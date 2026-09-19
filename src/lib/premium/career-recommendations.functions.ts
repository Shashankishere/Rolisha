import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CareerRecommendationsRow } from "@/lib/premium/career-recommendations.server";

export const generateCareerRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CareerRecommendationsRow> => {
    const { generateCareerRecommendations: run } =
      await import("@/lib/premium/career-recommendations.server");
    return run(context.supabase, context.userId);
  });

export const getCareerRecommendations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CareerRecommendationsRow[]> => {
    const { listCareerRecommendations } =
      await import("@/lib/premium/career-recommendations.server");
    return listCareerRecommendations(context.supabase, context.userId);
  });
