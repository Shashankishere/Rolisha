import { describe, expect, it } from "vitest";
import {
  applyProjectStatusToDetail,
  applyProjectStatusToListItem,
  getProjectDetail,
  groupTasksIntoMilestones,
  listProjectsForUser,
  saveProjectTaskProgress,
  setProjectStatus,
  submitProjectTask,
  type ProjectTask,
} from "@/lib/projects.server";
import { createFakeSupabase } from "@/lib/jobs/__tests__/fake-supabase";
import { USER_A, USER_B } from "@/lib/jobs/__tests__/fixtures";

const CAREER_DA = "career-data-analyst";
const CAREER_SE = "career-software-engineer";

function seedProjects(fake: ReturnType<typeof createFakeSupabase>) {
  fake.seed("projects", [
    {
      id: "proj-1",
      slug: "sales-dashboard",
      title: "Sales Performance Dashboard",
      summary: "Build a dashboard.",
      difficulty: "beginner",
      estimated_hours: 15,
      skills: ["Excel", "Data Visualization"],
      career_id: CAREER_DA,
      resume_bullet: "Built a dashboard.",
    },
    {
      id: "proj-2",
      slug: "task-api",
      title: "Task API with Auth",
      summary: "Build an API.",
      difficulty: "intermediate",
      estimated_hours: 20,
      skills: ["Node.js", "API Design"],
      career_id: CAREER_SE,
      resume_bullet: "Built an API.",
    },
  ]);
}

describe("listProjectsForUser", () => {
  it("returns every catalog project with not_started status when the user has no progress", async () => {
    const fake = createFakeSupabase();
    seedProjects(fake);
    fake.seed("profiles", [{ id: USER_A, career_id: CAREER_DA }]);

    const result = await listProjectsForUser(fake, USER_A);
    expect(result).toHaveLength(2);
    expect(result.every((p) => p.status === "not_started")).toBe(true);
  });

  it("marks projects matching the user's career as recommended and sorts them first", async () => {
    const fake = createFakeSupabase();
    seedProjects(fake);
    fake.seed("profiles", [{ id: USER_A, career_id: CAREER_SE }]);

    const result = await listProjectsForUser(fake, USER_A);
    expect(result[0]?.id).toBe("proj-2");
    expect(result[0]?.isRecommended).toBe(true);
    expect(result[1]?.isRecommended).toBe(false);
  });

  it("a user with no career set on their profile gets no recommendations, not an error", async () => {
    const fake = createFakeSupabase();
    seedProjects(fake);
    fake.seed("profiles", [{ id: USER_A, career_id: null }]);

    const result = await listProjectsForUser(fake, USER_A);
    expect(result.every((p) => p.isRecommended === false)).toBe(true);
  });

  it("merges the user's own user_projects status and never leaks another user's status", async () => {
    const fake = createFakeSupabase();
    seedProjects(fake);
    fake.seed("profiles", [{ id: USER_A, career_id: null }]);
    fake.seed("user_projects", [
      {
        user_id: USER_A,
        project_id: "proj-1",
        status: "started",
        repo_url: null,
        completed_at: null,
      },
      {
        user_id: USER_B,
        project_id: "proj-2",
        status: "completed",
        repo_url: null,
        completed_at: "2026-01-01",
      },
    ]);

    const result = await listProjectsForUser(fake, USER_A);
    const proj1 = result.find((p) => p.id === "proj-1");
    const proj2 = result.find((p) => p.id === "proj-2");
    expect(proj1?.status).toBe("started");
    expect(proj2?.status).toBe("not_started"); // that's User B's completion, not User A's
  });
});

describe("setProjectStatus", () => {
  it("starting a project upserts a user_projects row and logs a progress event", async () => {
    const fake = createFakeSupabase();
    seedProjects(fake);

    await setProjectStatus(fake, USER_A, "proj-1", "started");

    const rows = fake.table("user_projects");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ user_id: USER_A, project_id: "proj-1", status: "started" });

    const events = fake.table("progress_events");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ user_id: USER_A, event_type: "project_started" });
  });

  // Regression test for the "Start project" button: a fast double-click (or
  // a retry after a slow response) must never create a second project row
  // or a second progress-event entry for the same user/project.
  it("clicking Start twice in a row for the same project never creates a duplicate row", async () => {
    const fake = createFakeSupabase();
    seedProjects(fake);

    await setProjectStatus(fake, USER_A, "proj-1", "started");
    await setProjectStatus(fake, USER_A, "proj-1", "started");

    const rows = fake.table("user_projects");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ user_id: USER_A, project_id: "proj-1", status: "started" });
  });

  it("completing a project sets completed_at and logs a project_completed event", async () => {
    const fake = createFakeSupabase();
    seedProjects(fake);

    await setProjectStatus(fake, USER_A, "proj-1", "started");
    await setProjectStatus(fake, USER_A, "proj-1", "completed");

    const rows = fake.table("user_projects");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "completed" });
    expect(rows[0]?.["completed_at"]).toBeTruthy();

    const events = fake.table("progress_events");
    expect(events.filter((e) => e["event_type"] === "project_completed")).toHaveLength(1);
  });

  it("resetting to not_started deletes the row and does not log a progress event", async () => {
    const fake = createFakeSupabase();
    seedProjects(fake);

    await setProjectStatus(fake, USER_A, "proj-1", "started");
    await setProjectStatus(fake, USER_A, "proj-1", "not_started");

    expect(fake.table("user_projects")).toHaveLength(0);
    expect(fake.table("progress_events")).toHaveLength(1); // only the earlier "started" event
  });

  it("two users can independently track status on the same project", async () => {
    const fake = createFakeSupabase();
    seedProjects(fake);

    await setProjectStatus(fake, USER_A, "proj-1", "started");
    await setProjectStatus(fake, USER_B, "proj-1", "completed");

    const rows = fake.table("user_projects");
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r["user_id"] === USER_A)).toMatchObject({ status: "started" });
    expect(rows.find((r) => r["user_id"] === USER_B)).toMatchObject({ status: "completed" });
  });

  // Regression test for "Start project → refresh the page must still show
  // in progress": starting a project must be readable back through the
  // exact same read path the page's loader uses (getProjectDetail), not
  // just visible in the raw table row.
  it("a started project is reflected by getProjectDetail on a fresh read, as if the page were reloaded", async () => {
    const fake = createFakeSupabase();
    seedProjects(fake);

    const before = await getProjectDetail(fake, USER_A, "proj-1");
    expect(before?.status).toBe("not_started");

    await setProjectStatus(fake, USER_A, "proj-1", "started");

    // A brand new read, exactly like a hard page refresh would trigger —
    // no reliance on any in-memory/client cache carrying the new status.
    const after = await getProjectDetail(fake, USER_A, "proj-1");
    expect(after?.status).toBe("started");
  });
});

describe("setProjectStatus — Free plan limits", () => {
  it("blocks starting a 3rd distinct project on the Free plan", async () => {
    const fake = createFakeSupabase();
    seedProjects(fake);
    fake.seed("profiles", [{ id: USER_A, plan: "free" }]);
    fake.seed("projects", [
      ...fake.table("projects"),
      {
        id: "proj-3",
        slug: "p3",
        title: "P3",
        summary: "",
        difficulty: "beginner",
        estimated_hours: 5,
        skills: [],
        career_id: null,
        resume_bullet: "",
      },
    ]);

    await setProjectStatus(fake, USER_A, "proj-1", "started");
    await setProjectStatus(fake, USER_A, "proj-2", "started");
    await expect(setProjectStatus(fake, USER_A, "proj-3", "started")).rejects.toThrow(/pro plan/i);
    expect(fake.table("user_projects")).toHaveLength(2);
  });

  it("never blocks updating the status of a project already started on Free", async () => {
    const fake = createFakeSupabase();
    seedProjects(fake);
    fake.seed("profiles", [{ id: USER_A, plan: "free" }]);

    await setProjectStatus(fake, USER_A, "proj-1", "started");
    await setProjectStatus(fake, USER_A, "proj-2", "started");
    await expect(setProjectStatus(fake, USER_A, "proj-1", "completed")).resolves.toEqual({
      ok: true,
    });
  });

  it("Pro plan can start more than 2 projects", async () => {
    const fake = createFakeSupabase();
    seedProjects(fake);
    fake.seed("profiles", [{ id: USER_A, plan: "pro" }]);
    fake.seed("projects", [
      ...fake.table("projects"),
      {
        id: "proj-3",
        slug: "p3",
        title: "P3",
        summary: "",
        difficulty: "beginner",
        estimated_hours: 5,
        skills: [],
        career_id: null,
        resume_bullet: "",
      },
    ]);

    await setProjectStatus(fake, USER_A, "proj-1", "started");
    await setProjectStatus(fake, USER_A, "proj-2", "started");
    await expect(setProjectStatus(fake, USER_A, "proj-3", "started")).resolves.toEqual({
      ok: true,
    });
  });
});

describe("getProjectDetail", () => {
  function seedSkillsAndAssessment(fake: ReturnType<typeof createFakeSupabase>) {
    fake.seed("skills", [
      { id: "skill-excel", name: "Excel" },
      { id: "skill-dataviz", name: "Data Visualization" },
    ]);
    fake.seed("assessments", [{ id: "assess-1", slug: "excel-basics", skill_id: "skill-excel" }]);
  }

  it("marks a prerequisite ready only when the user has a recorded (non-none) level", async () => {
    const fake = createFakeSupabase();
    seedProjects(fake);
    seedSkillsAndAssessment(fake);
    fake.seed("user_skills", [{ user_id: USER_A, skill_id: "skill-excel", level: "intermediate" }]);

    const detail = await getProjectDetail(fake, USER_A, "proj-1");

    expect(detail).not.toBeNull();
    const excel = detail!.prerequisites.find((p) => p.name === "Excel");
    const dataviz = detail!.prerequisites.find((p) => p.name === "Data Visualization");
    expect(excel?.ready).toBe(true);
    expect(dataviz?.ready).toBe(false);
  });

  it("treats a user with no recorded skills as not meeting any prerequisite", async () => {
    const fake = createFakeSupabase();
    seedProjects(fake);
    seedSkillsAndAssessment(fake);

    const detail = await getProjectDetail(fake, USER_A, "proj-1");
    expect(detail!.prerequisites.every((p) => !p.ready)).toBe(true);
  });

  it("surfaces a matching assessment for the project's skills when one exists", async () => {
    const fake = createFakeSupabase();
    seedProjects(fake);
    seedSkillsAndAssessment(fake);

    const detail = await getProjectDetail(fake, USER_A, "proj-1");
    expect(detail!.assessmentSlug).toBe("excel-basics");
  });

  it("returns a null assessmentSlug when no assessment covers the project's skills", async () => {
    const fake = createFakeSupabase();
    seedProjects(fake);
    fake.seed("skills", [
      { id: "skill-excel", name: "Excel" },
      { id: "skill-dataviz", name: "Data Visualization" },
    ]);
    // No assessments seeded at all.

    const detail = await getProjectDetail(fake, USER_A, "proj-1");
    expect(detail!.assessmentSlug).toBeNull();
  });

  it("returns null for a project that doesn't exist", async () => {
    const fake = createFakeSupabase();
    seedProjects(fake);

    const detail = await getProjectDetail(fake, USER_A, "does-not-exist");
    expect(detail).toBeNull();
  });
});

describe("groupTasksIntoMilestones", () => {
  function task(index: number, completed: boolean): ProjectTask {
    return {
      index,
      title: `Task ${index}`,
      completed,
      status: completed ? "completed" : "not_started",
      note: "",
      link: null,
      updatedAt: null,
      evidence: [],
    };
  }

  it("returns no milestones for a project with no checklist", () => {
    expect(groupTasksIntoMilestones([])).toEqual({ milestones: [], currentMilestoneIndex: 0 });
  });

  it("groups a 4-task checklist into 2 milestones of 2 tasks each", () => {
    const tasks = [task(0, false), task(1, false), task(2, false), task(3, false)];
    const { milestones } = groupTasksIntoMilestones(tasks);
    expect(milestones).toHaveLength(2);
    expect(milestones[0]?.tasks.map((t) => t.index)).toEqual([0, 1]);
    expect(milestones[1]?.tasks.map((t) => t.index)).toEqual([2, 3]);
  });

  it("points at the first milestone with an incomplete task as current", () => {
    // First milestone (tasks 0-1) fully done, second (2-3) not.
    const tasks = [task(0, true), task(1, true), task(2, true), task(3, false)];
    const { milestones, currentMilestoneIndex } = groupTasksIntoMilestones(tasks);
    expect(milestones[0]?.isComplete).toBe(true);
    expect(milestones[1]?.isComplete).toBe(false);
    expect(currentMilestoneIndex).toBe(1);
  });

  it("points at the last milestone once every task is complete", () => {
    const tasks = [task(0, true), task(1, true), task(2, true), task(3, true)];
    const { milestones, currentMilestoneIndex } = groupTasksIntoMilestones(tasks);
    expect(milestones.every((m) => m.isComplete)).toBe(true);
    expect(currentMilestoneIndex).toBe(milestones.length - 1);
  });

  it("handles an odd number of tasks with a shorter final milestone", () => {
    const tasks = [task(0, false), task(1, false), task(2, false)];
    const { milestones } = groupTasksIntoMilestones(tasks);
    expect(milestones).toHaveLength(2);
    expect(milestones[0]?.totalCount).toBe(2);
    expect(milestones[1]?.totalCount).toBe(1);
  });
});

describe("setProjectStatus — completion requires all tasks done", () => {
  function seedProjectWithRequirements(fake: ReturnType<typeof createFakeSupabase>) {
    fake.seed("projects", [
      {
        id: "proj-1",
        slug: "sales-dashboard",
        title: "Sales Performance Dashboard",
        summary: "Build a dashboard.",
        difficulty: "beginner",
        estimated_hours: 15,
        skills: ["Excel"],
        career_id: CAREER_DA,
        resume_bullet: "Built a dashboard.",
        requirements: ["Step one", "Step two", "Step three", "Step four"],
      },
    ]);
  }

  it("refuses to mark a project complete when checklist steps remain (server-side, not just a disabled button)", async () => {
    const fake = createFakeSupabase();
    seedProjectWithRequirements(fake);
    fake.seed("user_projects", [
      {
        user_id: USER_A,
        project_id: "proj-1",
        status: "started",
        completed_tasks: [0, 1], // only 2 of 4 done
        repo_url: null,
        completed_at: null,
      },
    ]);

    await expect(setProjectStatus(fake, USER_A, "proj-1", "completed")).rejects.toThrow(/2\/4/);
    expect(fake.table("user_projects")[0]?.["status"]).toBe("started");
  });

  it("allows completion once every checklist step is done", async () => {
    const fake = createFakeSupabase();
    seedProjectWithRequirements(fake);
    fake.seed("user_projects", [
      {
        user_id: USER_A,
        project_id: "proj-1",
        status: "started",
        completed_tasks: [0, 1, 2, 3],
        repo_url: null,
        completed_at: null,
      },
    ]);

    await setProjectStatus(fake, USER_A, "proj-1", "completed");
    expect(fake.table("user_projects")[0]?.["status"]).toBe("completed");
  });
});

describe("listProjectsForUser — real task-progress counts", () => {
  it("reports real completed/total task counts instead of a fixed stage percentage", async () => {
    const fake = createFakeSupabase();
    fake.seed("projects", [
      {
        id: "proj-1",
        slug: "sales-dashboard",
        title: "Sales Performance Dashboard",
        summary: "Build a dashboard.",
        difficulty: "beginner",
        estimated_hours: 15,
        skills: ["Excel"],
        career_id: CAREER_DA,
        resume_bullet: "Built a dashboard.",
        requirements: ["Step one", "Step two", "Step three", "Step four"],
      },
    ]);
    fake.seed("profiles", [{ id: USER_A, career_id: null }]);
    fake.seed("user_projects", [
      {
        user_id: USER_A,
        project_id: "proj-1",
        status: "started",
        completed_tasks: [0],
        repo_url: null,
        completed_at: null,
      },
    ]);

    const result = await listProjectsForUser(fake, USER_A);
    const proj1 = result.find((p) => p.id === "proj-1")!;
    expect(proj1.completedTaskCount).toBe(1);
    expect(proj1.totalTaskCount).toBe(4);
  });

  it("reports full completion counts for a completed project even without an explicit completed_tasks array", async () => {
    const fake = createFakeSupabase();
    fake.seed("projects", [
      {
        id: "proj-1",
        slug: "sales-dashboard",
        title: "Sales Performance Dashboard",
        summary: "Build a dashboard.",
        difficulty: "beginner",
        estimated_hours: 15,
        skills: ["Excel"],
        career_id: CAREER_DA,
        resume_bullet: "Built a dashboard.",
        requirements: ["Step one", "Step two", "Step three", "Step four"],
      },
    ]);
    fake.seed("profiles", [{ id: USER_A, career_id: null }]);
    fake.seed("user_projects", [
      {
        user_id: USER_A,
        project_id: "proj-1",
        status: "completed",
        completed_tasks: [0, 1, 2, 3],
        repo_url: null,
        completed_at: "2026-01-01",
      },
    ]);

    const result = await listProjectsForUser(fake, USER_A);
    expect(result.find((p) => p.id === "proj-1")!.completedTaskCount).toBe(4);
  });
});

describe("project task workspace — evidence-gated completion", () => {
  function seedProjectWithRequirements(fake: ReturnType<typeof createFakeSupabase>) {
    fake.seed("projects", [
      {
        id: "proj-1",
        slug: "sales-dashboard",
        title: "Sales Performance Dashboard",
        summary: "Build a dashboard.",
        difficulty: "beginner",
        estimated_hours: 15,
        skills: ["Excel"],
        career_id: CAREER_DA,
        resume_bullet: "Built a dashboard.",
        requirements: ["Step one", "Step two", "Step three", "Step four"],
      },
    ]);
  }

  it("refuses to submit a task with a trivial/empty note (no one-click completion)", async () => {
    const fake = createFakeSupabase();
    seedProjectWithRequirements(fake);

    await expect(
      submitProjectTask(fake, USER_A, "proj-1", 0, { note: "done", link: null }),
    ).rejects.toThrow(/describe what you actually did/i);
    expect(fake.table("user_projects")).toHaveLength(0);
  });

  it("saving a draft does not mark the task completed", async () => {
    const fake = createFakeSupabase();
    seedProjectWithRequirements(fake);

    await saveProjectTaskProgress(fake, USER_A, "proj-1", 0, {
      note: "Started setting up the repo.",
      link: null,
    });

    const detail = await getProjectDetail(fake, USER_A, "proj-1");
    const task = detail!.tasks[0]!;
    expect(task.status).toBe("in_progress");
    expect(task.completed).toBe(false);
    expect(task.note).toBe("Started setting up the repo.");
  });

  it("submitting real evidence marks the task completed and preserves the evidence", async () => {
    const fake = createFakeSupabase();
    seedProjectWithRequirements(fake);

    await submitProjectTask(fake, USER_A, "proj-1", 0, {
      note: "Created the GitHub repo and pushed the initial commit with the folder structure.",
      link: "https://github.com/example/repo",
    });

    const detail = await getProjectDetail(fake, USER_A, "proj-1");
    const task = detail!.tasks[0]!;
    expect(task.status).toBe("completed");
    expect(task.completed).toBe(true);
    expect(task.link).toBe("https://github.com/example/repo");
    expect(detail!.milestones[0]?.completedCount).toBe(1);
  });

  it("a completed task cannot be reopened via the draft-save path", async () => {
    const fake = createFakeSupabase();
    seedProjectWithRequirements(fake);
    await submitProjectTask(fake, USER_A, "proj-1", 0, {
      note: "Created the GitHub repo and pushed the initial commit.",
      link: null,
    });

    await expect(
      saveProjectTaskProgress(fake, USER_A, "proj-1", 0, { note: "trying to edit", link: null }),
    ).rejects.toThrow(/already completed/i);
  });

  it("still refuses project completion server-side even if the client tries to skip steps", async () => {
    const fake = createFakeSupabase();
    seedProjectWithRequirements(fake);
    await submitProjectTask(fake, USER_A, "proj-1", 0, {
      note: "Created the GitHub repo and pushed the initial commit.",
      link: null,
    });

    await expect(setProjectStatus(fake, USER_A, "proj-1", "completed")).rejects.toThrow(/1\/4/);
  });
});

describe("applyProjectStatusToDetail (Start Project button cache-patch regression)", () => {
  it("updates the cached detail's status in place", () => {
    const before = { id: "proj-1", status: "not_started" as const, title: "Task API" };
    const after = applyProjectStatusToDetail(before, "started");
    expect(after).toEqual({ id: "proj-1", status: "started", title: "Task API" });
  });

  it("leaves other fields untouched", () => {
    const before = { id: "proj-1", status: "not_started" as const, tasks: [1, 2, 3] };
    const after = applyProjectStatusToDetail(before, "started");
    expect(after?.tasks).toEqual([1, 2, 3]);
  });

  it("is a no-op when there is nothing cached yet", () => {
    expect(applyProjectStatusToDetail(undefined, "started")).toBeUndefined();
    expect(applyProjectStatusToDetail(null, "started")).toBeNull();
  });
});

describe("applyProjectStatusToListItem (Start Project button cache-patch regression)", () => {
  it("updates only the matching project's status in the cached list", () => {
    const before = [
      { id: "proj-1", status: "not_started" as const },
      { id: "proj-2", status: "not_started" as const },
    ];
    const after = applyProjectStatusToListItem(before, "proj-1", "started");
    expect(after).toEqual([
      { id: "proj-1", status: "started" },
      { id: "proj-2", status: "not_started" },
    ]);
  });

  it("is a no-op when the list isn't cached yet", () => {
    expect(applyProjectStatusToListItem(undefined, "proj-1", "started")).toBeUndefined();
  });

  it("leaves the list unchanged if the project id isn't found", () => {
    const before = [{ id: "proj-1", status: "not_started" as const }];
    expect(applyProjectStatusToListItem(before, "does-not-exist", "started")).toEqual(before);
  });
});

describe("setProjectStatus + listProjectsForUser/getProjectDetail (Start Project button regression)", () => {
  it("a project immediately reads back as started from both the list and detail queries the UI reads from", async () => {
    const fake = createFakeSupabase();
    seedProjects(fake);
    fake.seed("profiles", [{ id: USER_A, career_id: CAREER_DA }]);

    await setProjectStatus(fake, USER_A, "proj-1", "started");

    const list = await listProjectsForUser(fake, USER_A);
    expect(list.find((p) => p.id === "proj-1")?.status).toBe("started");

    const detail = await getProjectDetail(fake, USER_A, "proj-1");
    expect(detail?.status).toBe("started");
  });
});
