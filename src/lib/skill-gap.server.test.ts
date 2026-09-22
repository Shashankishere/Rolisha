import { describe, expect, it } from "vitest";
import { createFakeSupabase } from "@/lib/jobs/__tests__/fake-supabase";
import { seedProfile, seedUserSkills, USER_A } from "@/lib/jobs/__tests__/fixtures";
import { loadAdvancedSkillGap, MIN_LIVE_JOBS_FOR_SIGNAL } from "@/lib/skill-gap.server";
import { UpgradeRequiredError } from "@/lib/subscription";

const CAREER_1 = "career-1";
const SKILL_SQL = "skill-sql";
const SKILL_PY = "skill-py";

function seedCareerSkills(fake: ReturnType<typeof createFakeSupabase>) {
  fake.seed("skills", [
    { id: SKILL_SQL, name: "SQL" },
    { id: SKILL_PY, name: "Python" },
  ]);
  fake.seed("career_skills", [
    {
      id: "cs-1",
      career_id: CAREER_1,
      skill_id: SKILL_SQL,
      importance: "critical",
      required_level: "advanced",
      demand_percentage: 70,
      sort_order: 1,
      skills: { name: "SQL" },
    },
    {
      id: "cs-2",
      career_id: CAREER_1,
      skill_id: SKILL_PY,
      importance: "medium",
      required_level: "intermediate",
      demand_percentage: 40,
      sort_order: 2,
      skills: { name: "Python" },
    },
  ]);
}

function seedRealJob(fake: ReturnType<typeof createFakeSupabase>, id: string, skillIds: string[]) {
  fake.table("jobs").push({ id, career_id: CAREER_1, is_demo: false });
  for (const skillId of skillIds) {
    fake.table("job_skills").push({ job_id: id, skill_id: skillId });
  }
}

describe("loadAdvancedSkillGap", () => {
  it("refuses free-plan users", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "free", career_id: CAREER_1 });
    seedCareerSkills(fake);

    await expect(loadAdvancedSkillGap(fake, USER_A)).rejects.toThrow(UpgradeRequiredError);
  });

  it("ranks by importance-weighted gap size and derives prerequisites from curriculum order", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro", career_id: CAREER_1 });
    seedCareerSkills(fake);
    seedUserSkills(fake, USER_A, []); // no skills yet -> both are gaps

    const result = await loadAdvancedSkillGap(fake, USER_A);

    expect(result.rows).toHaveLength(2);
    const sql = result.rows.find((r) => r.skillId === SKILL_SQL)!;
    const python = result.rows.find((r) => r.skillId === SKILL_PY)!;

    // SQL is critical importance with a full gap -> higher priority score than
    // Python's medium importance -> ranked first.
    expect(sql.priorityRank).toBe(1);
    expect(python.priorityRank).toBe(2);
    expect(result.recommendedSequence).toEqual(["SQL", "Python"]);

    // Python comes after SQL in curriculum (sort_order), and SQL isn't ready,
    // so SQL should show up as a prerequisite for Python.
    expect(python.prerequisites).toEqual(["SQL"]);
    expect(sql.prerequisites).toEqual([]);
  });

  it("withholds the live job-demand signal when too few real jobs exist", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro", career_id: CAREER_1 });
    seedCareerSkills(fake);
    seedUserSkills(fake, USER_A, []);
    // Only 2 real jobs -- below MIN_LIVE_JOBS_FOR_SIGNAL.
    seedRealJob(fake, "job-1", [SKILL_SQL]);
    seedRealJob(fake, "job-2", [SKILL_SQL]);

    const result = await loadAdvancedSkillGap(fake, USER_A);

    expect(result.liveJobSignal.available).toBe(false);
    expect(result.liveJobSignal.jobsAnalyzed).toBe(2);
    for (const row of result.rows) expect(row.liveJobDemandPercentage).toBeNull();
  });

  it("computes an honest demand percentage from real (is_demo=false) jobs only, ignoring demo jobs", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro", career_id: CAREER_1 });
    seedCareerSkills(fake);
    seedUserSkills(fake, USER_A, []);

    expect(MIN_LIVE_JOBS_FOR_SIGNAL).toBeGreaterThanOrEqual(5);
    for (let i = 0; i < MIN_LIVE_JOBS_FOR_SIGNAL; i++) {
      // 3 out of N jobs require SQL; none require Python.
      seedRealJob(fake, `job-${i}`, i < 3 ? [SKILL_SQL] : []);
    }
    // A demo job requiring Python must NOT count toward the signal.
    fake.table("jobs").push({ id: "demo-job", career_id: CAREER_1, is_demo: true });
    fake.table("job_skills").push({ job_id: "demo-job", skill_id: SKILL_PY });

    const result = await loadAdvancedSkillGap(fake, USER_A);

    expect(result.liveJobSignal.available).toBe(true);
    expect(result.liveJobSignal.jobsAnalyzed).toBe(MIN_LIVE_JOBS_FOR_SIGNAL);
    const sql = result.rows.find((r) => r.skillId === SKILL_SQL)!;
    const python = result.rows.find((r) => r.skillId === SKILL_PY)!;
    expect(sql.liveJobDemandPercentage).toBe(Math.round((3 / MIN_LIVE_JOBS_FOR_SIGNAL) * 100));
    expect(python.liveJobDemandPercentage).toBe(0);
  });

  it("returns no rows for a user with no selected career, never inventing a fallback profile", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro", career_id: null });

    const result = await loadAdvancedSkillGap(fake, USER_A);
    expect(result.rows).toEqual([]);
    expect(result.liveJobSignal.available).toBe(false);
  });
});
