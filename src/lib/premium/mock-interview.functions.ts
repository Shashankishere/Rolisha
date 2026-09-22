import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MockInterviewSession, MockInterviewTurn } from "@/lib/premium/mock-interview.server";

const startSchema = z.object({
  targetRole: z.string().min(2).max(200),
  questionCount: z.number().int().min(3).max(10).optional(),
});

export const startMockInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => startSchema.parse(data))
  .handler(async ({ context, data }): Promise<MockInterviewSession> => {
    const { startMockInterview: run } = await import("@/lib/premium/mock-interview.server");
    return run(context.supabase, context.userId, data);
  });

const answerSchema = z.object({
  sessionId: z.string().uuid(),
  turnIndex: z.number().int().min(0),
  answer: z.string().min(1).max(8000),
});

export const submitMockInterviewAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => answerSchema.parse(data))
  .handler(async ({ context, data }): Promise<MockInterviewTurn> => {
    const { submitMockInterviewAnswer: run } = await import("@/lib/premium/mock-interview.server");
    return run(context.supabase, context.userId, data);
  });

const sessionIdSchema = z.object({ sessionId: z.string().uuid() });

export const finishMockInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => sessionIdSchema.parse(data))
  .handler(async ({ context, data }): Promise<MockInterviewSession> => {
    const { finishMockInterview: run } = await import("@/lib/premium/mock-interview.server");
    return run(context.supabase, context.userId, data.sessionId);
  });

export const getMockInterviewSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => sessionIdSchema.parse(data))
  .handler(async ({ context, data }): Promise<MockInterviewSession | null> => {
    const { getMockInterviewSession: run } = await import("@/lib/premium/mock-interview.server");
    return run(context.supabase, context.userId, data.sessionId);
  });

export const getMockInterviewSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MockInterviewSession[]> => {
    const { listMockInterviewSessions } = await import("@/lib/premium/mock-interview.server");
    return listMockInterviewSessions(context.supabase, context.userId);
  });
