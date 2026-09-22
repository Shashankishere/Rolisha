/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = any;

import type { ProficiencyLevel } from "@/lib/domain";

export type TopicStatus = "not_started" | "learning" | "completed";

export interface LearningTopicRef {
  topicId: string;
  slug: string;
  title: string;
  skillId: string;
  difficulty: string;
  estimatedHours: number;
  hasAssessment: boolean;
}

/** Lightweight index of every topic, keyed by skill — used by the
 * dashboard/roadmap/skills pages to turn a skill into a "Learn X" link
 * without loading full lesson content for skills the user isn't viewing. */
export async function listLearningTopicRefs(supabase: Client): Promise<LearningTopicRef[]> {
  const { data, error } = await supabase
    .from("learning_topics")
    .select("id, slug, title, skill_id, difficulty, estimated_hours, assessment_id");
  if (error) throw new Error("Unable to load learning topics.");
  return ((data ?? []) as any[]).map((t) => ({
    topicId: t.id,
    slug: t.slug,
    title: t.title,
    skillId: t.skill_id,
    difficulty: t.difficulty,
    estimatedHours: Number(t.estimated_hours),
    hasAssessment: Boolean(t.assessment_id),
  }));
}

export interface LearningLesson {
  id: string;
  order: number;
  title: string;
  content: string;
  example: string | null;
  practice: string | null;
  completed: boolean;
}

export interface LearningResource {
  id: string;
  title: string;
  provider: string | null;
  url: string;
  type: string;
  isFree: boolean;
}

export interface LearningTopicDetail {
  id: string;
  slug: string;
  title: string;
  skillId: string;
  skillName: string;
  whyItMatters: string;
  difficulty: string;
  estimatedHours: number;
  objectives: string[];
  commonMistakes: string[];
  targetLevel: ProficiencyLevel;
  currentLevel: ProficiencyLevel;
  assessmentSlug: string | null;
  assessmentTitle: string | null;
  assessmentPassed: boolean;
  lessons: LearningLesson[];
  resources: LearningResource[];
  status: TopicStatus;
  completedAt: string | null;
}

export async function getLearningTopic(
  supabase: Client,
  userId: string,
  slug: string,
): Promise<LearningTopicDetail | null> {
  const { data: topic, error } = await supabase
    .from("learning_topics")
    .select(
      "id, slug, title, skill_id, why_it_matters, difficulty, estimated_hours, objectives, common_mistakes, target_level, skills(name), assessments(id, slug, title)",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error("Unable to load this learning topic.");
  if (!topic) return null;

  const t = topic as any;

  const [
    { data: lessons },
    { data: progress },
    { data: userSkill },
    assessmentAttempt,
    { data: resources },
  ] = await Promise.all([
    supabase
      .from("learning_lessons")
      .select("id, sort_order, title, content, example, practice")
      .eq("topic_id", t.id)
      .order("sort_order"),
    supabase
      .from("user_learning_progress")
      .select("status, completed_lessons, completed_at")
      .eq("user_id", userId)
      .eq("topic_id", t.id)
      .maybeSingle(),
    supabase
      .from("user_skills")
      .select("level")
      .eq("user_id", userId)
      .eq("skill_id", t.skill_id)
      .maybeSingle(),
    t.assessments?.id
      ? supabase
          .from("assessment_attempts")
          .select("score")
          .eq("user_id", userId)
          .eq("assessment_id", t.assessments.id)
      : Promise.resolve({ data: [] as any[] }),
    // Curated learning resources for this skill — reuses the same
    // `resources` table already used by the Projects detail page, never a
    // second/invented source of links.
    supabase
      .from("resources")
      .select("id, title, provider, url, type, is_free")
      .eq("skill_id", t.skill_id)
      .order("title"),
  ]);

  const completedIndexes = new Set<number>(
    ((progress as any)?.completed_lessons ?? []) as number[],
  );

  const attempts = (assessmentAttempt as any).data ?? [];
  const assessmentPassed =
    attempts.length > 0 && Math.max(...attempts.map((a: any) => a.score)) >= 70;

  return {
    id: t.id,
    slug: t.slug,
    title: t.title,
    skillId: t.skill_id,
    skillName: t.skills?.name ?? "Skill",
    whyItMatters: t.why_it_matters,
    difficulty: t.difficulty,
    estimatedHours: Number(t.estimated_hours),
    objectives: t.objectives ?? [],
    commonMistakes: t.common_mistakes ?? [],
    targetLevel: t.target_level as ProficiencyLevel,
    currentLevel: ((userSkill as any)?.level ?? "none") as ProficiencyLevel,
    assessmentSlug: t.assessments?.slug ?? null,
    assessmentTitle: t.assessments?.title ?? null,
    assessmentPassed,
    lessons: ((lessons ?? []) as any[]).map((l) => ({
      id: l.id,
      order: l.sort_order,
      title: l.title,
      content: l.content,
      example: l.example ?? null,
      practice: l.practice ?? null,
      completed: completedIndexes.has(l.sort_order),
    })),
    resources: ((resources ?? []) as any[]).map((r) => ({
      id: r.id,
      title: r.title,
      provider: r.provider ?? null,
      url: r.url,
      type: r.type,
      isFree: Boolean(r.is_free),
    })),
    status: ((progress as any)?.status ?? "not_started") as TopicStatus,
    completedAt: (progress as any)?.completed_at ?? null,
  };
}

export interface RecommendedNextTopic {
  topicSlug: string;
  topicTitle: string;
  skillName: string;
  estimatedHours: number;
}

/**
 * Cross-topic "what should I learn next" recommendation (Pro): the
 * highest-priority not-yet-ready skill in the user's target career that
 * has a mapped learning topic and isn't already completed. Uses the same
 * importance-weighted gap ranking as the advanced skill-gap page and the
 * roadmap engine, so all three agree on priority order.
 */
export async function getRecommendedNextTopic(
  supabase: Client,
  userId: string,
): Promise<RecommendedNextTopic | null> {
  const { requireFeature } = await import("@/lib/subscription.server");
  await requireFeature(supabase, userId, "unlimited_learning");

  const { loadProfile, loadRequiredSkills, loadUserSkills } = await import("@/lib/me.server");
  const { buildSkillGaps, IMPORTANCE_WEIGHT } = await import("@/lib/domain");

  const profile = await loadProfile(supabase, userId);
  if (!profile.careerId) return null;

  const [required, userSkills] = await Promise.all([
    loadRequiredSkills(supabase, profile.careerId),
    loadUserSkills(supabase, userId),
  ]);
  const levels: Record<string, ProficiencyLevel> = {};
  for (const s of userSkills) if (s.skillId) levels[s.skillId] = s.level;

  const prioritized = buildSkillGaps(required, levels)
    .filter((g) => g.status !== "ready")
    .sort(
      (a, b) =>
        IMPORTANCE_WEIGHT[b.importance] * b.gapPercentage -
        IMPORTANCE_WEIGHT[a.importance] * a.gapPercentage,
    );
  if (prioritized.length === 0) return null;

  const topics = await listLearningTopicRefs(supabase);
  const topicBySkillId = new Map(topics.map((t) => [t.skillId, t]));

  const { data: progressRows, error } = await supabase
    .from("user_learning_progress")
    .select("topic_id, status")
    .eq("user_id", userId);
  if (error) throw new Error("Unable to load your learning progress.");
  const completedTopicIds = new Set(
    ((progressRows ?? []) as { topic_id: string; status: string }[])
      .filter((r) => r.status === "completed")
      .map((r) => r.topic_id),
  );

  for (const gap of prioritized) {
    const topic = topicBySkillId.get(gap.skillId);
    if (topic && !completedTopicIds.has(topic.topicId)) {
      return {
        topicSlug: topic.slug,
        topicTitle: topic.title,
        skillName: gap.name,
        estimatedHours: topic.estimatedHours,
      };
    }
  }
  return null;
}

/** Marks a lesson complete/incomplete. Starting a lesson on a topic the user
 * hasn't opened before implicitly moves the topic to "learning" status —
 * there is no way to reach "completed" through this function alone, only
 * through completeLearningTopic (finish or explicit skip), matching the
 * "don't allow completion without actually entering the learning
 * experience, unless explicitly skipped" rule. */
export async function toggleLessonComplete(
  supabase: Client,
  userId: string,
  topicId: string,
  lessonOrder: number,
  completed: boolean,
): Promise<{ ok: true; completedLessons: number[] }> {
  const { data: existing } = await supabase
    .from("user_learning_progress")
    .select("completed_lessons, status")
    .eq("user_id", userId)
    .eq("topic_id", topicId)
    .maybeSingle();

  const set = new Set<number>(((existing as any)?.completed_lessons ?? []) as number[]);
  const isNewCompletion = completed && !set.has(lessonOrder);
  if (isNewCompletion) {
    const { getUserPlan, assertCanCompleteLesson } = await import("@/lib/subscription.server");
    const plan = await getUserPlan(supabase, userId);
    await assertCanCompleteLesson(supabase, userId, plan);
  }
  if (completed) set.add(lessonOrder);
  else set.delete(lessonOrder);
  const completedLessons = [...set].sort((a, b) => a - b);

  const status = (existing as any)?.status === "completed" ? "completed" : "learning";

  const { error } = await supabase
    .from("user_learning_progress")
    .upsert(
      { user_id: userId, topic_id: topicId, status, completed_lessons: completedLessons },
      { onConflict: "user_id,topic_id" },
    );
  if (error) throw new Error("Unable to update this lesson.");
  return { ok: true, completedLessons };
}

/**
 * Marks the topic itself complete and bumps the user's skill level toward
 * the topic's target level (never lowering it), so completing a learning
 * topic actually feeds back into the skill-gap matrix and roadmap, not just
 * a separate progress counter. `viaSkip` records whether every lesson was
 * actually finished first, or the user used the explicit "Skip" action.
 */
export async function completeLearningTopic(
  supabase: Client,
  userId: string,
  topicId: string,
  viaSkip: boolean,
): Promise<{ ok: true }> {
  const { data: topic, error: topicError } = await supabase
    .from("learning_topics")
    .select("skill_id, target_level, title")
    .eq("id", topicId)
    .maybeSingle();
  if (topicError || !topic) throw new Error("Unable to find this topic.");

  const { data: existing } = await supabase
    .from("user_learning_progress")
    .select("completed_lessons")
    .eq("user_id", userId)
    .eq("topic_id", topicId)
    .maybeSingle();

  const { error } = await supabase.from("user_learning_progress").upsert(
    {
      user_id: userId,
      topic_id: topicId,
      status: "completed",
      completed_lessons: (existing as any)?.completed_lessons ?? [],
      skipped: viaSkip,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,topic_id" },
  );
  if (error) throw new Error("Unable to complete this topic.");

  const { PROFICIENCY_VALUE } = await import("@/lib/domain");
  const { data: userSkill } = await supabase
    .from("user_skills")
    .select("level")
    .eq("user_id", userId)
    .eq("skill_id", (topic as any).skill_id)
    .maybeSingle();
  const currentLevel = ((userSkill as any)?.level ?? "none") as ProficiencyLevel;
  const targetLevel = (topic as any).target_level as ProficiencyLevel;
  if (PROFICIENCY_VALUE[targetLevel] > PROFICIENCY_VALUE[currentLevel]) {
    await supabase.from("user_skills").upsert(
      {
        user_id: userId,
        skill_id: (topic as any).skill_id,
        level: targetLevel,
        source: "learning_topic",
      },
      { onConflict: "user_id,skill_id" },
    );
  }

  const { syncReadiness } = await import("@/lib/me.server");
  await syncReadiness(supabase, userId);

  await supabase.from("progress_events").insert({
    user_id: userId,
    event_type: viaSkip ? "topic_skipped" : "topic_completed",
    label: (topic as any).title,
  });

  return { ok: true };
}
