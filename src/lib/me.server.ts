/** Server-only helpers backing the authenticated Rolisha server functions. */
import {
  buildSkillGaps,
  readinessScore,
  type EducationLevel,
  type ExperienceLevel,
  type ProficiencyLevel,
  type RequiredSkill,
  type SkillImportance,
  type WorkMode,
} from "@/lib/domain";
import type {
  MyProfile,
  MySkill,
  ProgressEventView,
  RoadmapMonthView,
  RoadmapView,
  Workspace,
} from "@/lib/me-types";
import {
  buildRoadmap,
  findWeeklyCapacityViolations,
  loadRoadmapContent,
} from "@/lib/roadmap.server";
import { FREE_ROADMAP_DETAIL_MONTHS, type PlanTier } from "@/lib/subscription";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = any;

export async function loadProfile(supabase: Client, userId: string): Promise<MyProfile> {
  const [{ data, error }, { data: adminRole }] = await Promise.all([
    supabase.from("profiles").select("*, careers(slug)").eq("id", userId).maybeSingle(),
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle(),
  ]);
  if (error) throw new Error("Unable to load your profile.");
  if (!data) throw new Error("Profile not found.");
  return {
    id: data.id,
    email: data.email,
    fullName: data.full_name,
    targetRole: data.target_role,
    careerId: data.career_id,
    careerSlug: data.careers?.slug ?? null,
    educationLevel: data.education_level as EducationLevel | null,
    degree: data.degree,
    fieldOfStudy: data.field_of_study,
    graduationYear: data.graduation_year,
    experience: (data.experience ?? "none") as ExperienceLevel,
    hoursPerWeek: data.hours_per_week ?? 10,
    salaryTarget: data.salary_target === null ? null : Number(data.salary_target),
    // Rolisha is an India-first product with no currency picker anywhere in
    // the UI for a user's own target salary (unlike job postings, which
    // keep their provider's real currency) -- so the only currency a
    // profile's target salary is ever shown/interpreted in is INR. The
    // `profiles.salary_currency` column still has a historical `DEFAULT
    // 'USD'` from before that product decision (see
    // supabase/migrations/*_localize_profile_salary_to_inr.sql for the
    // matching DB-side fix + backfill), so this fallback exists purely as
    // defense in depth for any row that predates that migration.
    salaryCurrency: data.salary_currency ?? "INR",
    country: data.country,
    city: data.city,
    workMode: (data.work_mode ?? "any") as WorkMode,
    plan: data.plan ?? "free",
    onboardingCompleted: Boolean(data.onboarding_completed),
    isAdmin: Boolean(adminRole),
  };
}

export async function loadUserSkills(supabase: Client, userId: string): Promise<MySkill[]> {
  const { data, error } = await supabase
    .from("user_skills")
    .select("skill_id, custom_skill_name, level, source, skills(name)")
    .eq("user_id", userId);
  if (error) throw new Error("Unable to load your skills.");
  return (data ?? []).map((row: any) => ({
    skillId: row.skill_id,
    customName: row.custom_skill_name,
    name: row.skills?.name ?? row.custom_skill_name ?? "Skill",
    level: row.level as ProficiencyLevel,
    source: row.source,
  }));
}

export async function loadRequiredSkills(
  supabase: Client,
  careerId: string | null,
): Promise<RequiredSkill[]> {
  if (!careerId) return [];
  const { data, error } = await supabase
    .from("career_skills")
    .select("skill_id, importance, required_level, demand_percentage, sort_order, skills(name)")
    .eq("career_id", careerId)
    .order("sort_order");
  if (error) throw new Error("Unable to load the skill profile for this role.");
  return (data ?? []).map((row: any) => ({
    skillId: row.skill_id,
    name: row.skills?.name ?? "Skill",
    importance: row.importance as SkillImportance,
    requiredLevel: row.required_level as ProficiencyLevel,
    demandPercentage: row.demand_percentage,
  }));
}

/** A month is "complete" once every one of its required roadmap_tasks has
 * `is_completed = true` -- per the product rule, this is never an arbitrary
 * percentage (e.g. 50%/80%), it's literally every task. A month with no
 * tasks recorded at all (shouldn't happen given the roadmap engine, which
 * always schedules at least one task per month) is treated as NOT
 * complete rather than vacuously true -- missing data should never be the
 * reason a later month silently unlocks. */
function isMonthComplete(monthTasks: { is_completed: boolean }[]): boolean {
  return monthTasks.length > 0 && monthTasks.every((t) => t.is_completed);
}

/**
 * How many of a Free user's roadmap months are unlocked, in month order:
 * Month 1 is always unlocked (see `FREE_ROADMAP_DETAIL_MONTHS`), and each
 * subsequent month unlocks only once every task in the month immediately
 * before it is completed -- never merely opened, viewed, or partially
 * completed. This walks strictly in order so a later month can never be
 * unlocked while an earlier one still has outstanding tasks (e.g.
 * completing Month 3 before Month 2 does not unlock Month 4). Pro has no
 * such gate and always sees every month.
 */
export function countUnlockedMonths(
  months: { id: string; month_number: number }[],
  tasksByMonthId: Map<string, { is_completed: boolean }[]>,
  plan: PlanTier,
): number {
  if (plan !== "free") return Infinity;
  const ordered = [...months].sort((a, b) => a.month_number - b.month_number);
  let unlocked = Math.min(FREE_ROADMAP_DETAIL_MONTHS, ordered.length);
  for (let i = unlocked; i < ordered.length; i += 1) {
    const previous = ordered[i - 1]!;
    const previousTasks = tasksByMonthId.get(previous.id) ?? [];
    if (!isMonthComplete(previousTasks)) break;
    unlocked = i + 1;
  }
  return unlocked;
}

/**
 * Server-side gate for completing (or un-completing) a roadmap task.
 * Re-derives the same lock state `loadActiveRoadmap` would show for this
 * user's roadmap and throws if the task belongs to a Free-plan month that
 * isn't unlocked yet -- this is what actually stops a Free user from
 * completing a locked month's tasks, not just the client never rendering
 * a checkbox for one (a locked month's task ids are never sent to the
 * client at all, but this closes the gap for a direct call with a
 * known/guessed id, i.e. the "disabled button"/"CSS blur only" failure
 * mode). Returns the task row on success so the caller doesn't have to
 * look it up a second time. Pro users have no month gate, so this is a
 * no-op ownership check for them.
 */
export async function loadTaskForCompletion(
  supabase: Client,
  userId: string,
  taskId: string,
  plan: PlanTier,
): Promise<{ id: string; title: string; month_id: string; roadmap_id: string }> {
  const { data: task, error } = await supabase
    .from("roadmap_tasks")
    .select("id, title, month_id, roadmap_id")
    .eq("id", taskId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Unable to update this task.");
  if (!task) throw new Error("Unable to update this task.");

  if (plan === "free") {
    const [{ data: months }, { data: allTasks }] = await Promise.all([
      supabase
        .from("roadmap_months")
        .select("id, month_number")
        .eq("roadmap_id", (task as any).roadmap_id),
      supabase
        .from("roadmap_tasks")
        .select("id, month_id, is_completed")
        .eq("roadmap_id", (task as any).roadmap_id),
    ]);
    const tasksByMonthId = new Map<string, { is_completed: boolean }[]>();
    for (const t of (allTasks ?? []) as any[]) {
      const list = tasksByMonthId.get(t.month_id) ?? [];
      list.push(t);
      tasksByMonthId.set(t.month_id, list);
    }
    const unlockedCount = countUnlockedMonths(months ?? [], tasksByMonthId, plan);
    const ordered = [...((months ?? []) as any[])].sort((a, b) => a.month_number - b.month_number);
    const unlockedMonthIds = new Set(ordered.slice(0, unlockedCount).map((m) => m.id));
    if (!unlockedMonthIds.has((task as any).month_id)) {
      throw new Error("Complete the previous month first to unlock this task.");
    }
  }

  return task as any;
}

export async function loadActiveRoadmap(
  supabase: Client,
  userId: string,
  plan: PlanTier = "free",
): Promise<RoadmapView | null> {
  const { data: roadmap, error } = await supabase
    .from("roadmaps")
    .select("*")
    .eq("user_id", userId)
    .eq("is_primary", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("Unable to load your roadmap.");
  if (!roadmap) return null;

  const [{ data: months }, { data: tasks }] = await Promise.all([
    supabase.from("roadmap_months").select("*").eq("roadmap_id", roadmap.id).order("month_number"),
    supabase.from("roadmap_tasks").select("*").eq("roadmap_id", roadmap.id).order("week_number"),
  ]);

  const tasksByMonthId = new Map<string, { is_completed: boolean }[]>();
  for (const task of (tasks ?? []) as any[]) {
    const list = tasksByMonthId.get(task.month_id) ?? [];
    list.push(task);
    tasksByMonthId.set(task.month_id, list);
  }

  const detailedMonths = countUnlockedMonths(months ?? [], tasksByMonthId, plan);

  const monthViews: RoadmapMonthView[] = (months ?? []).map((month: any, index: number) => {
    const locked = index >= detailedMonths;
    if (locked) {
      // Server-side truncation, not just a UI overlay: locked months never
      // leave the topics/skills/tasks/project/milestone fields the wire.
      return {
        id: month.id,
        monthNumber: month.month_number,
        title: month.title,
        locked: true,
        goal: null,
        topics: [],
        skills: [],
        estimatedHours: month.estimated_hours,
        projectTitle: null,
        projectDescription: null,
        milestone: null,
        assessmentSkill: null,
        tasks: [],
      };
    }
    return {
      id: month.id,
      monthNumber: month.month_number,
      title: month.title,
      locked: false,
      goal: month.goal,
      topics: month.topics ?? [],
      skills: month.skills ?? [],
      estimatedHours: month.estimated_hours,
      projectTitle: month.project_title,
      projectDescription: month.project_description,
      milestone: month.milestone,
      assessmentSkill: month.assessment_skill,
      tasks: (tasks ?? [])
        .filter((task: any) => task.month_id === month.id)
        .map((task: any) => ({
          id: task.id,
          monthId: task.month_id,
          weekNumber: task.week_number,
          title: task.title,
          description: task.description,
          skillName: task.skill_name,
          estimatedHours: task.estimated_hours,
          isCompleted: task.is_completed,
        })),
    };
  });

  return {
    id: roadmap.id,
    targetRole: roadmap.target_role,
    summary: roadmap.summary,
    hoursPerWeek: roadmap.hours_per_week,
    readinessScore: roadmap.readiness_score,
    dataMode: roadmap.data_mode,
    jobsAnalyzed: roadmap.jobs_analyzed,
    createdAt: roadmap.created_at,
    months: monthViews,
    totalMonths: monthViews.length,
  };
}

export async function loadEvents(
  supabase: Client,
  userId: string,
  limit = 25,
): Promise<ProgressEventView[]> {
  const { data } = await supabase
    .from("progress_events")
    .select("id, event_type, label, readiness_score, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((row: any) => ({
    id: row.id,
    eventType: row.event_type,
    label: row.label,
    readinessScore: row.readiness_score,
    createdAt: row.created_at,
  }));
}

export async function loadWorkspace(supabase: Client, userId: string): Promise<Workspace> {
  const profile = await loadProfile(supabase, userId);
  const [skills, required, roadmap, events] = await Promise.all([
    loadUserSkills(supabase, userId),
    loadRequiredSkills(supabase, profile.careerId),
    loadActiveRoadmap(supabase, userId, profile.plan as PlanTier),
    loadEvents(supabase, userId),
  ]);
  const levels: Record<string, ProficiencyLevel> = {};
  for (const skill of skills) if (skill.skillId) levels[skill.skillId] = skill.level;
  const gaps = buildSkillGaps(required, levels);
  return { profile, skills, gaps, readiness: readinessScore(gaps), roadmap, events };
}

interface GenerateRoadmapOptions {
  careerId: string | null;
  targetRole: string;
  hoursPerWeek: number;
  makePrimary: boolean;
}

async function generateRoadmapRow(
  supabase: Client,
  userId: string,
  opts: GenerateRoadmapOptions,
): Promise<{ roadmapId: string; readiness: number }> {
  const { careerId, targetRole: role, hoursPerWeek, makePrimary } = opts;
  const [skills, required] = await Promise.all([
    loadUserSkills(supabase, userId),
    loadRequiredSkills(supabase, careerId),
  ]);
  const levels: Record<string, ProficiencyLevel> = {};
  for (const skill of skills) if (skill.skillId) levels[skill.skillId] = skill.level;
  const gaps = buildSkillGaps(required, levels);
  const readiness = readinessScore(gaps);

  const [{ data: projects }, { data: demoJobs }] = await Promise.all([
    careerId
      ? supabase.from("projects").select("title").eq("career_id", careerId).limit(6)
      : Promise.resolve({ data: [] }),
    careerId
      ? supabase.from("jobs").select("id, job_sources(is_demo)").eq("career_id", careerId)
      : Promise.resolve({ data: [] }),
  ]);

  const jobRows = (demoJobs ?? []) as any[];
  const hasLive = jobRows.some((job) => job.job_sources?.is_demo === false);

  // Real lessons/resources/assessments for every skill in the gap, so the
  // roadmap surfaces actual learning-catalog content per week instead of a
  // single generic paragraph — see roadmap.server.ts for the fallback when
  // a skill has no seeded content yet.
  const content = await loadRoadmapContent(
    supabase,
    gaps.map((g) => g.skillId),
  );

  const planned = buildRoadmap({
    role,
    gaps,
    hoursPerWeek,
    projectTitles: ((projects ?? []) as any[]).map((p) => p.title),
    content,
  });

  // Never persist a plan that violates the user's selected weekly capacity.
  // This check MUST run, and MUST fail loudly, before a single row is
  // written -- previously the old primary roadmap was already deactivated
  // and a new (empty, content-less) roadmap was already inserted as
  // is_active/is_primary before this validation ran, so a failed generation
  // left the user's dashboard pointing at a roadmap with zero months/tasks
  // instead of their last good plan. Building and validating first, with no
  // database writes at all yet, means a rejected plan leaves the existing
  // roadmap (if any) completely untouched.
  const capacityViolations = findWeeklyCapacityViolations(planned, hoursPerWeek);
  if (capacityViolations.length > 0) {
    throw new Error("Unable to generate a roadmap that fits your selected weekly hours.");
  }

  // Insert the replacement as active but NOT primary yet -- it only earns
  // that status once its months and tasks are fully persisted below, so a
  // mid-write failure can never leave a half-built roadmap as "the" one the
  // dashboard/roadmap/skills/projects/assessments pages load.
  const { data: roadmap, error } = await supabase
    .from("roadmaps")
    .insert({
      user_id: userId,
      career_id: careerId,
      target_role: role,
      summary: `A six month plan to close ${gaps.filter((g) => g.gapPercentage > 0).length} skill gaps for ${role}, sized to ${hoursPerWeek} hours a week.`,
      readiness_score: readiness,
      hours_per_week: hoursPerWeek,
      generated_by: "engine",
      model: "roleready-gap-engine-v1",
      jobs_analyzed: jobRows.length,
      data_mode: hasLive ? "live" : "demo",
      is_active: true,
      is_primary: false,
    })
    .select("id")
    .single();
  if (error || !roadmap) throw new Error("Unable to generate your roadmap.");

  // Best-effort compensation for the lack of a real cross-table transaction:
  // if anything below fails, delete the roadmap row we just inserted.
  // roadmap_months/roadmap_tasks are ON DELETE CASCADE, so this can never
  // leave an orphaned, content-less roadmap sitting in the table.
  const cleanupOrphan = async () => {
    await supabase.from("roadmaps").delete().eq("id", roadmap.id);
  };

  const { data: insertedMonths, error: monthError } = await supabase
    .from("roadmap_months")
    .insert(
      planned.map((month) => ({
        roadmap_id: roadmap.id,
        user_id: userId,
        month_number: month.monthNumber,
        title: month.title,
        goal: month.goal,
        topics: month.topics,
        skills: month.skills,
        estimated_hours: month.estimatedHours,
        project_title: month.projectTitle,
        project_description: month.projectDescription,
        milestone: month.milestone,
        assessment_skill: month.assessmentSkill,
      })),
    )
    .select("id, month_number");
  if (monthError) {
    await cleanupOrphan();
    throw new Error("Unable to save your roadmap months.");
  }

  const monthIdByNumber = new Map<number, string>(
    ((insertedMonths ?? []) as any[]).map((m) => [m.month_number, m.id]),
  );

  const taskRows = planned.flatMap((month) =>
    month.tasks.map((task) => ({
      roadmap_id: roadmap.id,
      month_id: monthIdByNumber.get(month.monthNumber)!,
      user_id: userId,
      week_number: task.weekNumber,
      title: task.title,
      description: task.description,
      skill_name: task.skillName,
      estimated_hours: task.estimatedHours,
    })),
  );
  const { error: taskError } = await supabase.from("roadmap_tasks").insert(taskRows);
  if (taskError) {
    await cleanupOrphan();
    throw new Error("Unable to save your weekly plan.");
  }

  // Only now -- with the replacement's months and tasks fully persisted and
  // known-valid -- retire the old roadmap(s) and promote the new one. Every
  // one of these three writes is checked: previously they were fired and
  // forgotten, so a silent failure here (an RLS edge case, a transient
  // network error) could leave a user with zero or two primary roadmaps
  // without ever surfacing an error to debug. The new roadmap's content is
  // already fully valid and persisted at this point, so throwing here is
  // purely about making a real failure loud/debuggable, not about losing
  // any content.
  const { error: deactivateError } = await supabase
    .from("roadmaps")
    .update({ is_active: false })
    .eq("user_id", userId)
    .eq("career_id", careerId)
    .neq("id", roadmap.id);
  if (deactivateError) {
    throw new Error("Your roadmap was generated, but the previous one couldn't be retired.");
  }
  if (makePrimary) {
    const { error: demoteError } = await supabase
      .from("roadmaps")
      .update({ is_primary: false })
      .eq("user_id", userId)
      .eq("is_primary", true);
    if (demoteError) {
      throw new Error("Your roadmap was generated, but couldn't be made primary.");
    }
    const { error: promoteError } = await supabase
      .from("roadmaps")
      .update({ is_primary: true })
      .eq("id", roadmap.id);
    if (promoteError) {
      throw new Error("Your roadmap was generated, but couldn't be made primary.");
    }
  }

  await supabase.from("progress_events").insert({
    user_id: userId,
    event_type: "roadmap_generated",
    label: `Roadmap generated for ${role}`,
    readiness_score: readiness,
  });

  return { roadmapId: roadmap.id, readiness };
}

/** Recreate the primary roadmap from the user's current gap. Unchanged
 * behavior from before multiple roadmaps existed: always targets
 * `profile.careerId`/`profile.targetRole` and stays primary. */
export async function regenerateRoadmapFor(
  supabase: Client,
  userId: string,
): Promise<{ roadmapId: string; readiness: number }> {
  const profile = await loadProfile(supabase, userId);
  return generateRoadmapRow(supabase, userId, {
    careerId: profile.careerId,
    targetRole: profile.targetRole ?? "your target role",
    hoursPerWeek: profile.hoursPerWeek,
    makePrimary: true,
  });
}

export interface CareerRoadmapSummary {
  id: string;
  careerId: string | null;
  targetRole: string;
  readinessScore: number;
  isPrimary: boolean;
  createdAt: string;
}

/** Every career track the user is actively maintaining (Pro can
 * have more than one; Free always has at most one). */
export async function listCareerRoadmaps(
  supabase: Client,
  userId: string,
): Promise<CareerRoadmapSummary[]> {
  const { data, error } = await supabase
    .from("roadmaps")
    .select("id, career_id, target_role, readiness_score, is_primary, created_at")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Unable to load your career roadmaps.");
  const summaries = ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    careerId: r.career_id,
    targetRole: r.target_role,
    readinessScore: r.readiness_score,
    isPrimary: r.is_primary,
    createdAt: r.created_at,
  }));
  // Primary first, then most recently created -- done client-side (not in
  // the query) so this stays correct without relying on multi-column
  // ordering support.
  return summaries.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
}

/** Adds a new, independently-tracked roadmap for a different target career
 * (Pro). Doesn't touch any other career track's roadmap, tasks, or
 * progress -- each roadmap's months/tasks are already scoped by
 * `roadmap_id`, so this can't bleed into an existing track. */
export async function addCareerRoadmap(
  supabase: Client,
  userId: string,
  careerId: string,
): Promise<{ roadmapId: string; readiness: number }> {
  const { requireFeature, getUserPlan, assertCanAddCareerRoadmap } =
    await import("@/lib/subscription.server");
  await requireFeature(supabase, userId, "multiple_career_roadmaps");
  const plan = await getUserPlan(supabase, userId);
  await assertCanAddCareerRoadmap(supabase, userId, plan);

  const { data: career, error: careerError } = await supabase
    .from("careers")
    .select("id, title")
    .eq("id", careerId)
    .maybeSingle();
  if (careerError || !career) throw new Error("That career doesn't exist.");

  const profile = await loadProfile(supabase, userId);
  return generateRoadmapRow(supabase, userId, {
    careerId: (career as any).id,
    targetRole: (career as any).title,
    hoursPerWeek: profile.hoursPerWeek,
    makePrimary: false,
  });
}

/** Switches which career track is "the" roadmap shown on the dashboard,
 * /roadmap, /skills, /projects, and /assessments -- by updating
 * `profiles.career_id` to match, so every one of those pages (which all
 * derive their view from `profile.careerId`) follows automatically. */
export async function setPrimaryCareerRoadmap(
  supabase: Client,
  userId: string,
  roadmapId: string,
): Promise<void> {
  const { requireFeature } = await import("@/lib/subscription.server");
  await requireFeature(supabase, userId, "multiple_career_roadmaps");

  const { data: roadmap, error } = await supabase
    .from("roadmaps")
    .select("id, career_id, hours_per_week")
    .eq("id", roadmapId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (error || !roadmap) throw new Error("That roadmap wasn't found.");

  // A roadmap must also be structurally valid before it can become primary.
  // New roadmaps can't violate this (generateRoadmapRow validates before
  // persisting), but this guards against switching back to an older
  // is_active roadmap that was generated before that validation existed --
  // an invalid historical roadmap must never become "the" current one just
  // because the user switched career tracks.
  const { data: tasks, error: tasksError } = await supabase
    .from("roadmap_tasks")
    .select("week_number, estimated_hours")
    .eq("roadmap_id", roadmapId);
  if (tasksError) throw new Error("Unable to verify that roadmap.");
  const hoursByWeek = new Map<number, number>();
  for (const t of (tasks ?? []) as { week_number: number; estimated_hours: number }[]) {
    hoursByWeek.set(t.week_number, (hoursByWeek.get(t.week_number) ?? 0) + t.estimated_hours);
  }
  const hoursPerWeek = (roadmap as any).hours_per_week as number;
  const overBudgetWeek = [...hoursByWeek.entries()].find(([, hours]) => hours > hoursPerWeek);
  if (overBudgetWeek) {
    throw new Error(
      "That roadmap can't be made current because it exceeds your weekly hours -- regenerate it first.",
    );
  }

  await supabase
    .from("roadmaps")
    .update({ is_primary: false })
    .eq("user_id", userId)
    .eq("is_primary", true);
  await supabase.from("roadmaps").update({ is_primary: true }).eq("id", roadmapId);
  await supabase
    .from("profiles")
    .update({ career_id: (roadmap as any).career_id })
    .eq("id", userId);
}

/** Recalculate readiness and record it against the primary roadmap. */
export async function syncReadiness(supabase: Client, userId: string): Promise<number> {
  const profile = await loadProfile(supabase, userId);
  const [skills, required] = await Promise.all([
    loadUserSkills(supabase, userId),
    loadRequiredSkills(supabase, profile.careerId),
  ]);
  const levels: Record<string, ProficiencyLevel> = {};
  for (const skill of skills) if (skill.skillId) levels[skill.skillId] = skill.level;
  const score = readinessScore(buildSkillGaps(required, levels));
  await supabase
    .from("roadmaps")
    .update({ readiness_score: score })
    .eq("user_id", userId)
    .eq("is_primary", true);
  return score;
}
