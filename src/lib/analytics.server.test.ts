import { describe, expect, it } from "vitest";
import { createFakeSupabase } from "@/lib/jobs/__tests__/fake-supabase";
import { seedProfile, seedUserSkills, USER_A } from "@/lib/jobs/__tests__/fixtures";
import { loadCareerAnalytics } from "@/lib/analytics.server";
import { UpgradeRequiredError } from "@/lib/subscription";

const CAREER_ID = "career-analytics-1";
const SKILL_SQL = "skill-sql-a";
const SKILL_PY = "skill-py-a";

function seedCareer(fake: ReturnType<typeof createFakeSupabase>) {
  fake.seed("skills", [
    { id: SKILL_SQL, name: "SQL" },
    { id: SKILL_PY, name: "Python" },
  ]);
  fake.seed("career_skills", [
    {
      career_id: CAREER_ID,
      skill_id: SKILL_SQL,
      importance: "critical",
      required_level: "advanced",
      demand_percentage: null,
      sort_order: 1,
      skills: { name: "SQL" },
    },
    {
      career_id: CAREER_ID,
      skill_id: SKILL_PY,
      importance: "medium",
      required_level: "intermediate",
      demand_percentage: null,
      sort_order: 2,
      skills: { name: "Python" },
    },
  ]);
}

describe("loadCareerAnalytics", () => {
  it("refuses free-plan users", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "free", career_id: CAREER_ID });
    seedCareer(fake);

    await expect(loadCareerAnalytics(fake, USER_A)).rejects.toThrow(UpgradeRequiredError);
  });

  it("computes real activity counts from actual records, not estimates", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro", career_id: CAREER_ID });
    seedCareer(fake);
    seedUserSkills(fake, USER_A, [{ skillId: SKILL_SQL, level: "advanced" }]);

    fake.seed("roadmaps", [{ id: "rm-1", user_id: USER_A, is_active: true }]);
    fake.seed("roadmap_tasks", [
      { id: "t1", roadmap_id: "rm-1", is_completed: true },
      { id: "t2", roadmap_id: "rm-1", is_completed: true },
      { id: "t3", roadmap_id: "rm-1", is_completed: false },
      { id: "t4", roadmap_id: "rm-1", is_completed: false },
    ]);
    fake.seed("user_projects", [
      { user_id: USER_A, status: "completed" },
      { user_id: USER_A, status: "started" },
    ]);
    fake.seed("learning_topics", [{ id: "topic-1", estimated_hours: 8 }]);
    fake.seed("user_learning_progress", [
      { user_id: USER_A, topic_id: "topic-1", status: "completed" },
    ]);
    fake.seed("assessment_attempts", [
      { user_id: USER_A, assessment_id: "assess-1", score: 60 },
      { user_id: USER_A, assessment_id: "assess-1", score: 82 },
      { user_id: USER_A, assessment_id: "assess-2", score: 90 },
    ]);
    fake.seed("saved_jobs", [
      { user_id: USER_A, id: "sj-1" },
      { user_id: USER_A, id: "sj-2" },
    ]);

    const analytics = await loadCareerAnalytics(fake, USER_A);

    expect(analytics.roadmapCompletionPercent).toBe(50);
    expect(analytics.projectsCompletedCount).toBe(1);
    expect(analytics.learningHoursCompleted).toBe(8);
    expect(analytics.topicsCompletedCount).toBe(1);
    expect(analytics.jobsSavedCount).toBe(2);
    // Best score per assessment: 82 and 90 -> average 86.
    expect(analytics.assessments.assessmentsTaken).toBe(2);
    expect(analytics.assessments.averageBestScore).toBe(86);
    expect(analytics.assessments.assessmentsPassed).toBe(2);
    expect(analytics.skillsReadyCount).toBe(1); // SQL ready, Python not
  });

  it("shows an honest empty state (null/empty) instead of a fabricated trend with under 2 snapshots", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro", career_id: CAREER_ID });
    seedCareer(fake);
    seedUserSkills(fake, USER_A, []);
    fake.seed("progress_events", [
      { user_id: USER_A, readiness_score: 40, created_at: "2026-01-01" },
    ]);

    const analytics = await loadCareerAnalytics(fake, USER_A);
    expect(analytics.readinessTrend).toEqual([]);
  });

  it("returns a populated readiness trend, oldest first, once there are 2+ snapshots", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro", career_id: CAREER_ID });
    seedCareer(fake);
    seedUserSkills(fake, USER_A, []);
    fake.seed("progress_events", [
      { user_id: USER_A, readiness_score: 60, created_at: "2026-02-01" },
      { user_id: USER_A, readiness_score: 40, created_at: "2026-01-01" },
    ]);

    const analytics = await loadCareerAnalytics(fake, USER_A);
    expect(analytics.readinessTrend.map((p) => p.readinessScore)).toEqual([40, 60]);
  });

  it("returns zeroed, honest stats for a brand new user with no activity at all", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro", career_id: CAREER_ID });
    seedCareer(fake);
    seedUserSkills(fake, USER_A, []);

    const analytics = await loadCareerAnalytics(fake, USER_A);
    expect(analytics.roadmapCompletionPercent).toBeNull();
    expect(analytics.projectsCompletedCount).toBe(0);
    expect(analytics.learningHoursCompleted).toBe(0);
    expect(analytics.assessments.assessmentsTaken).toBe(0);
    expect(analytics.assessments.averageBestScore).toBeNull();
    expect(analytics.readinessTrend).toEqual([]);
  });
});
