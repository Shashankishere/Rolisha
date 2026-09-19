import { describe, expect, it } from "vitest";
import { addMissingSkillsToRoadmap } from "@/lib/jobs/roadmap-add.server";
import { createFakeSupabase, type FakeSupabase } from "./__tests__/fake-supabase";
import {
  SKILL_AWS,
  SKILL_PYTHON,
  SKILL_REACT,
  USER_A,
  USER_B,
  makeJob,
  seedSkills,
} from "./__tests__/fixtures";

function seedActiveRoadmap(
  fake: FakeSupabase,
  userId: string,
  opts: { months?: number; existingSkillNames?: string[] } = {},
) {
  const roadmapId = `roadmap-${userId}`;
  fake.table("roadmaps").push({
    id: roadmapId,
    user_id: userId,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
  });
  const monthCount = opts.months ?? 2;
  for (let i = 1; i <= monthCount; i++) {
    fake.table("roadmap_months").push({
      id: `${roadmapId}-month-${i}`,
      roadmap_id: roadmapId,
      month_number: i,
      skills: i === 1 ? [...(opts.existingSkillNames ?? [])] : [],
    });
  }
  return roadmapId;
}

function setup() {
  const fake = createFakeSupabase();
  seedSkills(fake);
  fake.seed("jobs", [makeJob({ id: "j1", title: "Backend Engineer", company: "Acme" })]);
  return fake;
}

describe("addMissingSkillsToRoadmap", () => {
  it("adds a skill that isn't in the roadmap yet", async () => {
    const fake = setup();
    const roadmapId = seedActiveRoadmap(fake, USER_A);
    const result = await addMissingSkillsToRoadmap(fake, USER_A, "j1", [SKILL_REACT]);
    expect(result.added).toEqual(["React"]);
    expect(result.alreadyPresent).toEqual([]);
    const tasks = fake.table("roadmap_tasks");
    expect(tasks).toHaveLength(1);
    expect(tasks[0]!["roadmap_id"]).toBe(roadmapId);
  });

  it("does not duplicate a skill already present in the target month", async () => {
    const fake = setup();
    seedActiveRoadmap(fake, USER_A, { existingSkillNames: ["React"] });
    // Pre-seed a task for React in month 1 to simulate it already being tracked.
    fake.table("roadmap_tasks").push({
      id: "existing-task",
      roadmap_id: `roadmap-${USER_A}`,
      month_id: `roadmap-${USER_A}-month-1`,
      user_id: USER_A,
      week_number: 1,
      is_completed: false,
      skill_name: "React",
      title: "Close the gap on React",
    });
    const result = await addMissingSkillsToRoadmap(fake, USER_A, "j1", [SKILL_REACT]);
    expect(result.added).toEqual([]);
    expect(result.alreadyPresent).toEqual(["React"]);
    expect(fake.table("roadmap_tasks")).toHaveLength(1); // no duplicate inserted
  });

  it("adds multiple skills correctly in one call", async () => {
    const fake = setup();
    seedActiveRoadmap(fake, USER_A);
    const result = await addMissingSkillsToRoadmap(fake, USER_A, "j1", [SKILL_REACT, SKILL_AWS]);
    expect(result.added.sort()).toEqual(["AWS", "React"].sort());
    expect(fake.table("roadmap_tasks")).toHaveLength(2);
  });

  it("returns early with empty results for an empty skill list, without touching the roadmap", async () => {
    const fake = setup();
    seedActiveRoadmap(fake, USER_A);
    const result = await addMissingSkillsToRoadmap(fake, USER_A, "j1", []);
    expect(result).toEqual({ added: [], alreadyPresent: [] });
    expect(fake.table("roadmap_tasks")).toHaveLength(0);
  });

  it("throws a clear error when the user has no active roadmap", async () => {
    const fake = setup();
    await expect(addMissingSkillsToRoadmap(fake, USER_A, "j1", [SKILL_REACT])).rejects.toThrow(
      /generate a roadmap first/i,
    );
  });

  it("silently skips an invalid/unknown skill ID (no matching skill row) instead of adding garbage", async () => {
    const fake = setup();
    seedActiveRoadmap(fake, USER_A);
    const bogusId = "99999999-9999-9999-9999-999999999999";
    const result = await addMissingSkillsToRoadmap(fake, USER_A, "j1", [bogusId]);
    expect(result.added).toEqual([]);
    expect(result.alreadyPresent).toEqual([]);
    expect(fake.table("roadmap_tasks")).toHaveLength(0);
  });

  it("a user cannot add skills to another user's roadmap (scoped by authenticated userId)", async () => {
    const fake = setup();
    seedActiveRoadmap(fake, USER_A); // only USER_A has a roadmap
    // USER_B calls the same operation; since the roadmap lookup is scoped to
    // USER_B's own user_id, USER_A's roadmap is invisible to them and this
    // must fail rather than silently mutating USER_A's data.
    await expect(addMissingSkillsToRoadmap(fake, USER_B, "j1", [SKILL_REACT])).rejects.toThrow(
      /generate a roadmap first/i,
    );
    expect(fake.table("roadmap_tasks")).toHaveLength(0);
  });

  it("preserves completed roadmap tasks when adding new skills", async () => {
    const fake = setup();
    seedActiveRoadmap(fake, USER_A);
    fake.table("roadmap_tasks").push({
      id: "completed-task",
      roadmap_id: `roadmap-${USER_A}`,
      month_id: `roadmap-${USER_A}-month-1`,
      user_id: USER_A,
      week_number: 1,
      is_completed: true,
      skill_name: "SQL",
      title: "Close the gap on SQL",
    });
    await addMissingSkillsToRoadmap(fake, USER_A, "j1", [SKILL_REACT]);
    const completed = fake.table("roadmap_tasks").find((t) => t["id"] === "completed-task");
    expect(completed).toBeDefined();
    expect(completed!["is_completed"]).toBe(true);
    expect(completed!["skill_name"]).toBe("SQL");
  });

  it("places new tasks in the first month with an incomplete task, after existing tasks in that month", async () => {
    const fake = setup();
    seedActiveRoadmap(fake, USER_A, { months: 3 });
    const roadmapId = `roadmap-${USER_A}`;
    // Month 1 fully complete -> should be skipped in favor of month 2.
    fake.table("roadmap_tasks").push({
      id: "m1-task",
      roadmap_id: roadmapId,
      month_id: `${roadmapId}-month-1`,
      user_id: USER_A,
      week_number: 1,
      is_completed: true,
      skill_name: "SQL",
      title: "x",
    });
    // Month 2 has an incomplete task at week 2 -> new task should land at week 3.
    fake.table("roadmap_tasks").push({
      id: "m2-task",
      roadmap_id: roadmapId,
      month_id: `${roadmapId}-month-2`,
      user_id: USER_A,
      week_number: 2,
      is_completed: false,
      skill_name: "Python",
      title: "x",
    });

    await addMissingSkillsToRoadmap(fake, USER_A, "j1", [SKILL_REACT]);

    const newTask = fake.table("roadmap_tasks").find((t) => t["skill_name"] === "React");
    expect(newTask).toBeDefined();
    expect(newTask!["month_id"]).toBe(`${roadmapId}-month-2`);
    expect(newTask!["week_number"]).toBe(3);
  });

  it("is idempotent: running the same request twice does not create duplicate roadmap entries", async () => {
    const fake = setup();
    seedActiveRoadmap(fake, USER_A);
    const first = await addMissingSkillsToRoadmap(fake, USER_A, "j1", [SKILL_REACT, SKILL_AWS]);
    const second = await addMissingSkillsToRoadmap(fake, USER_A, "j1", [SKILL_REACT, SKILL_AWS]);

    expect(first.added.sort()).toEqual(["AWS", "React"].sort());
    expect(second.added).toEqual([]);
    expect(second.alreadyPresent.sort()).toEqual(["AWS", "React"].sort());
    expect(fake.table("roadmap_tasks")).toHaveLength(2); // still just the two from the first call
  });

  it("throws when the active roadmap has no months yet", async () => {
    const fake = setup();
    seedActiveRoadmap(fake, USER_A, { months: 0 });
    await expect(addMissingSkillsToRoadmap(fake, USER_A, "j1", [SKILL_REACT])).rejects.toThrow(
      /no months yet/i,
    );
  });

  it("references the job title/company it was added from, falling back gracefully if the job can't be found", async () => {
    const fake = setup();
    seedActiveRoadmap(fake, USER_A);
    await addMissingSkillsToRoadmap(fake, USER_A, "does-not-exist", [SKILL_REACT]);
    const task = fake.table("roadmap_tasks")[0]!;
    expect(task["description"]).toContain("a job you viewed");
  });

  it("uses the real job title/company in the task description when the job exists", async () => {
    const fake = setup();
    seedActiveRoadmap(fake, USER_A);
    await addMissingSkillsToRoadmap(fake, USER_A, "j1", [SKILL_PYTHON]);
    const task = fake.table("roadmap_tasks")[0]!;
    expect(task["description"]).toContain("Backend Engineer at Acme");
  });

  describe("weekly scheduling regression (production roadmap bug)", () => {
    it("never assigns a new week number that collides with another month's existing week", async () => {
      const fake = setup();
      const roadmapId = seedActiveRoadmap(fake, USER_A, { months: 3 });
      // Month 1 (weeks 1-4) is already full up to week 4; month 3 already
      // has a task at week 9 (its own block, 9-12). Adding several skills to
      // month 1 used to keep counting maxWeekInMonth+1, +2, ... straight
      // into month 2's/month 3's territory (e.g. week 9), colliding with
      // the task that already legitimately owns week 9 in month 3.
      fake.table("roadmap_tasks").push(
        {
          id: "m1-w4",
          roadmap_id: roadmapId,
          month_id: `${roadmapId}-month-1`,
          user_id: USER_A,
          week_number: 4,
          is_completed: false,
          skill_name: "SQL",
          title: "x",
        },
        {
          id: "m3-w9",
          roadmap_id: roadmapId,
          month_id: `${roadmapId}-month-3`,
          user_id: USER_A,
          week_number: 9,
          is_completed: false,
          skill_name: "Docker",
          title: "y",
        },
      );

      await addMissingSkillsToRoadmap(fake, USER_A, "j1", [SKILL_REACT, SKILL_AWS, SKILL_PYTHON]);

      const weekNumbers = fake
        .table("roadmap_tasks")
        .filter((t) => t["month_id"] === `${roadmapId}-month-1` && t["skill_name"] !== "SQL")
        .map((t) => t["week_number"]);
      // None of the newly-added weeks should reuse week 9, which already
      // belongs to a different month's task.
      expect(weekNumbers).not.toContain(9);
      // And no two roadmap_tasks anywhere share a week number that would
      // represent two different logical weeks in different months.
      const allTasks = fake.table("roadmap_tasks");
      const weekToMonths = new Map<number, Set<string>>();
      for (const t of allTasks) {
        const wk = t["week_number"] as number;
        const set = weekToMonths.get(wk) ?? new Set<string>();
        set.add(t["month_id"] as string);
        weekToMonths.set(wk, set);
      }
      for (const [, monthIds] of weekToMonths) {
        expect(monthIds.size).toBe(1);
      }
    });

    it("caps a newly-added task's hours to the roadmap's own weekly capacity instead of a fixed 5h", async () => {
      const fake = setup();
      const roadmapId = `roadmap-${USER_A}`;
      fake.table("roadmaps").push({
        id: roadmapId,
        user_id: USER_A,
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
        hours_per_week: 2,
      });
      fake.table("roadmap_months").push({
        id: `${roadmapId}-month-1`,
        roadmap_id: roadmapId,
        month_number: 1,
        skills: [],
      });

      await addMissingSkillsToRoadmap(fake, USER_A, "j1", [SKILL_REACT]);

      const task = fake.table("roadmap_tasks")[0]!;
      expect(task["estimated_hours"] as number).toBeLessThanOrEqual(2);
    });

    it("still defaults to 5h when the roadmap has no hours_per_week set", async () => {
      const fake = setup();
      seedActiveRoadmap(fake, USER_A);
      await addMissingSkillsToRoadmap(fake, USER_A, "j1", [SKILL_REACT]);
      const task = fake.table("roadmap_tasks")[0]!;
      expect(task["estimated_hours"]).toBe(5);
    });

    it("updates the target month's estimated_hours from actual persisted tasks instead of leaving it stale (production bug regression)", async () => {
      const fake = setup();
      const roadmapId = seedActiveRoadmap(fake, USER_A);
      // Pre-existing task in month 1 worth 3h, with the month's stored
      // estimated_hours initially reflecting only that.
      fake.table("roadmap_tasks").push({
        roadmap_id: roadmapId,
        month_id: `${roadmapId}-month-1`,
        week_number: 1,
        is_completed: false,
        skill_name: "Python",
        estimated_hours: 3,
      });
      const month1 = fake.table("roadmap_months").find((m) => m["id"] === `${roadmapId}-month-1`)!;
      month1["estimated_hours"] = 3;

      await addMissingSkillsToRoadmap(fake, USER_A, "j1", [SKILL_REACT]);

      const addedTask = fake.table("roadmap_tasks").find((t) => t["skill_name"] === "React")!;
      const updatedMonth = fake
        .table("roadmap_months")
        .find((m) => m["id"] === `${roadmapId}-month-1`)!;
      const actualTotal = fake
        .table("roadmap_tasks")
        .filter((t) => t["month_id"] === `${roadmapId}-month-1`)
        .reduce((sum, t) => sum + (t["estimated_hours"] as number), 0);

      expect(addedTask["estimated_hours"]).toBeGreaterThan(0);
      expect(updatedMonth["estimated_hours"]).toBe(actualTotal);
      expect(updatedMonth["estimated_hours"]).not.toBe(3);
    });
  });
});
