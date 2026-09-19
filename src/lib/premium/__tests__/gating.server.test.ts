/**
 * PART N / PART M security requirement, updated for the two-plan model:
 * "Free cannot call any of these AI feature server functions." These used
 * to be Premium-only (with Pro also rejected); Premium was folded into
 * Pro, so Pro must now be ALLOWED through the same gate that still
 * rejects Free -- both directions are tested here by calling the real
 * server functions directly (bypassing any UI), proving the client can
 * never be the security boundary either way.
 *
 * No AI mocking is needed for the Free-rejection cases: `requireFeature`
 * runs first in every function under test, so a rejecting call never
 * reaches the AI layer at all. For the Pro-allowed cases we only assert
 * the call doesn't throw `UpgradeRequiredError` (i.e. the plan gate lets
 * it through) -- not that the AI call itself succeeds, since that depends
 * on a real provider being configured.
 */
import { describe, expect, it } from "vitest";
import { createFakeSupabase } from "@/lib/jobs/__tests__/fake-supabase";
import { seedProfile, USER_A } from "@/lib/jobs/__tests__/fixtures";
import { UpgradeRequiredError } from "@/lib/subscription";

import { analyzeResume, listResumeAnalyses } from "@/lib/premium/resume-analysis.server";
import { optimizeResume, listResumeOptimizations } from "@/lib/premium/resume-optimization.server";
import {
  generateInterviewPrep,
  listInterviewPrepSessions,
} from "@/lib/premium/interview-prep.server";
import {
  generateInterviewQuestions,
  listInterviewQuestionSets,
} from "@/lib/premium/interview-questions.server";
import {
  startMockInterview,
  submitMockInterviewAnswer,
  finishMockInterview,
  getMockInterviewSession,
  listMockInterviewSessions,
} from "@/lib/premium/mock-interview.server";
import { analyzeCareerSwitch, listCareerSwitchAnalyses } from "@/lib/premium/career-switch.server";
import {
  generateCareerRecommendations,
  listCareerRecommendations,
} from "@/lib/premium/career-recommendations.server";

function setup(plan: "free" | "pro") {
  const fake = createFakeSupabase();
  seedProfile(fake, USER_A, { plan });
  return fake;
}

describe("Free plan is rejected for every Pro-gated AI feature", () => {
  const plan = "free" as const;

  it("analyzeResume / listResumeAnalyses", async () => {
    const fake = setup(plan);
    await expect(
      analyzeResume(fake, USER_A, { targetRole: "PM", resumeText: "x".repeat(60) }),
    ).rejects.toThrow(UpgradeRequiredError);
    await expect(listResumeAnalyses(fake, USER_A)).rejects.toThrow(UpgradeRequiredError);
  });

  it("optimizeResume / listResumeOptimizations", async () => {
    const fake = setup(plan);
    await expect(
      optimizeResume(fake, USER_A, { targetRole: "PM", resumeText: "x".repeat(60) }),
    ).rejects.toThrow(UpgradeRequiredError);
    await expect(listResumeOptimizations(fake, USER_A)).rejects.toThrow(UpgradeRequiredError);
  });

  it("generateInterviewPrep / listInterviewPrepSessions", async () => {
    const fake = setup(plan);
    await expect(generateInterviewPrep(fake, USER_A, { targetRole: "PM" })).rejects.toThrow(
      UpgradeRequiredError,
    );
    await expect(listInterviewPrepSessions(fake, USER_A)).rejects.toThrow(UpgradeRequiredError);
  });

  it("generateInterviewQuestions / listInterviewQuestionSets", async () => {
    const fake = setup(plan);
    await expect(generateInterviewQuestions(fake, USER_A, { targetRole: "PM" })).rejects.toThrow(
      UpgradeRequiredError,
    );
    await expect(listInterviewQuestionSets(fake, USER_A)).rejects.toThrow(UpgradeRequiredError);
  });

  it("mock interview: start / answer / finish / get / list", async () => {
    const fake = setup(plan);
    await expect(startMockInterview(fake, USER_A, { targetRole: "PM" })).rejects.toThrow(
      UpgradeRequiredError,
    );
    await expect(
      submitMockInterviewAnswer(fake, USER_A, { sessionId: "s1", turnIndex: 0, answer: "hi" }),
    ).rejects.toThrow(UpgradeRequiredError);
    await expect(finishMockInterview(fake, USER_A, "s1")).rejects.toThrow(UpgradeRequiredError);
    await expect(getMockInterviewSession(fake, USER_A, "s1")).rejects.toThrow(UpgradeRequiredError);
    await expect(listMockInterviewSessions(fake, USER_A)).rejects.toThrow(UpgradeRequiredError);
  });

  it("analyzeCareerSwitch / listCareerSwitchAnalyses", async () => {
    const fake = setup(plan);
    await expect(
      analyzeCareerSwitch(fake, USER_A, { currentRole: "Teacher", targetRole: "PM" }),
    ).rejects.toThrow(UpgradeRequiredError);
    await expect(listCareerSwitchAnalyses(fake, USER_A)).rejects.toThrow(UpgradeRequiredError);
  });

  it("generateCareerRecommendations / listCareerRecommendations", async () => {
    const fake = setup(plan);
    await expect(generateCareerRecommendations(fake, USER_A)).rejects.toThrow(UpgradeRequiredError);
    await expect(listCareerRecommendations(fake, USER_A)).rejects.toThrow(UpgradeRequiredError);
  });

  it("rejection happens before any row is written (no side effects on a denied call)", async () => {
    const fake = setup(plan);
    await expect(
      analyzeResume(fake, USER_A, { targetRole: "PM", resumeText: "x".repeat(60) }),
    ).rejects.toThrow(UpgradeRequiredError);
    expect(fake.table("resume_analyses")).toHaveLength(0);
  });
});

describe("Pro plan is let through the gate for every former-Premium AI feature", () => {
  // Premium was folded into Pro, so none of these should ever throw
  // UpgradeRequiredError for a Pro user again -- whether the underlying AI
  // call itself succeeds is a separate concern (covered by each feature's
  // own dedicated test file with a mocked provider).
  const plan = "pro" as const;

  it("analyzeResume / listResumeAnalyses", async () => {
    const fake = setup(plan);
    await expect(
      analyzeResume(fake, USER_A, { targetRole: "PM", resumeText: "x".repeat(60) }),
    ).resolves.toBeDefined();
    await expect(listResumeAnalyses(fake, USER_A)).resolves.toBeDefined();
  });

  it("optimizeResume / listResumeOptimizations", async () => {
    const fake = setup(plan);
    await expect(
      optimizeResume(fake, USER_A, { targetRole: "PM", resumeText: "x".repeat(60) }),
    ).resolves.toBeDefined();
    await expect(listResumeOptimizations(fake, USER_A)).resolves.toBeDefined();
  });

  it("generateInterviewPrep / listInterviewPrepSessions", async () => {
    const fake = setup(plan);
    await expect(generateInterviewPrep(fake, USER_A, { targetRole: "PM" })).resolves.toBeDefined();
    await expect(listInterviewPrepSessions(fake, USER_A)).resolves.toBeDefined();
  });

  it("generateInterviewQuestions / listInterviewQuestionSets", async () => {
    const fake = setup(plan);
    await expect(
      generateInterviewQuestions(fake, USER_A, { targetRole: "PM" }),
    ).resolves.toBeDefined();
    await expect(listInterviewQuestionSets(fake, USER_A)).resolves.toBeDefined();
  });

  it("mock interview: start / get / list do not throw an upgrade error", async () => {
    const fake = setup(plan);
    await expect(startMockInterview(fake, USER_A, { targetRole: "PM" })).resolves.toBeDefined();
    await expect(getMockInterviewSession(fake, USER_A, "s1")).resolves.toBeDefined();
    await expect(listMockInterviewSessions(fake, USER_A)).resolves.toBeDefined();
  });

  it("analyzeCareerSwitch / listCareerSwitchAnalyses", async () => {
    const fake = setup(plan);
    await expect(
      analyzeCareerSwitch(fake, USER_A, { currentRole: "Teacher", targetRole: "PM" }),
    ).resolves.toBeDefined();
    await expect(listCareerSwitchAnalyses(fake, USER_A)).resolves.toBeDefined();
  });

  it("generateCareerRecommendations / listCareerRecommendations", async () => {
    const fake = setup(plan);
    await expect(generateCareerRecommendations(fake, USER_A)).resolves.toBeDefined();
    await expect(listCareerRecommendations(fake, USER_A)).resolves.toBeDefined();
  });
});
