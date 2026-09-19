import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ResumeAnalysisRow } from "@/lib/premium/resume-analysis.server";

const analyzeSchema = z.object({
  targetRole: z.string().min(2).max(200),
  resumeText: z.string().min(50).max(20_000),
});

export const analyzeResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => analyzeSchema.parse(data))
  .handler(async ({ context, data }): Promise<ResumeAnalysisRow> => {
    const { analyzeResume: run } = await import("@/lib/premium/resume-analysis.server");
    return run(context.supabase, context.userId, data);
  });

export const getResumeAnalyses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ResumeAnalysisRow[]> => {
    const { listResumeAnalyses } = await import("@/lib/premium/resume-analysis.server");
    return listResumeAnalyses(context.supabase, context.userId);
  });

const getOneSchema = z.object({ id: z.string().uuid() });

export const getResumeAnalysis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => getOneSchema.parse(data))
  .handler(async ({ context, data }): Promise<ResumeAnalysisRow | null> => {
    const { getResumeAnalysis: getOne } = await import("@/lib/premium/resume-analysis.server");
    return getOne(context.supabase, context.userId, data.id);
  });
