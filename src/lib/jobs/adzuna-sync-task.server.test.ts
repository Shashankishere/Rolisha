import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, type FakeSupabase } from "./__tests__/fake-supabase";
import { runAdzunaSyncTask, getSyncHistory } from "@/lib/jobs/adzuna-sync-task.server";
import { USER_A, USER_B } from "./__tests__/fixtures";

const SKILL_SQL = "skill-sql";
const CAREER_DATA_ANALYST = "career-data-analyst";

function seedCatalog(fake: FakeSupabase) {
  fake.seed("skills", [{ id: SKILL_SQL, name: "SQL", aliases: [] }]);
  fake.seed("careers", [
    {
      id: CAREER_DATA_ANALYST,
      slug: "data-analyst",
      title: "Data Analyst",
      short_description: "Turn raw data into decisions with SQL.",
      description: "Data Analysts use SQL.",
    },
  ]);
  fake.seed("career_skills", [{ career_id: CAREER_DATA_ANALYST, skill_id: SKILL_SQL }]);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const ORIGINAL_ENV = { ...process.env };
function setConfigEnv() {
  process.env["ADZUNA_APP_ID"] = "test-app-id-value";
  process.env["ADZUNA_APP_KEY"] = "test-app-key-value";
}

let fetchMock: ReturnType<typeof vi.fn>;
let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  logSpy.mockRestore();
  errorSpy.mockRestore();
  process.env = { ...ORIGINAL_ENV };
});

function allLoggedText(): string {
  const fromCalls = (spy: ReturnType<typeof vi.spyOn>) =>
    spy.mock.calls.map((args) => args.map(String).join(" ")).join("\n");
  return `${fromCalls(logSpy)}\n${fromCalls(errorSpy)}`;
}

describe("runAdzunaSyncTask", () => {
  it("fails safely with no fabricated data when Adzuna credentials are missing", async () => {
    delete process.env["ADZUNA_APP_ID"];
    delete process.env["ADZUNA_APP_KEY"];
    delete process.env["ADZUNA_API_KEY"];
    const fake = createFakeSupabase();
    seedCatalog(fake);

    const summary = await runAdzunaSyncTask(fake, { trigger: "scheduled" });

    expect(summary.status).toBe("failed");
    expect(summary.errorMessage).toMatch(/not configured/i);
    expect(fake.table("jobs")).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
    const run = fake.table("job_sync_runs")[0]!;
    expect(run["status"]).toBe("failed");
    expect(run["trigger"]).toBe("scheduled");
  });

  it("on success: ingests real jobs through the existing pipeline and records a success run", async () => {
    setConfigEnv();
    const fake = createFakeSupabase();
    seedCatalog(fake);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        results: [{ id: 1, title: "Data Analyst", company: { display_name: "Globex" } }],
        count: 1,
      }),
    );

    const summary = await runAdzunaSyncTask(fake, { trigger: "scheduled", maxJobs: 5 });

    expect(summary.status).toBe("success");
    expect(summary.inserted).toBe(1);
    expect(fake.table("jobs")).toHaveLength(1);
    expect(fake.table("jobs")[0]).toMatchObject({ title: "Data Analyst", is_demo: false });
    const run = fake.table("job_sync_runs").find((r) => r["status"] === "success")!;
    expect(run["inserted_count"]).toBe(1);
    expect(run["completed_at"]).toBeTruthy();
  });

  it("on provider failure: records a failed run and leaves existing jobs untouched", async () => {
    setConfigEnv();
    const fake = createFakeSupabase();
    seedCatalog(fake);
    fake.seed("job_sources", [
      { id: "src-adzuna", slug: "adzuna", name: "Adzuna", is_demo: false },
    ]);
    fake.seed("jobs", [
      {
        id: "existing-1",
        source_id: "src-adzuna",
        external_id: "999",
        title: "Existing Real Job",
        is_demo: false,
        is_active: true,
        last_seen_at: new Date().toISOString(),
      },
    ]);
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "invalid app_id or app_key" }, 401));

    const summary = await runAdzunaSyncTask(fake, { trigger: "scheduled", maxJobs: 5 });

    expect(summary.status).toBe("failed");
    // The pre-existing job is completely untouched -- no deletion, no
    // corruption, no fabricated replacement.
    expect(fake.table("jobs")).toHaveLength(1);
    expect(fake.table("jobs")[0]).toMatchObject({ id: "existing-1", title: "Existing Real Job" });
    const run = fake.table("job_sync_runs").find((r) => r["status"] === "failed")!;
    expect(run["error_message"]).toBeTruthy();
  });

  it("empty provider response does not delete existing jobs", async () => {
    setConfigEnv();
    const fake = createFakeSupabase();
    seedCatalog(fake);
    fake.seed("job_sources", [
      { id: "src-adzuna", slug: "adzuna", name: "Adzuna", is_demo: false },
    ]);
    fake.seed("jobs", [
      {
        id: "existing-1",
        source_id: "src-adzuna",
        external_id: "999",
        title: "Existing Real Job",
        is_demo: false,
        is_active: true,
        last_seen_at: new Date().toISOString(),
      },
    ]);
    fetchMock.mockResolvedValueOnce(jsonResponse({ results: [], count: 0 }));

    const summary = await runAdzunaSyncTask(fake, { trigger: "scheduled", maxJobs: 5 });

    expect(summary.status).toBe("success");
    expect(summary.fetched).toBe(0);
    expect(fake.table("jobs")).toHaveLength(1);
    expect(fake.table("jobs")[0]).toMatchObject({ id: "existing-1" });
  });

  it("demo jobs remain demo and are never touched by a live sync", async () => {
    setConfigEnv();
    const fake = createFakeSupabase();
    seedCatalog(fake);
    fake.seed("job_sources", [
      { id: "src-demo", slug: "demo-sample", name: "Demo", is_demo: true },
      { id: "src-adzuna", slug: "adzuna", name: "Adzuna", is_demo: false },
    ]);
    fake.seed("jobs", [
      {
        id: "demo-1",
        source_id: "src-demo",
        external_id: null,
        title: "Demo Job",
        is_demo: true,
        is_active: true,
      },
    ]);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        results: [{ id: 1, title: "Real Job", company: { display_name: "Acme" } }],
        count: 1,
      }),
    );

    await runAdzunaSyncTask(fake, { trigger: "scheduled", maxJobs: 5 });

    const demoJob = fake.table("jobs").find((j) => j["id"] === "demo-1")!;
    expect(demoJob["is_demo"]).toBe(true);
    expect(demoJob["is_active"]).toBe(true);
    const realJob = fake.table("jobs").find((j) => j["title"] === "Real Job")!;
    expect(realJob["is_demo"]).toBe(false);
  });

  it("marks jobs from this source inactive when they haven't been seen recently, without deleting them", async () => {
    setConfigEnv();
    const fake = createFakeSupabase();
    seedCatalog(fake);
    const longAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago
    fake.seed("job_sources", [
      { id: "src-adzuna", slug: "adzuna", name: "Adzuna", is_demo: false },
    ]);
    fake.seed("jobs", [
      {
        id: "stale-1",
        source_id: "src-adzuna",
        external_id: "stale-ext",
        title: "Stale Job",
        is_demo: false,
        is_active: true,
        last_seen_at: longAgo,
      },
    ]);
    fetchMock.mockResolvedValueOnce(jsonResponse({ results: [], count: 0 }));

    const summary = await runAdzunaSyncTask(fake, { trigger: "scheduled", maxJobs: 5 });

    expect(summary.deactivated).toBe(1);
    const staleJob = fake.table("jobs").find((j) => j["id"] === "stale-1")!;
    expect(staleJob["is_active"]).toBe(false);
    // Still present in the table -- never deleted.
    expect(fake.table("jobs")).toHaveLength(1);
  });

  it("never logs credential values, even on failure", async () => {
    process.env["ADZUNA_APP_ID"] = "super-secret-app-id-xyz";
    process.env["ADZUNA_APP_KEY"] = "super-secret-app-key-abc";
    const fake = createFakeSupabase();
    seedCatalog(fake);
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "bad credentials" }, 401));

    await runAdzunaSyncTask(fake, { trigger: "scheduled", maxJobs: 5 });

    const logged = allLoggedText();
    expect(logged).not.toContain("super-secret-app-id-xyz");
    expect(logged).not.toContain("super-secret-app-key-abc");
  });

  it("distinguishes scheduled, manual, and cron_http triggers in the recorded run", async () => {
    setConfigEnv();
    const fake = createFakeSupabase();
    seedCatalog(fake);
    fetchMock.mockResolvedValue(jsonResponse({ results: [], count: 0 }));

    await runAdzunaSyncTask(fake, { trigger: "manual" });
    await runAdzunaSyncTask(fake, { trigger: "cron_http" });

    const triggers = fake.table("job_sync_runs").map((r) => r["trigger"]);
    expect(triggers).toEqual(["manual", "cron_http"]);
  });
});

describe("getSyncHistory", () => {
  it("rejects a non-admin caller before touching job_sync_runs at all", async () => {
    const fake = createFakeSupabase();
    fake.seed("user_roles", [{ user_id: USER_B, role: "member" }]);
    await expect(getSyncHistory(fake, USER_B)).rejects.toThrow(/forbidden/i);
  });

  it("returns available:true with an empty list when no syncs have run yet (genuinely empty, not an error)", async () => {
    const fake = createFakeSupabase();
    fake.seed("user_roles", [{ user_id: USER_A, role: "admin" }]);
    const result = await getSyncHistory(fake, USER_A);
    expect(result).toEqual({ available: true, runs: [], errorMessage: null });
  });

  it("returns available:true with mapped rows when sync runs exist", async () => {
    const fake = createFakeSupabase();
    fake.seed("user_roles", [{ user_id: USER_A, role: "admin" }]);
    fake.seed("job_sync_runs", [
      {
        id: "run-1",
        provider: "adzuna",
        trigger: "manual",
        status: "success",
        started_at: "2026-08-30T00:00:00Z",
        completed_at: "2026-08-30T00:00:05Z",
        fetched_count: 10,
        inserted_count: 3,
        updated_count: 7,
        skipped_count: 0,
        failed_count: 0,
        deactivated_count: 1,
        error_message: null,
      },
    ]);
    const result = await getSyncHistory(fake, USER_A);
    expect(result.available).toBe(true);
    expect(result.runs).toHaveLength(1);
    expect(result.runs[0]).toMatchObject({ id: "run-1", insertedCount: 3, deactivatedCount: 1 });
  });

  it("degrades gracefully (available:false, actionable message) instead of throwing when the query itself fails — e.g. the migration hasn't been applied yet", async () => {
    const fake = createFakeSupabase();
    fake.seed("user_roles", [{ user_id: USER_A, role: "admin" }]);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const failingClient = {
      from(table: string) {
        if (table === "job_sync_runs") {
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  limit: () =>
                    Promise.resolve({
                      data: null,
                      error: { message: 'relation "job_sync_runs" does not exist' },
                    }),
                }),
              }),
            }),
          };
        }
        return fake.from(table);
      },
    };

    try {
      const result = await getSyncHistory(failingClient, USER_A);
      expect(result.available).toBe(false);
      expect(result.runs).toEqual([]);
      expect(result.errorMessage).toMatch(/unable to load ingestion history/i);
      // The raw Postgres error text must never reach the returned result.
      expect(result.errorMessage).not.toContain("relation");
      expect(result.errorMessage).not.toContain("does not exist");
    } finally {
      errorSpy.mockRestore();
    }
  });
});
