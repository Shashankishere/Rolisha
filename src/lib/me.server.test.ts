import { describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "@/lib/jobs/__tests__/fake-supabase";
import {
  addCareerRoadmap,
  countUnlockedMonths,
  listCareerRoadmaps,
  loadActiveRoadmap,
  loadProfile,
  loadTaskForCompletion,
  regenerateRoadmapFor,
  setPrimaryCareerRoadmap,
} from "@/lib/me.server";
import { FREE_ROADMAP_DETAIL_MONTHS, UpgradeRequiredError } from "@/lib/subscription";
import { seedProfile, seedUserSkills, USER_A } from "@/lib/jobs/__tests__/fixtures";

describe("loadProfile: Target Salary currency defaults to INR (India-first product)", () => {
  it(
    "falls back to INR, not USD, when a profile row has no salary_currency " +
      "(production regression: profiles.salary_currency used to default to " +
      "'USD' -- see 20260918000000_localize_profile_salary_to_inr.sql)",
    async () => {
      const fake = createFakeSupabase();
      seedProfile(fake, USER_A, { salary_currency: undefined });

      const profile = await loadProfile(fake, USER_A);

      expect(profile.salaryCurrency).toBe("INR");
    },
  );

  it("respects an explicitly-stored currency rather than always forcing INR", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { salary_currency: "EUR" });

    const profile = await loadProfile(fake, USER_A);

    expect(profile.salaryCurrency).toBe("EUR");
  });
});

const USER_ID = "user-roadmap-1";
const ROADMAP_ID = "roadmap-1";

function seedRoadmap(fake: ReturnType<typeof createFakeSupabase>, monthCount: number) {
  fake.seed("roadmaps", [
    {
      id: ROADMAP_ID,
      user_id: USER_ID,
      target_role: "Data Analyst",
      summary: "A plan",
      hours_per_week: 10,
      readiness_score: 40,
      data_mode: "demo",
      jobs_analyzed: 0,
      created_at: "2026-01-01",
      is_active: true,
      is_primary: true,
    },
  ]);
  const months = Array.from({ length: monthCount }, (_, i) => ({
    id: `month-${i + 1}`,
    roadmap_id: ROADMAP_ID,
    month_number: i + 1,
    title: `Month ${i + 1}`,
    goal: `Goal ${i + 1}`,
    topics: [`Topic ${i + 1}`],
    skills: [`Skill ${i + 1}`],
    estimated_hours: 20,
    project_title: `Project ${i + 1}`,
    project_description: "Do the thing",
    milestone: `Milestone ${i + 1}`,
    assessment_skill: `Skill ${i + 1}`,
  }));
  fake.seed(
    "roadmap_months",
    months.map((m) => ({ ...m, user_id: USER_ID })),
  );
  fake.seed(
    "roadmap_tasks",
    months.map((m) => ({
      id: `task-${m.month_number}`,
      roadmap_id: ROADMAP_ID,
      user_id: USER_ID,
      month_id: m.id,
      week_number: 1,
      title: `Task for ${m.title}`,
      description: "Do it",
      skill_name: `Skill ${m.month_number}`,
      estimated_hours: 5,
      is_completed: false,
    })),
  );
}

describe("loadActiveRoadmap", () => {
  it("returns full detail for every month on a pro plan", async () => {
    const fake = createFakeSupabase();
    seedRoadmap(fake, 6);

    const roadmap = await loadActiveRoadmap(fake, USER_ID, "pro");

    expect(roadmap).not.toBeNull();
    expect(roadmap!.totalMonths).toBe(6);
    expect(roadmap!.months.every((m) => !m.locked)).toBe(true);
    expect(roadmap!.months[5]!.goal).toBe("Goal 6");
    expect(roadmap!.months[5]!.tasks).toHaveLength(1);
  });

  it("truncates months beyond the free detail limit, stripping content server-side", async () => {
    const fake = createFakeSupabase();
    seedRoadmap(fake, 6);

    const roadmap = await loadActiveRoadmap(fake, USER_ID, "free");

    expect(roadmap!.totalMonths).toBe(6);
    const unlocked = roadmap!.months.filter((m) => !m.locked);
    const locked = roadmap!.months.filter((m) => m.locked);
    expect(unlocked).toHaveLength(FREE_ROADMAP_DETAIL_MONTHS);
    expect(locked).toHaveLength(6 - FREE_ROADMAP_DETAIL_MONTHS);

    // Locked months must not leak goal/topics/skills/tasks/project/milestone.
    for (const month of locked) {
      expect(month.goal).toBeNull();
      expect(month.topics).toEqual([]);
      expect(month.skills).toEqual([]);
      expect(month.tasks).toEqual([]);
      expect(month.projectTitle).toBeNull();
      expect(month.projectDescription).toBeNull();
      expect(month.milestone).toBeNull();
      // Title and estimated hours are still shown so the preview is honest
      // about what exists, not a mystery box.
      expect(month.title).toBeTruthy();
      expect(month.estimatedHours).toBeGreaterThan(0);
    }
  });

  it("defaults to the free tier when no plan is passed", async () => {
    const fake = createFakeSupabase();
    seedRoadmap(fake, 3);

    const roadmap = await loadActiveRoadmap(fake, USER_ID);
    expect(roadmap!.months.filter((m) => !m.locked)).toHaveLength(FREE_ROADMAP_DETAIL_MONTHS);
  });

  it("returns null when the user has no active roadmap", async () => {
    const fake = createFakeSupabase();
    const roadmap = await loadActiveRoadmap(fake, "nobody", "pro");
    expect(roadmap).toBeNull();
  });
});

/** Marks every seeded task for a given month number complete (mirrors what
 * `setTaskCompletion` does one task at a time in production). */
function completeMonth(fake: ReturnType<typeof createFakeSupabase>, monthNumber: number) {
  for (const task of fake.table("roadmap_tasks")) {
    if (task["month_id"] === `month-${monthNumber}`) task["is_completed"] = true;
  }
}

describe("Free-plan sequential roadmap month unlocking", () => {
  it("unlocks Month 1 by default and keeps every later month locked with no completions", async () => {
    const fake = createFakeSupabase();
    seedRoadmap(fake, 6);

    const roadmap = await loadActiveRoadmap(fake, USER_ID, "free");

    expect(roadmap!.months.filter((m) => !m.locked).map((m) => m.monthNumber)).toEqual([1]);
  });

  it("unlocks Month 2 once every required task in Month 1 is completed", async () => {
    const fake = createFakeSupabase();
    seedRoadmap(fake, 6);
    completeMonth(fake, 1);

    const roadmap = await loadActiveRoadmap(fake, USER_ID, "free");

    expect(roadmap!.months.filter((m) => !m.locked).map((m) => m.monthNumber)).toEqual([1, 2]);
  });

  it("keeps Month 2 locked when Month 1 is only partially completed (9/10-style)", async () => {
    const fake = createFakeSupabase();
    seedRoadmap(fake, 6);
    // A second, still-incomplete task in Month 1 -- month completion
    // requires ALL required tasks, not a percentage.
    fake.table("roadmap_tasks").push({
      id: "task-1-extra",
      roadmap_id: ROADMAP_ID,
      user_id: USER_ID,
      month_id: "month-1",
      week_number: 2,
      title: "Second task for Month 1",
      description: "Do it",
      skill_name: "Skill 1",
      estimated_hours: 5,
      is_completed: false,
    });
    completeMonth(fake, 1); // marks task-1 (and any other Month 1 task) complete...
    // ...except task-1-extra, which stays outstanding on purpose.
    fake.table("roadmap_tasks").find((t) => t["id"] === "task-1-extra")!["is_completed"] = false;

    const roadmap = await loadActiveRoadmap(fake, USER_ID, "free");

    expect(roadmap!.months.filter((m) => !m.locked).map((m) => m.monthNumber)).toEqual([1]);
  });

  it("unlocks the remaining month once the outstanding task is completed too", async () => {
    const fake = createFakeSupabase();
    seedRoadmap(fake, 6);
    fake.table("roadmap_tasks").push({
      id: "task-1-extra",
      roadmap_id: ROADMAP_ID,
      user_id: USER_ID,
      month_id: "month-1",
      week_number: 2,
      title: "Second task for Month 1",
      description: "Do it",
      skill_name: "Skill 1",
      estimated_hours: 5,
      is_completed: false,
    });
    completeMonth(fake, 1); // now both task-1 and task-1-extra are complete

    const roadmap = await loadActiveRoadmap(fake, USER_ID, "free");

    expect(roadmap!.months.filter((m) => !m.locked).map((m) => m.monthNumber)).toEqual([1, 2]);
  });

  it("unlocks month by month as each prior month is completed in turn, through Month 6", async () => {
    const fake = createFakeSupabase();
    seedRoadmap(fake, 6);

    for (let month = 1; month <= 5; month += 1) {
      completeMonth(fake, month);
      const roadmap = await loadActiveRoadmap(fake, USER_ID, "free");
      expect(roadmap!.months.filter((m) => !m.locked)).toHaveLength(month + 1);
    }

    completeMonth(fake, 6);
    const finalRoadmap = await loadActiveRoadmap(fake, USER_ID, "free");
    expect(finalRoadmap!.months.every((m) => !m.locked)).toBe(true);
  });

  it("never unlocks a month out of order, even if a later month is completed while an earlier one isn't", async () => {
    const fake = createFakeSupabase();
    seedRoadmap(fake, 6);
    completeMonth(fake, 3); // Month 1 and 2 are still incomplete.

    const roadmap = await loadActiveRoadmap(fake, USER_ID, "free");

    expect(roadmap!.months.filter((m) => !m.locked).map((m) => m.monthNumber)).toEqual([1]);
  });

  it("keeps Pro fully unlocked regardless of any completion state", async () => {
    const fake = createFakeSupabase();
    seedRoadmap(fake, 6);

    const roadmap = await loadActiveRoadmap(fake, USER_ID, "pro");

    expect(roadmap!.months.every((m) => !m.locked)).toBe(true);
  });
});

describe("countUnlockedMonths (pure)", () => {
  const months = [1, 2, 3, 4, 5, 6].map((n) => ({ id: `m${n}`, month_number: n }));

  it("unlocks only Month 1 for Free with no tasks-by-month data", () => {
    expect(countUnlockedMonths(months, new Map(), "free")).toBe(1);
  });

  it("is unaffected by plan tiers other than free (Pro sees everything)", () => {
    expect(countUnlockedMonths(months, new Map(), "pro")).toBe(Infinity);
  });

  it("unlocks progressively as consecutive months are marked complete", () => {
    const tasksByMonth = new Map([
      ["m1", [{ is_completed: true }]],
      ["m2", [{ is_completed: true }]],
      ["m3", [{ is_completed: false }]],
    ]);
    expect(countUnlockedMonths(months, tasksByMonth, "free")).toBe(3);
  });

  it("treats a month with no recorded tasks as NOT complete, so missing data never silently unlocks the next month", () => {
    const tasksByMonth = new Map([["m1", []]]);
    expect(countUnlockedMonths(months, tasksByMonth, "free")).toBe(1);
  });
});

describe("loadTaskForCompletion", () => {
  it("allows completing a task in the currently unlocked month for a Free user", async () => {
    const fake = createFakeSupabase();
    seedRoadmap(fake, 6);

    const task = await loadTaskForCompletion(fake, USER_ID, "task-1", "free");
    expect(task.id).toBe("task-1");
  });

  it("rejects completing a task in a locked month for a Free user, even with a known task id (direct API bypass)", async () => {
    const fake = createFakeSupabase();
    seedRoadmap(fake, 6);

    await expect(loadTaskForCompletion(fake, USER_ID, "task-2", "free")).rejects.toThrow(
      /complete the previous month/i,
    );
  });

  it("allows completing a later month's task for a Free user once it has actually unlocked", async () => {
    const fake = createFakeSupabase();
    seedRoadmap(fake, 6);
    completeMonth(fake, 1);

    const task = await loadTaskForCompletion(fake, USER_ID, "task-2", "free");
    expect(task.id).toBe("task-2");
  });

  it("never blocks a Pro user from any month's task", async () => {
    const fake = createFakeSupabase();
    seedRoadmap(fake, 6);

    const task = await loadTaskForCompletion(fake, USER_ID, "task-6", "pro");
    expect(task.id).toBe("task-6");
  });

  it("rejects a task id that doesn't belong to the caller", async () => {
    const fake = createFakeSupabase();
    seedRoadmap(fake, 6);

    await expect(loadTaskForCompletion(fake, "someone-else", "task-1", "free")).rejects.toThrow();
  });
});

describe("multiple career roadmaps (Pro)", () => {
  const CAREER_A = "career-primary";
  const CAREER_B = "career-secondary";

  function seedCareers(fake: ReturnType<typeof createFakeSupabase>) {
    fake.seed("careers", [
      { id: CAREER_A, title: "Data Analyst", slug: "data-analyst" },
      { id: CAREER_B, title: "Business Analyst", slug: "business-analyst" },
    ]);
  }

  it("refuses to add a second roadmap on the free plan", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "free", career_id: CAREER_A });
    seedCareers(fake);
    seedUserSkills(fake, USER_A, []);

    await expect(addCareerRoadmap(fake, USER_A, CAREER_B)).rejects.toThrow(UpgradeRequiredError);
  });

  it("lets a Pro user add a second, independent career roadmap without touching the first", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro", career_id: CAREER_A, target_role: "Data Analyst" });
    seedCareers(fake);
    seedUserSkills(fake, USER_A, []);

    // The user already has a primary roadmap for career A.
    const primary = await import("@/lib/me.server").then((m) =>
      m.regenerateRoadmapFor(fake, USER_A),
    );

    const secondary = await addCareerRoadmap(fake, USER_A, CAREER_B);
    expect(secondary.roadmapId).not.toBe(primary.roadmapId);

    const roadmaps = await listCareerRoadmaps(fake, USER_A);
    expect(roadmaps).toHaveLength(2);
    const primaryRow = roadmaps.find((r) => r.id === primary.roadmapId);
    const secondaryRow = roadmaps.find((r) => r.id === secondary.roadmapId);
    expect(primaryRow?.isPrimary).toBe(true);
    expect(secondaryRow?.isPrimary).toBe(false);
    expect(secondaryRow?.careerId).toBe(CAREER_B);

    // The primary roadmap's own months/tasks must be untouched by adding
    // the secondary one.
    const primaryDetail = await loadActiveRoadmap(fake, USER_A, "pro");
    expect(primaryDetail?.id).toBe(primary.roadmapId);
  });

  it("enforces the Pro numeric cap once the plan's roadmap limit is reached", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro", career_id: CAREER_A });
    seedCareers(fake);
    seedUserSkills(fake, USER_A, []);
    // 5 already-active roadmaps -- at the Pro cap.
    for (let i = 0; i < 5; i++) {
      fake.table("roadmaps").push({
        id: `existing-${i}`,
        user_id: USER_A,
        career_id: `career-existing-${i}`,
        is_active: true,
        is_primary: i === 0,
      });
    }

    await expect(addCareerRoadmap(fake, USER_A, CAREER_B)).rejects.toThrow(/limit/i);
  });

  it("switches the primary roadmap and updates profiles.career_id to match", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro", career_id: CAREER_A, target_role: "Data Analyst" });
    seedCareers(fake);
    seedUserSkills(fake, USER_A, []);

    const { regenerateRoadmapFor } = await import("@/lib/me.server");
    const primary = await regenerateRoadmapFor(fake, USER_A);
    const secondary = await addCareerRoadmap(fake, USER_A, CAREER_B);

    await setPrimaryCareerRoadmap(fake, USER_A, secondary.roadmapId);

    const roadmaps = await listCareerRoadmaps(fake, USER_A);
    const primaryRow = roadmaps.find((r) => r.id === primary.roadmapId);
    const secondaryRow = roadmaps.find((r) => r.id === secondary.roadmapId);
    expect(primaryRow?.isPrimary).toBe(false);
    expect(secondaryRow?.isPrimary).toBe(true);

    const profileRow = fake.table("profiles").find((p) => p["id"] === USER_A);
    expect(profileRow?.["career_id"]).toBe(CAREER_B);

    const loaded = await loadActiveRoadmap(fake, USER_A, "pro");
    expect(loaded?.id).toBe(secondary.roadmapId);
  });

  it("rejects switching to a roadmap that doesn't belong to the user", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro", career_id: CAREER_A });
    seedCareers(fake);
    seedUserSkills(fake, USER_A, []);
    fake.table("roadmaps").push({
      id: "someone-elses",
      user_id: "someone-else",
      career_id: CAREER_B,
      is_active: true,
      is_primary: true,
    });

    await expect(setPrimaryCareerRoadmap(fake, USER_A, "someone-elses")).rejects.toThrow();
  });

  it(
    "a historical roadmap that violates the weekly cap cannot be promoted to " +
      "primary via setPrimaryCareerRoadmap, even though it's still is_active " +
      "(ticket regression: switching career tracks must not resurrect a roadmap " +
      "generated before capacity validation existed)",
    async () => {
      const fake = createFakeSupabase();
      seedProfile(fake, USER_A, { plan: "pro", career_id: CAREER_A, target_role: "Data Analyst" });
      seedCareers(fake);
      seedUserSkills(fake, USER_A, []);

      await regenerateRoadmapFor(fake, USER_A); // real, valid primary for CAREER_A

      // A pre-existing, is_active roadmap for CAREER_B whose week 1 totals
      // 1 + 2 + 4 = 7h against a 6h/week budget -- exactly the production
      // shape reported (7h/8h weeks under a 6h cap), seeded directly to
      // simulate data written by an older allocator.
      fake.seed("roadmaps", [
        ...fake.table("roadmaps"),
        {
          id: "invalid-historical",
          user_id: USER_A,
          career_id: CAREER_B,
          hours_per_week: 6,
          is_active: true,
          is_primary: false,
        },
      ]);
      fake.table("roadmap_tasks").push(
        {
          id: "t1",
          roadmap_id: "invalid-historical",
          month_id: "m1",
          week_number: 1,
          estimated_hours: 1,
        },
        {
          id: "t2",
          roadmap_id: "invalid-historical",
          month_id: "m1",
          week_number: 1,
          estimated_hours: 2,
        },
        {
          id: "t3",
          roadmap_id: "invalid-historical",
          month_id: "m1",
          week_number: 1,
          estimated_hours: 4,
        },
      );

      await expect(setPrimaryCareerRoadmap(fake, USER_A, "invalid-historical")).rejects.toThrow(
        /exceeds your weekly hours/i,
      );

      // The previously-good primary must still be primary.
      const roadmaps = await listCareerRoadmaps(fake, USER_A);
      const stillPrimary = roadmaps.find((r) => r.isPrimary);
      expect(stillPrimary?.careerId).toBe(CAREER_A);
    },
  );
});

describe("roadmap generation end-to-end (ticket regression): generate -> persist -> load", () => {
  const CAREER_ID = "career-e2e";
  const SKILL_REACT = "skill-react-e2e";
  const SKILL_SQL = "skill-sql-e2e";
  const SKILL_STATS = "skill-stats-e2e";

  function seedCareerWithGaps(fake: ReturnType<typeof createFakeSupabase>) {
    fake.seed("careers", [{ id: CAREER_ID, title: "Data Analyst", slug: "data-analyst-e2e" }]);
    fake.seed("skills", [
      { id: SKILL_REACT, name: "React" },
      { id: SKILL_SQL, name: "SQL" },
      { id: SKILL_STATS, name: "Statistics" },
    ]);
    fake.seed("career_skills", [
      {
        id: "cs-e2e-1",
        career_id: CAREER_ID,
        skill_id: SKILL_REACT,
        importance: "critical",
        required_level: "advanced",
        demand_percentage: 70,
        sort_order: 1,
        skills: { name: "React" },
      },
      {
        id: "cs-e2e-2",
        career_id: CAREER_ID,
        skill_id: SKILL_SQL,
        importance: "high",
        required_level: "intermediate",
        demand_percentage: 60,
        sort_order: 2,
        skills: { name: "SQL" },
      },
      {
        id: "cs-e2e-3",
        career_id: CAREER_ID,
        skill_id: SKILL_STATS,
        importance: "medium",
        required_level: "intermediate",
        demand_percentage: 40,
        sort_order: 3,
        skills: { name: "Statistics" },
      },
    ]);
  }

  it.each([2, 4, 6, 10, 16, 24, 40])(
    "at %i hours/week, the persisted+loaded roadmap has 6 non-empty months and no week over capacity",
    async (hoursPerWeek) => {
      const fake = createFakeSupabase();
      const userId = `user-e2e-${hoursPerWeek}`;
      seedProfile(fake, userId, {
        plan: "pro",
        career_id: CAREER_ID,
        target_role: "Data Analyst",
        hours_per_week: hoursPerWeek,
      });
      seedCareerWithGaps(fake);
      seedUserSkills(fake, userId, []);

      await regenerateRoadmapFor(fake, userId);
      const roadmap = await loadActiveRoadmap(fake, userId, "pro");

      expect(roadmap).not.toBeNull();
      expect(roadmap!.totalMonths).toBe(6);
      expect(roadmap!.months.every((m) => !m.locked)).toBe(true);

      // Every month has actual tasks -- never just a heading.
      for (const month of roadmap!.months) {
        expect(month.tasks.length).toBeGreaterThan(0);
      }

      // No persisted week exceeds the user's selected weekly capacity, and
      // the month's displayed total matches the sum of its own tasks.
      for (const month of roadmap!.months) {
        const byWeek = new Map<number, number>();
        for (const task of month.tasks) {
          byWeek.set(task.weekNumber, (byWeek.get(task.weekNumber) ?? 0) + task.estimatedHours);
          expect(task.estimatedHours).toBeGreaterThan(0);
        }
        for (const total of byWeek.values()) {
          expect(total).toBeLessThanOrEqual(hoursPerWeek);
        }
        const actualMonthTotal = month.tasks.reduce((sum, t) => sum + t.estimatedHours, 0);
        expect(month.estimatedHours).toBe(actualMonthTotal);
      }
    },
  );

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 10, 12])(
    'exact production failure regression at %i h/week: never attempts a fractional insert, persisted hours are integers, weekly totals stay within capacity, and generation succeeds (22P02 invalid input syntax for type integer: "3.5")',
    async (hoursPerWeek) => {
      const fake = createFakeSupabase();
      const userId = `user-frac-regression-${hoursPerWeek}`;
      seedProfile(fake, userId, {
        plan: "pro",
        career_id: CAREER_ID,
        target_role: "Data Analyst",
        hours_per_week: hoursPerWeek,
      });
      seedCareerWithGaps(fake);
      seedUserSkills(fake, userId, []);

      // The fake's `roadmap_tasks`/`roadmap_months` inserts reproduce the
      // real Postgres INTEGER-column constraint (see fake-supabase.ts) --
      // so if the allocator ever generates a fractional hour like 3.5
      // again, `regenerateRoadmapFor` surfaces the same failure production
      // did, instead of the test silently passing against a permissive
      // in-memory store.
      const result = await regenerateRoadmapFor(fake, userId);
      expect(result.roadmapId).toBeTruthy();

      const months = fake
        .table("roadmap_months")
        .filter((m) => m["roadmap_id"] === result.roadmapId);
      const tasks = fake.table("roadmap_tasks").filter((t) => t["roadmap_id"] === result.roadmapId);
      expect(months.length).toBe(6);
      expect(tasks.length).toBeGreaterThan(0);

      // Persisted hours are integers everywhere.
      for (const m of months) expect(Number.isInteger(m["estimated_hours"])).toBe(true);
      const byWeek = new Map<number, number>();
      for (const t of tasks) {
        expect(Number.isInteger(t["estimated_hours"])).toBe(true);
        const week = t["week_number"] as number;
        byWeek.set(week, (byWeek.get(week) ?? 0) + (t["estimated_hours"] as number));
      }
      for (const total of byWeek.values()) {
        expect(total).toBeLessThanOrEqual(hoursPerWeek);
      }

      // The new roadmap only became primary because generation actually
      // succeeded end-to-end.
      const roadmapRow = fake.table("roadmaps").find((r) => r["id"] === result.roadmapId);
      expect(roadmapRow?.["is_primary"]).toBe(true);
      expect(roadmapRow?.["is_active"]).toBe(true);
    },
  );

  it("refuses to persist a roadmap that would violate the user's weekly capacity", async () => {
    // generateRoadmapRow's capacity guard is exercised indirectly by every
    // hours/week value above succeeding; this asserts the guard function
    // itself is what's wired in by checking a hand-built violating plan is
    // rejected by the same check used before insert.
    const { findWeeklyCapacityViolations } = await import("@/lib/roadmap.server");
    const violatingPlan = [
      {
        monthNumber: 1,
        title: "Month 1",
        goal: "g",
        topics: [],
        skills: [],
        estimatedHours: 100,
        projectTitle: null,
        projectDescription: null,
        milestone: "m",
        assessmentSkill: null,
        tasks: [
          {
            weekNumber: 1,
            title: "Too much",
            description: "d",
            skillName: null,
            estimatedHours: 999,
          },
        ],
      },
    ];
    expect(findWeeklyCapacityViolations(violatingPlan, 6)).not.toEqual([]);
  });

  it(
    "a rejected regeneration leaves the existing valid primary roadmap completely " +
      "untouched (ticket regression: failed generation used to deactivate/demote the " +
      "old primary and insert an empty roadmap as the new one before validation ran)",
    async () => {
      const fake = createFakeSupabase();
      const userId = "user-e2e-failure-safety";
      seedProfile(fake, userId, {
        plan: "pro",
        career_id: CAREER_ID,
        target_role: "Data Analyst",
        hours_per_week: 6,
      });
      seedCareerWithGaps(fake);
      seedUserSkills(fake, userId, []);

      // Build a real, valid primary roadmap first.
      const good = await regenerateRoadmapFor(fake, userId);
      const before = await loadActiveRoadmap(fake, userId, "pro");
      expect(before?.id).toBe(good.roadmapId);
      const monthsBefore = fake.table("roadmap_months").length;
      const tasksBefore = fake.table("roadmap_tasks").length;
      const roadmapsBefore = fake.table("roadmaps").length;

      // Force the next generation attempt to detect a violation, exactly as
      // if the generator's own math had produced one.
      vi.spyOn(
        await import("@/lib/roadmap.server"),
        "findWeeklyCapacityViolations",
      ).mockReturnValueOnce([{ weekNumber: 1, totalHours: 999, limit: 6 }]);

      await expect(regenerateRoadmapFor(fake, userId)).rejects.toThrow(/weekly hours/i);

      // Nothing about the existing valid roadmap changed...
      const after = await loadActiveRoadmap(fake, userId, "pro");
      expect(after?.id).toBe(good.roadmapId);
      const afterRow = fake.table("roadmaps").find((r) => r["id"] === good.roadmapId);
      expect(afterRow?.["is_primary"]).toBe(true);
      expect(afterRow?.["is_active"]).toBe(true);

      // ...and no orphaned roadmap/months/tasks were left behind from the
      // rejected attempt.
      expect(fake.table("roadmaps").length).toBe(roadmapsBefore);
      expect(fake.table("roadmap_months").length).toBe(monthsBefore);
      expect(fake.table("roadmap_tasks").length).toBe(tasksBefore);
    },
  );
});
