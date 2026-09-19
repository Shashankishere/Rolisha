import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, type FakeSupabase } from "./__tests__/fake-supabase";
import {
  ensureFreshJobsForSearch,
  getRecentLiveSearches,
  LIVE_SEARCH_COOLDOWN_MS,
  MIN_FRESH_RESULTS_BEFORE_LIVE_SEARCH,
} from "@/lib/jobs/dynamic-search.server";

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
  process.env["ADZUNA_APP_ID"] = "test-app-id";
  process.env["ADZUNA_APP_KEY"] = "test-app-key";
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

describe("ensureFreshJobsForSearch", () => {
  it("does not call Adzuna when Supabase already has enough fresh matches", async () => {
    setConfigEnv();
    const fake = createFakeSupabase();
    seedCatalog(fake);

    const outcome = await ensureFreshJobsForSearch(fake, {
      query: "Data Analyst",
      location: "Bengaluru",
      country: "in",
      existingMatchCount: MIN_FRESH_RESULTS_BEFORE_LIVE_SEARCH,
    });

    expect(outcome.triggered).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls Adzuna when Supabase has no matching jobs at all", async () => {
    setConfigEnv();
    const fake = createFakeSupabase();
    seedCatalog(fake);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        results: [{ id: 1, title: "Data Analyst", company: { display_name: "Acme" } }],
        count: 1,
      }),
    );

    const outcome = await ensureFreshJobsForSearch(fake, {
      query: "Data Analyst",
      location: "Bengaluru",
      country: "in",
      existingMatchCount: 0,
    });

    expect(outcome.triggered).toBe(true);
    expect(outcome.jobsFound).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fake.table("jobs")).toHaveLength(1);
    expect(fake.table("jobs")[0]).toMatchObject({ title: "Data Analyst", is_demo: false });
  });

  it("calls Adzuna when Supabase has some but insufficient fresh matches", async () => {
    setConfigEnv();
    const fake = createFakeSupabase();
    seedCatalog(fake);
    fetchMock.mockResolvedValueOnce(jsonResponse({ results: [], count: 0 }));

    const outcome = await ensureFreshJobsForSearch(fake, {
      query: "Data Analyst",
      location: "Mumbai",
      country: "in",
      existingMatchCount: MIN_FRESH_RESULTS_BEFORE_LIVE_SEARCH - 1,
    });

    expect(outcome.triggered).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not call Adzuna for a fully empty search (no query, no location)", async () => {
    setConfigEnv();
    const fake = createFakeSupabase();
    seedCatalog(fake);

    const outcome = await ensureFreshJobsForSearch(fake, {
      query: "",
      location: "",
      country: "in",
      existingMatchCount: 0,
    });

    expect(outcome.triggered).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Adzuna returns zero results: no fake jobs are inserted, and it's still a successful (not failed) outcome", async () => {
    setConfigEnv();
    const fake = createFakeSupabase();
    seedCatalog(fake);
    fetchMock.mockResolvedValueOnce(jsonResponse({ results: [], count: 0 }));

    const outcome = await ensureFreshJobsForSearch(fake, {
      query: "Underwater Basket Weaver",
      location: "Nowhere",
      country: "in",
      existingMatchCount: 0,
    });

    expect(outcome.triggered).toBe(true);
    expect(outcome.jobsFound).toBe(0);
    expect(outcome.errorMessage).toBeNull();
    expect(fake.table("jobs")).toHaveLength(0);
  });

  it("Adzuna failure: existing jobs are untouched and no fake data is inserted", async () => {
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

    const outcome = await ensureFreshJobsForSearch(fake, {
      query: "Data Analyst",
      location: "Delhi",
      country: "in",
      existingMatchCount: 0,
    });

    expect(outcome.triggered).toBe(true);
    expect(outcome.errorMessage).toBeTruthy();
    expect(fake.table("jobs")).toHaveLength(1);
    expect(fake.table("jobs")[0]).toMatchObject({ id: "existing-1" });
  });

  it("does not leak credential values in logs, even on failure", async () => {
    process.env["ADZUNA_APP_ID"] = "super-secret-id-123";
    process.env["ADZUNA_APP_KEY"] = "super-secret-key-456";
    const fake = createFakeSupabase();
    seedCatalog(fake);
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "bad credentials" }, 401));

    await ensureFreshJobsForSearch(fake, {
      query: "Data Analyst",
      location: "Pune",
      country: "in",
      existingMatchCount: 0,
    });

    const logged = [...logSpy.mock.calls, ...errorSpy.mock.calls]
      .map((args) => args.join(" "))
      .join("\n");
    expect(logged).not.toContain("super-secret-id-123");
    expect(logged).not.toContain("super-secret-key-456");
  });

  it("rate limiting: an identical search within the cooldown window does not call Adzuna again", async () => {
    setConfigEnv();
    const fake = createFakeSupabase();
    seedCatalog(fake);
    fetchMock.mockResolvedValue(jsonResponse({ results: [], count: 0 }));

    const first = await ensureFreshJobsForSearch(fake, {
      query: "Data Analyst",
      location: "Hyderabad",
      country: "in",
      existingMatchCount: 0,
    });
    const second = await ensureFreshJobsForSearch(fake, {
      query: "Data Analyst",
      location: "Hyderabad",
      country: "in",
      existingMatchCount: 0,
    });

    expect(first.triggered).toBe(true);
    expect(second.triggered).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("different locations for the same role trigger independent searches", async () => {
    setConfigEnv();
    const fake = createFakeSupabase();
    seedCatalog(fake);
    fetchMock.mockResolvedValue(jsonResponse({ results: [], count: 0 }));

    const bengaluru = await ensureFreshJobsForSearch(fake, {
      query: "Data Analyst",
      location: "Bengaluru",
      country: "in",
      existingMatchCount: 0,
    });
    const mumbai = await ensureFreshJobsForSearch(fake, {
      query: "Data Analyst",
      location: "Mumbai",
      country: "in",
      existingMatchCount: 0,
    });
    const delhi = await ensureFreshJobsForSearch(fake, {
      query: "Data Analyst",
      location: "Delhi",
      country: "in",
      existingMatchCount: 0,
    });

    expect(bengaluru.triggered).toBe(true);
    expect(mumbai.triggered).toBe(true);
    expect(delhi.triggered).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fake.table("job_live_searches")).toHaveLength(3);
  });

  it("different roles for the same location trigger independent searches", async () => {
    setConfigEnv();
    const fake = createFakeSupabase();
    seedCatalog(fake);
    fetchMock.mockResolvedValue(jsonResponse({ results: [], count: 0 }));

    const swe = await ensureFreshJobsForSearch(fake, {
      query: "Software Engineer",
      location: "Hyderabad",
      country: "in",
      existingMatchCount: 0,
    });
    const frontend = await ensureFreshJobsForSearch(fake, {
      query: "Frontend Developer",
      location: "Pune",
      country: "in",
      existingMatchCount: 0,
    });

    expect(swe.triggered).toBe(true);
    expect(frontend.triggered).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("a search allowed again after the cooldown window has passed calls Adzuna again", async () => {
    setConfigEnv();
    const fake = createFakeSupabase();
    seedCatalog(fake);
    fetchMock.mockResolvedValue(jsonResponse({ results: [], count: 0 }));

    await ensureFreshJobsForSearch(fake, {
      query: "Data Analyst",
      location: "Chennai",
      country: "in",
      existingMatchCount: 0,
    });
    // Simulate the cooldown having elapsed by rewinding the recorded timestamp.
    const row = fake.table("job_live_searches")[0]!;
    row["searched_at"] = new Date(Date.now() - LIVE_SEARCH_COOLDOWN_MS - 1000).toISOString();

    const outcome = await ensureFreshJobsForSearch(fake, {
      query: "Data Analyst",
      location: "Chennai",
      country: "in",
      existingMatchCount: 0,
    });

    expect(outcome.triggered).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("the same Adzuna job returned by two separate on-demand searches does not create a duplicate", async () => {
    setConfigEnv();
    const fake = createFakeSupabase();
    seedCatalog(fake);
    const sameJob = {
      results: [{ id: 42, title: "Data Analyst", company: { display_name: "Globex" } }],
      count: 1,
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(sameJob));

    await ensureFreshJobsForSearch(fake, {
      query: "Data Analyst",
      location: "Kolkata",
      country: "in",
      existingMatchCount: 0,
    });
    // Rewind the cooldown so a second on-demand search for the same query is
    // actually allowed to hit Adzuna again (simulating two different users
    // searching the same thing on different days).
    const row = fake.table("job_live_searches")[0]!;
    row["searched_at"] = new Date(Date.now() - LIVE_SEARCH_COOLDOWN_MS - 1000).toISOString();
    fetchMock.mockResolvedValueOnce(jsonResponse(sameJob));

    await ensureFreshJobsForSearch(fake, {
      query: "Data Analyst",
      location: "Kolkata",
      country: "in",
      existingMatchCount: 0,
    });

    expect(fake.table("jobs")).toHaveLength(1);
  });

  it("scheduled/manual ingestion and an on-demand search can safely process the same job without duplicating it", async () => {
    setConfigEnv();
    const fake = createFakeSupabase();
    seedCatalog(fake);
    const { ingestJobs } = await import("@/lib/jobs/ingest.server");
    const { AdzunaJobSourceAdapter } = await import("@/lib/jobs/adzuna-adapter.server");

    // A prior scheduled/manual sync already ingested this job.
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        results: [{ id: 7, title: "Data Analyst", company: { display_name: "Initech" } }],
        count: 1,
      }),
    );
    await ingestJobs(fake, new AdzunaJobSourceAdapter("id", "key", { maxJobs: 5 }));
    expect(fake.table("jobs")).toHaveLength(1);

    // The same job comes back through an on-demand search.
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        results: [{ id: 7, title: "Data Analyst", company: { display_name: "Initech" } }],
        count: 1,
      }),
    );
    await ensureFreshJobsForSearch(fake, {
      query: "Data Analyst",
      location: "Noida",
      country: "in",
      existingMatchCount: 0,
    });

    expect(fake.table("jobs")).toHaveLength(1);
  });
});

describe("getRecentLiveSearches", () => {
  it("returns available:true with mapped entries", async () => {
    const fake = createFakeSupabase();
    fake.seed("job_live_searches", [
      {
        id: "ls-1",
        query_key: "data analyst|pune|in",
        query: "Data Analyst",
        location: "Pune",
        country: "in",
        jobs_found: 4,
        searched_at: "2026-09-01T00:00:00Z",
      },
    ]);
    const result = await getRecentLiveSearches(fake);
    expect(result.available).toBe(true);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({ query: "Data Analyst", jobsFound: 4 });
  });

  it("returns available:true with an empty list when the table exists but has no rows yet — this is NOT an error state (regression: admin panel must never show the generic failure message for a simply-empty history)", async () => {
    const fake = createFakeSupabase();
    // No rows seeded for job_live_searches at all.
    const result = await getRecentLiveSearches(fake);
    expect(result.available).toBe(true);
    expect(result.entries).toEqual([]);
    expect(result.errorMessage).toBeNull();
  });

  it("degrades gracefully instead of throwing when the query fails", async () => {
    const failingClient = {
      from: () => ({
        select: () => ({
          order: () => ({
            limit: () =>
              Promise.resolve({ data: null, error: { message: "relation does not exist" } }),
          }),
        }),
      }),
    };
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = await getRecentLiveSearches(failingClient);
      expect(result.available).toBe(false);
      expect(result.entries).toEqual([]);
      expect(result.errorMessage).toMatch(/unable to load/i);
    } finally {
      errSpy.mockRestore();
    }
  });
});
