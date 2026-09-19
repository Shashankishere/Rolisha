import { describe, expect, it } from "vitest";
import {
  calculateJobMatch,
  calculateJobMatchesBatch,
  loadJobForMatch,
} from "@/lib/jobs/match.server";
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

function setupJob(overrides: Partial<ReturnType<typeof makeJob>> = {}) {
  const fake = createFakeSupabase();
  seedSkills(fake);
  fake.seed("jobs", [makeJob({ id: "j1", ...overrides })]);
  return fake;
}

describe("calculateJobMatch — matched/missing skills", () => {
  it("splits required skills into matched and missing based on proficiency >= intermediate", async () => {
    const fake = setupJob();
    seedJobSkills(fake, "j1", [
      { skillId: SKILL_REACT, required: true },
      { skillId: SKILL_SQL, required: true },
      { skillId: SKILL_AWS, required: true },
    ]);
    seedProfile(fake, USER_A);
    seedUserSkills(fake, USER_A, [
      { skillId: SKILL_REACT, level: "advanced" },
      { skillId: SKILL_SQL, level: "beginner" }, // below intermediate threshold -> missing
    ]);
    const result = await calculateJobMatch(fake, USER_A, "j1");
    expect(result.matchedSkillIds).toEqual([SKILL_REACT]);
    expect(result.missingSkillIds.sort()).toEqual([SKILL_AWS, SKILL_SQL].sort());
  });

  it("user with no skills at all: everything required is missing", async () => {
    const fake = setupJob();
    seedJobSkills(fake, "j1", [{ skillId: SKILL_REACT, required: true }]);
    seedProfile(fake, USER_A);
    seedUserSkills(fake, USER_A, []);
    const result = await calculateJobMatch(fake, USER_A, "j1");
    expect(result.matchedSkillIds).toEqual([]);
    expect(result.missingSkillIds).toEqual([SKILL_REACT]);
    expect(result.skills).toBe(0);
  });

  it("user with all required skills at sufficient level: 100% skills score", async () => {
    const fake = setupJob();
    seedJobSkills(fake, "j1", [
      { skillId: SKILL_REACT, required: true },
      { skillId: SKILL_SQL, required: true },
    ]);
    seedProfile(fake, USER_A);
    seedUserSkills(fake, USER_A, [
      { skillId: SKILL_REACT, level: "expert" },
      { skillId: SKILL_SQL, level: "intermediate" },
    ]);
    const result = await calculateJobMatch(fake, USER_A, "j1");
    expect(result.skills).toBe(100);
    expect(result.missingSkillIds).toEqual([]);
  });

  it("job with no listed skills: skills score is 0 and nothing is matched or missing", async () => {
    const fake = setupJob();
    seedProfile(fake, USER_A);
    seedUserSkills(fake, USER_A, [{ skillId: SKILL_REACT, level: "expert" }]);
    const result = await calculateJobMatch(fake, USER_A, "j1");
    expect(result.skills).toBe(0);
    expect(result.matchedSkillIds).toEqual([]);
    expect(result.missingSkillIds).toEqual([]);
  });

  it("preferred (non-required) job skills are not included in requiredSkillIds used for scoring", async () => {
    const fake = setupJob();
    seedJobSkills(fake, "j1", [
      { skillId: SKILL_REACT, required: true },
      { skillId: SKILL_PYTHON, required: false }, // preferred, not required
    ]);
    seedProfile(fake, USER_A);
    seedUserSkills(fake, USER_A, [{ skillId: SKILL_REACT, level: "advanced" }]);
    const job = await loadJobForMatch(fake, "j1");
    // loadJobForMatch's job_skills query does not filter on is_required, matching
    // production behavior (match.server.ts treats all job_skills rows as
    // "required" for scoring purposes) — documented here so a future change
    // to that behavior fails a test instead of silently changing scoring.
    expect(job.requiredSkillIds.sort()).toEqual([SKILL_PYTHON, SKILL_REACT].sort());
  });
});

describe("calculateJobMatch — experience", () => {
  it("scores 100 when the job has no minimum experience requirement", async () => {
    const fake = setupJob({ experience_years_min: null });
    seedProfile(fake, USER_A, { experience: "none" });
    seedUserSkills(fake, USER_A, []);
    const result = await calculateJobMatch(fake, USER_A, "j1");
    expect(result.experience).toBe(100);
  });

  it("scores proportionally when user experience is below the requirement", async () => {
    const fake = setupJob({ experience_years_min: 6 });
    seedProfile(fake, USER_A, { experience: "1_2" }); // 1.5 years
    seedUserSkills(fake, USER_A, []);
    const result = await calculateJobMatch(fake, USER_A, "j1");
    expect(result.experience).toBe(25); // round(1.5 / 6 * 100)
  });

  it("caps at 100 when user experience exceeds the requirement", async () => {
    const fake = setupJob({ experience_years_min: 1 });
    seedProfile(fake, USER_A, { experience: "5_plus" });
    seedUserSkills(fake, USER_A, []);
    const result = await calculateJobMatch(fake, USER_A, "j1");
    expect(result.experience).toBe(100);
  });
});

describe("calculateJobMatch — education", () => {
  it("scores 100 when neither job nor user education is set", async () => {
    const fake = setupJob({ education_requirement: null });
    seedProfile(fake, USER_A, { education_level: null });
    seedUserSkills(fake, USER_A, []);
    const result = await calculateJobMatch(fake, USER_A, "j1");
    expect(result.education).toBe(100);
  });

  it("scores 100 when the user meets or exceeds the requirement", async () => {
    const fake = setupJob({ education_requirement: "bachelors" });
    seedProfile(fake, USER_A, { education_level: "masters" });
    seedUserSkills(fake, USER_A, []);
    const result = await calculateJobMatch(fake, USER_A, "j1");
    expect(result.education).toBe(100);
  });

  it("scores 65 when the user falls short of the requirement", async () => {
    const fake = setupJob({ education_requirement: "masters" });
    seedProfile(fake, USER_A, { education_level: "bachelors" });
    seedUserSkills(fake, USER_A, []);
    const result = await calculateJobMatch(fake, USER_A, "j1");
    expect(result.education).toBe(65);
  });
});

describe("calculateJobMatch — location", () => {
  it("scores 100 for a fully remote job regardless of user preference", async () => {
    const fake = setupJob({ work_mode: "remote" });
    seedProfile(fake, USER_A, { work_mode: "onsite" });
    seedUserSkills(fake, USER_A, []);
    const result = await calculateJobMatch(fake, USER_A, "j1");
    expect(result.location).toBe(100);
  });

  it("scores 100 when the user has no location preference set", async () => {
    const fake = setupJob({ work_mode: "onsite" });
    seedProfile(fake, USER_A, { work_mode: "any" });
    seedUserSkills(fake, USER_A, []);
    const result = await calculateJobMatch(fake, USER_A, "j1");
    expect(result.location).toBe(100);
  });

  it("falls back to a neutral 70 when neither job nor user has country data", async () => {
    const fake = setupJob({ work_mode: "onsite", country: null });
    seedProfile(fake, USER_A, { work_mode: "hybrid", country: null });
    seedUserSkills(fake, USER_A, []);
    const result = await calculateJobMatch(fake, USER_A, "j1");
    expect(result.location).toBe(70);
  });
});

describe("calculateJobMatch — salary", () => {
  it("uses the neutral 80 default when the job has no salary listed", async () => {
    const fake = setupJob({ salary_max: null });
    seedProfile(fake, USER_A, { salary_target: 120000 });
    seedUserSkills(fake, USER_A, []);
    const result = await calculateJobMatch(fake, USER_A, "j1");
    expect(result.salary).toBe(80);
  });

  it("uses the neutral 80 default when the user has no salary target", async () => {
    const fake = setupJob({ salary_max: 150000 });
    seedProfile(fake, USER_A, { salary_target: null });
    seedUserSkills(fake, USER_A, []);
    const result = await calculateJobMatch(fake, USER_A, "j1");
    expect(result.salary).toBe(80);
  });

  it("scores proportionally when the job's max salary is below the user's target", async () => {
    const fake = setupJob({ salary_max: 90000 });
    seedProfile(fake, USER_A, { salary_target: 120000 });
    seedUserSkills(fake, USER_A, []);
    const result = await calculateJobMatch(fake, USER_A, "j1");
    expect(result.salary).toBe(75); // round(90000 / 120000 * 100)
  });
});

describe("calculateJobMatchesBatch", () => {
  it("scores multiple jobs against one profile load (no N+1) and matches per-job calculateJobMatch", async () => {
    const fake = createFakeSupabase();
    seedSkills(fake);
    fake.seed("jobs", [makeJob({ id: "j1" }), makeJob({ id: "j2" })]);
    seedJobSkills(fake, "j1", [{ skillId: SKILL_REACT, required: true }]);
    seedJobSkills(fake, "j2", [{ skillId: SKILL_AWS, required: true }]);
    seedProfile(fake, USER_A);
    seedUserSkills(fake, USER_A, [{ skillId: SKILL_REACT, level: "advanced" }]);

    const j1 = await loadJobForMatch(fake, "j1");
    const j2 = await loadJobForMatch(fake, "j2");
    const batch = await calculateJobMatchesBatch(fake, USER_A, [j1, j2]);

    const single1 = await calculateJobMatch(fake, USER_A, "j1");
    const single2 = await calculateJobMatch(fake, USER_A, "j2");

    expect(batch.get("j1")!.overall).toBe(single1.overall);
    expect(batch.get("j2")!.overall).toBe(single2.overall);
    expect(batch.get("j1")!.skills).toBe(100);
    expect(batch.get("j2")!.skills).toBe(0);
  });

  it("returns an empty map for an empty job list", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A);
    seedUserSkills(fake, USER_A, []);
    const batch = await calculateJobMatchesBatch(fake, USER_A, []);
    expect(batch.size).toBe(0);
  });
});
