import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { InterviewQuestionSetRow } from "@/lib/premium/interview-questions.server";

const genSchema = z.object({
  targetRole: z.string().min(2).max(200),
  jobId: z.string().uuid().optional(),
});

export const generateInterviewQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => genSchema.parse(data))
  .handler(async ({ context, data }): Promise<InterviewQuestionSetRow> => {
    const { generateInterviewQuestions: run } =
      await import("@/lib/premium/interview-questions.server");
    return run(context.supabase, context.userId, data);
  });

export const getInterviewQuestionSets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InterviewQuestionSetRow[]> => {
    const { listInterviewQuestionSets } = await import("@/lib/premium/interview-questions.server");
    return listInterviewQuestionSets(context.supabase, context.userId);
  });
