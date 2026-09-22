/**
 * Central subscription/feature-gating model for Rolisha.
 *
 * This module is intentionally pure (no Supabase import, no I/O) so it can
 * be imported from both server code and client components/routes without
 * pulling server-only dependencies into the browser bundle. Server-side
 * data loading and enforcement lives in `subscription.server.ts`.
 *
 * PLAN SCOPE: Rolisha has exactly two user-facing plans, Free and Pro.
 * There used to be a third "Premium" tier above Pro; it was removed
 * before launch and every feature that would have been Premium-only
 * (resume analysis, interview prep, mock interviews, career switching,
 * ...) was folded into Pro instead -- see the `requiredPlan` values
 * below. `planSource` on a profile is either the default ('default',
 * i.e. still on whatever the signup default is), 'manual_admin' (an
 * admin changed it by hand), or 'razorpay_subscription' (a real paid
 * subscription) — never anything that implies access without one of
 * those three explanations.
 */

export type PlanTier = "free" | "pro";

export const PLAN_TIERS: PlanTier[] = ["free", "pro"];

export const PLAN_RANK: Record<PlanTier, number> = {
  free: 0,
  pro: 1,
};

export const PLAN_LABEL: Record<PlanTier, string> = {
  free: "Free",
  pro: "Pro",
};

export function planAtLeast(plan: PlanTier, minimum: PlanTier): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[minimum];
}

/**
 * Every gate-able feature identifier in the product. Some of these
 * (resume_analysis, mock_interviews, ai_personalization, ...) do not have
 * an implemented feature behind them yet in Phase 1 — they exist here only
 * so later phases can call `canAccessFeature`/`requireFeature` against a
 * stable identifier instead of re-deriving plan logic ad hoc.
 */
export type Feature =
  | "roadmap_full"
  | "unlimited_learning"
  | "advanced_skill_gap"
  | "advanced_assessments"
  | "unlimited_projects"
  | "advanced_job_matching"
  | "multiple_career_roadmaps"
  | "career_analytics"
  | "ai_personalization"
  | "resume_analysis"
  | "resume_optimization"
  | "interview_preparation"
  | "personalized_interview_questions"
  | "mock_interviews"
  | "career_switch_analysis"
  | "ai_career_recommendations";

export interface FeatureInfo {
  /** Short display name, e.g. "Advanced skill-gap analysis". */
  label: string;
  /** One-sentence explanation of what the feature does. */
  description: string;
  /** Minimum plan required. */
  requiredPlan: PlanTier;
  /** False if the identifier exists but nothing is implemented behind it.
   * Such a feature must not be advertised anywhere (pricing, plan panel):
   * user-facing surfaces filter on this flag. */
  implemented: boolean;
}

export const FEATURE_INFO: Record<Feature, FeatureInfo> = {
  roadmap_full: {
    label: "Full roadmap",
    description: "The complete multi month roadmap with every task, not just the first stretch.",
    requiredPlan: "pro",
    implemented: true,
  },
  unlimited_learning: {
    label: "Unlimited learning",
    description: "Complete as many learning lessons as you want, with no monthly cap.",
    requiredPlan: "pro",
    implemented: true,
  },
  advanced_skill_gap: {
    label: "Advanced skill gap analysis",
    description: "A deeper breakdown of your skill gaps against real job requirements.",
    requiredPlan: "pro",
    implemented: true,
  },
  advanced_assessments: {
    label: "Full assessment library",
    description: "Take every assessment in the catalog, not just a handful.",
    requiredPlan: "pro",
    implemented: true,
  },
  unlimited_projects: {
    label: "Unlimited projects",
    description: "Start as many portfolio projects as you want, with no cap.",
    requiredPlan: "pro",
    implemented: true,
  },
  advanced_job_matching: {
    label: "Advanced job matching",
    description: "See exactly which skills match and which are missing for every job.",
    requiredPlan: "pro",
    implemented: true,
  },
  multiple_career_roadmaps: {
    label: "Multiple career roadmaps",
    description: "Maintain more than one target role roadmap at once.",
    requiredPlan: "pro",
    implemented: true,
  },
  career_analytics: {
    label: "Advanced career analytics",
    description: "Deeper trend analytics on your readiness and progress over time.",
    requiredPlan: "pro",
    implemented: true,
  },
  ai_personalization: {
    label: "AI powered learning recommendations",
    description: "AI personalized suggestions for what to learn next.",
    requiredPlan: "pro",
    implemented: false,
  },
  resume_analysis: {
    label: "AI resume analysis",
    description: "Get your resume analyzed against your target role.",
    requiredPlan: "pro",
    implemented: true,
  },
  resume_optimization: {
    label: "Resume optimization",
    description: "AI suggested rewrites to strengthen your resume.",
    requiredPlan: "pro",
    implemented: true,
  },
  interview_preparation: {
    label: "Interview preparation",
    description: "A structured preparation plan for your target role's interviews.",
    requiredPlan: "pro",
    implemented: true,
  },
  personalized_interview_questions: {
    label: "Personalized interview questions",
    description: "Interview questions generated from your real skills, projects, and target role.",
    requiredPlan: "pro",
    implemented: true,
  },
  mock_interviews: {
    label: "Mock interviews",
    description: "Practice interviews with AI driven feedback.",
    requiredPlan: "pro",
    implemented: true,
  },
  career_switch_analysis: {
    label: "Career switch analysis",
    description: "Analysis of how your existing skills transfer to a new target role.",
    requiredPlan: "pro",
    implemented: true,
  },
  ai_career_recommendations: {
    label: "AI career recommendations",
    description: "Recommended roles based on your real profile, skills, and progress.",
    requiredPlan: "pro",
    implemented: true,
  },
};

export function canAccessFeature(plan: PlanTier, feature: Feature): boolean {
  return planAtLeast(plan, FEATURE_INFO[feature].requiredPlan);
}

/** Every feature required at a given plan or below (used to build "what's
 * included" lists for pricing/settings without repeating the matrix). */
export function featuresForPlan(plan: PlanTier): Feature[] {
  return (Object.keys(FEATURE_INFO) as Feature[]).filter((f) =>
    planAtLeast(plan, FEATURE_INFO[f].requiredPlan),
  );
}

/**
 * Machine-readable "upgrade required" error. The message is a plain,
 * human-readable sentence prefixed with a stable marker so a client that
 * wants to render a rich UpgradePrompt (rather than a plain toast) can
 * parse `parseUpgradeError` — but any caller that just reads `.message`
 * still gets something sensible to show. This survives the server-function
 * RPC boundary because it's encoded entirely in the string message, not in
 * custom class fields (which are not guaranteed to survive serialization).
 */
const UPGRADE_MARKER = "FEATURE_REQUIRES_UPGRADE";

export interface UpgradeRequiredInfo {
  code: "FEATURE_REQUIRES_UPGRADE";
  feature: Feature;
  featureLabel: string;
  currentPlan: PlanTier;
  requiredPlan: PlanTier;
  message: string;
}

export class UpgradeRequiredError extends Error {
  readonly info: UpgradeRequiredInfo;

  constructor(feature: Feature, currentPlan: PlanTier) {
    const requiredPlan = FEATURE_INFO[feature].requiredPlan;
    const featureLabel = FEATURE_INFO[feature].label;
    const human = `${featureLabel} requires the ${PLAN_LABEL[requiredPlan]} plan. You're currently on ${PLAN_LABEL[currentPlan]}.`;
    super(`${UPGRADE_MARKER}::${feature}::${requiredPlan}::${currentPlan}::${human}`);
    this.name = "UpgradeRequiredError";
    this.info = {
      code: "FEATURE_REQUIRES_UPGRADE",
      feature,
      featureLabel,
      currentPlan,
      requiredPlan,
      message: human,
    };
  }
}

/** Parses an error message (from any Error, including one that crossed a
 * server-function boundary) back into structured upgrade info, or returns
 * null if it isn't one of ours. Always safe to call. */
export function parseUpgradeError(message: string | undefined | null): UpgradeRequiredInfo | null {
  if (!message) return null;
  const parts = message.split("::");
  if (parts.length < 5 || parts[0] !== UPGRADE_MARKER) return null;
  const [, feature, requiredPlan, currentPlan, ...rest] = parts;
  if (!(feature! in FEATURE_INFO)) return null;
  if (
    !PLAN_TIERS.includes(requiredPlan as PlanTier) ||
    !PLAN_TIERS.includes(currentPlan as PlanTier)
  ) {
    return null;
  }
  return {
    code: "FEATURE_REQUIRES_UPGRADE",
    feature: feature as Feature,
    featureLabel: FEATURE_INFO[feature as Feature].label,
    requiredPlan: requiredPlan as PlanTier,
    currentPlan: currentPlan as PlanTier,
    message: rest.join("::"),
  };
}

/** A resource with a countable, plan-dependent free/pro cap. `null` means
 * unlimited. These are the "suggested starting limits" from the spec —
 * centralized here instead of hardcoded in components. */
export type LimitedResource = "career_roadmaps" | "projects" | "assessments" | "learning_lessons";

export const FREE_LEARNING_LESSONS = 5;
export const FREE_PROJECTS = 2;
export const FREE_ASSESSMENTS = 3;
export const FREE_CAREER_ROADMAPS = 1;
export const PRO_CAREER_ROADMAPS = 5;
/** Free plan roadmap months are unlocked sequentially rather than given away
 * all at once (see `roadmap.server.ts`'s month-unlock logic, which is the
 * actual enforcement behind the `roadmap_full` feature flag): this is how
 * many months a Free user's roadmap starts with unlocked before completing
 * anything -- Month 1 is usable immediately, and completing every required
 * task in an unlocked month unlocks the next one. Pro has no such gate and
 * sees every month unlocked immediately. */
export const FREE_ROADMAP_DETAIL_MONTHS = 1;

export function getLimit(plan: PlanTier, resource: LimitedResource): number | null {
  if (plan === "pro") {
    if (resource === "career_roadmaps") return PRO_CAREER_ROADMAPS;
    return null; // unlimited learning/projects/assessments on Pro
  }
  // free
  switch (resource) {
    case "career_roadmaps":
      return FREE_CAREER_ROADMAPS;
    case "projects":
      return FREE_PROJECTS;
    case "assessments":
      return FREE_ASSESSMENTS;
    case "learning_lessons":
      return FREE_LEARNING_LESSONS;
  }
}

export const RESOURCE_LABEL: Record<LimitedResource, string> = {
  career_roadmaps: "Career roadmaps",
  projects: "Projects",
  assessments: "Assessments",
  learning_lessons: "Learning lessons",
};
