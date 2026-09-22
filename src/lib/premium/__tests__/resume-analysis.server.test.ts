import { describe, expect, it, vi, beforeEach } from "vitest";
import { createFakeSupabase } from "@/lib/jobs/__tests__/fake-supabase";
import { seedProfile, USER_A, USER_B } from "@/lib/jobs/__tests__/fixtures";
import { AiNotConfiguredError } from "@/lib/ai/provider.server";

vi.mock("@/lib/ai/provider.server", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/provider.server")>(
    "@/lib/ai/provider.server",
  );
  return {
    ...actual,
    generateStructured: vi.fn(),
    currentModelLabel: vi.fn(() => "test-model"),
  };
});

import { generateStructured } from "@/lib/ai/provider.server";
import {
  analyzeResume,
  getResumeAnalysis,
  listResumeAnalyses,
} from "@/lib/premium/resume-analysis.server";

const FAKE_ANALYSIS = {
  overallScore: 72,
  atsScore: 60,
  atsNotes: "Mostly parseable.",
  skillsDetected: ["SQL"],
  missingSkills: ["Python"],
  strengths: ["Clear formatting"],
  weaknesses: ["No quantified impact"],
  experienceRelevance: "Relevant.",
  educationRelevance: "Relevant.",
  keywordCoverage: [{ keyword: "SQL", covered: true }],
  jobDescriptionAlignment: "Good fit.",
  recommendations: ["Add metrics"],
};

beforeEach(() => {
  vi.mocked(generateStructured).mockReset();
});

describe("analyzeResume", () => {
  it("persists a completed row when the AI call succeeds (premium user)", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro" });
    vi.mocked(generateStructured).mockResolvedValueOnce(FAKE_ANALYSIS);

    const result = await analyzeResume(fake, USER_A, {
      targetRole: "Data Analyst",
      resumeText: "x".repeat(60),
    });

    expect(result.status).toBe("completed");
    expect(result.overallScore).toBe(72);
    expect(result.model).toBe("test-model");
    expect(fake.table("resume_analyses")).toHaveLength(1);
  });

  it("persists an honest failed row (never a fabricated result) when AI isn't configured", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro" });
    vi.mocked(generateStructured).mockRejectedValueOnce(new AiNotConfiguredError());

    const result = await analyzeResume(fake, USER_A, {
      targetRole: "Data Analyst",
      resumeText: "x".repeat(60),
    });

    expect(result.status).toBe("failed");
    expect(result.errorMessage).toMatch(/not configured|isn't configured/i);
    expect(result.overallScore).toBe(0);
    expect(result.recommendations).toEqual([]);
  });

  it("scopes reads to the requesting user only (RLS-equivalent ownership check)", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro" });
    seedProfile(fake, USER_B, { plan: "pro" });
    vi.mocked(generateStructured).mockResolvedValueOnce(FAKE_ANALYSIS);

    const owned = await analyzeResume(fake, USER_A, {
      targetRole: "PM",
      resumeText: "x".repeat(60),
    });

    // USER_B must not be able to fetch USER_A's analysis by id.
    const asOtherUser = await getResumeAnalysis(fake, USER_B, owned.id);
    expect(asOtherUser).toBeNull();

    const ownersList = await listResumeAnalyses(fake, USER_A);
    const othersList = await listResumeAnalyses(fake, USER_B);
    expect(ownersList).toHaveLength(1);
    expect(othersList).toHaveLength(0);
  });
});
