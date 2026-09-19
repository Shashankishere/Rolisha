import { describe, expect, it } from "vitest";
import { createFakeSupabase } from "@/lib/jobs/__tests__/fake-supabase";
import { seedProfile, USER_A } from "@/lib/jobs/__tests__/fixtures";
import {
  assertCanAttemptAssessment,
  assertCanCompleteLesson,
  assertCanStartProject,
  getUsageSummary,
  getUserPlan,
} from "@/lib/subscription.server";
import { PRO_CAREER_ROADMAPS, UpgradeRequiredError } from "@/lib/subscription";

describe("getUserPlan", () => {
  it("reads the plan from the profile", () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro" });
    return getUserPlan(fake, USER_A).then((plan) => expect(plan).toBe("pro"));
  });

  it("defaults to free (never fails open) when no profile row exists", async () => {
    const fake = createFakeSupabase();
    const plan = await getUserPlan(fake, USER_A);
    expect(plan).toBe("free");
  });
});

describe("getUsageSummary", () => {
  it("computes real counts from existing tables, not invented numbers", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "free" });
    fake.table("roadmaps").push({ id: "r1", user_id: USER_A, is_active: true });
    fake
      .table("user_projects")
      .push(
        { user_id: USER_A, project_id: "p1", status: "started" },
        { user_id: USER_A, project_id: "p2", status: "completed" },
      );
    fake.table("assessment_attempts").push(
      { id: "a1", user_id: USER_A, assessment_id: "asmt-1" },
      { id: "a2", user_id: USER_A, assessment_id: "asmt-1" }, // retake, doesn't add a distinct assessment
    );
    fake
      .table("user_learning_progress")
      .push(
        { user_id: USER_A, topic_id: "t1", completed_lessons: [0, 1, 2] },
        { user_id: USER_A, topic_id: "t2", completed_lessons: [0] },
      );

    const summary = await getUsageSummary(fake, USER_A, "free");
    expect(summary.careerRoadmaps).toEqual({ used: 1, limit: 1 });
    expect(summary.projects).toEqual({ used: 2, limit: 2 });
    expect(summary.assessments).toEqual({ used: 1, limit: 3 });
    expect(summary.learningLessons).toEqual({ used: 4, limit: 5 });
  });

  it("reports unlimited (null limit) fields for pro, except roadmaps which stay capped", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro" });
    const summary = await getUsageSummary(fake, USER_A, "pro");
    expect(summary.projects.limit).toBeNull();
    expect(summary.assessments.limit).toBeNull();
    expect(summary.learningLessons.limit).toBeNull();
    expect(summary.careerRoadmaps.limit).toBe(PRO_CAREER_ROADMAPS);
  });
});

describe("assertCanStartProject", () => {
  it("allows a free user under the limit to start a new project", async () => {
    const fake = createFakeSupabase();
    await expect(assertCanStartProject(fake, USER_A, "p1", "free")).resolves.toBeUndefined();
  });

  it("blocks a free user at the limit from starting another new project", async () => {
    const fake = createFakeSupabase();
    fake
      .table("user_projects")
      .push(
        { user_id: USER_A, project_id: "p1", status: "started" },
        { user_id: USER_A, project_id: "p2", status: "completed" },
      );
    await expect(assertCanStartProject(fake, USER_A, "p3", "free")).rejects.toThrow(
      UpgradeRequiredError,
    );
  });

  it("never blocks continuing a project already started", async () => {
    const fake = createFakeSupabase();
    fake
      .table("user_projects")
      .push(
        { user_id: USER_A, project_id: "p1", status: "started" },
        { user_id: USER_A, project_id: "p2", status: "completed" },
      );
    await expect(assertCanStartProject(fake, USER_A, "p1", "free")).resolves.toBeUndefined();
  });

  it("never blocks pro users", async () => {
    const fake = createFakeSupabase();
    for (let i = 0; i < 10; i++) {
      fake.table("user_projects").push({ user_id: USER_A, project_id: `p${i}`, status: "started" });
    }
    await expect(assertCanStartProject(fake, USER_A, "p-new", "pro")).resolves.toBeUndefined();
  });
});

describe("assertCanAttemptAssessment", () => {
  it("blocks a free user at the limit from starting a new distinct assessment", async () => {
    const fake = createFakeSupabase();
    fake
      .table("assessment_attempts")
      .push(
        { id: "1", user_id: USER_A, assessment_id: "a1" },
        { id: "2", user_id: USER_A, assessment_id: "a2" },
        { id: "3", user_id: USER_A, assessment_id: "a3" },
      );
    await expect(assertCanAttemptAssessment(fake, USER_A, "a4", "free")).rejects.toThrow(
      UpgradeRequiredError,
    );
  });

  it("always allows retaking an assessment already attempted", async () => {
    const fake = createFakeSupabase();
    fake
      .table("assessment_attempts")
      .push(
        { id: "1", user_id: USER_A, assessment_id: "a1" },
        { id: "2", user_id: USER_A, assessment_id: "a2" },
        { id: "3", user_id: USER_A, assessment_id: "a3" },
      );
    await expect(assertCanAttemptAssessment(fake, USER_A, "a1", "free")).resolves.toBeUndefined();
  });
});

describe("assertCanCompleteLesson", () => {
  it("blocks a free user at the limit from completing another lesson", async () => {
    const fake = createFakeSupabase();
    fake.table("user_learning_progress").push({
      user_id: USER_A,
      topic_id: "t1",
      completed_lessons: [0, 1, 2, 3, 4],
    });
    await expect(assertCanCompleteLesson(fake, USER_A, "free")).rejects.toThrow(
      UpgradeRequiredError,
    );
  });

  it("allows a free user under the limit", async () => {
    const fake = createFakeSupabase();
    fake.table("user_learning_progress").push({
      user_id: USER_A,
      topic_id: "t1",
      completed_lessons: [0, 1],
    });
    await expect(assertCanCompleteLesson(fake, USER_A, "free")).resolves.toBeUndefined();
  });

  it("never blocks pro users", async () => {
    const fake = createFakeSupabase();
    fake.table("user_learning_progress").push({
      user_id: USER_A,
      topic_id: "t1",
      completed_lessons: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    });
    await expect(assertCanCompleteLesson(fake, USER_A, "pro")).resolves.toBeUndefined();
  });
});
