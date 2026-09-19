import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { InterviewPrepRow } from "@/lib/premium/interview-prep.server";

const prepInputSchema = z.object({ targetRole: z.string().min(2).max(200) });

export const generateInterviewPrep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => prepInputSchema.parse(data))
  .handler(async ({ context, data }): Promise<InterviewPrepRow> => {
    const { generateInterviewPrep: run } = await import("@/lib/premium/interview-prep.server");
    return run(context.supabase, context.userId, data);
  });

export const getInterviewPrepSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InterviewPrepRow[]> => {
    const { listInterviewPrepSessions } = await import("@/lib/premium/interview-prep.server");
    return listInterviewPrepSessions(context.supabase, context.userId);
  });
