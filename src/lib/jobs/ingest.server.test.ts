import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdzunaJobSourceAdapter } from "@/lib/jobs/adzuna-adapter.server";
import { ingestJobs, removeDemoJobs } from "@/lib/jobs/ingest.server";
import { ManualJobSourceAdapter } from "@/lib/jobs/manual-adapter";
import type { JobSourceAdapter, RawProviderJob } from "@/lib/jobs/types";
import { createFakeSupabase, type FakeSupabase } from "./__tests__/fake-supabase";

const SKILL_SQL = "skill-sql";
const SKILL_EXCEL = "skill-excel";

const CAREER_DATA_ANALYST = "career-data-analyst";

function seedCatalog(fake: FakeSupabase) {
  fake.seed("skills", [
    { id: SKILL_SQL, name: "SQL", aliases: [] },
    { id: SKILL_EXCEL, name: "Excel", aliases: [] },
  ]);
  fake.seed("careers", [
    {
      id: CAREER_DATA_ANALYST,
      slug: "data-analyst",
      title: "Data Analyst",
      short_description: "Turn raw data into decisions with SQL and Excel dashboards.",
      description: "Data Analysts use SQL and Excel to interpret data.",
    },
  ]);
  fake.seed("career_skills", [
    { career_id: CAREER_DATA_ANALYST, skill_id: SKILL_SQL },
    { career_id: CAREER_DATA_ANALYST, skill_id: SKILL_EXCEL },
  ]);
}

function manualAdapter(jobs: RawProviderJob[]) {
  return new ManualJobSourceAdapter({
    sourceSlug: "manual-test",
    sourceName: "Manual Test Source",
    jobs,
  });
}

describe("ingestJobs — manual adapter (unchanged behavior)", () => {
  it("inserts a new job and extracts its skills", async () => {
    const fake = createFakeSupabase();
    seedCatalog(fake);
    const adapter = manualAdapter([
      {
        externalId: "ext-1",
        title: "Data Analyst",
        company: "Acme",
        description: "You will write SQL queries and build Excel dashboards.",
      },
    ]);

    const summary = await ingestJobs(fake, adapter);

    expect(summary.jobsReceived).toBe(1);
    expect(summary.jobsInserted).toBe(1);
    expect(summary.jobsSkipped).toBe(0);
    expect(summary.skillsExtracted).toBe(2);
    expect(fake.table("jobs")).toHaveLength(1);
    expect(fake.table("job_skills")).toHaveLength(2);
  });

  it("re-running ingestion for the same external id updates instead of duplicating", async () => {
    const fake = createFakeSupabase();
    seedCatalog(fake);
    const job: RawProviderJob = {
      externalId: "ext-1",
      title: "Data Analyst",
      company: "Acme",
      description: "SQL and Excel work.",
    };

    await ingestJobs(fake, manualAdapter([job]));
    const second = await ingestJobs(
      fake,
      manualAdapter([{ ...job, title: "Senior Data Analyst" }]),
    );

    expect(fake.table("jobs")).toHaveLength(1);
    expect(second.jobsInserted).toBe(0);
    expect(second.jobsUpdated).toBe(1);
    expect(fake.table("jobs")[0]?.["title"]).toBe("Senior Data Analyst");
  });

  it("dedupes postings without an external id within the same run", async () => {
    const fake = createFakeSupabase();
    seedCatalog(fake);
    const adapter = manualAdapter([
      { externalId: "", title: "Data Analyst", company: "Acme", location: "Remote" },
      { externalId: "", title: "Data Analyst", company: "Acme", location: "Remote" },
    ]);

    const summary = await ingestJobs(fake, adapter);
    expect(summary.jobsInserted).toBe(1);
    expect(summary.jobsSkipped).toBe(1);
  });

  it("processes multiple independent postings in one run without cross-contamination", async () => {
    const fake = createFakeSupabase();
    seedCatalog(fake);
    const adapter = manualAdapter([
      { externalId: "ext-1", title: "Data Analyst", company: "Acme" },
      { externalId: "ext-2", title: "Data Analyst", company: "Beta" },
    ]);
    const summary = await ingestJobs(fake, adapter);
    expect(summary.jobsInserted).toBe(2);
    expect(summary.errors).toHaveLength(0);
  });
});

describe("ingestJobs — demo/live separation", () => {
  class FakeDemoAdapter implements JobSourceAdapter {
    readonly sourceSlug = "manual-test";
    readonly sourceName = "Manual Test Source";
    readonly baseUrl = null;
    readonly isDemo = true;
    constructor(private jobs: RawProviderJob[]) {}
    async fetchJobs() {
      return this.jobs;
    }
  }

  it("never lets a demo re-ingestion overwrite a real (is_demo=false) job", async () => {
    const fake = createFakeSupabase();
    seedCatalog(fake);
    fake.seed("job_sources", [
      { id: "src-1", slug: "manual-test", name: "Manual Test Source", is_demo: false },
    ]);
    fake.seed("jobs", [
      {
        id: "job-1",
        source_id: "src-1",
        external_id: "ext-1",
        title: "Real Data Analyst Posting",
        company: "Acme",
        is_demo: false,
      },
    ]);

    const demoAdapter = new FakeDemoAdapter([
      { externalId: "ext-1", title: "Demo Overwrite Attempt", company: "Acme" },
    ]);

    const summary = await ingestJobs(fake, demoAdapter);
    expect(summary.jobsSkipped).toBe(1);
    expect(summary.jobsUpdated).toBe(0);
    expect(fake.table("jobs")[0]?.["title"]).toBe("Real Data Analyst Posting");
  });

  it("marks jobs is_demo=false when the adapter itself is not a demo source", async () => {
    const fake = createFakeSupabase();
    seedCatalog(fake);
    const adapter = manualAdapter([
      { externalId: "ext-1", title: "Data Analyst", company: "Acme" },
    ]);
    await ingestJobs(fake, adapter);
    expect(fake.table("jobs")[0]?.["is_demo"]).toBe(false);
  });
});

describe("ingestJobs — career classification wiring", () => {
  it("sets career_id on a confidently classifiable posting and counts it", async () => {
    const fake = createFakeSupabase();
    seedCatalog(fake);
    const adapter = manualAdapter([
      {
        externalId: "ext-1",
        title: "Data Analyst",
        company: "Acme",
        description: "You will write SQL queries and build Excel dashboards for stakeholders.",
      },
    ]);

    const summary = await ingestJobs(fake, adapter);
    expect(summary.careersClassified).toBe(1);
    expect(fake.table("jobs")[0]?.["career_id"]).toBe(CAREER_DATA_ANALYST);
  });

  it("leaves career_id null for an unclassifiable posting", async () => {
    const fake = createFakeSupabase();
    seedCatalog(fake);
    const adapter = manualAdapter([
      { externalId: "ext-1", title: "Warehouse Forklift Operator", company: "Acme" },
    ]);

    const summary = await ingestJobs(fake, adapter);
    expect(summary.careersClassified).toBe(0);
    expect(fake.table("jobs")[0]?.["career_id"]).toBeNull();
  });

  it("does not run extractSkills twice per job (career_id uses the same extraction as job_skills)", async () => {
    const fake = createFakeSupabase();
    seedCatalog(fake);
    const adapter = manualAdapter([
      {
        externalId: "ext-1",
        title: "Data Analyst",
        company: "Acme",
        description: "SQL and Excel.",
      },
    ]);
    const summary = await ingestJobs(fake, adapter);
    // Two skills mentioned (SQL, Excel) -> exactly two job_skills rows,
    // proving extraction ran once and both career classification and the
    // job_skills upsert used the same result.
    expect(summary.skillsExtracted).toBe(2);
    expect(fake.table("job_skills")).toHaveLength(2);
  });
});

describe("ingestJobs — Adzuna adapter end-to-end", () => {
  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("ingests live Adzuna results through the full pipeline (jobs + job_skills, is_demo=false)", async () => {
    const fake = createFakeSupabase();
    seedCatalog(fake);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        results: [
          {
            id: 42,
            title: "Data Analyst",
            company: { display_name: "Globex" },
            location: { display_name: "Remote" },
            description: "SQL and Excel dashboards.",
            redirect_url: "https://www.adzuna.com/details/42",
            salary_min: 50000,
            salary_max: 70000,
            created: "2026-08-01T00:00:00Z",
          },
        ],
        count: 1,
      }),
    );

    const adapter = new AdzunaJobSourceAdapter("id", "key", { maxJobs: 5 });
    const summary = await ingestJobs(fake, adapter);

    expect(summary.jobsInserted).toBe(1);
    expect(fake.table("jobs")[0]?.["is_demo"]).toBe(false);
    expect(fake.table("jobs")[0]?.["external_id"]).toBe("42");
    expect(summary.skillsExtracted).toBe(2);
    expect(summary.careersClassified).toBe(1);
  });

  it("re-ingesting the same Adzuna external id updates rather than duplicates", async () => {
    const fake = createFakeSupabase();
    seedCatalog(fake);
    const resultPage = (title: string) =>
      jsonResponse({ results: [{ id: 42, title, company: { display_name: "Globex" } }], count: 1 });

    fetchMock.mockResolvedValueOnce(resultPage("Data Analyst"));
    await ingestJobs(fake, new AdzunaJobSourceAdapter("id", "key", { maxJobs: 5 }));

    fetchMock.mockResolvedValueOnce(resultPage("Senior Data Analyst"));
    const second = await ingestJobs(fake, new AdzunaJobSourceAdapter("id", "key", { maxJobs: 5 }));

    expect(fake.table("jobs")).toHaveLength(1);
    expect(second.jobsUpdated).toBe(1);
    expect(fake.table("jobs")[0]?.["title"]).toBe("Senior Data Analyst");
  });

  it(
    "job salary refresh: re-ingesting the same posting with new salary figures " +
      "overwrites the stale salary_min/salary_max, and the fresh values are what " +
      "listJobsCore (what the Jobs Explorer actually reads) returns afterward",
    async () => {
      const fake = createFakeSupabase();
      seedCatalog(fake);
      const resultPage = (salaryMin: number, salaryMax: number) =>
        jsonResponse({
          results: [
            {
              id: 42,
              title: "Data Analyst",
              company: { display_name: "Globex" },
              salary_min: salaryMin,
              salary_max: salaryMax,
            },
          ],
          count: 1,
        });

      fetchMock.mockResolvedValueOnce(resultPage(50000, 70000));
      await ingestJobs(fake, new AdzunaJobSourceAdapter("id", "key", { maxJobs: 5 }));
      expect(fake.table("jobs")[0]?.["salary_min"]).toBe(50000);
      expect(fake.table("jobs")[0]?.["salary_max"]).toBe(70000);

      // The provider now reports a raise for the same posting (its external
      // id is unchanged) -- a refresh must persist the NEW figures, not
      // leave the first ingest's numbers in place.
      fetchMock.mockResolvedValueOnce(resultPage(65000, 90000));
      const second = await ingestJobs(
        fake,
        new AdzunaJobSourceAdapter("id", "key", { maxJobs: 5 }),
      );

      expect(fake.table("jobs")).toHaveLength(1);
      expect(second.jobsUpdated).toBe(1);
      expect(fake.table("jobs")[0]?.["salary_min"]).toBe(65000);
      expect(fake.table("jobs")[0]?.["salary_max"]).toBe(90000);
      // Never silently keep serving the stale reading.
      expect(fake.table("jobs")[0]?.["salary_min"]).not.toBe(50000);
      expect(fake.table("jobs")[0]?.["salary_max"]).not.toBe(70000);

      // And the Jobs Explorer's own read path reflects it too -- there is
      // no separate cache between `jobs` and what listJobsCore returns.
      const { listJobsCore } = await import("@/lib/jobs/list.server");
      const { DEFAULT_JOB_FILTERS } = await import("@/lib/jobs/explorer-types");
      const result = await listJobsCore(fake, null, DEFAULT_JOB_FILTERS, "newest", 1, 12);
      expect(result.jobs[0]?.salaryMin).toBe(65000);
      expect(result.jobs[0]?.salaryMax).toBe(90000);
    },
  );

  it("zero live results: writes nothing and never fabricates a job to fill the gap", async () => {
    const fake = createFakeSupabase();
    seedCatalog(fake);
    fetchMock.mockResolvedValueOnce(jsonResponse({ results: [], count: 0 }));

    const summary = await ingestJobs(fake, new AdzunaJobSourceAdapter("id", "key", { maxJobs: 5 }));

    expect(summary.jobsReceived).toBe(0);
    expect(summary.jobsInserted).toBe(0);
    expect(fake.table("jobs")).toHaveLength(0);
  });

  it("provider failure (e.g. bad credentials): propagates the error and writes zero rows — never falls back to fake data", async () => {
    const fake = createFakeSupabase();
    seedCatalog(fake);
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "invalid app_id or app_key" }, 401));

    await expect(
      ingestJobs(fake, new AdzunaJobSourceAdapter("id", "key", { maxJobs: 5 })),
    ).rejects.toThrow(/unauthorized|401/i);

    expect(fake.table("jobs")).toHaveLength(0);
    expect(fake.table("job_sources")).toHaveLength(0);
  });

  it("provider outage (500): propagates the error and writes zero rows", async () => {
    const fake = createFakeSupabase();
    seedCatalog(fake);
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));

    await expect(
      ingestJobs(fake, new AdzunaJobSourceAdapter("id", "key", { maxJobs: 5 })),
    ).rejects.toThrow();
    expect(fake.table("jobs")).toHaveLength(0);
  });
});

describe("removeDemoJobs", () => {
  it("refuses to run when no live (non-demo, active) jobs exist yet -- never empties the Jobs Explorer", async () => {
    const fake = createFakeSupabase();
    fake.seed("jobs", [
      { id: "demo-1", is_demo: true, is_active: true, title: "Demo Job" },
      { id: "demo-2", is_demo: true, is_active: true, title: "Another Demo Job" },
    ]);

    const result = await removeDemoJobs(fake);

    expect(result.skipped).toBe(true);
    if (result.skipped) {
      expect(result.reason).toMatch(/no live/i);
    }
    // Nothing was deleted.
    expect(fake.table("jobs")).toHaveLength(2);
  });

  it("removes demo jobs once at least one live active job exists, leaving live jobs untouched", async () => {
    const fake = createFakeSupabase();
    fake.seed("jobs", [
      { id: "demo-1", is_demo: true, is_active: true, title: "Demo Job" },
      { id: "demo-2", is_demo: true, is_active: true, title: "Another Demo Job" },
      { id: "live-1", is_demo: false, is_active: true, title: "Real Job" },
    ]);

    const result = await removeDemoJobs(fake);

    expect(result.skipped).toBe(false);
    if (!result.skipped) {
      expect(result.removed).toBe(2);
    }
    expect(fake.table("jobs")).toHaveLength(1);
    expect(fake.table("jobs")[0]).toMatchObject({ id: "live-1" });
  });

  it("does not count an inactive (deactivated) live job as sufficient to allow cleanup", async () => {
    const fake = createFakeSupabase();
    fake.seed("jobs", [
      { id: "demo-1", is_demo: true, is_active: true, title: "Demo Job" },
      { id: "live-stale", is_demo: false, is_active: false, title: "Stale Real Job" },
    ]);

    const result = await removeDemoJobs(fake);

    expect(result.skipped).toBe(true);
    expect(fake.table("jobs")).toHaveLength(2);
  });
});
