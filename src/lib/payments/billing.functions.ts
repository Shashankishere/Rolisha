import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { BillingSubscriptionView } from "@/lib/payments/billing.server";

export const getCurrentSubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BillingSubscriptionView | null> => {
    const { getCurrentSubscription: run } = await import("@/lib/payments/billing.server");
    return run(context.supabase, context.userId);
  });

const cancelSchema = z.object({ immediately: z.boolean().optional() });

export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => cancelSchema.parse(data ?? {}))
  .handler(async ({ context, data }): Promise<BillingSubscriptionView> => {
    const { cancelUserSubscription } = await import("@/lib/payments/billing.server");
    return cancelUserSubscription(context.supabase, context.userId, data);
  });
