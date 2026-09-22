import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ResumeOptimizationRow } from "@/lib/premium/resume-optimization.server";

const optimizeSchema = z.object({
  targetRole: z.string().min(2).max(200),
  resumeText: z.string().min(50).max(20_000),
});

export const optimizeResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => optimizeSchema.parse(data))
  .handler(async ({ context, data }): Promise<ResumeOptimizationRow> => {
    const { optimizeResume: run } = await import("@/lib/premium/resume-optimization.server");
    return run(context.supabase, context.userId, data);
  });

export const getResumeOptimizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ResumeOptimizationRow[]> => {
    const { listResumeOptimizations } = await import("@/lib/premium/resume-optimization.server");
    return listResumeOptimizations(context.supabase, context.userId);
  });
