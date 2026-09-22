/**
 * Advanced skill-gap analysis (Pro).
 *
 * Builds on the existing free skill-gap (`buildSkillGaps` in domain.ts,
 * ordered by the career's curated `career_skills.sort_order`) and adds,
 * for Pro users only:
 *
 *  - priority ranking: not-yet-ready skills ordered by importance-weighted
 *    gap size (same weighting `roadmap.server.ts` uses to sequence the
 *    roadmap, so the two stay consistent with each other)
 *  - estimated learning time, sourced from `learning_topics.estimated_hours`
 *    when a topic exists for the skill (never invented)
 *  - prerequisite relationships, derived from the career's own curated
 *    `sort_order` — skills earlier in that curriculum order that are not
 *    yet "ready" are surfaced as prerequisites. This is a real, admin
 *    authored ordering already used elsewhere (roadmap sequencing), not a
 *    fabricated dependency graph.
 *  - a recommended learning sequence (the same not-ready skills, priority
 *    order)
 *  - recommended project / assessment links, reusing the existing catalogs
 *  - a live job-demand signal computed ONLY from real ingested jobs
 *    (`jobs.is_demo = false`, scoped to the user's target career). Below
 *    `MIN_LIVE_JOBS_FOR_SIGNAL` real postings the signal is withheld with
 *    an honest reason rather than estimated or interpolated from demo data.
 */
import {
  buildSkillGaps,
  IMPORTANCE_WEIGHT,
  type ProficiencyLevel,
  type SkillGapRow,
} from "@/lib/domain";
import { loadProfile, loadRequiredSkills, loadUserSkills } from "@/lib/me.server";
import { requireFeature } from "@/lib/subscription.server";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = any;

/** Below this many real (is_demo=false) postings for the user's career, we
 * refuse to compute a per-skill demand percentage — too few data points to
 * be meaningful, and we will not paper over that with a guess. */
export const MIN_LIVE_JOBS_FOR_SIGNAL = 5;

export interface AdvancedSkillGapRow extends SkillGapRow {
  /** 1 = highest priority. Only assigned to skills that aren't "ready" yet;
   * ready skills get `null`. */
  priorityRank: number | null;
  estimatedHours: number | null;
  /** Names of skills earlier in this career's curriculum order that the
   * user hasn't reached the required level on yet. */
  prerequisites: string[];
  /** Percentage of real, currently-ingested live postings for this career
   * that require this skill. `null` when there isn't enough live job data
   * to compute this honestly (see `MIN_LIVE_JOBS_FOR_SIGNAL`). */
  liveJobDemandPercentage: number | null;
  learningTopicSlug: string | null;
  assessmentSlug: string | null;
  recommendedProjectId: string | null;
  recommendedProjectSlug: string | null;
}

export interface AdvancedSkillGapResult {
  rows: AdvancedSkillGapRow[];
  /** Skill names, in the order we'd recommend learning them next. */
  recommendedSequence: string[];
  liveJobSignal: {
    available: boolean;
    jobsAnalyzed: number;
  };
}

function priorityScore(row: SkillGapRow): number {
  return IMPORTANCE_WEIGHT[row.importance] * row.gapPercentage;
}

export async function loadAdvancedSkillGap(
  supabase: Client,
  userId: string,
): Promise<AdvancedSkillGapResult> {
  await requireFeature(supabase, userId, "advanced_skill_gap");

  const profile = await loadProfile(supabase, userId);
  const [required, userSkills] = await Promise.all([
    loadRequiredSkills(supabase, profile.careerId),
    loadUserSkills(supabase, userId),
  ]);

  const levels: Record<string, ProficiencyLevel> = {};
  for (const s of userSkills) if (s.skillId) levels[s.skillId] = s.level;
  // loadRequiredSkills orders by career_skills.sort_order, and buildSkillGaps
  // preserves input order, so `gaps` is already in curriculum order.
  const gaps = buildSkillGaps(required, levels);

  // --- Live job-demand signal: real ingested jobs only ---------------
  let jobsAnalyzed = 0;
  const demandCountBySkill = new Map<string, number>();
  if (profile.careerId) {
    const { count } = await supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("career_id", profile.careerId)
      .eq("is_demo", false);
    jobsAnalyzed = count ?? 0;

    if (jobsAnalyzed >= MIN_LIVE_JOBS_FOR_SIGNAL) {
      const { data: liveJobs, error: liveJobsError } = await supabase
        .from("jobs")
        .select("id")
        .eq("career_id", profile.careerId)
        .eq("is_demo", false);
      if (liveJobsError) throw new Error("Unable to load live job data.");
      const liveJobIds = ((liveJobs ?? []) as { id: string }[]).map((j) => j.id);
      if (liveJobIds.length > 0) {
        const { data: jobSkillRows, error: jobSkillsError } = await supabase
          .from("job_skills")
          .select("skill_id, job_id")
          .in("job_id", liveJobIds);
        if (jobSkillsError) throw new Error("Unable to load live job skill requirements.");
        for (const row of (jobSkillRows ?? []) as { skill_id: string }[]) {
          demandCountBySkill.set(row.skill_id, (demandCountBySkill.get(row.skill_id) ?? 0) + 1);
        }
      }
    }
  }
  const hasLiveSignal = jobsAnalyzed >= MIN_LIVE_JOBS_FOR_SIGNAL;

  // --- Learning topics, assessments, projects for linking -------------
  const skillIds = gaps.map((g) => g.skillId).filter(Boolean);

  const { listLearningTopicRefs } = await import("@/lib/learning.server");
  const topics = skillIds.length ? await listLearningTopicRefs(supabase) : [];
  const topicBySkillId = new Map(topics.map((t) => [t.skillId, t]));

  let assessmentBySkillId = new Map<string, string>();
  if (skillIds.length > 0) {
    const { data: assessmentRows, error: assessmentError } = await supabase
      .from("assessments")
      .select("slug, skill_id")
      .in("skill_id", skillIds);
    if (assessmentError) throw new Error("Unable to load assessments for these skills.");
    assessmentBySkillId = new Map(
      ((assessmentRows ?? []) as { slug: string; skill_id: string | null }[])
        .filter((r) => r.skill_id)
        .map((r) => [r.skill_id as string, r.slug]),
    );
  }

  const { data: projectRows, error: projectError } = await supabase
    .from("projects")
    .select("id, slug, skills");
  if (projectError) throw new Error("Unable to load the project catalog.");
  const projectByLowerSkillName = new Map<string, { id: string; slug: string }>();
  for (const p of (projectRows ?? []) as { id: string; slug: string; skills: string[] }[]) {
    for (const skillName of p.skills ?? []) {
      const key = skillName.toLowerCase();
      if (!projectByLowerSkillName.has(key)) {
        projectByLowerSkillName.set(key, { id: p.id, slug: p.slug });
      }
    }
  }

  // --- Priority ranking + prerequisites (curriculum order) -------------
  const notReadyIndices = gaps
    .map((g, i) => ({ g, i }))
    .filter(({ g }) => g.status !== "ready")
    .sort((a, b) => priorityScore(b.g) - priorityScore(a.g));
  const rankBySkillId = new Map<string, number>();
  notReadyIndices.forEach(({ g }, rank) => rankBySkillId.set(g.skillId, rank + 1));

  const rows: AdvancedSkillGapRow[] = gaps.map((gap, index) => {
    const topic = topicBySkillId.get(gap.skillId);
    const project = projectByLowerSkillName.get(gap.name.toLowerCase());
    const prerequisites = gaps
      .slice(0, index)
      .filter((earlier) => earlier.status !== "ready")
      .map((earlier) => earlier.name);

    return {
      ...gap,
      priorityRank: rankBySkillId.get(gap.skillId) ?? null,
      estimatedHours: topic?.estimatedHours ?? null,
      prerequisites,
      liveJobDemandPercentage: hasLiveSignal
        ? Math.round(((demandCountBySkill.get(gap.skillId) ?? 0) / jobsAnalyzed) * 100)
        : null,
      learningTopicSlug: topic?.slug ?? null,
      assessmentSlug: assessmentBySkillId.get(gap.skillId) ?? null,
      recommendedProjectId: project?.id ?? null,
      recommendedProjectSlug: project?.slug ?? null,
    };
  });

  const recommendedSequence = notReadyIndices.map(({ g }) => g.name);

  return {
    rows,
    recommendedSequence,
    liveJobSignal: { available: hasLiveSignal, jobsAnalyzed },
  };
}
