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
import { AiRateLimitError, runAiWorkflow } from "@/lib/ai/run-workflow.server";
import { z } from "zod";

const schema = z.object({ ok: z.boolean() });

function callWorkflow(fake: ReturnType<typeof createFakeSupabase>, userId: string) {
  return runAiWorkflow({
    supabase: fake,
    table: "resume_analyses",
    userId,
    insertRow: { user_id: userId, target_role: "Data Analyst", resume_text: "x".repeat(60) },
    system: "s",
    prompt: "p",
    schema,
    toColumns: () => ({}),
  });
}

beforeEach(() => {
  vi.mocked(generateStructured).mockReset();
  vi.mocked(generateStructured).mockResolvedValue({ ok: true });
});

describe("runAiWorkflow rate limiting (ticket: uncontrolled AI cost abuse)", () => {
  it("allows requests under the per-user, per-feature limit", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro" });

    for (let i = 0; i < 8; i++) {
      const result = await callWorkflow(fake, USER_A);
      expect(result.status).toBe("completed");
    }
  });

  it("reproduces the bug: with no cap, a single account could script unlimited AI calls", async () => {
    // Regression guard for the exact vulnerability -- before the rate
    // limit existed, this loop would have completed all 20 calls and run
    // up real AI provider cost with zero application-level ceiling.
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro" });

    let rejected = 0;
    for (let i = 0; i < 20; i++) {
      try {
        await callWorkflow(fake, USER_A);
      } catch (error) {
        if (error instanceof AiRateLimitError) rejected++;
      }
    }
    expect(rejected).toBeGreaterThan(0);
    // The AI provider itself must never have been called for the
    // rejected requests -- a throttled request should never even reach
    // the (costly) provider call.
    expect(vi.mocked(generateStructured).mock.calls.length).toBeLessThan(20);
  });

  it("throws AiRateLimitError once the limit is exceeded, without inserting a new row", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro" });

    for (let i = 0; i < 8; i++) await callWorkflow(fake, USER_A);
    const before = fake.table("resume_analyses").length;

    await expect(callWorkflow(fake, USER_A)).rejects.toBeInstanceOf(AiRateLimitError);
    expect(fake.table("resume_analyses")).toHaveLength(before);
  });

  it("scopes the limit per user -- another user is never throttled by someone else's usage", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro" });
    seedProfile(fake, USER_B, { plan: "pro" });

    for (let i = 0; i < 8; i++) await callWorkflow(fake, USER_A);
    await expect(callWorkflow(fake, USER_A)).rejects.toBeInstanceOf(AiRateLimitError);

    // USER_B has made zero requests -- must still be allowed through.
    const result = await callWorkflow(fake, USER_B);
    expect(result.status).toBe("completed");
  });

  it("scopes the limit per feature table -- exhausting one Pro feature doesn't throttle another", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro" });

    for (let i = 0; i < 8; i++) await callWorkflow(fake, USER_A);
    await expect(callWorkflow(fake, USER_A)).rejects.toBeInstanceOf(AiRateLimitError);

    const result = await runAiWorkflow({
      supabase: fake,
      table: "resume_optimizations",
      userId: USER_A,
      insertRow: { user_id: USER_A, target_role: "Data Analyst", resume_text: "x".repeat(60) },
      system: "s",
      prompt: "p",
      schema,
      toColumns: () => ({}),
    });
    expect(result.status).toBe("completed");
  });
});
