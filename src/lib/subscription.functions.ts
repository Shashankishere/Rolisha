import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { FEATURE_INFO, type Feature, type PlanTier } from "@/lib/subscription";
import type { UsageSummary } from "@/lib/subscription.server";

export interface SubscriptionStatus {
  plan: PlanTier;
  planSource: "default" | "manual_admin" | "razorpay_subscription";
  usage: UsageSummary;
  /** Whether the current plan can access each feature — computed
   * server-side so the client never has to re-derive plan logic to decide
   * what to show as locked. */
  features: Record<Feature, boolean>;
}

export const getSubscriptionStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SubscriptionStatus> => {
    const { getUserPlan, getUsageSummary } = await import("@/lib/subscription.server");
    const { canAccessFeature } = await import("@/lib/subscription");

    const { data, error } = await context.supabase
      .from("profiles")
      .select("plan, plan_source")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error("Unable to load your subscription.");

    const plan = await getUserPlan(context.supabase, context.userId);
    const usage = await getUsageSummary(context.supabase, context.userId, plan);
    const planSource = ((data as { plan_source?: string } | null)?.plan_source ?? "default") as
      "default" | "manual_admin" | "razorpay_subscription";

    const features = Object.fromEntries(
      (Object.keys(FEATURE_INFO) as Feature[]).map((f) => [f, canAccessFeature(plan, f)]),
    ) as Record<Feature, boolean>;

    return { plan, planSource, usage, features };
  });
