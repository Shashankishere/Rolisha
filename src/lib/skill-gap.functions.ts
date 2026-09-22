import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AdvancedSkillGapResult } from "@/lib/skill-gap.server";

export const getAdvancedSkillGap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdvancedSkillGapResult> => {
    const { loadAdvancedSkillGap } = await import("@/lib/skill-gap.server");
    return loadAdvancedSkillGap(context.supabase, context.userId);
  });
