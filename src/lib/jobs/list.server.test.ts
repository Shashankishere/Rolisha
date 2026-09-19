import { describe, expect, it } from "vitest";
import { scoreJobMatch } from "@/lib/domain";
import { DEFAULT_JOB_FILTERS } from "@/lib/jobs/explorer-types";
import { BEST_MATCH_CANDIDATE_CAP, listJobsCore, loadJobDetailCore } from "@/lib/jobs/list.server";
import { createFakeSupabase } from "./__tests__/fake-supabase";
import {
  SKILL_AWS,
  SKILL_PYTHON,
  SKILL_REACT,
  SKILL_SQL,
  USER_A,
  makeJob,
  seedJobSkills,
  seedProfile,
  seedSkills,
  seedUserSkills,
} from "./__tests__/fixtures";

function baseSetup() {
  const fake = createFakeSupabase();
  seedSkills(fake);
  seedProfile(fake, USER_A);
  seedUserSkills(fake, USER_A, [
    { skillId: SKILL_REACT, level: "advanced" },
    { skillId: SKILL_SQL, level: "advanced" },
  ]);
  return fake;
}

describe("listJobsCore — filtering", () => {
  it("search matches job title", async () => {
    const fake = baseSetup();
    fake.seed("jobs", [
      makeJob({ id: "j1", title: "Backend Engineer" }),
      makeJob({ id: "j2", title: "Frontend Designer" }),
    ]);
    const result = await listJobsCore(
      fake,
      null,
      { ...DEFAULT_JOB_FILTERS, search: "Backend" },
      "newest",
      1,
      10,
    );
    expect(result.jobs.map((j) => j.id)).toEqual(["j1"]);
  });

  it("search matches company name", async () => {
    const fake = baseSetup();
    fake.seed("jobs", [
      makeJob({ id: "j1", title: "Engineer", company: "Initech" }),
      makeJob({ id: "j2", title: "Engineer", company: "Globex" }),
    ]);
    const result = await listJobsCore(
      fake,
      null,
      { ...DEFAULT_JOB_FILTERS, search: "Globex" },
      "newest",
      1,
      10,
    );
    expect(result.jobs.map((j) => j.id)).toEqual(["j2"]);
  });

  it("search also matches jobs whose required skill name matches the term", async () => {
    const fake = baseSetup();
    fake.seed("jobs", [
      makeJob({ id: "j1", title: "Backend Engineer" }),
      makeJob({ id: "j2", title: "Data Analyst" }),
    ]);
    seedJobSkills(fake, "j2", [{ skillId: SKILL_PYTHON, required: true }]);
    const result = await listJobsCore(
      fake,
      null,
      { ...DEFAULT_JOB_FILTERS, search: "Python" },
      "newest",
      1,
      10,
    );
    expect(result.jobs.map((j) => j.id)).toEqual(["j2"]);
  });

  it("location filter matches substring, case-insensitively", async () => {
    const fake = baseSetup();
    fake.seed("jobs", [
      makeJob({ id: "j1", location: "Austin, TX" }),
      makeJob({ id: "j2", location: "Boston, MA" }),
    ]);
    const result = await listJobsCore(
      fake,
      null,
      { ...DEFAULT_JOB_FILTERS, location: "austin" },
      "newest",
      1,
      10,
    );
    expect(result.jobs.map((j) => j.id)).toEqual(["j1"]);
  });

  it("work mode filter restricts to exact mode", async () => {
    const fake = baseSetup();
    fake.seed("jobs", [
      makeJob({ id: "j1", work_mode: "remote" }),
      makeJob({ id: "j2", work_mode: "onsite" }),
    ]);
    const result = await listJobsCore(
      fake,
      null,
      { ...DEFAULT_JOB_FILTERS, workMode: "onsite" },
      "newest",
      1,
      10,
    );
    expect(result.jobs.map((j) => j.id)).toEqual(["j2"]);
  });

  it("salary minimum keeps jobs whose salary_max meets the floor", async () => {
    const fake = baseSetup();
    fake.seed("jobs", [
      makeJob({ id: "j1", salary_min: 40000, salary_max: 60000 }),
      makeJob({ id: "j2", salary_min: 100000, salary_max: 150000 }),
    ]);
    const result = await listJobsCore(
      fake,
      null,
      { ...DEFAULT_JOB_FILTERS, salaryMin: 90000 },
      "newest",
      1,
      10,
    );
    expect(result.jobs.map((j) => j.id)).toEqual(["j2"]);
  });

  it("salary maximum keeps jobs whose salary_min stays under the ceiling", async () => {
    const fake = baseSetup();
    fake.seed("jobs", [
      makeJob({ id: "j1", salary_min: 40000, salary_max: 60000 }),
      makeJob({ id: "j2", salary_min: 100000, salary_max: 150000 }),
    ]);
    const result = await listJobsCore(
      fake,
      null,
      { ...DEFAULT_JOB_FILTERS, salaryMax: 70000 },
      "newest",
      1,
      10,
    );
    expect(result.jobs.map((j) => j.id)).toEqual(["j1"]);
  });

  it("skill filter keeps jobs requiring at least one of the given skills", async () => {
    const fake = baseSetup();
    fake.seed("jobs", [makeJob({ id: "j1" }), makeJob({ id: "j2" }), makeJob({ id: "j3" })]);
    seedJobSkills(fake, "j1", [{ skillId: SKILL_AWS, required: true }]);
    seedJobSkills(fake, "j2", [{ skillId: SKILL_PYTHON, required: true }]);
    const result = await listJobsCore(
      fake,
      null,
      { ...DEFAULT_JOB_FILTERS, skillIds: [SKILL_AWS] },
      "newest",
      1,
      10,
    );
    expect(result.jobs.map((j) => j.id)).toEqual(["j1"]);
  });

  it("career filter restricts to the given career_id", async () => {
    const fake = baseSetup();
    fake.seed("jobs", [
      makeJob({ id: "j1", career_id: "career-eng" }),
      makeJob({ id: "j2", career_id: "career-design" }),
    ]);
    const result = await listJobsCore(
      fake,
      null,
      { ...DEFAULT_JOB_FILTERS, careerId: "career-eng" },
      "newest",
      1,
      10,
    );
    expect(result.jobs.map((j) => j.id)).toEqual(["j1"]);
  });
});

describe("listJobsCore — sorting", () => {
  it("newest sorts by posted_at descending", async () => {
    const fake = baseSetup();
    fake.seed("jobs", [
      makeJob({ id: "old", posted_at: "2026-01-01T00:00:00Z" }),
      makeJob({ id: "new", posted_at: "2026-03-01T00:00:00Z" }),
      makeJob({ id: "mid", posted_at: "2026-02-01T00:00:00Z" }),
    ]);
    const result = await listJobsCore(fake, null, DEFAULT_JOB_FILTERS, "newest", 1, 10);
    expect(result.jobs.map((j) => j.id)).toEqual(["new", "mid", "old"]);
  });

  it("salary_desc sorts by salary_max high to low", async () => {
    const fake = baseSetup();
    fake.seed("jobs", [
      makeJob({ id: "low", salary_max: 80000 }),
      makeJob({ id: "high", salary_max: 200000 }),
      makeJob({ id: "mid", salary_max: 120000 }),
    ]);
    const result = await listJobsCore(fake, null, DEFAULT_JOB_FILTERS, "salary_desc", 1, 10);
    expect(result.jobs.map((j) => j.id)).toEqual(["high", "mid", "low"]);
  });

  it("salary_asc sorts by salary_min low to high", async () => {
    const fake = baseSetup();
    fake.seed("jobs", [
      makeJob({ id: "low", salary_min: 50000 }),
      makeJob({ id: "high", salary_min: 150000 }),
      makeJob({ id: "mid", salary_min: 90000 }),
    ]);
    const result = await listJobsCore(fake, null, DEFAULT_JOB_FILTERS, "salary_asc", 1, 10);
    expect(result.jobs.map((j) => j.id)).toEqual(["low", "mid", "high"]);
  });

  it("best_match sorts by overall match score, highest first", async () => {
    const fake = baseSetup();
    // strongMatch requires only skills the user has; weakMatch requires a skill they lack too.
    fake.seed("jobs", [
      makeJob({ id: "strongMatch", posted_at: "2026-01-01T00:00:00Z" }),
      makeJob({ id: "weakMatch", posted_at: "2026-01-02T00:00:00Z" }),
    ]);
    seedJobSkills(fake, "strongMatch", [{ skillId: SKILL_REACT, required: true }]);
    seedJobSkills(fake, "weakMatch", [
      { skillId: SKILL_REACT, required: true },
      { skillId: SKILL_AWS, required: true },
    ]);
    const result = await listJobsCore(fake, USER_A, DEFAULT_JOB_FILTERS, "best_match", 1, 10);
    expect(result.jobs.map((j) => j.id)).toEqual(["strongMatch", "weakMatch"]);
    expect(result.jobs[0]!.match!.overall).toBeGreaterThan(result.jobs[1]!.match!.overall);
  });
});

describe("listJobsCore — pagination", () => {
  function seedFive(fake: ReturnType<typeof baseSetup>) {
    fake.seed(
      "jobs",
      Array.from({ length: 5 }, (_, i) =>
        makeJob({ id: `j${i}`, posted_at: `2026-01-0${i + 1}T00:00:00Z` }),
      ),
    );
  }

  it("returns the first page in order", async () => {
    const fake = baseSetup();
    seedFive(fake);
    const result = await listJobsCore(fake, null, DEFAULT_JOB_FILTERS, "newest", 1, 2);
    expect(result.jobs.map((j) => j.id)).toEqual(["j4", "j3"]);
    expect(result.page).toBe(1);
  });

  it("returns the second page continuing from the first", async () => {
    const fake = baseSetup();
    seedFive(fake);
    const result = await listJobsCore(fake, null, DEFAULT_JOB_FILTERS, "newest", 2, 2);
    expect(result.jobs.map((j) => j.id)).toEqual(["j2", "j1"]);
  });

  it("returns an empty jobs array for a page past the end", async () => {
    const fake = baseSetup();
    seedFive(fake);
    const result = await listJobsCore(fake, null, DEFAULT_JOB_FILTERS, "newest", 10, 2);
    expect(result.jobs).toEqual([]);
    expect(result.total).toBe(5);
  });

  it("reports the correct total count regardless of page size", async () => {
    const fake = baseSetup();
    seedFive(fake);
    const result = await listJobsCore(fake, null, DEFAULT_JOB_FILTERS, "newest", 1, 3);
    expect(result.total).toBe(5);
  });

  it("honors the requested page size", async () => {
    const fake = baseSetup();
    seedFive(fake);
    const result = await listJobsCore(fake, null, DEFAULT_JOB_FILTERS, "newest", 1, 3);
    expect(result.jobs).toHaveLength(3);
    expect(result.pageSize).toBe(3);
  });

  it("computes correct page boundaries (pageCount) for an exact multiple", async () => {
    const fake = baseSetup();
    seedFive(fake);
    const result = await listJobsCore(fake, null, DEFAULT_JOB_FILTERS, "newest", 1, 5);
    expect(result.pageCount).toBe(1);
    expect(result.jobs).toHaveLength(5);
  });

  it("computes correct page boundaries (pageCount) for a remainder", async () => {
    const fake = baseSetup();
    seedFive(fake);
    const result = await listJobsCore(fake, null, DEFAULT_JOB_FILTERS, "newest", 1, 2);
    expect(result.pageCount).toBe(3); // ceil(5/2)
  });
});

describe("listJobsCore — best match scoring", () => {
  it("uses scoreJobMatch() as the canonical scoring path (matches the pure function directly)", async () => {
    const fake = baseSetup();
    fake.seed("jobs", [makeJob({ id: "j1" })]);
    seedJobSkills(fake, "j1", [
      { skillId: SKILL_REACT, required: true },
      { skillId: SKILL_AWS, required: true },
    ]);
    const result = await listJobsCore(fake, USER_A, DEFAULT_JOB_FILTERS, "best_match", 1, 10);

    const expected = scoreJobMatch({
      jobSkillIds: [SKILL_REACT, SKILL_AWS],
      userLevels: { [SKILL_REACT]: "advanced", [SKILL_SQL]: "advanced" },
      jobExperienceYearsMin: 2,
      userExperience: "2_5",
      jobEducation: null,
      userEducation: "bachelors",
      jobWorkMode: "remote",
      userWorkMode: "remote",
      jobCountry: "US",
      userCountry: "US",
      jobSalaryMax: 130000,
      userSalaryTarget: 120000,
    });

    expect(result.jobs[0]!.match).toEqual(expected);
  });

  it("caps the candidate pool at BEST_MATCH_CANDIDATE_CAP and flags scoredSubsetOnly", async () => {
    const fake = baseSetup();
    const total = BEST_MATCH_CANDIDATE_CAP + 25;
    fake.seed(
      "jobs",
      Array.from({ length: total }, (_, i) =>
        makeJob({ id: `j${i}`, posted_at: new Date(2026, 0, 1 + i).toISOString() }),
      ),
    );
    const result = await listJobsCore(fake, USER_A, DEFAULT_JOB_FILTERS, "best_match", 1, 10);
    expect(result.scoredSubsetOnly).toBe(true);
    expect(result.total).toBe(BEST_MATCH_CANDIDATE_CAP);
    expect(result.pageCount).toBe(Math.ceil(BEST_MATCH_CANDIDATE_CAP / 10));
  });

  it("does not flag scoredSubsetOnly when the pool is under the cap", async () => {
    const fake = baseSetup();
    fake.seed("jobs", [makeJob({ id: "j1" }), makeJob({ id: "j2" })]);
    const result = await listJobsCore(fake, USER_A, DEFAULT_JOB_FILTERS, "best_match", 1, 10);
    expect(result.scoredSubsetOnly).toBe(false);
    expect(result.total).toBe(2);
  });

  it("handles an empty job pool without error", async () => {
    const fake = baseSetup();
    fake.seed("jobs", []);
    const result = await listJobsCore(fake, USER_A, DEFAULT_JOB_FILTERS, "best_match", 1, 10);
    expect(result.jobs).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.pageCount).toBe(1);
    expect(result.scoredSubsetOnly).toBe(false);
  });

  it("scores every job when the pool is smaller than the cap", async () => {
    const fake = baseSetup();
    fake.seed("jobs", [makeJob({ id: "j1" }), makeJob({ id: "j2" }), makeJob({ id: "j3" })]);
    const result = await listJobsCore(fake, USER_A, DEFAULT_JOB_FILTERS, "best_match", 1, 10);
    expect(result.jobs).toHaveLength(3);
    expect(result.jobs.every((j) => j.match !== null)).toBe(true);
  });

  it("does not compute a match for an anonymous (signed-out) user", async () => {
    const fake = baseSetup();
    fake.seed("jobs", [makeJob({ id: "j1" })]);
    const result = await listJobsCore(fake, null, DEFAULT_JOB_FILTERS, "best_match", 1, 10);
    expect(result.jobs[0]!.match).toBeNull();
  });
});

describe("listJobsCore — dataMode (demo vs live, never fabricated)", () => {
  it("is 'demo' when the result set has zero real (is_demo=false) jobs", async () => {
    const fake = baseSetup();
    fake.seed("jobs", [makeJob({ id: "j1", is_demo: true }), makeJob({ id: "j2", is_demo: true })]);
    const result = await listJobsCore(fake, null, DEFAULT_JOB_FILTERS, "newest", 1, 10);
    expect(result.dataMode).toBe("demo");
  });

  it("is 'demo' (not fabricated as 'live') when there are zero jobs at all", async () => {
    const fake = baseSetup();
    const result = await listJobsCore(fake, null, DEFAULT_JOB_FILTERS, "newest", 1, 10);
    expect(result.total).toBe(0);
    expect(result.jobs).toEqual([]);
    expect(result.dataMode).toBe("demo");
  });

  it("is 'live' when every job in the result set is real", async () => {
    const fake = baseSetup();
    fake.seed("jobs", [
      makeJob({ id: "j1", is_demo: false }),
      makeJob({ id: "j2", is_demo: false }),
    ]);
    const result = await listJobsCore(fake, null, DEFAULT_JOB_FILTERS, "newest", 1, 10);
    expect(result.dataMode).toBe("live");
  });

  it("is 'mixed' when both demo and real jobs are present", async () => {
    const fake = baseSetup();
    fake.seed("jobs", [
      makeJob({ id: "j1", is_demo: true }),
      makeJob({ id: "j2", is_demo: false }),
    ]);
    const result = await listJobsCore(fake, null, DEFAULT_JOB_FILTERS, "newest", 1, 10);
    expect(result.dataMode).toBe("mixed");
  });

  it("each returned job carries its own real isDemo flag — never inferred or defaulted to false", async () => {
    const fake = baseSetup();
    fake.seed("jobs", [
      makeJob({ id: "j1", is_demo: true }),
      makeJob({ id: "j2", is_demo: false }),
    ]);
    const result = await listJobsCore(fake, null, DEFAULT_JOB_FILTERS, "newest", 1, 10);
    const byId = Object.fromEntries(result.jobs.map((j) => [j.id, j.isDemo]));
    expect(byId["j1"]).toBe(true);
    expect(byId["j2"]).toBe(false);
  });
});

describe("loadJobDetailCore", () => {
  it("returns null for a job that doesn't exist", async () => {
    const fake = baseSetup();
    const result = await loadJobDetailCore(fake, USER_A, "missing-job");
    expect(result).toBeNull();
  });

  it("splits job_skills into required and preferred, and computes the match breakdown", async () => {
    const fake = baseSetup();
    fake.seed("jobs", [makeJob({ id: "j1" })]);
    seedJobSkills(fake, "j1", [
      { skillId: SKILL_REACT, required: true },
      { skillId: SKILL_AWS, required: false },
    ]);
    const result = await loadJobDetailCore(fake, USER_A, "j1");
    expect(result).not.toBeNull();
    expect(result!.requiredSkills.map((s) => s.id)).toEqual([SKILL_REACT]);
    expect(result!.preferredSkills.map((s) => s.id)).toEqual([SKILL_AWS]);
    expect(result!.match.matchedSkillIds).toEqual([SKILL_REACT]);
  });

  it("reports isSaved true when the user has saved the job", async () => {
    const fake = baseSetup();
    fake.seed("jobs", [makeJob({ id: "j1" })]);
    fake.table("saved_jobs").push({ user_id: USER_A, job_id: "j1" });
    const result = await loadJobDetailCore(fake, USER_A, "j1");
    expect(result!.isSaved).toBe(true);
  });

  it("reports isSaved false when the user has not saved the job", async () => {
    const fake = baseSetup();
    fake.seed("jobs", [makeJob({ id: "j1" })]);
    const result = await loadJobDetailCore(fake, USER_A, "j1");
    expect(result!.isSaved).toBe(false);
  });

  it("returns a neutral, unauthenticated-safe match placeholder for a signed-out user", async () => {
    const fake = baseSetup();
    fake.seed("jobs", [makeJob({ id: "j1" })]);
    seedJobSkills(fake, "j1", [{ skillId: SKILL_REACT, required: true }]);
    const result = await loadJobDetailCore(fake, null, "j1");
    expect(result!.isSaved).toBe(false);
    expect(result!.match.overall).toBe(0);
    expect(result!.match.missingSkillIds).toEqual([SKILL_REACT]);
  });

  it("hides itemized matched/missing skill lists for a free-plan user (advanced_job_matching gate)", async () => {
    const fake = baseSetup();
    fake.seed("jobs", [makeJob({ id: "j1" })]);
    seedJobSkills(fake, "j1", [
      { skillId: SKILL_REACT, required: true },
      { skillId: SKILL_AWS, required: false },
    ]);

    const result = await loadJobDetailCore(fake, USER_A, "j1", "free");

    expect(result!.matchBreakdownLocked).toBe(true);
    expect(result!.matchedSkills).toEqual([]);
    expect(result!.missingSkills).toEqual([]);
    // The overall score itself is never hidden -- still needed for browsing.
    expect(typeof result!.match.overall).toBe("number");
  });

  it("shows the full itemized skill breakdown for a pro-plan user", async () => {
    const fake = baseSetup();
    fake.seed("jobs", [makeJob({ id: "j1" })]);
    seedJobSkills(fake, "j1", [
      { skillId: SKILL_REACT, required: true },
      { skillId: SKILL_AWS, required: false },
    ]);

    const result = await loadJobDetailCore(fake, USER_A, "j1", "pro");

    expect(result!.matchBreakdownLocked).toBe(false);
    expect(result!.matchedSkills.map((s) => s.id)).toEqual([SKILL_REACT]);
  });
});
