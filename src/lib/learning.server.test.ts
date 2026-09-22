import { describe, expect, it } from "vitest";
import {
  getLearningTopic,
  getRecommendedNextTopic,
  listLearningTopicRefs,
  toggleLessonComplete,
} from "@/lib/learning.server";
import { createFakeSupabase } from "@/lib/jobs/__tests__/fake-supabase";
import { seedProfile, seedUserSkills, USER_A, USER_B } from "@/lib/jobs/__tests__/fixtures";
import { UpgradeRequiredError } from "@/lib/subscription";

const TOPIC_ID = "topic-api-design";
const SKILL_ID = "skill-api-design";
const ASSESSMENT_ID = "assessment-api-design";

function seedTopic(fake: ReturnType<typeof createFakeSupabase>) {
  fake.seed("learning_topics", [
    {
      id: TOPIC_ID,
      slug: "api-design",
      title: "API Design",
      skill_id: SKILL_ID,
      why_it_matters: "Backend roles require it.",
      difficulty: "beginner",
      estimated_hours: 5,
      objectives: ["Explain what an API is"],
      common_mistakes: ["Using verbs in URLs"],
      target_level: "intermediate",
      assessment_id: ASSESSMENT_ID,
      // Embedded relations, as real PostgREST would shape them for
      // .select("...skills(name), assessments(id, slug, title)")
      skills: { name: "API Design" },
      assessments: {
        id: ASSESSMENT_ID,
        slug: "api-design-basics",
        title: "API Design Fundamentals",
      },
    },
  ]);
  fake.seed("learning_lessons", [
    { id: "lesson-1", topic_id: TOPIC_ID, sort_order: 1, title: "What is an API?", content: "..." },
    {
      id: "lesson-2",
      topic_id: TOPIC_ID,
      sort_order: 2,
      title: "REST fundamentals",
      content: "...",
    },
  ]);
}

describe("getLearningTopic", () => {
  it("returns null for an unknown slug", async () => {
    const fake = createFakeSupabase();
    const result = await getLearningTopic(fake, USER_A, "does-not-exist");
    expect(result).toBeNull();
  });

  it("returns lessons in order with no lessons marked complete when the user has no progress row", async () => {
    const fake = createFakeSupabase();
    seedTopic(fake);

    const topic = await getLearningTopic(fake, USER_A, "api-design");
    expect(topic).not.toBeNull();
    expect(topic!.status).toBe("not_started");
    expect(topic!.lessons.map((l) => l.order)).toEqual([1, 2]);
    expect(topic!.lessons.every((l) => !l.completed)).toBe(true);
    expect(topic!.assessmentTitle).toBe("API Design Fundamentals");
    expect(topic!.assessmentPassed).toBe(false);
  });

  it("merges the user's own completed lessons and status, never another user's", async () => {
    const fake = createFakeSupabase();
    seedTopic(fake);
    fake.seed("user_learning_progress", [
      { user_id: USER_A, topic_id: TOPIC_ID, status: "learning", completed_lessons: [1] },
      { user_id: USER_B, topic_id: TOPIC_ID, status: "completed", completed_lessons: [1, 2] },
    ]);

    const topic = await getLearningTopic(fake, USER_A, "api-design");
    expect(topic!.status).toBe("learning");
    expect(topic!.lessons.find((l) => l.order === 1)!.completed).toBe(true);
    expect(topic!.lessons.find((l) => l.order === 2)!.completed).toBe(false);
  });

  it("surfaces curated resources for the topic's skill, and none when there are none", async () => {
    const fake = createFakeSupabase();
    seedTopic(fake);
    fake.seed("resources", [
      {
        id: "resource-1",
        title: "REST API Tutorial",
        provider: "MDN",
        url: "https://developer.mozilla.org/rest",
        type: "documentation",
        is_free: true,
        skill_id: SKILL_ID,
      },
      {
        id: "resource-2",
        title: "Unrelated SQL course",
        provider: "Example",
        url: "https://example.com/sql",
        type: "course",
        is_free: true,
        skill_id: "skill-sql",
      },
    ]);

    const topic = await getLearningTopic(fake, USER_A, "api-design");
    expect(topic!.resources).toHaveLength(1);
    expect(topic!.resources[0]).toMatchObject({
      id: "resource-1",
      title: "REST API Tutorial",
      provider: "MDN",
      isFree: true,
    });
  });

  it("returns an empty resources list when no resources are seeded for the skill", async () => {
    const fake = createFakeSupabase();
    seedTopic(fake);

    const topic = await getLearningTopic(fake, USER_A, "api-design");
    expect(topic!.resources).toEqual([]);
  });

  it("marks the assessment passed only when the user's own best score clears the bar", async () => {
    const fake = createFakeSupabase();
    seedTopic(fake);
    fake.seed("assessment_attempts", [
      { user_id: USER_A, assessment_id: ASSESSMENT_ID, score: 40 },
      { user_id: USER_A, assessment_id: ASSESSMENT_ID, score: 80 },
      { user_id: USER_B, assessment_id: ASSESSMENT_ID, score: 100 },
    ]);

    const topic = await getLearningTopic(fake, USER_A, "api-design");
    expect(topic!.assessmentPassed).toBe(true);
  });
});

describe("toggleLessonComplete", () => {
  it("adds a lesson to completed_lessons and sets status to learning on first interaction", async () => {
    const fake = createFakeSupabase();
    seedTopic(fake);

    const result = await toggleLessonComplete(fake, USER_A, TOPIC_ID, 1, true);
    expect(result.completedLessons).toEqual([1]);

    const topic = await getLearningTopic(fake, USER_A, "api-design");
    expect(topic!.status).toBe("learning");
    expect(topic!.lessons.find((l) => l.order === 1)!.completed).toBe(true);
  });

  it("removes a lesson when un-completed, without touching other users' progress", async () => {
    const fake = createFakeSupabase();
    seedTopic(fake);
    fake.seed("user_learning_progress", [
      { user_id: USER_A, topic_id: TOPIC_ID, status: "learning", completed_lessons: [1, 2] },
      { user_id: USER_B, topic_id: TOPIC_ID, status: "learning", completed_lessons: [1, 2] },
    ]);

    const result = await toggleLessonComplete(fake, USER_A, TOPIC_ID, 1, false);
    expect(result.completedLessons).toEqual([2]);

    const otherUsersProgress = fake
      .table("user_learning_progress")
      .find((r: Record<string, unknown>) => r["user_id"] === USER_B) as Record<string, unknown>;
    expect(otherUsersProgress["completed_lessons"]).toEqual([1, 2]);
  });

  it("never downgrades a topic already marked completed back to learning", async () => {
    const fake = createFakeSupabase();
    seedTopic(fake);
    fake.seed("user_learning_progress", [
      { user_id: USER_A, topic_id: TOPIC_ID, status: "completed", completed_lessons: [1, 2] },
    ]);

    await toggleLessonComplete(fake, USER_A, TOPIC_ID, 1, false);
    const topic = await getLearningTopic(fake, USER_A, "api-design");
    expect(topic!.status).toBe("completed");
  });
});

describe("listLearningTopicRefs", () => {
  it("returns a lightweight skill-to-topic index", async () => {
    const fake = createFakeSupabase();
    seedTopic(fake);

    const refs = await listLearningTopicRefs(fake);
    expect(refs).toEqual([
      {
        topicId: TOPIC_ID,
        slug: "api-design",
        title: "API Design",
        skillId: SKILL_ID,
        difficulty: "beginner",
        estimatedHours: 5,
        hasAssessment: true,
      },
    ]);
  });
});

describe("toggleLessonComplete — Free plan limits", () => {
  it("blocks completing a 6th lesson on the Free plan", async () => {
    const fake = createFakeSupabase();
    seedTopic(fake);
    fake.seed("profiles", [{ id: USER_A, plan: "free" }]);
    fake.seed("user_learning_progress", [
      {
        user_id: USER_A,
        topic_id: "other-topic",
        started_at: "2026-01-01",
        completed_lessons: [1, 2, 3, 4, 5],
        completed_at: null,
      },
    ]);

    await expect(toggleLessonComplete(fake, USER_A, TOPIC_ID, 1, true)).rejects.toThrow(
      /pro plan/i,
    );
  });

  it("always allows un-completing a lesson, even at the limit", async () => {
    const fake = createFakeSupabase();
    seedTopic(fake);
    fake.seed("profiles", [{ id: USER_A, plan: "free" }]);
    fake.seed("user_learning_progress", [
      {
        user_id: USER_A,
        topic_id: TOPIC_ID,
        started_at: "2026-01-01",
        completed_lessons: [1, 2, 3, 4, 5],
        completed_at: null,
      },
    ]);

    await expect(toggleLessonComplete(fake, USER_A, TOPIC_ID, 1, false)).resolves.toBeDefined();
  });

  it("Pro plan can keep completing lessons past the free cap", async () => {
    const fake = createFakeSupabase();
    seedTopic(fake);
    fake.seed("profiles", [{ id: USER_A, plan: "pro" }]);
    fake.seed("user_learning_progress", [
      {
        user_id: USER_A,
        topic_id: "other-topic",
        started_at: "2026-01-01",
        completed_lessons: [1, 2, 3, 4, 5],
        completed_at: null,
      },
    ]);

    await expect(toggleLessonComplete(fake, USER_A, TOPIC_ID, 1, true)).resolves.toBeDefined();
  });
});

const CAREER_ID = "career-recommend";
const SKILL_SQL = "skill-sql-rec";
const SKILL_PY = "skill-py-rec";

function seedRecommendationFixture(fake: ReturnType<typeof createFakeSupabase>) {
  fake.seed("skills", [
    { id: SKILL_SQL, name: "SQL" },
    { id: SKILL_PY, name: "Python" },
  ]);
  fake.seed("career_skills", [
    {
      id: "cs-sql",
      career_id: CAREER_ID,
      skill_id: SKILL_SQL,
      importance: "critical",
      required_level: "advanced",
      demand_percentage: null,
      sort_order: 1,
      skills: { name: "SQL" },
    },
    {
      id: "cs-py",
      career_id: CAREER_ID,
      skill_id: SKILL_PY,
      importance: "medium",
      required_level: "intermediate",
      demand_percentage: null,
      sort_order: 2,
      skills: { name: "Python" },
    },
  ]);
  fake.seed("learning_topics", [
    {
      id: "topic-sql",
      slug: "sql-fundamentals",
      title: "SQL Fundamentals",
      skill_id: SKILL_SQL,
      difficulty: "beginner",
      estimated_hours: 8,
      assessment_id: null,
    },
    {
      id: "topic-py",
      slug: "python-fundamentals",
      title: "Python Fundamentals",
      skill_id: SKILL_PY,
      difficulty: "beginner",
      estimated_hours: 6,
      assessment_id: null,
    },
  ]);
}

describe("getRecommendedNextTopic", () => {
  it("refuses free-plan users", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "free", career_id: CAREER_ID });
    seedRecommendationFixture(fake);

    await expect(getRecommendedNextTopic(fake, USER_A)).rejects.toThrow(UpgradeRequiredError);
  });

  it("recommends the highest-priority not-ready skill's topic", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro", career_id: CAREER_ID });
    seedRecommendationFixture(fake);
    seedUserSkills(fake, USER_A, []);

    const result = await getRecommendedNextTopic(fake, USER_A);
    expect(result).toMatchObject({ topicSlug: "sql-fundamentals", skillName: "SQL" });
  });

  it("skips topics the user has already completed and moves to the next priority", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro", career_id: CAREER_ID });
    seedRecommendationFixture(fake);
    seedUserSkills(fake, USER_A, []);
    fake.table("user_learning_progress").push({
      user_id: USER_A,
      topic_id: "topic-sql",
      status: "completed",
      completed_lessons: [],
    });

    const result = await getRecommendedNextTopic(fake, USER_A);
    expect(result).toMatchObject({ topicSlug: "python-fundamentals", skillName: "Python" });
  });

  it("returns null once every gap has a completed topic", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro", career_id: CAREER_ID });
    seedRecommendationFixture(fake);
    seedUserSkills(fake, USER_A, [
      { skillId: SKILL_SQL, level: "advanced" },
      { skillId: SKILL_PY, level: "intermediate" },
    ]);

    const result = await getRecommendedNextTopic(fake, USER_A);
    expect(result).toBeNull();
  });

  it("returns null for a user with no selected career", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro", career_id: null });

    const result = await getRecommendedNextTopic(fake, USER_A);
    expect(result).toBeNull();
  });
});
