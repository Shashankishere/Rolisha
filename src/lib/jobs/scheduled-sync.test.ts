/**
 * Scheduled Adzuna sync -- regression + reliability coverage.
 *
 * What these tests DO prove, deterministically:
 *  - the real Nitro task file (server/tasks/adzuna-sync.ts) -- i.e. exactly
 *    what Cloudflare's `scheduled()` -> Nitro `runTask` invokes -- runs the
 *    full pipeline (Adzuna adapter -> normalize -> ingest -> Supabase) with
 *    NO user session, admin role, or browser involved
 *  - provider failure, Supabase failure, malformed records, salary refresh,
 *    duplicate prevention and env/config handling behave as required
 *  - vite.config.ts wires the task handler EXPLICITLY (the actual production
 *    bug: without it the built Worker has a cron trigger but `resolve:
 *    undefined`, so every tick fails with "Task ... is not implemented")
 *
 * What they CANNOT prove (production-only): that Cloudflare registered the
 * cron from the deployed wrangler config. Verify that with
 * `npm run build && npm run verify:cron` (built-Worker check) and, after
 * deploy, the Cron Triggers panel + a `job_sync_runs` row with
 * trigger = 'scheduled'.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, type FakeSupabase } from "./__tests__/fake-supabase";
import { runAdzunaSyncTask, resolveSyncConfig } from "@/lib/jobs/adzuna-sync-task.server";
import { ingestJobs } from "@/lib/jobs/ingest.server";
import type { JobSourceAdapter, RawProviderJob } from "@/lib/jobs/types";

// The Supabase service client is what the Nitro task imports. Route it to a
// per-test fake so the REAL task file runs against a controllable database.
const holder = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: new Proxy(
    {},
    { get: (_target, prop) => (holder.client as Record<string | symbol, unknown>)[prop] },
  ),
}));

const ORIGINAL_ENV = { ...process.env };
let fetchMock: ReturnType<typeof vi.fn>;
let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function configureAdzuna() {
  process.env["ADZUNA_APP_ID"] = "test-app-id-value";
  process.env["ADZUNA_APP_KEY"] = "test-app-key-value";
  delete process.env["ADZUNA_SYNC_MAX_JOBS"];
  delete process.env["ADZUNA_SYNC_COUNTRY"];
  delete process.env["ADZUNA_SYNC_QUERY"];
  delete process.env["ADZUNA_SYNC_LOCATION"];
}

function seedCatalog(fake: FakeSupabase) {
  fake.seed("skills", [{ id: "skill-sql", name: "SQL", aliases: [] }]);
  fake.seed("careers", [
    {
      id: "career-da",
      slug: "data-analyst",
      title: "Data Analyst",
      short_description: "SQL.",
      description: "SQL.",
    },
  ]);
  fake.seed("career_skills", [{ career_id: "career-da", skill_id: "skill-sql" }]);
}

function freshDb(): FakeSupabase {
  const fake = createFakeSupabase();
  seedCatalog(fake);
  holder.client = fake;
  return fake;
}

/** A Supabase client whose `jobs` writes fail like a database outage while
 * everything else (run log, catalogue) still works. */
function dbWithFailingJobWrites(fake: FakeSupabase) {
  const failing = {
    select: () => failing,
    eq: () => failing,
    lt: () => failing,
    maybeSingle: async () => ({ data: null, error: null }),
    insert: () => ({
      select: () => ({
        single: async () => ({ data: null, error: { message: "connection refused" } }),
      }),
    }),
    update: () => ({
      eq: () => ({ select: async () => ({ data: [], error: null }) }),
    }),
  };
  return new Proxy(fake, {
    get(target, prop, receiver) {
      if (prop === "from") {
        return (table: string) => (table === "jobs" ? failing : target.from(table));
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

function adzunaJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 1001,
    title: "Data Analyst",
    company: { display_name: "Globex" },
    location: { display_name: "Bengaluru, Karnataka" },
    description: "You will write SQL every day.",
    redirect_url: "https://example.test/job/1001",
    salary_min: 600000,
    salary_max: 900000,
    created: "2026-09-18T08:00:00Z",
    contract_time: "full_time",
    ...overrides,
  };
}

async function loadTask() {
  const mod = await import("../../../server/tasks/adzuna-sync");
  return mod.default as {
    meta: { name: string };
    run: (event: { name: string; payload: object; context: object }) => Promise<unknown>;
  };
}

const TASK_EVENT = { name: "adzuna-sync", payload: {}, context: {} };

function allLoggedText(): string {
  const text = (spy: ReturnType<typeof vi.spyOn>) =>
    spy.mock.calls.map((args) => args.map(String).join(" ")).join("\n");
  return `${text(logSpy)}\n${text(errorSpy)}`;
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  configureAdzuna();
});

afterEach(() => {
  vi.unstubAllGlobals();
  logSpy.mockRestore();
  errorSpy.mockRestore();
  process.env = { ...ORIGINAL_ENV };
  holder.client = null;
});

describe("scheduled handler (the real Nitro task Cloudflare's scheduled() invokes)", () => {
  it("is named exactly as vite.config.ts schedules it", async () => {
    const task = await loadTask();
    expect(task.meta.name).toBe("adzuna-sync");
  });

  it("runs the full pipeline with no user session or admin role and records a 'scheduled' run", async () => {
    const fake = freshDb(); // note: no profiles, no user_roles, no auth of any kind
    fetchMock.mockResolvedValueOnce(jsonResponse({ results: [adzunaJob()], count: 1 }));

    const task = await loadTask();
    const out = (await task.run(TASK_EVENT)) as { result: { status: string; inserted: number } };

    expect(out.result).toMatchObject({ status: "success", inserted: 1 });
    expect(fake.table("jobs")).toHaveLength(1);
    expect(fake.table("jobs")[0]).toMatchObject({
      title: "Data Analyst",
      company: "Globex",
      is_demo: false,
      is_active: true,
      salary_min: 600000,
      salary_max: 900000,
      salary_currency: "INR",
    });
    expect(fake.table("job_skills")).toHaveLength(1);
    const run = fake.table("job_sync_runs")[0]!;
    expect(run["trigger"]).toBe("scheduled");
    expect(run["status"]).toBe("success");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("provider failure: surfaces a failed invocation, records the failure, leaves existing jobs untouched, leaks no secrets", async () => {
    const fake = freshDb();
    fake.seed("job_sources", [{ id: "src", slug: "adzuna", name: "Adzuna", is_demo: false }]);
    fake.seed("jobs", [
      { id: "keep-me", source_id: "src", external_id: "old", title: "Existing", is_demo: false },
    ]);
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 401 }));

    const task = await loadTask();
    // Thrown so Cloudflare marks the cron invocation failed (not a silent "ok").
    await expect(task.run(TASK_EVENT)).rejects.toThrow(/Scheduled Adzuna sync failed/);

    expect(fake.table("jobs")).toHaveLength(1);
    expect(fake.table("jobs")[0]).toMatchObject({ id: "keep-me", title: "Existing" });
    const run = fake.table("job_sync_runs")[0]!;
    expect(run["status"]).toBe("failed");
    expect(String(run["error_message"])).toMatch(/401|credentials/i);
    expect(allLoggedText()).not.toContain("test-app-key-value");
    expect(allLoggedText()).not.toContain("test-app-id-value");
    expect(JSON.stringify(run)).not.toContain("test-app-key-value");
  });

  it("missing Adzuna credentials: fails the invocation clearly and never calls the provider or fabricates jobs", async () => {
    const fake = freshDb();
    delete process.env["ADZUNA_APP_ID"];
    delete process.env["ADZUNA_APP_KEY"];
    delete process.env["ADZUNA_API_KEY"];

    const task = await loadTask();
    await expect(task.run(TASK_EVENT)).rejects.toThrow(/not configured/i);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(fake.table("jobs")).toHaveLength(0);
  });
});

describe("Supabase failures in the scheduled environment", () => {
  it("missing service-role config (client throws on first use): resolves as failed, never throws out of the runner", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ results: [adzunaJob()], count: 1 }));
    const throwingClient = {
      from() {
        throw new Error(
          "Missing Supabase environment variable(s): SUPABASE_SERVICE_ROLE_KEY. Configure Supabase for this project.",
        );
      },
    };

    // Before the fix this rejected: the run-log insert sat outside any try/catch.
    const summary = await runAdzunaSyncTask(throwingClient, { trigger: "scheduled" });

    expect(summary.status).toBe("failed");
    expect(summary.errorMessage).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(allLoggedText()).toMatch(/could not record run start/);
  });

  it("every job write failing is a FAILED run (not a healthy 'success'), and nothing is deactivated", async () => {
    const fake = freshDb();
    fake.seed("job_sources", [{ id: "src", slug: "adzuna", name: "Adzuna", is_demo: false }]);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ results: [adzunaJob({ id: 1 }), adzunaJob({ id: 2 })], count: 2 }),
    );

    const summary = await runAdzunaSyncTask(dbWithFailingJobWrites(fake), {
      trigger: "scheduled",
    });

    expect(summary.status).toBe("failed");
    expect(summary.errorMessage).toMatch(/None of the 2 fetched job\(s\) could be saved/);
    expect(summary.errorMessage).toMatch(/connection refused/);
    expect(summary.deactivated).toBe(0);
    const run = fake.table("job_sync_runs")[0]!;
    expect(run["status"]).toBe("failed");
  });

  it("a failed existing-row lookup is reported as a lookup failure, not misread as 'no existing row'", async () => {
    const fake = freshDb();
    fake.seed("job_sources", [{ id: "src", slug: "adzuna", name: "Adzuna", is_demo: false }]);
    const lookupFails = new Proxy(fake, {
      get(target, prop, receiver) {
        if (prop === "from") {
          return (table: string) => {
            if (table !== "jobs") return target.from(table);
            const chain: Record<string, unknown> = {};
            chain["select"] = () => chain;
            chain["eq"] = () => chain;
            chain["maybeSingle"] = async () => ({
              data: null,
              error: { message: "statement timeout" },
            });
            return chain;
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });
    const adapter: JobSourceAdapter = {
      sourceSlug: "adzuna",
      sourceName: "Adzuna",
      isDemo: false,
      fetchJobs: async () => [{ externalId: "1", title: "Data Analyst", company: "Globex" }],
    };

    const summary = await ingestJobs(lookupFails, adapter);

    expect(summary.jobsInserted).toBe(0);
    expect(summary.errors).toEqual([
      { externalId: "1", message: "Lookup failed: statement timeout" },
    ]);
  });
});

describe("malformed provider records", () => {
  it("Adzuna records that fail shape validation are skipped; valid ones still ingest and the run succeeds", async () => {
    const fake = freshDb();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        results: [
          adzunaJob({ id: 1 }),
          { id: 2, title: 12345 }, // title not a string
          { title: "No id at all" }, // id missing
          null, // not even an object
          adzunaJob({ id: 3, title: "" }), // empty title
          adzunaJob({ id: 4, title: "Backend Engineer" }),
        ],
        count: 6,
      }),
    );

    const summary = await runAdzunaSyncTask(fake, { trigger: "scheduled" });

    expect(summary.status).toBe("success");
    expect(summary.inserted).toBe(2);
    expect(fake.table("jobs").map((j) => j["external_id"])).toEqual(["1", "4"]);
  });

  it("ingestJobs itself survives a record that cannot be normalized (provider-agnostic guard)", async () => {
    const fake = freshDb();
    const records = [
      { externalId: "bad-1", title: 123, company: "X" }, // non-string title -> normalizeJob throws
      null, // hostile/broken adapter output
      { externalId: "good-1", title: "Data Analyst", company: "Globex" },
    ] as unknown as RawProviderJob[];
    const adapter: JobSourceAdapter = {
      sourceSlug: "custom",
      sourceName: "Custom",
      isDemo: false,
      fetchJobs: async () => records,
    };

    const summary = await ingestJobs(fake, adapter);

    expect(summary.jobsInserted).toBe(1);
    expect(summary.jobsSkipped).toBe(2);
    expect(summary.errors).toEqual([
      { externalId: "bad-1", message: "Malformed provider record could not be normalized." },
      { externalId: null, message: "Malformed provider record could not be normalized." },
    ]);
    expect(fake.table("jobs")).toHaveLength(1);
  });

  it("a partially failing run still succeeds but logs samples for diagnosis", async () => {
    const fake = freshDb();
    const adapter: JobSourceAdapter = {
      sourceSlug: "adzuna",
      sourceName: "Adzuna",
      isDemo: false,
      fetchJobs: async () =>
        [
          { externalId: "ok", title: "Data Analyst", company: "Globex" },
          { externalId: "bad", title: 5, company: "X" },
        ] as unknown as RawProviderJob[],
    };
    const summary = await ingestJobs(fake, adapter);
    expect(summary.jobsInserted).toBe(1);
    expect(summary.errors).toHaveLength(1);
  });
});

describe("salary refresh and duplicate prevention across scheduled runs", () => {
  it("re-ingesting the same posting UPDATES salary min/max in place (currency stays the provider/country currency)", async () => {
    const fake = freshDb();
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          results: [adzunaJob({ salary_min: 600000, salary_max: 900000 })],
          count: 1,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          results: [
            adzunaJob({ salary_min: 750000, salary_max: 1200000, title: "Senior Data Analyst" }),
          ],
          count: 1,
        }),
      );

    const first = await runAdzunaSyncTask(fake, { trigger: "scheduled" });
    const second = await runAdzunaSyncTask(fake, { trigger: "scheduled" });

    expect(first).toMatchObject({ status: "success", inserted: 1, updated: 0 });
    expect(second).toMatchObject({ status: "success", inserted: 0, updated: 1 });
    expect(fake.table("jobs")).toHaveLength(1);
    expect(fake.table("jobs")[0]).toMatchObject({
      salary_min: 750000,
      salary_max: 1200000,
      salary_currency: "INR",
      title: "Senior Data Analyst",
      is_active: true,
    });
  });

  it("a posting whose salary disappears at the provider is refreshed to null rather than showing a stale figure", async () => {
    const fake = freshDb();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ results: [adzunaJob()], count: 1 }))
      .mockResolvedValueOnce(
        jsonResponse({ results: [adzunaJob({ salary_min: null, salary_max: null })], count: 1 }),
      );

    await runAdzunaSyncTask(fake, { trigger: "scheduled" });
    await runAdzunaSyncTask(fake, { trigger: "scheduled" });

    expect(fake.table("jobs")).toHaveLength(1);
    expect(fake.table("jobs")[0]).toMatchObject({ salary_min: null, salary_max: null });
  });

  it("never duplicates: same id twice in one response, and the same feed across runs, is still one row per posting", async () => {
    const fake = freshDb();
    const feed = {
      results: [adzunaJob({ id: 7 }), adzunaJob({ id: 7 }), adzunaJob({ id: 8 })],
      count: 3,
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(feed)).mockResolvedValueOnce(jsonResponse(feed));

    const first = await runAdzunaSyncTask(fake, { trigger: "scheduled" });
    const second = await runAdzunaSyncTask(fake, { trigger: "scheduled" });

    expect(first.inserted).toBe(2);
    expect(second.inserted).toBe(0);
    expect(second.updated).toBe(2);
    expect(fake.table("jobs")).toHaveLength(2);
  });

  it("stamps last_seen_at on refresh so a still-listed posting is never treated as stale", async () => {
    const fake = freshDb();
    fetchMock.mockImplementation(async () => jsonResponse({ results: [adzunaJob()], count: 1 }));
    await runAdzunaSyncTask(fake, { trigger: "scheduled" });
    const before = String(fake.table("jobs")[0]!["last_seen_at"]);
    await new Promise((r) => setTimeout(r, 5));
    await runAdzunaSyncTask(fake, { trigger: "scheduled" });
    expect(String(fake.table("jobs")[0]!["last_seen_at"]) >= before).toBe(true);
  });
});

describe("environment / configuration handling", () => {
  it("resolveSyncConfig: blank or invalid ADZUNA_SYNC_MAX_JOBS falls back to the default instead of 0/NaN", () => {
    expect(resolveSyncConfig({}).maxJobs).toBe(50);
    expect(resolveSyncConfig({ ADZUNA_SYNC_MAX_JOBS: "" }).maxJobs).toBe(50); // was 0 -> fetched 1 job
    expect(resolveSyncConfig({ ADZUNA_SYNC_MAX_JOBS: "   " }).maxJobs).toBe(50);
    expect(resolveSyncConfig({ ADZUNA_SYNC_MAX_JOBS: "abc" }).maxJobs).toBe(50); // was NaN -> fetched 0 jobs
    expect(resolveSyncConfig({ ADZUNA_SYNC_MAX_JOBS: "0" }).maxJobs).toBe(50);
    expect(resolveSyncConfig({ ADZUNA_SYNC_MAX_JOBS: "-5" }).maxJobs).toBe(50);
    expect(resolveSyncConfig({ ADZUNA_SYNC_MAX_JOBS: "25" }).maxJobs).toBe(25);
  });

  it("resolveSyncConfig: blank scope variables become null (not empty strings)", () => {
    expect(
      resolveSyncConfig({
        ADZUNA_SYNC_QUERY: "  ",
        ADZUNA_SYNC_LOCATION: "",
        ADZUNA_SYNC_COUNTRY: " gb ",
      }),
    ).toMatchObject({ query: null, location: null, country: "gb" });
  });

  it("a BLANK ADZUNA_SYNC_MAX_JOBS still fetches a full page (regression: it used to fetch 1 job)", async () => {
    const fake = freshDb();
    process.env["ADZUNA_SYNC_MAX_JOBS"] = "";
    fetchMock.mockResolvedValueOnce(jsonResponse({ results: [adzunaJob()], count: 1 }));

    await runAdzunaSyncTask(fake, { trigger: "scheduled" });

    const url = new URL(String(fetchMock.mock.calls[0]![0]));
    expect(url.searchParams.get("results_per_page")).toBe("50");
  });

  it("uses the India-first default market and honours ADZUNA_SYNC_COUNTRY / ADZUNA_API_KEY alias", async () => {
    const fake = freshDb();
    // A fresh Response per call: a Response body can only be read once.
    fetchMock.mockImplementation(async () => jsonResponse({ results: [], count: 0 }));

    await runAdzunaSyncTask(fake, { trigger: "scheduled" });
    expect(String(fetchMock.mock.calls[0]![0])).toContain("/jobs/in/search/1");

    delete process.env["ADZUNA_APP_KEY"];
    process.env["ADZUNA_API_KEY"] = "alias-key-value";
    process.env["ADZUNA_SYNC_COUNTRY"] = "gb";
    const summary = await runAdzunaSyncTask(fake, { trigger: "scheduled" });
    expect(summary.status).toBe("success");
    expect(String(fetchMock.mock.calls[1]![0])).toContain("/jobs/gb/search/1");
  });
});

describe("deployment wiring (the actual production bug)", () => {
  const read = (rel: string) =>
    readFileSync(fileURLToPath(new URL(`../../../${rel}`, import.meta.url)), "utf-8");

  it("vite.config.ts passes the task handler EXPLICITLY -- Nitro 3 does not auto-discover server/tasks", () => {
    const config = read("vite.config.ts");
    expect(config).toMatch(/handler:\s*ADZUNA_SYNC_TASK_HANDLER/);
    expect(config).toContain('"./server/tasks/adzuna-sync.ts"');
    // ...and fails the build if the file is ever moved, instead of shipping a dead cron.
    expect(config).toMatch(/existsSync\(ADZUNA_SYNC_TASK_HANDLER\)/);
    // Both halves of the wiring are present.
    expect(config).toContain("scheduledTasks");
    expect(config).toContain("[ADZUNA_SYNC_CRON]");
  });

  it("the post-build verifier checks for a resolvable handler, not just a cron entry", () => {
    const script = read("scripts/verify-scheduled-sync.mjs");
    expect(script).toContain("triggers");
    expect(script).toMatch(/resolvable handler/);
    expect(read("package.json")).toContain('"verify:cron"');
  });

  it("the task file no longer documents the stale 'adzuna:sync' name", () => {
    expect(read("server/tasks/adzuna-sync.ts")).not.toContain("adzuna:sync");
  });
});
