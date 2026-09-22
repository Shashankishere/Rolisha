/**
 * Checkout entry points. `createCheckoutSession` is the only place a
 * Razorpay Subscription gets created; `verifyCheckoutSession` is the
 * optimistic fast-path the browser calls right after Razorpay Checkout
 * reports success -- it independently re-derives the HMAC signature
 * server-side before treating the payment as real (see
 * signature.server.ts). The webhook remains the durable source of truth
 * regardless of whether this fast path runs.
 */
import { z } from "zod";
import {
  RazorpayNotConfiguredError,
  createOrFetchCustomer,
  createSubscription,
  getRazorpayConfig,
} from "@/lib/payments/razorpay-client.server";
import { verifyCheckoutSignature } from "@/lib/payments/signature.server";
import {
  applySubscriptionStatus,
  recordSubscriptionCreated,
} from "@/lib/payments/subscription-sync.server";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = any;

const DEFAULT_TOTAL_COUNT = 120; // 10 years of monthly cycles; cancellation is explicit via the Cancel action.

export interface CheckoutSession {
  razorpaySubscriptionId: string;
  razorpayKeyId: string;
  planTier: "pro";
}

export async function createCheckoutSession(
  supabase: Client,
  userId: string,
  planTier: "pro",
): Promise<CheckoutSession> {
  const config = getRazorpayConfig();
  if (!config) throw new RazorpayNotConfiguredError();

  const planId = config.planIdByTier[planTier];
  if (!planId) {
    throw new RazorpayNotConfiguredError(
      `Payments aren't fully configured yet: no Razorpay plan is set for ${planTier}.`,
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", userId)
    .maybeSingle();
  if (profileError || !profile) throw new Error("Unable to load your profile for checkout.");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin: Client = supabaseAdmin;

  const { data: existingCustomer } = await admin
    .from("billing_customers")
    .select("razorpay_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  let razorpayCustomerId = (existingCustomer as { razorpay_customer_id: string } | null)
    ?.razorpay_customer_id;

  if (!razorpayCustomerId) {
    const customer = await createOrFetchCustomer(config, {
      email: (profile as any).email,
      name: (profile as any).full_name ?? (profile as any).email,
      notes: { app_user_id: userId },
    });
    razorpayCustomerId = customer.id;
    await admin
      .from("billing_customers")
      .insert({ user_id: userId, razorpay_customer_id: razorpayCustomerId });
  }

  const totalCount = Number(
    process.env["RAZORPAY_SUBSCRIPTION_TOTAL_COUNT"] ?? DEFAULT_TOTAL_COUNT,
  );

  const subscription = await createSubscription(config, {
    planId,
    customerId: razorpayCustomerId,
    totalCount: Number.isFinite(totalCount) ? totalCount : DEFAULT_TOTAL_COUNT,
    notes: { app_user_id: userId, plan_tier: planTier },
  });

  await recordSubscriptionCreated(admin, {
    userId,
    planTier,
    razorpaySubscriptionId: subscription.id,
    razorpayPlanId: planId,
    status: subscription.status,
  });

  return { razorpaySubscriptionId: subscription.id, razorpayKeyId: config.keyId, planTier };
}

const verifySchema = z.object({
  razorpayPaymentId: z.string().min(1),
  razorpaySubscriptionId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

export type VerifyCheckoutInput = z.infer<typeof verifySchema>;

export interface VerifyCheckoutResult {
  verified: boolean;
  /** True once profiles.plan reflects this subscription -- may still be
   * false immediately after a valid signature if the webhook hasn't
   * landed yet; the caller should treat this as "hang tight, refreshing"
   * rather than a failure. */
  applied: boolean;
}

export async function verifyCheckoutSession(
  userId: string,
  input: VerifyCheckoutInput,
): Promise<VerifyCheckoutResult> {
  const parsed = verifySchema.parse(input);
  const config = getRazorpayConfig();
  if (!config) throw new RazorpayNotConfiguredError();

  const verified = verifyCheckoutSignature({
    razorpayPaymentId: parsed.razorpayPaymentId,
    razorpaySubscriptionId: parsed.razorpaySubscriptionId,
    razorpaySignature: parsed.razorpaySignature,
    keySecret: config.keySecret,
  });
  if (!verified) return { verified: false, applied: false };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin: Client = supabaseAdmin;

  // Confirm the subscription we're about to activate actually belongs to
  // the caller -- a verified signature alone only proves it came from
  // Razorpay, not that this user is entitled to *this* subscription id.
  const { data: subscription } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("razorpay_subscription_id", parsed.razorpaySubscriptionId)
    .maybeSingle();
  if (!subscription || (subscription as any).user_id !== userId) {
    return { verified: false, applied: false };
  }

  await applySubscriptionStatus(admin, {
    razorpaySubscriptionId: parsed.razorpaySubscriptionId,
    status: "active",
  });

  return { verified: true, applied: true };
}
