import { describe, expect, it } from "vitest";
import {
  getAssessmentForTaking,
  listAssessments,
  submitAssessmentAttempt,
} from "@/lib/assessments.server";
import { createFakeSupabase } from "@/lib/jobs/__tests__/fake-supabase";
import { USER_A, USER_B } from "@/lib/jobs/__tests__/fixtures";

const SQL_SKILL = "skill-sql";
const ASSESSMENT_SQL = "assessment-sql";

function seedSqlAssessment(fake: ReturnType<typeof createFakeSupabase>) {
  fake.seed("skills", [{ id: SQL_SKILL, name: "SQL" }]);
  fake.seed("assessments", [
    {
      id: ASSESSMENT_SQL,
      slug: "sql-fundamentals",
      title: "SQL Fundamentals",
      difficulty: "beginner",
      description: "Core SQL.",
      pass_score: 70,
      skill_id: SQL_SKILL,
    },
  ]);
  fake.seed("assessment_questions", [
    {
      id: "q1",
      assessment_id: ASSESSMENT_SQL,
      prompt: "Which clause filters rows before grouping?",
      options: ["HAVING", "WHERE"],
      correct_index: 1,
      explanation: "WHERE runs before GROUP BY.",
      sort_order: 1,
    },
    {
      id: "q2",
      assessment_id: ASSESSMENT_SQL,
      prompt: "Which clause filters groups after aggregation?",
      options: ["WHERE", "HAVING"],
      correct_index: 1,
      explanation: "HAVING runs after GROUP BY.",
      sort_order: 2,
    },
  ]);
}

describe("listAssessments", () => {
  it("returns assessment metadata with skill name and question count, no attempts yet", async () => {
    const fake = createFakeSupabase();
    seedSqlAssessment(fake);

    const { assessments } = await listAssessments(fake, USER_A);
    expect(assessments).toHaveLength(1);
    expect(assessments[0]).toMatchObject({
      slug: "sql-fundamentals",
      skillName: "SQL",
      questionCount: 2,
      bestScore: null,
      attemptCount: 0,
      passed: false,
    });
  });

  it("computes bestScore as the max of the user's own attempts and marks passed when >= pass_score", async () => {
    const fake = createFakeSupabase();
    seedSqlAssessment(fake);
    fake.seed("assessment_attempts", [
      {
        assessment_id: ASSESSMENT_SQL,
        user_id: USER_A,
        score: 50,
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        assessment_id: ASSESSMENT_SQL,
        user_id: USER_A,
        score: 80,
        created_at: "2026-01-02T00:00:00Z",
      },
    ]);

    const { assessments } = await listAssessments(fake, USER_A);
    expect(assessments[0]).toMatchObject({ bestScore: 80, attemptCount: 2, passed: true });
  });

  it("never counts another user's attempts toward bestScore", async () => {
    const fake = createFakeSupabase();
    seedSqlAssessment(fake);
    fake.seed("assessment_attempts", [
      {
        assessment_id: ASSESSMENT_SQL,
        user_id: USER_B,
        score: 100,
        created_at: "2026-01-01T00:00:00Z",
      },
    ]);

    const { assessments } = await listAssessments(fake, USER_A);
    expect(assessments[0]).toMatchObject({ bestScore: null, attemptCount: 0 });
  });

  it("flags assessments matching the user's selected career and sorts them first", async () => {
    const fake = createFakeSupabase();
    seedSqlAssessment(fake);
    fake.seed("skills", [
      { id: SQL_SKILL, name: "SQL" },
      { id: "skill-excel", name: "Excel" },
    ]);
    fake.seed("assessments", [
      ...fake.table("assessments"),
      {
        id: "assessment-excel",
        slug: "excel-fundamentals",
        title: "Excel Fundamentals",
        difficulty: "beginner",
        description: "Core Excel.",
        pass_score: 70,
        skill_id: "skill-excel",
      },
    ]);
    fake.seed("profiles", [
      { id: USER_A, career_id: "career-data-analyst", target_role: "Data Analyst" },
    ]);
    fake.seed("career_skills", [{ career_id: "career-data-analyst", skill_id: SQL_SKILL }]);

    const { assessments, hasRoleMatch, targetRoleTitle } = await listAssessments(fake, USER_A);
    expect(hasRoleMatch).toBe(true);
    expect(targetRoleTitle).toBe("Data Analyst");
    expect(assessments[0]).toMatchObject({ slug: "sql-fundamentals", isRoleMatch: true });
    expect(assessments.find((a) => a.slug === "excel-fundamentals")).toMatchObject({
      isRoleMatch: false,
    });
  });

  it("a user with no career selected gets no role matches, not an error", async () => {
    const fake = createFakeSupabase();
    seedSqlAssessment(fake);
    fake.seed("profiles", [{ id: USER_A, career_id: null, target_role: null }]);

    const { hasRoleMatch, assessments } = await listAssessments(fake, USER_A);
    expect(hasRoleMatch).toBe(false);
    expect(assessments.every((a) => a.isRoleMatch === false)).toBe(true);
  });
});

describe("getAssessmentForTaking", () => {
  it("returns questions in sort order without correct_index or explanation", async () => {
    const fake = createFakeSupabase();
    seedSqlAssessment(fake);

    const quiz = await getAssessmentForTaking(fake, ASSESSMENT_SQL);
    expect(quiz.questions).toHaveLength(2);
    expect(quiz.questions[0]?.id).toBe("q1");
    for (const q of quiz.questions) {
      expect(q).not.toHaveProperty("correctIndex");
      expect(q).not.toHaveProperty("explanation");
    }
  });

  it("throws for a non-existent assessment", async () => {
    const fake = createFakeSupabase();
    await expect(getAssessmentForTaking(fake, "does-not-exist")).rejects.toThrow("not found");
  });
});

describe("submitAssessmentAttempt", () => {
  it("grades correctly, computes a percentage score, and records the attempt", async () => {
    const fake = createFakeSupabase();
    seedSqlAssessment(fake);

    const result = await submitAssessmentAttempt(fake, USER_A, ASSESSMENT_SQL, [1, 0]);

    expect(result).toMatchObject({ score: 50, correctCount: 1, totalQuestions: 2, passed: false });
    expect(result.perQuestion[0]).toMatchObject({ correct: true, correctIndex: 1 });
    expect(result.perQuestion[1]).toMatchObject({ correct: false, correctIndex: 1 });

    const attempts = fake.table("assessment_attempts");
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ user_id: USER_A, score: 50, total_questions: 2 });
  });

  it("passes when the score meets pass_score and reports the resulting level", async () => {
    const fake = createFakeSupabase();
    seedSqlAssessment(fake);

    const result = await submitAssessmentAttempt(fake, USER_A, ASSESSMENT_SQL, [1, 1]);
    expect(result).toMatchObject({ score: 100, passed: true, resultingLevel: "expert" });
  });

  it("rejects a mismatched answer count rather than silently mis-grading", async () => {
    const fake = createFakeSupabase();
    seedSqlAssessment(fake);
    await expect(submitAssessmentAttempt(fake, USER_A, ASSESSMENT_SQL, [1])).rejects.toThrow(
      "doesn't match",
    );
  });

  it("bumps user_skills to the resulting level when it's higher than the existing one", async () => {
    const fake = createFakeSupabase();
    seedSqlAssessment(fake);
    fake.seed("user_skills", [
      { user_id: USER_A, skill_id: SQL_SKILL, level: "beginner", source: "self_reported" },
    ]);

    await submitAssessmentAttempt(fake, USER_A, ASSESSMENT_SQL, [1, 1]); // 100% -> expert

    const skillRow = fake.table("user_skills").find((r) => r["user_id"] === USER_A);
    expect(skillRow).toMatchObject({ level: "expert", source: "assessment" });
  });

  it("never lowers an existing higher-or-equal skill level", async () => {
    const fake = createFakeSupabase();
    seedSqlAssessment(fake);
    fake.seed("user_skills", [
      { user_id: USER_A, skill_id: SQL_SKILL, level: "expert", source: "self_reported" },
    ]);

    await submitAssessmentAttempt(fake, USER_A, ASSESSMENT_SQL, [0, 0]); // 0% -> "none", would be a downgrade

    const skillRow = fake.table("user_skills").find((r) => r["user_id"] === USER_A);
    expect(skillRow).toMatchObject({ level: "expert", source: "self_reported" });
  });
});

describe("submitAssessmentAttempt — Free plan limits", () => {
  it("blocks a 4th distinct assessment on the Free plan", async () => {
    const fake = createFakeSupabase();
    seedSqlAssessment(fake);
    fake.seed("profiles", [{ id: USER_A, plan: "free" }]);
    fake.seed("assessment_attempts", [
      { id: "e1", user_id: USER_A, assessment_id: "other-1" },
      { id: "e2", user_id: USER_A, assessment_id: "other-2" },
      { id: "e3", user_id: USER_A, assessment_id: "other-3" },
    ]);

    await expect(submitAssessmentAttempt(fake, USER_A, ASSESSMENT_SQL, [1, 1])).rejects.toThrow(
      /pro plan/i,
    );
  });

  it("always allows retaking an assessment already attempted, even at the limit", async () => {
    const fake = createFakeSupabase();
    seedSqlAssessment(fake);
    fake.seed("profiles", [{ id: USER_A, plan: "free" }]);
    fake.seed("assessment_attempts", [
      { id: "e1", user_id: USER_A, assessment_id: ASSESSMENT_SQL },
      { id: "e2", user_id: USER_A, assessment_id: "other-2" },
      { id: "e3", user_id: USER_A, assessment_id: "other-3" },
    ]);

    await expect(
      submitAssessmentAttempt(fake, USER_A, ASSESSMENT_SQL, [1, 1]),
    ).resolves.toBeDefined();
  });
});

describe("getSkillPerformanceBreakdown", () => {
  const CAREER_ID = "career-frontend";
  const SKILL_JS = "skill-js";
  const SKILL_CSS = "skill-css";

  function seedRoleAssessments(fake: ReturnType<typeof createFakeSupabase>) {
    fake.seed("skills", [
      { id: SKILL_JS, name: "JavaScript" },
      { id: SKILL_CSS, name: "HTML/CSS" },
    ]);
    fake.seed("assessments", [
      {
        id: "assess-js",
        slug: "js-fundamentals",
        title: "JavaScript Fundamentals",
        difficulty: "beginner",
        description: null,
        pass_score: 70,
        skill_id: SKILL_JS,
      },
      {
        id: "assess-css",
        slug: "css-fundamentals",
        title: "HTML/CSS Fundamentals",
        difficulty: "beginner",
        description: null,
        pass_score: 70,
        skill_id: SKILL_CSS,
      },
    ]);
    fake.seed("career_skills", [
      { career_id: CAREER_ID, skill_id: SKILL_JS },
      { career_id: CAREER_ID, skill_id: SKILL_CSS },
    ]);
    fake.seed("profiles", [
      { id: USER_A, plan: "pro", career_id: CAREER_ID, target_role: "Frontend Developer" },
    ]);
  }

  it("refuses free-plan users", async () => {
    const fake = createFakeSupabase();
    seedRoleAssessments(fake);
    fake.seed("profiles", [
      { id: USER_A, plan: "free", career_id: CAREER_ID, target_role: "Frontend Developer" },
    ]);

    const { getSkillPerformanceBreakdown } = await import("@/lib/assessments.server");
    await expect(getSkillPerformanceBreakdown(fake, USER_A)).rejects.toThrow();
  });

  it("shows the best score per role skill and lists unattempted skills honestly", async () => {
    const fake = createFakeSupabase();
    seedRoleAssessments(fake);
    fake.seed("assessment_attempts", [
      {
        id: "att-1",
        user_id: USER_A,
        assessment_id: "assess-js",
        score: 64,
        created_at: "2026-01-01",
      },
      {
        id: "att-2",
        user_id: USER_A,
        assessment_id: "assess-js",
        score: 82,
        created_at: "2026-01-05",
      },
      // No attempt at all for CSS.
    ]);

    const { getSkillPerformanceBreakdown } = await import("@/lib/assessments.server");
    const result = await getSkillPerformanceBreakdown(fake, USER_A);

    expect(result.targetRoleTitle).toBe("Frontend Developer");
    const js = result.rows.find((r) => r.skillId === SKILL_JS);
    const css = result.rows.find((r) => r.skillId === SKILL_CSS);
    expect(js?.score).toBe(82); // best of the two attempts
    expect(css?.score).toBeNull(); // never attempted -- not zero, not guessed

    // CSS never attempted is the most urgent -- ranked as the recommendation.
    expect(result.recommendedNextSkill).toBe("HTML/CSS");
  });

  it("returns an empty breakdown honestly when the role has no matching assessments", async () => {
    const fake = createFakeSupabase();
    fake.seed("profiles", [
      { id: USER_A, plan: "pro", career_id: "career-no-assessments", target_role: "Some Role" },
    ]);

    const { getSkillPerformanceBreakdown } = await import("@/lib/assessments.server");
    const result = await getSkillPerformanceBreakdown(fake, USER_A);
    expect(result.rows).toEqual([]);
    expect(result.recommendedNextSkill).toBeNull();
  });
});
