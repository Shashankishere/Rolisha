import { describe, expect, it } from "vitest";
import {
  FEATURE_INFO,
  FREE_ASSESSMENTS,
  FREE_CAREER_ROADMAPS,
  FREE_LEARNING_LESSONS,
  FREE_PROJECTS,
  PRO_CAREER_ROADMAPS,
  UpgradeRequiredError,
  canAccessFeature,
  featuresForPlan,
  getLimit,
  parseUpgradeError,
  type Feature,
} from "@/lib/subscription";

const ALL_FEATURES = Object.keys(FEATURE_INFO) as Feature[];

describe("canAccessFeature — FREE plan", () => {
  it("denies every gated feature", () => {
    for (const feature of ALL_FEATURES) {
      expect(canAccessFeature("free", feature)).toBe(false);
    }
  });
});

describe("canAccessFeature — PRO plan", () => {
  // Rolisha has exactly two user-facing plans, Free and Pro. There used to
  // be a third "Premium" tier above Pro that gated resume analysis,
  // interview prep, mock interviews, career switching, etc.; it was
  // removed and every one of those features became a Pro feature instead
  // -- so Pro is now the top tier and unlocks everything gated at all.
  it("allows every gated feature -- Pro is the top tier now that Premium has been folded into it", () => {
    for (const feature of ALL_FEATURES) {
      expect(FEATURE_INFO[feature].requiredPlan).toBe("pro");
      expect(canAccessFeature("pro", feature)).toBe(true);
    }
  });
});

describe("featuresForPlan", () => {
  it("free plan gets no gated features", () => {
    expect(featuresForPlan("free")).toHaveLength(0);
  });

  it("pro plan gets every gated feature, including the former Premium-only ones", () => {
    const pro = new Set(featuresForPlan("pro"));
    expect(pro.size).toBe(ALL_FEATURES.length);
    for (const formerlyPremium of [
      "resume_analysis",
      "resume_optimization",
      "interview_preparation",
      "personalized_interview_questions",
      "mock_interviews",
      "career_switch_analysis",
      "ai_career_recommendations",
    ] as Feature[]) {
      expect(pro.has(formerlyPremium)).toBe(true);
    }
  });
});

describe("getLimit", () => {
  it("free plan matches the spec's suggested starting limits", () => {
    expect(getLimit("free", "career_roadmaps")).toBe(FREE_CAREER_ROADMAPS);
    expect(getLimit("free", "projects")).toBe(FREE_PROJECTS);
    expect(getLimit("free", "assessments")).toBe(FREE_ASSESSMENTS);
    expect(getLimit("free", "learning_lessons")).toBe(FREE_LEARNING_LESSONS);
  });

  it("pro plan is unlimited except roadmaps, capped at 5", () => {
    expect(getLimit("pro", "career_roadmaps")).toBe(PRO_CAREER_ROADMAPS);
    expect(getLimit("pro", "projects")).toBeNull();
    expect(getLimit("pro", "assessments")).toBeNull();
    expect(getLimit("pro", "learning_lessons")).toBeNull();
  });
});

describe("UpgradeRequiredError / parseUpgradeError round-trip", () => {
  it("encodes and decodes feature, required plan and current plan", () => {
    const err = new UpgradeRequiredError("resume_analysis", "free");
    const parsed = parseUpgradeError(err.message);
    expect(parsed).not.toBeNull();
    expect(parsed?.feature).toBe("resume_analysis");
    expect(parsed?.requiredPlan).toBe("pro");
    expect(parsed?.currentPlan).toBe("free");
    expect(parsed?.code).toBe("FEATURE_REQUIRES_UPGRADE");
  });

  it("returns null for an unrelated error message", () => {
    expect(parseUpgradeError("Something else went wrong.")).toBeNull();
    expect(parseUpgradeError(undefined)).toBeNull();
    expect(parseUpgradeError(null)).toBeNull();
  });

  it(".info matches what parseUpgradeError derives from .message", () => {
    const err = new UpgradeRequiredError("mock_interviews", "free");
    const parsed = parseUpgradeError(err.message)!;
    expect(parsed.feature).toBe(err.info.feature);
    expect(parsed.requiredPlan).toBe(err.info.requiredPlan);
    expect(parsed.currentPlan).toBe(err.info.currentPlan);
  });
});
