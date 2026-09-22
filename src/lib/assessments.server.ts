/**
 * Server-side core logic for the Assessments page.
 *
 * Reads/writes the existing `assessments`, `assessment_questions`, and
 * `assessment_attempts` tables (real schema, previously zero rows — see the
 * seed migration 20260824000000_seed_assessments.sql for the first real
 * content). Grading always happens here, server-side, against
 * `correct_index` — the quiz-taking query never selects `correct_index` or
 * `explanation`, so a user inspecting network responses can't see answers
 * before submitting.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = any;

import { PROFICIENCY_VALUE, type ProficiencyLevel } from "@/lib/domain";

export interface AssessmentSummary {
  id: string;
  slug: string;
  title: string;
  skillName: string | null;
  skillId: string | null;
  difficulty: string;
  description: string | null;
  passScore: number;
  questionCount: number;
  bestScore: number | null;
  attemptCount: number;
  lastAttemptAt: string | null;
  passed: boolean;
  /** True when this assessment's skill is part of the user's currently
   * selected target career's required skill profile. */
  isRoleMatch: boolean;
}

export interface AssessmentsForUser {
  assessments: AssessmentSummary[];
  targetRoleTitle: string | null;
  /** Whether at least one assessment matches the user's selected role — the
   * UI uses this to decide between a role-specific list and an honest
   * "nothing for this role yet" message instead of silently falling back
   * to an unrelated generic quiz. */
  hasRoleMatch: boolean;
}

/**
 * Lists assessments with the current user's attempt history merged in, and
 * flags which ones match the skill profile of the user's selected target
 * career (career -> career_skills -> skill_id), so the Assessments page can
 * surface role-specific quizzes instead of the same generic list for every
 * career. Never hides assessments outside the role — role matches are
 * surfaced first, everything else remains browsable below.
 */
export async function listAssessments(
  supabase: Client,
  userId: string,
): Promise<AssessmentsForUser> {
  const [
    { data: profile },
    { data: assessments, error: aError },
    { data: questions, error: qError },
  ] = await Promise.all([
    supabase.from("profiles").select("career_id, target_role").eq("id", userId).maybeSingle(),
    supabase
      .from("assessments")
      .select("id, slug, title, difficulty, description, pass_score, skill_id")
      .order("title", { ascending: true }),
    supabase.from("assessment_questions").select("assessment_id"),
  ]);
  if (aError) throw new Error("Unable to load assessments.");
  if (qError) throw new Error("Unable to load assessment questions.");

  const careerId = (profile as any)?.career_id ?? null;
  const targetRoleTitle = (profile as any)?.target_role ?? null;

  let requiredSkillIds = new Set<string>();
  if (careerId) {
    const { data: careerSkills } = await supabase
      .from("career_skills")
      .select("skill_id")
      .eq("career_id", careerId);
    requiredSkillIds = new Set(((careerSkills ?? []) as any[]).map((row) => row.skill_id));
  }

  const assessmentRows = (assessments ?? []) as any[];
  const skillIds = [...new Set(assessmentRows.map((a) => a.skill_id).filter(Boolean))];
  const { data: skills, error: sError } = skillIds.length
    ? await supabase.from("skills").select("id, name").in("id", skillIds)
    : { data: [] as any[], error: null };
  if (sError) throw new Error("Unable to load skill names.");
  const skillNameById = new Map(((skills ?? []) as any[]).map((s) => [s.id, s.name]));

  const { data: attempts, error: atError } = await supabase
    .from("assessment_attempts")
    .select("assessment_id, score, created_at")
    .eq("user_id", userId);
  if (atError) throw new Error("Unable to load your attempt history.");

  const questionCountByAssessment = new Map<string, number>();
  for (const q of (questions ?? []) as any[]) {
    questionCountByAssessment.set(
      q.assessment_id,
      (questionCountByAssessment.get(q.assessment_id) ?? 0) + 1,
    );
  }

  const attemptsByAssessment = new Map<string, { score: number; created_at: string }[]>();
  for (const attempt of (attempts ?? []) as any[]) {
    const list = attemptsByAssessment.get(attempt.assessment_id) ?? [];
    list.push(attempt);
    attemptsByAssessment.set(attempt.assessment_id, list);
  }

  const summaries: AssessmentSummary[] = assessmentRows.map((a) => {
    const attemptList = attemptsByAssessment.get(a.id) ?? [];
    const bestScore = attemptList.length ? Math.max(...attemptList.map((x) => x.score)) : null;
    const lastAttemptAt = attemptList.length
      ? attemptList.reduce(
          (latest, x) => (x.created_at > latest ? x.created_at : latest),
          attemptList[0]!.created_at,
        )
      : null;
    return {
      id: a.id,
      slug: a.slug,
      title: a.title,
      skillId: a.skill_id ?? null,
      skillName: a.skill_id ? (skillNameById.get(a.skill_id) ?? null) : null,
      difficulty: a.difficulty,
      description: a.description ?? null,
      passScore: a.pass_score,
      questionCount: questionCountByAssessment.get(a.id) ?? 0,
      bestScore,
      attemptCount: attemptList.length,
      lastAttemptAt,
      passed: bestScore !== null && bestScore >= a.pass_score,
      isRoleMatch: Boolean(a.skill_id && requiredSkillIds.has(a.skill_id)),
    };
  });

  summaries.sort((a, b) => {
    if (a.isRoleMatch !== b.isRoleMatch) return a.isRoleMatch ? -1 : 1;
    return a.title.localeCompare(b.title);
  });

  return {
    assessments: summaries,
    targetRoleTitle,
    hasRoleMatch: summaries.some((a) => a.isRoleMatch),
  };
}

export interface SkillPerformanceRow {
  skillId: string;
  skillName: string;
  /** Best score across attempts of the role-matched assessment(s) for this
   * skill. `null` means the user hasn't attempted an assessment for it yet
   * — shown honestly as "not attempted", never estimated. */
  score: number | null;
  passed: boolean;
}

export interface SkillPerformanceBreakdown {
  targetRoleTitle: string | null;
  rows: SkillPerformanceRow[];
  /** The weakest-performing (or never-attempted) role skill, if any. */
  recommendedNextSkill: string | null;
  recommendedTopicSlug: string | null;
}

/**
 * Per-skill score breakdown for the user's target role (Pro), e.g. "React
 * 64%, APIs 58%" — built entirely from real attempt history via
 * `listAssessments`, never invented. When a role skill has more than one
 * assessment, the best score across them is used. Skills with no attempt
 * yet are still listed with `score: null` so the breakdown reflects full
 * role coverage, not just what's been attempted.
 */
export async function getSkillPerformanceBreakdown(
  supabase: Client,
  userId: string,
): Promise<SkillPerformanceBreakdown> {
  const { requireFeature } = await import("@/lib/subscription.server");
  await requireFeature(supabase, userId, "advanced_assessments");

  const { assessments, targetRoleTitle, hasRoleMatch } = await listAssessments(supabase, userId);
  if (!hasRoleMatch) {
    return { targetRoleTitle, rows: [], recommendedNextSkill: null, recommendedTopicSlug: null };
  }

  const bySkill = new Map<string, AssessmentSummary>();
  for (const a of assessments) {
    if (!a.isRoleMatch || !a.skillId) continue;
    const existing = bySkill.get(a.skillId);
    if (!existing || (a.bestScore ?? -1) > (existing.bestScore ?? -1)) {
      bySkill.set(a.skillId, a);
    }
  }

  const rows: SkillPerformanceRow[] = [...bySkill.values()]
    .map((a) => ({
      skillId: a.skillId as string,
      skillName: a.skillName ?? "Skill",
      score: a.bestScore,
      passed: a.passed,
    }))
    .sort((a, b) => (a.score ?? -1) - (b.score ?? -1));

  const weakest = rows[0] ?? null;
  let recommendedTopicSlug: string | null = null;
  if (weakest) {
    const { listLearningTopicRefs } = await import("@/lib/learning.server");
    const topics = await listLearningTopicRefs(supabase);
    recommendedTopicSlug = topics.find((t) => t.skillId === weakest.skillId)?.slug ?? null;
  }

  return {
    targetRoleTitle,
    rows,
    recommendedNextSkill: weakest?.skillName ?? null,
    recommendedTopicSlug,
  };
}

export interface AssessmentQuestionForTaking {
  id: string;
  prompt: string;
  options: string[];
}

export interface AssessmentForTaking {
  id: string;
  slug: string;
  title: string;
  passScore: number;
  questions: AssessmentQuestionForTaking[];
}

/** Fetches a quiz for the user to take — deliberately never selects
 * `correct_index` or `explanation`, so answers can't leak before grading. */
export async function getAssessmentForTaking(
  supabase: Client,
  assessmentId: string,
): Promise<AssessmentForTaking> {
  const { data: assessment, error: aError } = await supabase
    .from("assessments")
    .select("id, slug, title, pass_score")
    .eq("id", assessmentId)
    .maybeSingle();
  if (aError) throw new Error("Unable to load this assessment.");
  if (!assessment) throw new Error("Assessment not found.");

  const { data: questions, error: qError } = await supabase
    .from("assessment_questions")
    .select("id, prompt, options, sort_order")
    .eq("assessment_id", assessmentId)
    .order("sort_order", { ascending: true });
  if (qError) throw new Error("Unable to load questions.");

  return {
    id: (assessment as any).id,
    slug: (assessment as any).slug,
    title: (assessment as any).title,
    passScore: (assessment as any).pass_score,
    questions: ((questions ?? []) as any[]).map((q) => ({
      id: q.id,
      prompt: q.prompt,
      options: q.options,
    })),
  };
}

export interface AttemptQuestionResult {
  questionId: string;
  selectedIndex: number | null;
  correctIndex: number;
  correct: boolean;
  explanation: string | null;
}

export interface AttemptResult {
  score: number;
  totalQuestions: number;
  correctCount: number;
  passed: boolean;
  resultingLevel: ProficiencyLevel;
  perQuestion: AttemptQuestionResult[];
}

function scoreToLevel(score: number): ProficiencyLevel {
  if (score >= 90) return "expert";
  if (score >= 75) return "advanced";
  if (score >= 50) return "intermediate";
  if (score > 0) return "beginner";
  return "none";
}

/**
 * Grades an attempt server-side against `correct_index`, records it in
 * `assessment_attempts`, and — if the assessment is tied to a skill and the
 * resulting level is higher than what the user already has recorded —
 * bumps `user_skills` with `source: 'assessment'`. Never lowers an existing
 * self-reported or higher level; an assessment can only raise confidence,
 * not take it away.
 */
export async function submitAssessmentAttempt(
  supabase: Client,
  userId: string,
  assessmentId: string,
  answers: (number | null)[],
): Promise<AttemptResult> {
  const { data: assessment, error: aError } = await supabase
    .from("assessments")
    .select("id, pass_score, skill_id")
    .eq("id", assessmentId)
    .maybeSingle();
  if (aError) throw new Error("Unable to load this assessment.");
  if (!assessment) throw new Error("Assessment not found.");

  const { data: questions, error: qError } = await supabase
    .from("assessment_questions")
    .select("id, correct_index, explanation, sort_order")
    .eq("assessment_id", assessmentId)
    .order("sort_order", { ascending: true });
  if (qError) throw new Error("Unable to load questions.");

  const questionRows = (questions ?? []) as any[];
  if (answers.length !== questionRows.length) {
    throw new Error("Answer count doesn't match the number of questions.");
  }

  const { getUserPlan, assertCanAttemptAssessment } = await import("@/lib/subscription.server");
  const plan = await getUserPlan(supabase, userId);
  await assertCanAttemptAssessment(supabase, userId, assessmentId, plan);

  const perQuestion: AttemptQuestionResult[] = questionRows.map((q, i) => ({
    questionId: q.id,
    selectedIndex: answers[i] ?? null,
    correctIndex: q.correct_index,
    correct: answers[i] === q.correct_index,
    explanation: q.explanation ?? null,
  }));

  const correctCount = perQuestion.filter((p) => p.correct).length;
  const totalQuestions = questionRows.length;
  const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const passed = score >= (assessment as any).pass_score;
  const resultingLevel = scoreToLevel(score);

  const { error: insertError } = await supabase.from("assessment_attempts").insert({
    user_id: userId,
    assessment_id: assessmentId,
    score,
    total_questions: totalQuestions,
    answers: answers,
    resulting_level: resultingLevel,
  });
  if (insertError) throw new Error("Unable to save your attempt.");

  const skillId = (assessment as any).skill_id;
  if (skillId) {
    const { data: existingSkill } = await supabase
      .from("user_skills")
      .select("level")
      .eq("user_id", userId)
      .eq("skill_id", skillId)
      .maybeSingle();
    const existingLevel = (existingSkill as any)?.level as ProficiencyLevel | undefined;
    if (!existingLevel || PROFICIENCY_VALUE[resultingLevel] > PROFICIENCY_VALUE[existingLevel]) {
      await supabase
        .from("user_skills")
        .upsert(
          { user_id: userId, skill_id: skillId, level: resultingLevel, source: "assessment" },
          { onConflict: "user_id,skill_id" },
        );
    }
  }

  return { score, totalQuestions, correctCount, passed, resultingLevel, perQuestion };
}
