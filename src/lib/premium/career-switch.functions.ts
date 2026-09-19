import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CareerSwitchAnalysisRow } from "@/lib/premium/career-switch.server";

const switchInputSchema = z.object({
  currentRole: z.string().min(2).max(200),
  targetRole: z.string().min(2).max(200),
});

export const analyzeCareerSwitch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => switchInputSchema.parse(data))
  .handler(async ({ context, data }): Promise<CareerSwitchAnalysisRow> => {
    const { analyzeCareerSwitch: run } = await import("@/lib/premium/career-switch.server");
    return run(context.supabase, context.userId, data);
  });

export const getCareerSwitchAnalyses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CareerSwitchAnalysisRow[]> => {
    const { listCareerSwitchAnalyses } = await import("@/lib/premium/career-switch.server");
    return listCareerSwitchAnalyses(context.supabase, context.userId);
  });
