/**
 * Career analytics (Pro).
 *
 * Every number here is derived from tables that already exist and are
 * already written to by other real features (roadmap_tasks, user_projects,
 * user_learning_progress + learning_topics, assessment_attempts,
 * saved_jobs, progress_events) — nothing here is estimated, simulated, or
 * backfilled. Where there isn't enough history to say something meaningful
 * (e.g. a readiness trend from a single data point), the field is left
 * empty/null and the UI shows an honest empty state instead of a fabricated
 * chart.
 */
import { buildSkillGaps, readinessScore, type ProficiencyLevel } from "@/lib/domain";
import { loadProfile, loadRequiredSkills, loadUserSkills } from "@/lib/me.server";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = any;

export interface SkillStrengthRow {
  skillId: string;
  name: string;
  /** 0-100, based on current level vs required level for the target role. */
  coveragePercent: number;
}

export interface ReadinessTrendPoint {
  date: string;
  readinessScore: number;
}

export interface AssessmentPerformanceSummary {
  attemptsCount: number;
  assessmentsTaken: number;
  assessmentsPassed: number;
  averageBestScore: number | null;
}

export interface CareerAnalytics {
  targetRole: string | null;
  readiness: number;
  roadmapCompletionPercent: number | null;
  skillsReadyCount: number;
  skillsRequiredCount: number;
  learningHoursCompleted: number;
  topicsCompletedCount: number;
  projectsCompletedCount: number;
  jobsSavedCount: number;
  assessments: AssessmentPerformanceSummary;
  strongestSkills: SkillStrengthRow[];
  weakestSkills: SkillStrengthRow[];
  /** Readiness over time, oldest first. Only populated once there are at
   * least 2 recorded readiness snapshots — a single point isn't a trend. */
  readinessTrend: ReadinessTrendPoint[];
}

export async function loadCareerAnalytics(
  supabase: Client,
  userId: string,
): Promise<CareerAnalytics> {
  const { requireFeature } = await import("@/lib/subscription.server");
  await requireFeature(supabase, userId, "career_analytics");

  const profile = await loadProfile(supabase, userId);
  const [required, userSkills] = await Promise.all([
    loadRequiredSkills(supabase, profile.careerId),
    loadUserSkills(supabase, userId),
  ]);
  const levels: Record<string, ProficiencyLevel> = {};
  for (const s of userSkills) if (s.skillId) levels[s.skillId] = s.level;
  const gaps = buildSkillGaps(required, levels);

  const strengthRows: SkillStrengthRow[] = gaps.map((g) => ({
    skillId: g.skillId,
    name: g.name,
    coveragePercent: Math.max(0, Math.min(100, 100 - g.gapPercentage)),
  }));
  const sortedByStrength = [...strengthRows].sort((a, b) => b.coveragePercent - a.coveragePercent);
  const strongestSkills = sortedByStrength.slice(0, 3);
  const weakestSkills = [...sortedByStrength].reverse().slice(0, 3);

  const [
    { data: activeRoadmap },
    { data: userProjects },
    { data: learningProgress },
    { data: attempts },
    { count: jobsSavedCount },
    { count: readinessSnapshotCount },
  ] = await Promise.all([
    supabase
      .from("roadmaps")
      .select("id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase.from("user_projects").select("status").eq("user_id", userId),
    supabase.from("user_learning_progress").select("topic_id, status").eq("user_id", userId),
    supabase.from("assessment_attempts").select("assessment_id, score").eq("user_id", userId),
    supabase.from("saved_jobs").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase
      .from("progress_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("readiness_score", "is", null),
  ]);

  let roadmapCompletionPercent: number | null = null;
  if (activeRoadmap) {
    const { data: tasks } = await supabase
      .from("roadmap_tasks")
      .select("is_completed")
      .eq("roadmap_id", (activeRoadmap as any).id);
    const taskRows = (tasks ?? []) as { is_completed: boolean }[];
    roadmapCompletionPercent = taskRows.length
      ? Math.round((taskRows.filter((t) => t.is_completed).length / taskRows.length) * 100)
      : null;
  }

  const projectsCompletedCount = ((userProjects ?? []) as { status: string }[]).filter(
    (p) => p.status === "completed",
  ).length;

  const completedTopicIds = ((learningProgress ?? []) as { topic_id: string; status: string }[])
    .filter((r) => r.status === "completed")
    .map((r) => r.topic_id);
  let learningHoursCompleted = 0;
  if (completedTopicIds.length > 0) {
    const { data: topics } = await supabase
      .from("learning_topics")
      .select("id, estimated_hours")
      .in("id", completedTopicIds);
    learningHoursCompleted = ((topics ?? []) as { estimated_hours: number }[]).reduce(
      (sum, t) => sum + Number(t.estimated_hours ?? 0),
      0,
    );
  }

  const attemptRows = (attempts ?? []) as { assessment_id: string; score: number }[];
  const bestByAssessment = new Map<string, number>();
  for (const a of attemptRows) {
    const existing = bestByAssessment.get(a.assessment_id);
    if (existing === undefined || a.score > existing)
      bestByAssessment.set(a.assessment_id, a.score);
  }
  const bestScores = [...bestByAssessment.values()];
  const assessments: AssessmentPerformanceSummary = {
    attemptsCount: attemptRows.length,
    assessmentsTaken: bestByAssessment.size,
    assessmentsPassed: bestScores.filter((s) => s >= 70).length,
    averageBestScore: bestScores.length
      ? Math.round(bestScores.reduce((sum, s) => sum + s, 0) / bestScores.length)
      : null,
  };

  let readinessTrend: ReadinessTrendPoint[] = [];
  if ((readinessSnapshotCount ?? 0) >= 2) {
    const { data: snapshots } = await supabase
      .from("progress_events")
      .select("created_at, readiness_score")
      .eq("user_id", userId)
      .not("readiness_score", "is", null)
      .order("created_at", { ascending: true });
    readinessTrend = ((snapshots ?? []) as { created_at: string; readiness_score: number }[]).map(
      (s) => ({ date: s.created_at, readinessScore: s.readiness_score }),
    );
  }

  return {
    targetRole: profile.targetRole,
    readiness: readinessScore(gaps),
    roadmapCompletionPercent,
    skillsReadyCount: gaps.filter((g) => g.status === "ready").length,
    skillsRequiredCount: gaps.length,
    learningHoursCompleted,
    topicsCompletedCount: completedTopicIds.length,
    projectsCompletedCount,
    jobsSavedCount: jobsSavedCount ?? 0,
    assessments,
    strongestSkills,
    weakestSkills,
    readinessTrend,
  };
}
