import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CareerAnalytics } from "@/lib/analytics.server";

export const getCareerAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CareerAnalytics> => {
    const { loadCareerAnalytics } = await import("@/lib/analytics.server");
    return loadCareerAnalytics(context.supabase, context.userId);
  });
