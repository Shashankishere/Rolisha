/**
 * The one place that translates a Razorpay subscription's state into (a)
 * our local `subscriptions` mirror row and (b) `profiles.plan`. Both the
 * webhook handler and the optimistic post-checkout verification path call
 * into this -- there is exactly one code path that can grant or revoke
 * paid access, and it always runs against the service-role client after
 * the caller has independently verified a Razorpay signature.
 *
 * `profiles.plan` write access is revoked from the `authenticated` role
 * at the database level (see 20260827000000_subscription_gating.sql), so
 * this function using the service-role client isn't just a convention --
 * it's the only client that is *able* to make this write at all.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = any;

const ACTIVE_STATUSES = new Set(["authenticated", "active"]);
const TERMINAL_DOWNGRADE_STATUSES = new Set(["cancelled", "completed", "expired", "halted"]);

export interface RecordSubscriptionInput {
  userId: string;
  planTier: "pro";
  razorpaySubscriptionId: string;
  razorpayPlanId: string;
  status: string;
}

/** Called right after Razorpay confirms subscription creation during
 * checkout. Inserts the local mirror row in 'created' status -- this does
 * NOT grant plan access by itself; access is only granted once a
 * subsequent 'authenticated'/'active' status is applied via
 * `applySubscriptionStatus`, which requires independent signature
 * verification (webhook or checkout-signature check) first. */
export async function recordSubscriptionCreated(
  admin: Client,
  input: RecordSubscriptionInput,
): Promise<string> {
  const { data, error } = await admin
    .from("subscriptions")
    .insert({
      user_id: input.userId,
      plan_tier: input.planTier,
      razorpay_subscription_id: input.razorpaySubscriptionId,
      razorpay_plan_id: input.razorpayPlanId,
      status: input.status,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("Unable to record the new subscription.");
  return (data as { id: string }).id;
}

export interface ApplyStatusInput {
  razorpaySubscriptionId: string;
  status: string;
  currentPeriodEndUnix?: number | null | undefined;
  lastPaymentError?: string | null | undefined;
  cancelAtPeriodEnd?: boolean | undefined;
}

/**
 * Applies a status transition to the local subscription row and, when the
 * transition crosses into or out of "paid access should be active",
 * updates `profiles.plan` to match. Safe to call multiple times with the
 * same status (idempotent) -- re-applying 'active' just re-writes the
 * same values.
 */
export async function applySubscriptionStatus(
  admin: Client,
  input: ApplyStatusInput,
): Promise<void> {
  const { data: subscription, error: findError } = await admin
    .from("subscriptions")
    .select("*")
    .eq("razorpay_subscription_id", input.razorpaySubscriptionId)
    .maybeSingle();
  if (findError || !subscription) {
    // Nothing local to reconcile against (e.g. a subscription created
    // directly in the Razorpay dashboard rather than through our
    // checkout). Nothing to fabricate here -- just no-op.
    return;
  }

  const updates: Record<string, unknown> = { status: input.status };
  if (input.currentPeriodEndUnix !== undefined) {
    updates["current_period_end"] =
      input.currentPeriodEndUnix === null
        ? null
        : new Date(input.currentPeriodEndUnix * 1000).toISOString();
  }
  if (input.lastPaymentError !== undefined) updates["last_payment_error"] = input.lastPaymentError;
  if (input.cancelAtPeriodEnd !== undefined)
    updates["cancel_at_period_end"] = input.cancelAtPeriodEnd;

  await admin
    .from("subscriptions")
    .update(updates)
    .eq("id", (subscription as any).id);

  const userId = (subscription as any).user_id as string;
  // The `subscriptions` table's `plan_tier` column can still legitimately
  // read "premium" for a subscription that predates folding Premium into
  // Pro (kept as a historical billing record, not destroyed) -- but
  // `profiles.plan` itself must only ever be "free" or "pro" going
  // forward, so any paid tier normalizes to "pro" here rather than
  // writing the historical value through verbatim.
  const planTier = "pro" as const;

  if (ACTIVE_STATUSES.has(input.status)) {
    await admin
      .from("profiles")
      .update({
        plan: planTier,
        plan_source: "razorpay_subscription",
        plan_updated_at: new Date().toISOString(),
        plan_updated_by: null,
      })
      .eq("id", userId);
    return;
  }

  if (TERMINAL_DOWNGRADE_STATUSES.has(input.status)) {
    // Only downgrade if this Razorpay subscription is actually what's
    // currently backing the user's plan -- never clobber a manually
    // assigned admin plan, and never downgrade a user who has since moved
    // to a different (still active) subscription.
    const { data: profile } = await admin
      .from("profiles")
      .select("plan, plan_source")
      .eq("id", userId)
      .maybeSingle();
    const currentlyBackedByThis =
      (profile as any)?.plan_source === "razorpay_subscription" &&
      (profile as any)?.plan === planTier;
    if (currentlyBackedByThis) {
      await admin
        .from("profiles")
        .update({
          plan: "free",
          plan_source: "default",
          plan_updated_at: new Date().toISOString(),
          plan_updated_by: null,
        })
        .eq("id", userId);
    }
  }
  // 'pending' / 'created': no plan change -- Razorpay is mid-retry or the
  // subscription hasn't completed its first charge yet.
}
