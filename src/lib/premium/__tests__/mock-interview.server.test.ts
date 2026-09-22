import { describe, expect, it, vi, beforeEach } from "vitest";
import { createFakeSupabase } from "@/lib/jobs/__tests__/fake-supabase";
import { seedProfile, USER_A, USER_B } from "@/lib/jobs/__tests__/fixtures";

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
  finishMockInterview,
  getMockInterviewSession,
  startMockInterview,
  submitMockInterviewAnswer,
} from "@/lib/premium/mock-interview.server";

beforeEach(() => {
  vi.mocked(generateStructured).mockReset();
});

describe("mock interview workflow", () => {
  it("runs start -> answer -> finish end to end for a premium user", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro" });

    vi.mocked(generateStructured).mockResolvedValueOnce({
      questions: [
        { category: "technical", question: "Explain indexing." },
        { category: "behavioral", question: "Tell me about a conflict." },
      ],
    });

    const session = await startMockInterview(fake, USER_A, {
      targetRole: "Backend Engineer",
      questionCount: 3,
    });
    expect(session.status).toBe("in_progress");
    expect(session.turns).toHaveLength(2);

    vi.mocked(generateStructured).mockResolvedValueOnce({
      quality: 80,
      relevance: 75,
      completeness: 70,
      communication: 85,
      technicalDepth: 60,
      areasToImprove: ["Be more specific"],
      followUpTopics: ["B-tree indexes"],
    });

    const turn = await submitMockInterviewAnswer(fake, USER_A, {
      sessionId: session.id,
      turnIndex: 0,
      answer: "An index speeds up lookups.",
    });
    expect(turn.answer).toBe("An index speeds up lookups.");
    expect(turn.feedback?.status).toBe("completed");
    expect(turn.feedback?.quality).toBe(80);

    vi.mocked(generateStructured).mockResolvedValueOnce({
      summary: "Solid technical answer, one question unanswered.",
      areas: [{ area: "Technical depth", note: "Go deeper on internals." }],
    });

    const finished = await finishMockInterview(fake, USER_A, session.id);
    expect(finished.status).toBe("completed");
    expect(finished.overallSummary).toContain("Solid technical answer");
  });

  it("stores an honest failed session (not a fabricated one) when question generation fails", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro" });
    vi.mocked(generateStructured).mockRejectedValueOnce(new Error("network blip"));

    const session = await startMockInterview(fake, USER_A, { targetRole: "PM" });
    expect(session.status).toBe("failed");
    expect(session.errorMessage).toMatch(/network blip/);
    expect(session.turns).toHaveLength(0);
  });

  it("prevents one user from reading or answering another user's session", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro" });
    seedProfile(fake, USER_B, { plan: "pro" });
    vi.mocked(generateStructured).mockResolvedValueOnce({
      questions: [{ category: "technical", question: "Q1" }],
    });

    const session = await startMockInterview(fake, USER_A, { targetRole: "PM" });

    const asOther = await getMockInterviewSession(fake, USER_B, session.id);
    expect(asOther).toBeNull();

    await expect(
      submitMockInterviewAnswer(fake, USER_B, {
        sessionId: session.id,
        turnIndex: 0,
        answer: "hack",
      }),
    ).rejects.toThrow();
  });
});
