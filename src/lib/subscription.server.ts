/**
 * Server-only enforcement for the subscription/feature-gating system.
 *
 * The rule this file exists to uphold: the server is the only source of
 * truth for a user's plan and usage. Every function here reads the plan
 * fresh from `profiles` (via the caller's RLS-scoped client, so a user can
 * only ever read their own plan through this path) and never trusts a
 * plan value handed in from the client.
 *
 * USAGE COUNTING NOTE (documented simplification for Phase 1): the spec's
 * suggested limits ("N per month") imply a monthly reset. The current
 * schema has no billing-period/usage-window table, so introducing accurate
 * calendar-month resets would mean inventing new tracking infrastructure
 * ahead of the payment phase. Rather than fabricate a monthly counter that
 * doesn't actually reset correctly, Phase 1 enforces these as running
 * lifetime counts against real existing tables:
 *   - career_roadmaps: count of the user's currently ACTIVE roadmap (0 or
 *     1) — the app only ever keeps one active roadmap regardless of plan
 *     today, so this is purely informational and never blocks regenerating
 *     your one roadmap.
 *   - projects: count of distinct projects the user has ever started
 *     (rows in user_projects — deleting resets to not_started).
 *   - assessments: count of distinct assessments the user has ever
 *     attempted (retaking an assessment you've already attempted is
 *     always allowed and doesn't count again).
 *   - learning_lessons: total lessons ever marked complete across all
 *     topics (un-completing and re-completing the same lesson doesn't
 *     double count).
 * A later phase can swap these for real monthly-window tracking once a
 * billing cycle actually exists to anchor "per month" to.
 */

import {
  FEATURE_INFO,
  UpgradeRequiredError,
  getLimit,
  type Feature,
  type LimitedResource,
  type PlanTier,
} from "@/lib/subscription";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = any;

/** Reads only the plan column — deliberately lighter than loadProfile()
 * (which joins careers + admin role) since this is called on every gated
 * write. Defaults to 'free' (the safest, most restrictive plan) if no
 * profile row exists yet, rather than failing open. */
export async function getUserPlan(supabase: Client, userId: string): Promise<PlanTier> {
  const { data, error } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error("Unable to verify your plan.");
  return ((data?.plan as PlanTier | undefined) ?? "free") as PlanTier;
}

/** Throws an UpgradeRequiredError if the user's plan doesn't include this
 * feature. Use at the top of any server function backing a gated feature,
 * before performing the privileged operation. */
export async function requireFeature(
  supabase: Client,
  userId: string,
  feature: Feature,
): Promise<PlanTier> {
  const plan = await getUserPlan(supabase, userId);
  const { canAccessFeature } = await import("@/lib/subscription");
  if (!canAccessFeature(plan, feature)) {
    throw new UpgradeRequiredError(feature, plan);
  }
  return plan;
}

export interface UsageCount {
  used: number;
  limit: number | null; // null = unlimited
}

export interface UsageSummary {
  plan: PlanTier;
  careerRoadmaps: UsageCount;
  projects: UsageCount;
  assessments: UsageCount;
  learningLessons: UsageCount;
}

async function countDistinct(
  supabase: Client,
  table: string,
  userId: string,
  column: string,
): Promise<number> {
  const { data, error } = await supabase.from(table).select(column).eq("user_id", userId);
  if (error) throw new Error(`Unable to load usage for ${table}.`);
  const values = ((data ?? []) as Record<string, unknown>[]).map((r) => r[column]);
  return new Set(values).size;
}

/** Real, computed usage against real tables — never estimated or invented.
 * See the module-level note above for how "per month" limits are
 * approximated as lifetime counts in Phase 1. */
export async function getUsageSummary(
  supabase: Client,
  userId: string,
  plan: PlanTier,
): Promise<UsageSummary> {
  const [{ count: activeRoadmaps }, projectCount, assessmentCount, learningRows] =
    await Promise.all([
      supabase
        .from("roadmaps")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_active", true),
      countDistinct(supabase, "user_projects", userId, "project_id"),
      countDistinct(supabase, "assessment_attempts", userId, "assessment_id"),
      supabase.from("user_learning_progress").select("completed_lessons").eq("user_id", userId),
    ]);

  const learningLessonsUsed = (
    (learningRows.data ?? []) as { completed_lessons: number[] }[]
  ).reduce((sum, row) => sum + (row.completed_lessons?.length ?? 0), 0);

  const limitOf = (resource: LimitedResource) => getLimit(plan, resource);

  return {
    plan,
    careerRoadmaps: { used: activeRoadmaps ?? 0, limit: limitOf("career_roadmaps") },
    projects: { used: projectCount, limit: limitOf("projects") },
    assessments: { used: assessmentCount, limit: limitOf("assessments") },
    learningLessons: { used: learningLessonsUsed, limit: limitOf("learning_lessons") },
  };
}

/** Throws if starting a NEW project (one the user hasn't already got a
 * user_projects row for) would exceed the plan's project limit. Always
 * allows updating the status of a project the user has already started. */
export async function assertCanStartProject(
  supabase: Client,
  userId: string,
  projectId: string,
  plan: PlanTier,
): Promise<void> {
  const limit = getLimit(plan, "projects");
  if (limit === null) return;
  const { data: existing, error } = await supabase
    .from("user_projects")
    .select("project_id")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw new Error("Unable to verify your project usage.");
  if (existing) return; // already started — never blocked from updating it
  const used = await countDistinct(supabase, "user_projects", userId, "project_id");
  if (used >= limit) {
    throw new UpgradeRequiredError("unlimited_projects", plan);
  }
}

/** Throws if attempting an assessment the user hasn't already attempted
 * would exceed the plan's assessment limit. Retakes are always allowed. */
export async function assertCanAttemptAssessment(
  supabase: Client,
  userId: string,
  assessmentId: string,
  plan: PlanTier,
): Promise<void> {
  const limit = getLimit(plan, "assessments");
  if (limit === null) return;
  const { data: existing, error } = await supabase
    .from("assessment_attempts")
    .select("id")
    .eq("user_id", userId)
    .eq("assessment_id", assessmentId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("Unable to verify your assessment usage.");
  if (existing) return; // retake — never blocked
  const used = await countDistinct(supabase, "assessment_attempts", userId, "assessment_id");
  if (used >= limit) {
    throw new UpgradeRequiredError("advanced_assessments", plan);
  }
}

/** Throws if marking a NEW lesson complete (one not already in the topic's
 * completed set) would exceed the plan's lesson limit. Un-completing, or
 * re-completing an already-completed lesson, is always allowed. */
export async function assertCanCompleteLesson(
  supabase: Client,
  userId: string,
  plan: PlanTier,
): Promise<void> {
  const limit = getLimit(plan, "learning_lessons");
  if (limit === null) return;
  const { data, error } = await supabase
    .from("user_learning_progress")
    .select("completed_lessons")
    .eq("user_id", userId);
  if (error) throw new Error("Unable to verify your learning usage.");
  const used = ((data ?? []) as { completed_lessons: number[] }[]).reduce(
    (sum, row) => sum + (row.completed_lessons?.length ?? 0),
    0,
  );
  if (used >= limit) {
    throw new UpgradeRequiredError("unlimited_learning", plan);
  }
}

/** Throws if adding another career roadmap would exceed the plan's limit.
 * Free plans never reach here -- `multiple_career_roadmaps` is gated
 * entirely by `requireFeature` before this runs (see `addCareerRoadmap`).
 * The only real caller of this is a Pro user hitting the numeric
 * `PRO_CAREER_ROADMAPS` cap -- so this throws a plain quota error rather
 * than `UpgradeRequiredError` (which would confusingly say "requires Pro"
 * to someone already on Pro). */
export async function assertCanAddCareerRoadmap(
  supabase: Client,
  userId: string,
  plan: PlanTier,
): Promise<void> {
  const limit = getLimit(plan, "career_roadmaps");
  if (limit === null) return;
  const { count, error } = await supabase
    .from("roadmaps")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_active", true);
  if (error) throw new Error("Unable to verify your roadmap usage.");
  if ((count ?? 0) >= limit) {
    throw new Error(`You've reached your plan's limit of ${limit} career roadmaps.`);
  }
}

export { FEATURE_INFO };
