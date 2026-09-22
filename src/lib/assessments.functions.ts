import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  AssessmentForTaking,
  AssessmentsForUser,
  AttemptResult,
  SkillPerformanceBreakdown,
} from "@/lib/assessments.server";

export const getAssessments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AssessmentsForUser> => {
    const { listAssessments } = await import("@/lib/assessments.server");
    return listAssessments(context.supabase, context.userId);
  });

export const getSkillPerformance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SkillPerformanceBreakdown> => {
    const { getSkillPerformanceBreakdown } = await import("@/lib/assessments.server");
    return getSkillPerformanceBreakdown(context.supabase, context.userId);
  });

const getAssessmentSchema = z.object({ assessmentId: z.string().uuid() });

/** Returns a quiz for taking — never includes correct_index or explanation. */
export const getAssessment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => getAssessmentSchema.parse(data))
  .handler(async ({ context, data }): Promise<AssessmentForTaking> => {
    const { getAssessmentForTaking } = await import("@/lib/assessments.server");
    return getAssessmentForTaking(context.supabase, data.assessmentId);
  });

const submitAttemptSchema = z.object({
  assessmentId: z.string().uuid(),
  answers: z.array(z.number().int().min(0).nullable()).max(200),
});

export const submitAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => submitAttemptSchema.parse(data))
  .handler(async ({ context, data }): Promise<AttemptResult> => {
    const { submitAssessmentAttempt } = await import("@/lib/assessments.server");
    return submitAssessmentAttempt(
      context.supabase,
      context.userId,
      data.assessmentId,
      data.answers,
    );
  });
