/**
 * Jobs page: filtering states, live-source messaging, and salary display.
 *
 * Root cause covered: `dataMode` used to be computed from counts that already
 * had the user's filters applied, so ANY search/filter matching zero rows was
 * reported as "demo" -> "You're viewing sample postings, not live job data.
 * An admin can connect a live source..." even with thousands of live jobs.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_JOB_FILTERS } from "@/lib/jobs/explorer-types";
import { listJobsCore } from "@/lib/jobs/list.server";
import {
  JOBS_COPY,
  dataModeBadge,
  emptyStateCopy,
  resolveJobsListView,
  sampleNoticeText,
  shouldShowSampleDataNotice,
} from "@/lib/jobs/list-state";
import {
  SALARY_CURRENCY_UNSPECIFIED,
  SALARY_NOT_PROVIDED,
  formatJobSalary,
  hasMixedSalaryCurrencies,
} from "@/lib/jobs/salary-display";
import { createFakeSupabase } from "./__tests__/fake-supabase";
import { USER_A, makeJob, seedProfile, seedSkills } from "./__tests__/fixtures";

function setup() {
  const fake = createFakeSupabase();
  seedSkills(fake);
  seedProfile(fake, USER_A);
  return fake;
}

const list = (
  fake: ReturnType<typeof setup>,
  filters: Partial<typeof DEFAULT_JOB_FILTERS> = {},
  page = 1,
  pageSize = 10,
) => listJobsCore(fake, null, { ...DEFAULT_JOB_FILTERS, ...filters }, "newest", page, pageSize);

describe("dataMode is a property of the catalogue, not of the filtered page", () => {
  it("live catalogue + a search that matches nothing -> total 0 but dataMode stays 'live' (regression)", async () => {
    const fake = setup();
    fake.seed("jobs", [
      makeJob({ id: "j1", title: "Backend Engineer" }),
      makeJob({ id: "j2", title: "Data Analyst" }),
    ]);

    const result = await list(fake, { search: "zzz-nothing-matches-this" });

    expect(result.total).toBe(0);
    expect(result.jobs).toEqual([]);
    expect(result.dataMode).toBe("live"); // was "demo" -> the false "sample postings" banner
  });

  it("live catalogue + a location filter that matches nothing stays 'live'", async () => {
    const fake = setup();
    fake.seed("jobs", [makeJob({ id: "j1", location: "Pune" })]);
    const result = await list(fake, { location: "Reykjavik" });
    expect(result.total).toBe(0);
    expect(result.dataMode).toBe("live");
  });

  it("live catalogue + a salary filter that matches nothing stays 'live'", async () => {
    const fake = setup();
    fake.seed("jobs", [makeJob({ id: "j1", salary_min: 50000, salary_max: 60000 })]);
    const result = await list(fake, { salaryMin: 9_000_000 });
    expect(result.total).toBe(0);
    expect(result.dataMode).toBe("live");
  });

  it("mixed catalogue: a filter matching only demo rows, or nothing, is still 'mixed' -- never 'demo'", async () => {
    const fake = setup();
    fake.seed("jobs", [
      makeJob({ id: "demo1", title: "Sample Role", is_demo: true }),
      makeJob({ id: "live1", title: "Backend Engineer", is_demo: false }),
    ]);

    const onlyDemoMatches = await list(fake, { search: "Sample Role" });
    expect(onlyDemoMatches.total).toBe(1);
    expect(onlyDemoMatches.dataMode).toBe("mixed");

    const nothingMatches = await list(fake, { search: "zzz-nothing" });
    expect(nothingMatches.total).toBe(0);
    expect(nothingMatches.dataMode).toBe("mixed");
  });

  it("genuinely no live source: demo-only catalogue is 'demo' with or without filters", async () => {
    const fake = setup();
    fake.seed("jobs", [makeJob({ id: "d1", is_demo: true }), makeJob({ id: "d2", is_demo: true })]);
    expect((await list(fake)).dataMode).toBe("demo");
    expect((await list(fake, { search: "zzz-nothing" })).dataMode).toBe("demo");
  });

  it("genuinely no live source: an empty catalogue is 'demo'", async () => {
    const fake = setup();
    expect((await list(fake)).dataMode).toBe("demo");
  });

  it("live jobs that have all been deactivated do not count as a connected live source", async () => {
    const fake = setup();
    fake.seed("jobs", [
      makeJob({ id: "old-live", is_demo: false, is_active: false }),
      makeJob({ id: "d1", is_demo: true }),
    ]);
    expect((await list(fake)).dataMode).toBe("demo");
  });
});

describe("filters are executed by the server query, not against an already-loaded page", () => {
  it("finds a job that is NOT on the currently loaded page (page 1 of 25 jobs)", async () => {
    const fake = setup();
    fake.seed("jobs", [
      ...Array.from({ length: 24 }, (_, i) =>
        makeJob({
          id: `j${i}`,
          title: `Backend Engineer ${i}`,
          posted_at: `2026-02-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
        }),
      ),
      makeJob({
        id: "needle",
        title: "Quantum Compiler Engineer",
        posted_at: "2025-01-01T00:00:00Z",
      }),
    ]);

    const unfiltered = await list(fake);
    expect(unfiltered.total).toBe(25);
    expect(unfiltered.jobs.map((j) => j.id)).not.toContain("needle"); // not in the loaded list

    const filtered = await list(fake, { search: "Quantum Compiler" });
    expect(filtered.jobs.map((j) => j.id)).toEqual(["needle"]);
    expect(filtered.total).toBe(1);
    expect(filtered.dataMode).toBe("live");
  });

  it("changing a filter changes the server result set (no stale reuse)", async () => {
    const fake = setup();
    fake.seed("jobs", [
      makeJob({ id: "a", title: "Backend Engineer", location: "Pune" }),
      makeJob({ id: "b", title: "Data Analyst", location: "Delhi" }),
    ]);
    expect((await list(fake, { location: "Pune" })).jobs.map((j) => j.id)).toEqual(["a"]);
    expect((await list(fake, { location: "Delhi" })).jobs.map((j) => j.id)).toEqual(["b"]);
    expect((await list(fake, { location: "Pune", search: "Data" })).total).toBe(0);
  });
});

describe("resolveJobsListView -- the three states are never confused", () => {
  it("State A: jobs returned -> results (live or mixed or demo)", () => {
    for (const dataMode of ["live", "mixed", "demo"] as const) {
      expect(resolveJobsListView({ jobCount: 3, dataMode })).toBe("results");
    }
  });

  it("State B: live source connected + zero matches -> no_matches (NOT the live-source setup message)", () => {
    expect(resolveJobsListView({ jobCount: 0, dataMode: "live" })).toBe("no_matches");
    expect(resolveJobsListView({ jobCount: 0, dataMode: "mixed" })).toBe("no_matches");
  });

  it("State C: no live source anywhere -> source_unavailable", () => {
    expect(resolveJobsListView({ jobCount: 0, dataMode: "demo" })).toBe("source_unavailable");
  });

  it("before any data has loaded, zero jobs is not treated as 'source unavailable'", () => {
    expect(resolveJobsListView({ jobCount: 0, dataMode: undefined })).toBe("no_matches");
  });
});

describe("Jobs page copy", () => {
  const base = { liveSearchTriggered: false, liveSearchFailed: false, isAdmin: false };

  it("State B shows exactly 'No jobs match your current filters.' and never mentions a live source or admin", () => {
    const copy = emptyStateCopy({ ...base, view: "no_matches" });
    expect(copy.title).toBe("No jobs match your current filters.");
    expect(`${copy.title} ${copy.description}`).not.toMatch(/live source|admin|sample|ingest/i);
  });

  it("State B after a live provider search says so in product language (no provider name)", () => {
    const copy = emptyStateCopy({ ...base, view: "no_matches", liveSearchTriggered: true });
    expect(copy.title).toBe("No matching jobs found for this search.");
    expect(copy.description).not.toMatch(/Adzuna/);
    const failed = emptyStateCopy({
      ...base,
      view: "no_matches",
      liveSearchTriggered: true,
      liveSearchFailed: true,
    });
    expect(failed.description).toMatch(/temporarily unavailable/);
  });

  it("State C: customers get a calm message; only admins get the setup instruction", () => {
    const customer = emptyStateCopy({ ...base, view: "source_unavailable" });
    const admin = emptyStateCopy({ ...base, view: "source_unavailable", isAdmin: true });
    expect(customer.description).not.toMatch(/admin|Job ingestion/i);
    expect(admin.description).toMatch(/Job ingestion in Admin settings/);
    expect(sampleNoticeText(false)).not.toMatch(/admin/i);
    expect(sampleNoticeText(true)).toMatch(/Admin settings/);
  });

  it("the sample-data notice appears only when there is no live job at all", () => {
    expect(shouldShowSampleDataNotice("demo")).toBe(true);
    expect(shouldShowSampleDataNotice("live")).toBe(false);
    expect(shouldShowSampleDataNotice("mixed")).toBe(false);
    expect(shouldShowSampleDataNotice(undefined)).toBe(false);
  });

  it("badges: no 'Mixed sample & live data' development label once live data exists", () => {
    expect(dataModeBadge("demo")?.label).toBe("Sample job data");
    expect(dataModeBadge("live")?.label).toBe("Live job data");
    expect(dataModeBadge("mixed")).toBeNull();
    expect(dataModeBadge(undefined)).toBeNull();
  });

  it("no user-facing string contains development-status wording", () => {
    const strings = Object.values(JOBS_COPY).flatMap((v) =>
      typeof v === "function" ? [v(1), v(2)] : [v],
    );
    for (const text of strings)
      expect(text).not.toMatch(/planned|premium|not live job data|Adzuna|cached/i);
  });
});

describe("formatJobSalary -- provider currency, correct symbol, no fabrication", () => {
  const f = (salaryMin: number | null, salaryMax: number | null, salaryCurrency: string | null) =>
    formatJobSalary({ salaryMin, salaryMax, salaryCurrency });

  it("matches the product examples for each currency", () => {
    expect(f(800000, 1200000, "INR")).toBe("₹8–12 LPA");
    expect(f(80000, 100000, "USD")).toBe("$80K–$100K");
    expect(f(45000, 60000, "GBP")).toBe("£45K–£60K");
    expect(f(50000, 65000, "EUR")).toBe("€50K–€65K");
  });

  it("never shows $ for INR, and never shows ₹ for other currencies", () => {
    expect(f(800000, 1200000, "INR")).not.toContain("$");
    for (const currency of ["USD", "GBP", "EUR", "CAD", "AUD", "SGD"]) {
      expect(f(80000, 100000, currency)).not.toContain("₹");
    }
    // A dollar-currency other than USD is disambiguated, not passed off as US$.
    expect(f(80000, 100000, "CAD")).toBe("CA$80K–CA$100K");
  });

  it("handles thousands/millions and fractional lakhs/thousands", () => {
    expect(f(650000, 1250000, "INR")).toBe("₹6.5–12.5 LPA");
    expect(f(45500, 60000, "USD")).toBe("$45.5K–$60K");
    expect(f(1_200_000, 1_500_000, "USD")).toBe("$1.2M–$1.5M");
  });

  it("collapses an equal min/max to one figure", () => {
    expect(f(80000, 80000, "USD")).toBe("$80K");
    expect(f(800000, 800000, "INR")).toBe("₹8 LPA");
  });

  it("marks one-sided ranges instead of presenting them as exact", () => {
    expect(f(80000, null, "USD")).toBe("From $80K");
    expect(f(null, 100000, "USD")).toBe("Up to $100K");
    expect(f(800000, null, "INR")).toBe("From ₹8 LPA");
    expect(f(null, 1200000, "INR")).toBe("Up to ₹12 LPA");
  });

  it("puts a reversed min/max in order", () => {
    expect(f(100000, 80000, "USD")).toBe("$80K–$100K");
    expect(f(1200000, 800000, "INR")).toBe("₹8–12 LPA");
  });

  it("shows plain rupees for INR amounts below one lakh instead of a misleading '0.3 LPA'", () => {
    expect(f(30000, 60000, "INR")).toBe("₹30,000–₹60,000");
  });

  it("missing salary is 'Salary not provided' -- null, zero, negative and NaN never become a figure", () => {
    expect(f(null, null, "USD")).toBe(SALARY_NOT_PROVIDED);
    expect(f(0, 0, "USD")).toBe(SALARY_NOT_PROVIDED);
    expect(f(-5, null, "INR")).toBe(SALARY_NOT_PROVIDED);
    expect(f(Number.NaN, Number.NaN, "USD")).toBe(SALARY_NOT_PROVIDED);
  });

  it("amounts with no currency never get an invented symbol", () => {
    expect(f(80000, 90000, null)).toBe(SALARY_CURRENCY_UNSPECIFIED);
    expect(f(80000, 90000, "  ")).toBe(SALARY_CURRENCY_UNSPECIFIED);
    expect(SALARY_CURRENCY_UNSPECIFIED).not.toMatch(/[$₹£€]/);
  });

  it("an unrecognised currency code is shown as the code, not a guessed symbol", () => {
    expect(f(80000, 90000, "NOTREAL")).toBe("NOTREAL 80K–NOTREAL 90K");
  });

  it("currency codes are case-insensitive and single figures stay consistent with formatSalary's INR style", () => {
    expect(f(80000, 90000, "usd")).toBe("$80K–$90K");
  });
});

describe("hasMixedSalaryCurrencies -- the note is shown only when it is useful", () => {
  const job = (salaryMin: number | null, salaryCurrency: string | null) => ({
    salaryMin,
    salaryMax: null,
    salaryCurrency,
  });

  it("is false for a single currency, for an empty list, and when only one job has a salary", () => {
    expect(hasMixedSalaryCurrencies([])).toBe(false);
    expect(hasMixedSalaryCurrencies([job(1, "INR"), job(2, "INR")])).toBe(false);
    expect(hasMixedSalaryCurrencies([job(1, "INR"), job(null, "USD")])).toBe(false);
  });

  it("is true when jobs that carry a salary use different currencies", () => {
    expect(hasMixedSalaryCurrencies([job(800000, "INR"), job(80000, "USD")])).toBe(true);
    expect(hasMixedSalaryCurrencies([job(80000, "usd"), job(80000, "GBP")])).toBe(true);
  });

  it("ignores jobs without a salary or currency", () => {
    expect(hasMixedSalaryCurrencies([job(800000, "INR"), job(null, "USD"), job(5, null)])).toBe(
      false,
    );
  });
});

describe("Jobs page wiring (source-level, following the repo's copy-regression pattern)", () => {
  const read = (rel: string) =>
    readFileSync(fileURLToPath(new URL(`../../../${rel}`, import.meta.url)), "utf-8");

  it("the route no longer contains the false sample-data banner or provider-flavoured copy", () => {
    const route = read("src/routes/_authenticated/jobs.index.tsx");
    expect(route).not.toMatch(/not live job data/);
    expect(route).not.toMatch(/Mixed sample/);
    expect(route).not.toMatch(/Searched Adzuna/);
    expect(route).not.toMatch(/previously cached/);
    expect(route).not.toMatch(/Compared in each job/);
    expect(route).toMatch(/resolveJobsListView/);
  });

  it("the job query is keyed by filters, sort and page so every change is a fresh server request", () => {
    const route = read("src/routes/_authenticated/jobs.index.tsx");
    expect(route).toMatch(/queryKey:\s*\["jobs",\s*filters,\s*sort,\s*page\]/);
    expect(route).toMatch(/listJobs\(\{\s*data:/);
  });

  it("the salary filter panel no longer carries the awkward currency sentence", () => {
    expect(read("src/components/jobs/job-filters-panel.tsx")).not.toMatch(/own currency/);
  });

  it("job card and job detail both use the job-specific salary formatter", () => {
    expect(read("src/components/jobs/job-card.tsx")).toMatch(/formatJobSalary\(job\)/);
    expect(read("src/routes/_authenticated/jobs.$jobId.tsx")).toMatch(/formatJobSalary\(job\)/);
  });

  it("the shared salary formatter used by career pages and settings is untouched", () => {
    const domain = read("src/lib/domain.ts");
    expect(domain).toMatch(/export function formatSalaryRange/);
    expect(domain).toMatch(/Salary currency unavailable/);
  });
});
