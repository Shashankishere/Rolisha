/**
 * User-initiated cancellation and subscription status lookup.
 *
 * Cancellation calls Razorpay to cancel at the end of the current billing
 * cycle by default (so the user keeps the access they already paid for)
 * and records that intent locally, but the ACTUAL plan downgrade still
 * only happens when Razorpay's `subscription.cancelled` webhook fires --
 * mirroring the "client success claim isn't the source of truth"
 * principle in the other direction: a client-initiated cancel request
 * doesn't revoke access either, until the provider confirms it.
 */
import {
  RazorpayNotConfiguredError,
  cancelSubscription as cancelViaRazorpay,
  getRazorpayConfig,
} from "@/lib/payments/razorpay-client.server";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = any;

export interface BillingSubscriptionView {
  id: string;
  planTier: "pro" | "premium";
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  lastPaymentError: string | null;
  createdAt: string;
}

function mapRow(row: any): BillingSubscriptionView {
  return {
    id: row.id,
    planTier: row.plan_tier,
    status: row.status,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    currentPeriodEnd: row.current_period_end,
    lastPaymentError: row.last_payment_error,
    createdAt: row.created_at,
  };
}

/** The user's most recent subscription row, regardless of status -- the
 * Settings page uses this to show active/cancelled/failed state honestly. */
export async function getCurrentSubscription(
  supabase: Client,
  userId: string,
): Promise<BillingSubscriptionView | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("Unable to load your subscription.");
  return data ? mapRow(data) : null;
}

export async function cancelUserSubscription(
  supabase: Client,
  userId: string,
  options: { immediately?: boolean | undefined } = {},
): Promise<BillingSubscriptionView> {
  const config = getRazorpayConfig();
  if (!config) throw new RazorpayNotConfiguredError();

  const { data: row, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["created", "authenticated", "active", "pending"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !row) throw new Error("No active subscription found to cancel.");

  const cancelAtCycleEnd = !options.immediately;
  const result = await cancelViaRazorpay(
    config,
    (row as any).razorpay_subscription_id,
    cancelAtCycleEnd,
  );

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { applySubscriptionStatus } = await import("@/lib/payments/subscription-sync.server");

  if (cancelAtCycleEnd) {
    // Razorpay keeps status 'active' until the period actually ends when
    // cancelling at cycle end -- just record the intent; the webhook will
    // deliver the terminal 'cancelled' status (and the resulting
    // downgrade) when the cycle actually completes.
    await applySubscriptionStatus(supabaseAdmin, {
      razorpaySubscriptionId: (row as any).razorpay_subscription_id,
      status: result.status,
      cancelAtPeriodEnd: true,
    });
  } else {
    await applySubscriptionStatus(supabaseAdmin, {
      razorpaySubscriptionId: (row as any).razorpay_subscription_id,
      status: result.status,
      cancelAtPeriodEnd: false,
    });
  }

  const updated = await getCurrentSubscription(supabase, userId);
  if (!updated) throw new Error("Unable to load the updated subscription.");
  return updated;
}
