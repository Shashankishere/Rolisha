import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CheckoutSession, VerifyCheckoutResult } from "@/lib/payments/checkout.server";

const createSchema = z.object({ planTier: z.enum(["pro"]) });

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => createSchema.parse(data))
  .handler(async ({ context, data }): Promise<CheckoutSession> => {
    const { createCheckoutSession: run } = await import("@/lib/payments/checkout.server");
    return run(context.supabase, context.userId, data.planTier);
  });

const verifySchema = z.object({
  razorpayPaymentId: z.string().min(1),
  razorpaySubscriptionId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

export const verifyCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => verifySchema.parse(data))
  .handler(async ({ context, data }): Promise<VerifyCheckoutResult> => {
    const { verifyCheckoutSession: run } = await import("@/lib/payments/checkout.server");
    return run(context.userId, data);
  });
