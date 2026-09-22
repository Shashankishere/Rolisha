/**
 * Server-side core logic for the Projects page.
 *
 * Reads/writes the existing `projects` (catalog, 8 seeded rows) and
 * `user_projects` (per-user status) tables — no new tables, no reinvented
 * scoring. "Recommended" is a simple career_id match against the user's
 * profile, following the same "keep it explainable" philosophy as
 * roadmap.server.ts.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = any;

// Type-only import — erased at compile time, so this does not create a
// runtime circular dependency with task-evidence.server.ts (which imports
// loadTaskWorkspaceRow from this file). See getProjectDetail in
// projects.functions.ts for where the two are actually composed together.
import type { TaskEvidenceRecord } from "@/lib/task-evidence.server";

export type ProjectStatus = "not_started" | "started" | "completed";

export interface ProjectListItem {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  difficulty: string;
  estimatedHours: number;
  skills: string[];
  isRecommended: boolean;
  status: ProjectStatus;
  repoUrl: string | null;
  resumeBullet: string | null;
  completedAt: string | null;
  /** Real counts from the project's own task checklist — used to show
   * actual progress (not a fixed "started = 60%" stage guess) everywhere
   * this list is rendered (Projects page cards, dashboard). Both are 0 for
   * a project with no step-by-step breakdown defined. */
  completedTaskCount: number;
  totalTaskCount: number;
}

export type TaskWorkStatus = "not_started" | "in_progress" | "completed";

export interface ProjectTask {
  index: number;
  title: string;
  /** True iff status === "completed" — kept alongside `status` so existing
   * UI/consumers that only cared about done-vs-not-done keep working. */
  completed: boolean;
  status: TaskWorkStatus;
  /** The evidence/explanation the user has saved or submitted for this
   * task. Empty string when nothing has been entered yet. */
  note: string;
  /** Optional supporting link (repo, deployed URL, doc, etc). */
  link: string | null;
  updatedAt: string | null;
  /** Uploaded screenshots/files proving the work was done. Optional
   * supporting proof alongside the note — populated by the
   * getProjectDetail server function (projects.functions.ts), which merges
   * this in from task-evidence.server.ts after loading the base task list.
   * Always `[]` when read directly from getProjectDetail in this file. */
  evidence: TaskEvidenceRecord[];
}

interface TaskProgressEntry {
  status: Exclude<TaskWorkStatus, "not_started">;
  note: string;
  link: string | null;
  updatedAt: string;
}

/** Minimum length of the written evidence required to actually submit
 * (not just save a draft of) a task. Deliberately low — this isn't meant to
 * be a content quality gate, just enough to stop a one-click "click to
 * complete" shortcut from sneaking back in via a one-character note. */
const MIN_SUBMISSION_NOTE_LENGTH = 20;

/** A group of consecutive tasks presented together as one milestone. Purely
 * a display grouping over the project's real task list — no separate
 * milestone data is stored; there's nothing here that isn't derived from
 * the same `requirements`/`completed_tasks` data the flat checklist uses. */
export interface ProjectMilestone {
  label: string;
  tasks: ProjectTask[];
  completedCount: number;
  totalCount: number;
  isComplete: boolean;
}

/** How many checklist steps make up one milestone. Two per milestone keeps
 * even the shortest seeded projects (4 steps) at a meaningful two
 * milestones, while still grouping longer checklists into digestible
 * chunks rather than one giant flat list. */
const TASKS_PER_MILESTONE = 2;

/**
 * Groups a project's flat task checklist into milestones of
 * `TASKS_PER_MILESTONE` consecutive steps, and reports which milestone is
 * "current" (the first one with an incomplete task, or the last one once
 * everything is done). Pure function — no I/O — so it's unit-testable on
 * its own.
 */
export function groupTasksIntoMilestones(tasks: ProjectTask[]): {
  milestones: ProjectMilestone[];
  currentMilestoneIndex: number;
} {
  if (tasks.length === 0) return { milestones: [], currentMilestoneIndex: 0 };

  const milestones: ProjectMilestone[] = [];
  for (let start = 0; start < tasks.length; start += TASKS_PER_MILESTONE) {
    const group = tasks.slice(start, start + TASKS_PER_MILESTONE);
    const completedCount = group.filter((t) => t.completed).length;
    milestones.push({
      label: `Milestone ${milestones.length + 1}`,
      tasks: group,
      completedCount,
      totalCount: group.length,
      isComplete: completedCount === group.length,
    });
  }

  const firstIncomplete = milestones.findIndex((m) => !m.isComplete);

  return {
    milestones,
    currentMilestoneIndex: firstIncomplete === -1 ? milestones.length - 1 : firstIncomplete,
  };
}

export interface ProjectResource {
  id: string;
  title: string;
  provider: string | null;
  url: string;
  type: string;
  isFree: boolean;
}

export interface ProjectPrerequisite {
  name: string;
  /** True when the user has any recorded level for this skill (not "none").
   * A simple, honest readiness signal — not a fabricated threshold. */
  ready: boolean;
}

export interface ProjectDetail {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  difficulty: string;
  estimatedHours: number;
  skills: string[];
  prerequisites: ProjectPrerequisite[];
  datasetSuggestion: string | null;
  expectedOutput: string | null;
  readmeOutline: string[];
  resumeBullet: string | null;
  status: ProjectStatus;
  tasks: ProjectTask[];
  milestones: ProjectMilestone[];
  currentMilestoneIndex: number;
  resources: ProjectResource[];
  assessmentSlug: string | null;
  careerTitle: string | null;
  careerSlug: string | null;
}

const STATUS_SORT_WEIGHT: Record<ProjectStatus, number> = {
  started: 0,
  not_started: 1,
  completed: 2,
};

/**
 * Lists every catalog project with the current user's status merged in.
 * Two queries (projects, user_projects) plus a lightweight profile lookup
 * for career_id — no N+1, everything joined in memory.
 */
export async function listProjectsForUser(
  supabase: Client,
  userId: string,
): Promise<ProjectListItem[]> {
  const [
    { data: profile },
    { data: projects, error: projectsError },
    { data: userProjects, error: upError },
  ] = await Promise.all([
    supabase.from("profiles").select("career_id").eq("id", userId).maybeSingle(),
    supabase
      .from("projects")
      .select(
        "id, slug, title, summary, difficulty, estimated_hours, skills, career_id, resume_bullet, requirements",
      )
      .order("estimated_hours", { ascending: true }),
    supabase
      .from("user_projects")
      .select("project_id, status, repo_url, completed_at, completed_tasks")
      .eq("user_id", userId),
  ]);

  if (projectsError) throw new Error("Unable to load projects.");
  if (upError) throw new Error("Unable to load your project progress.");

  const statusByProject = new Map<
    string,
    {
      status: ProjectStatus;
      repoUrl: string | null;
      completedAt: string | null;
      completedTasks: number[];
    }
  >();
  for (const row of (userProjects ?? []) as any[]) {
    statusByProject.set(row.project_id, {
      status: row.status as ProjectStatus,
      repoUrl: row.repo_url ?? null,
      completedAt: row.completed_at ?? null,
      completedTasks: (row.completed_tasks ?? []) as number[],
    });
  }

  const careerId = (profile as any)?.career_id ?? null;

  const items: ProjectListItem[] = ((projects ?? []) as any[]).map((p) => {
    const userState = statusByProject.get(p.id);
    const totalTaskCount: number = (p.requirements ?? []).length;
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      summary: p.summary,
      difficulty: p.difficulty,
      estimatedHours: p.estimated_hours,
      skills: p.skills ?? [],
      isRecommended: careerId !== null && p.career_id === careerId,
      status: userState?.status ?? "not_started",
      repoUrl: userState?.repoUrl ?? null,
      resumeBullet: p.resume_bullet ?? null,
      completedAt: userState?.completedAt ?? null,
      totalTaskCount,
      completedTaskCount:
        userState?.status === "completed"
          ? totalTaskCount
          : (userState?.completedTasks.length ?? 0),
    };
  });

  items.sort((a, b) => {
    if (a.isRecommended !== b.isRecommended) return a.isRecommended ? -1 : 1;
    if (STATUS_SORT_WEIGHT[a.status] !== STATUS_SORT_WEIGHT[b.status]) {
      return STATUS_SORT_WEIGHT[a.status] - STATUS_SORT_WEIGHT[b.status];
    }
    return a.estimatedHours - b.estimatedHours;
  });

  return items;
}

/**
 * Sets a project's status for the current user. `not_started` deletes the
 * row (there's nothing to track); `started`/`completed` upsert. Also logs a
 * `progress_events` row so the Progress page timeline picks it up, matching
 * the pattern already used for roadmap tasks (me.functions.ts) and skill
 * additions (roadmap-add.server.ts).
 */
export async function setProjectStatus(
  supabase: Client,
  userId: string,
  projectId: string,
  status: ProjectStatus,
): Promise<{ ok: true }> {
  if (status === "not_started") {
    const { error } = await supabase
      .from("user_projects")
      .delete()
      .eq("user_id", userId)
      .eq("project_id", projectId);
    if (error) throw new Error("Unable to reset this project.");
    return { ok: true };
  }

  const { getUserPlan, assertCanStartProject } = await import("@/lib/subscription.server");
  const plan = await getUserPlan(supabase, userId);
  await assertCanStartProject(supabase, userId, projectId, plan);

  if (status === "completed") {
    // Server-side enforcement, not just a disabled button: a project can
    // only actually be marked complete once every step in its checklist is
    // done. Projects with no step-by-step breakdown (`requirements` empty)
    // have nothing to gate on, so those still complete directly.
    const [{ data: project }, { data: existingRow }] = await Promise.all([
      supabase.from("projects").select("requirements").eq("id", projectId).maybeSingle(),
      supabase
        .from("user_projects")
        .select("completed_tasks")
        .eq("user_id", userId)
        .eq("project_id", projectId)
        .maybeSingle(),
    ]);
    const totalTasks: number = ((project as any)?.requirements ?? []).length;
    const completedTasks: number[] = ((existingRow as any)?.completed_tasks ?? []) as number[];
    if (totalTasks > 0 && completedTasks.length < totalTasks) {
      throw new Error(
        `Complete all ${totalTasks} steps before marking this project as complete (${completedTasks.length}/${totalTasks} done).`,
      );
    }
  }

  const row: Record<string, unknown> = { user_id: userId, project_id: projectId, status };
  if (status === "completed") row["completed_at"] = new Date().toISOString();
  if (status === "started") row["completed_at"] = null;

  const { error } = await supabase
    .from("user_projects")
    .upsert(row, { onConflict: "user_id,project_id" });
  if (error) throw new Error("Unable to update this project.");

  const { data: project } = await supabase
    .from("projects")
    .select("title")
    .eq("id", projectId)
    .maybeSingle();

  await supabase.from("progress_events").insert({
    user_id: userId,
    event_type: status === "completed" ? "project_completed" : "project_started",
    label: (project as any)?.title ?? "a project",
  });

  return { ok: true };
}

/**
 * Pure cache-patch helpers for the "Start Project" button bug: the detail
 * page used to rely solely on `invalidateQueries` marking the relevant
 * queries stale and waiting for a background refetch to resolve before the
 * button/status could switch away from "Start project" — on a slow
 * connection a user could tap Start and still see the old button for the
 * length of that round trip. The mutation's onSuccess now calls these to
 * patch the already-cached React Query data synchronously via
 * `queryClient.setQueryData`, so the UI updates the instant the mutation
 * resolves; the existing `invalidateQueries` call still runs afterward to
 * reconcile with the authoritative server state in the background.
 */
export function applyProjectStatusToDetail<T extends { status: ProjectStatus } | null | undefined>(
  detail: T,
  status: ProjectStatus,
): T {
  if (!detail) return detail;
  return { ...detail, status };
}

export function applyProjectStatusToListItem<T extends { id: string; status: ProjectStatus }>(
  items: T[] | undefined,
  projectId: string,
  status: ProjectStatus,
): T[] | undefined {
  if (!items) return items;
  return items.map((item) => (item.id === projectId ? { ...item, status } : item));
}

/**
 * Loads the full learning workspace for a single project: the objective,
 * what to build, the required skills, the step-by-step tasks (derived from
 * the catalog's `requirements` list, with the current user's per-task
 * progress merged in) and real learning resources for the skills involved
 * (pulled from the `resources` table — never invented URLs).
 */
export async function getProjectDetail(
  supabase: Client,
  userId: string,
  projectId: string,
): Promise<ProjectDetail | null> {
  const { data: project, error } = await supabase
    .from("projects")
    .select(
      "id, slug, title, summary, difficulty, estimated_hours, skills, dataset_suggestion, requirements, expected_output, readme_outline, resume_bullet, career_id, careers(title, slug)",
    )
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw new Error("Unable to load this project.");
  if (!project) return null;

  const p = project as any;
  const skillNames: string[] = p.skills ?? [];

  const [{ data: userProject }, { data: matchedSkills }] = await Promise.all([
    supabase
      .from("user_projects")
      .select("status, completed_tasks, task_progress")
      .eq("user_id", userId)
      .eq("project_id", projectId)
      .maybeSingle(),
    skillNames.length
      ? supabase.from("skills").select("id, name").in("name", skillNames)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const skillIds = ((matchedSkills ?? []) as any[]).map((s) => s.id);

  const [{ data: resourceRows }, { data: userSkillLevels }, { data: assessmentRows }] =
    await Promise.all([
      skillIds.length
        ? supabase
            .from("resources")
            .select("id, title, provider, url, type, is_free, skill_id")
            .in("skill_id", skillIds)
            .order("title")
        : Promise.resolve({ data: [] as any[] }),
      skillIds.length
        ? supabase
            .from("user_skills")
            .select("skill_id, level")
            .eq("user_id", userId)
            .in("skill_id", skillIds)
        : Promise.resolve({ data: [] as any[] }),
      skillIds.length
        ? supabase.from("assessments").select("slug, skill_id").in("skill_id", skillIds).limit(1)
        : Promise.resolve({ data: [] as any[] }),
    ]);
  const resources = ((resourceRows ?? []) as any[]).slice(0, 12);

  const levelBySkillId = new Map(
    ((userSkillLevels ?? []) as any[]).map((s) => [s.skill_id, s.level]),
  );
  const prerequisites: ProjectPrerequisite[] = ((matchedSkills ?? []) as any[]).map((s) => ({
    name: s.name,
    ready: (levelBySkillId.get(s.id) ?? "none") !== "none",
  }));
  const assessmentSlug: string | null = ((assessmentRows ?? [])[0] as any)?.slug ?? null;

  const completedSet = new Set<number>(((userProject as any)?.completed_tasks ?? []) as number[]);
  const progressByIndex = ((userProject as any)?.task_progress ?? {}) as Record<
    string,
    TaskProgressEntry
  >;
  const requirements: string[] = p.requirements ?? [];
  const tasks: ProjectTask[] = requirements.map((title, index) => {
    const entry = progressByIndex[String(index)];
    const completed = completedSet.has(index);
    return {
      index,
      title,
      completed,
      status: completed ? "completed" : (entry?.status ?? "not_started"),
      note: entry?.note ?? "",
      link: entry?.link ?? null,
      updatedAt: entry?.updatedAt ?? null,
      evidence: [],
    };
  });
  const { milestones, currentMilestoneIndex } = groupTasksIntoMilestones(tasks);

  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    summary: p.summary ?? null,
    difficulty: p.difficulty,
    estimatedHours: p.estimated_hours,
    skills: skillNames,
    prerequisites,
    datasetSuggestion: p.dataset_suggestion ?? null,
    expectedOutput: p.expected_output ?? null,
    readmeOutline: p.readme_outline ?? [],
    resumeBullet: p.resume_bullet ?? null,
    status: ((userProject as any)?.status ?? "not_started") as ProjectStatus,
    tasks,
    milestones,
    currentMilestoneIndex,
    resources: resources.map((r) => ({
      id: r.id,
      title: r.title,
      provider: r.provider ?? null,
      url: r.url,
      type: r.type,
      isFree: Boolean(r.is_free),
    })),
    assessmentSlug,
    careerTitle: p.careers?.title ?? null,
    careerSlug: p.careers?.slug ?? null,
  };
}

/** Loads a project's requirements list plus the caller's existing
 * `user_projects` row (if any). Shared by the save/submit task-workspace
 * paths and by task-evidence.server.ts, so evidence upload/removal checks
 * "does this task exist / is it already completed" the exact same way the
 * note/link submission path does — one source of truth, not two. */
export async function loadTaskWorkspaceRow(supabase: Client, userId: string, projectId: string) {
  const [{ data: existing }, { data: project, error: projectError }] = await Promise.all([
    supabase
      .from("user_projects")
      .select("status, completed_tasks, task_progress")
      .eq("user_id", userId)
      .eq("project_id", projectId)
      .maybeSingle(),
    supabase.from("projects").select("title, requirements").eq("id", projectId).maybeSingle(),
  ]);
  if (projectError || !project) throw new Error("Unable to load this project.");
  return { existing: existing as any, project: project as any };
}

async function startProjectIfNeeded(
  supabase: Client,
  userId: string,
  projectId: string,
  existing: unknown,
  projectTitle: string,
) {
  if (existing) return;
  await supabase.from("progress_events").insert({
    user_id: userId,
    event_type: "project_started",
    label: projectTitle,
  });
}

/**
 * Saves a work-in-progress draft (note/link) for a single task without
 * marking it complete. Opening a project's workspace and saving a draft on
 * a project the user hasn't touched before implicitly starts it, same as
 * the old toggle behaviour did.
 */
export async function saveProjectTaskProgress(
  supabase: Client,
  userId: string,
  projectId: string,
  taskIndex: number,
  input: { note: string; link: string | null },
): Promise<{ ok: true; task: TaskProgressEntry }> {
  const { existing, project } = await loadTaskWorkspaceRow(supabase, userId, projectId);
  const totalTasks: number = (project.requirements ?? []).length;
  if (taskIndex < 0 || taskIndex >= totalTasks) throw new Error("That step doesn't exist.");

  const completedTasks: number[] = (existing?.completed_tasks ?? []) as number[];
  // A task that's already been submitted stays completed and locked — this
  // is a draft-save path, not an "undo completion" path.
  if (completedTasks.includes(taskIndex)) {
    throw new Error("This step is already completed.");
  }

  const progress = { ...(existing?.task_progress ?? {}) } as Record<string, TaskProgressEntry>;
  const entry: TaskProgressEntry = {
    status: "in_progress",
    note: input.note.slice(0, 5000),
    link: input.link,
    updatedAt: new Date().toISOString(),
  };
  progress[String(taskIndex)] = entry;

  const status: ProjectStatus = (existing?.status as ProjectStatus | undefined) ?? "started";
  const { error } = await supabase.from("user_projects").upsert(
    {
      user_id: userId,
      project_id: projectId,
      status,
      completed_tasks: completedTasks,
      task_progress: progress,
    },
    { onConflict: "user_id,project_id" },
  );
  if (error) throw new Error("Unable to save your progress.");

  await startProjectIfNeeded(supabase, userId, projectId, existing, project.title ?? "a project");

  return { ok: true, task: entry };
}

/**
 * Submits a task's evidence and — only then — marks it completed. This is
 * the sole path by which a task can move into `completed_tasks`; there is
 * no plain checkbox toggle. Requires a real written explanation (not just a
 * link) so a task can't be "completed" with an empty or trivial note.
 */
export async function submitProjectTask(
  supabase: Client,
  userId: string,
  projectId: string,
  taskIndex: number,
  input: { note: string; link: string | null },
): Promise<{ ok: true; completedTasks: number[]; status: ProjectStatus }> {
  const note = input.note.trim();
  if (note.length < MIN_SUBMISSION_NOTE_LENGTH) {
    throw new Error(
      `Describe what you actually did for this step (at least ${MIN_SUBMISSION_NOTE_LENGTH} characters) before submitting it.`,
    );
  }

  const { existing, project } = await loadTaskWorkspaceRow(supabase, userId, projectId);
  const totalTasks: number = (project.requirements ?? []).length;
  if (taskIndex < 0 || taskIndex >= totalTasks) throw new Error("That step doesn't exist.");

  const currentCompleted = new Set<number>((existing?.completed_tasks ?? []) as number[]);
  currentCompleted.add(taskIndex);
  const completedTasks = [...currentCompleted].sort((a, b) => a - b);

  const progress = { ...(existing?.task_progress ?? {}) } as Record<string, TaskProgressEntry>;
  progress[String(taskIndex)] = {
    status: "completed",
    note: note.slice(0, 5000),
    link: input.link,
    updatedAt: new Date().toISOString(),
  };

  const status: ProjectStatus = (existing?.status as ProjectStatus | undefined) ?? "started";
  const { error } = await supabase.from("user_projects").upsert(
    {
      user_id: userId,
      project_id: projectId,
      status,
      completed_tasks: completedTasks,
      task_progress: progress,
    },
    { onConflict: "user_id,project_id" },
  );
  if (error) throw new Error("Unable to submit this step.");

  await startProjectIfNeeded(supabase, userId, projectId, existing, project.title ?? "a project");

  return { ok: true, completedTasks, status };
}
