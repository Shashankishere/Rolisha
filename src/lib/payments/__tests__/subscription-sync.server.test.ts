import { describe, expect, it } from "vitest";
import { createFakeSupabase } from "@/lib/jobs/__tests__/fake-supabase";
import { seedProfile, USER_A } from "@/lib/jobs/__tests__/fixtures";
import {
  applySubscriptionStatus,
  recordSubscriptionCreated,
} from "@/lib/payments/subscription-sync.server";

function seedSubscription(
  fake: ReturnType<typeof createFakeSupabase>,
  overrides: Record<string, unknown> = {},
) {
  fake.table("subscriptions").push({
    id: "sub-row-1",
    user_id: USER_A,
    plan_tier: "pro",
    razorpay_subscription_id: "sub_razorpay_1",
    razorpay_plan_id: "plan_pro",
    status: "created",
    cancel_at_period_end: false,
    current_period_end: null,
    last_payment_error: null,
    ...overrides,
  });
}

describe("recordSubscriptionCreated", () => {
  it("inserts a new local subscription row in 'created' status", async () => {
    const fake = createFakeSupabase();
    const id = await recordSubscriptionCreated(fake, {
      userId: USER_A,
      planTier: "pro",
      razorpaySubscriptionId: "sub_abc",
      razorpayPlanId: "plan_pro",
      status: "created",
    });
    expect(id).toBeTruthy();
    expect(fake.table("subscriptions")).toHaveLength(1);
    expect(fake.table("subscriptions")[0]).toMatchObject({ status: "created", plan_tier: "pro" });
  });
});

describe("applySubscriptionStatus", () => {
  it("grants the plan when the subscription becomes active", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "free", plan_source: "default" });
    seedSubscription(fake);

    await applySubscriptionStatus(fake, {
      razorpaySubscriptionId: "sub_razorpay_1",
      status: "active",
    });

    const profile = fake.table("profiles").find((p) => p["id"] === USER_A)!;
    expect(profile["plan"]).toBe("pro");
    expect(profile["plan_source"]).toBe("razorpay_subscription");
    expect(fake.table("subscriptions")[0]!["status"]).toBe("active");
  });

  it("normalizes a legacy Premium-tier subscription row to Pro rather than writing 'premium' to profiles.plan", async () => {
    // Premium was folded into Pro; a subscription row created before that
    // can still legitimately read plan_tier: "premium" as a historical
    // record (never destroyed), but profiles.plan itself must only ever
    // become "free" or "pro".
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "free", plan_source: "default" });
    seedSubscription(fake, { plan_tier: "premium", razorpay_plan_id: "plan_premium" });

    await applySubscriptionStatus(fake, {
      razorpaySubscriptionId: "sub_razorpay_1",
      status: "active",
    });

    const profile = fake.table("profiles").find((p) => p["id"] === USER_A)!;
    expect(profile["plan"]).toBe("pro");
    // The historical row itself is left untouched -- only profiles.plan is
    // normalized, the subscriptions table keeps its real record.
    expect(fake.table("subscriptions")[0]!["plan_tier"]).toBe("premium");
  });

  it("downgrades to free when a razorpay-backed subscription is cancelled", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro", plan_source: "razorpay_subscription" });
    seedSubscription(fake, { status: "active" });

    await applySubscriptionStatus(fake, {
      razorpaySubscriptionId: "sub_razorpay_1",
      status: "cancelled",
    });

    const profile = fake.table("profiles").find((p) => p["id"] === USER_A)!;
    expect(profile["plan"]).toBe("free");
    expect(profile["plan_source"]).toBe("default");
  });

  it("never downgrades a plan an admin manually granted, even if a subscription is cancelled", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro", plan_source: "manual_admin" });
    seedSubscription(fake, { status: "active" });

    await applySubscriptionStatus(fake, {
      razorpaySubscriptionId: "sub_razorpay_1",
      status: "cancelled",
    });

    const profile = fake.table("profiles").find((p) => p["id"] === USER_A)!;
    expect(profile["plan"]).toBe("pro");
    expect(profile["plan_source"]).toBe("manual_admin");
  });

  it("records a payment failure without changing the plan", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro", plan_source: "razorpay_subscription" });
    seedSubscription(fake, { status: "active" });

    await applySubscriptionStatus(fake, {
      razorpaySubscriptionId: "sub_razorpay_1",
      status: "pending",
      lastPaymentError: "Card declined.",
    });

    const profile = fake.table("profiles").find((p) => p["id"] === USER_A)!;
    expect(profile["plan"]).toBe("pro"); // unchanged
    expect(fake.table("subscriptions")[0]!["status"]).toBe("pending");
    expect(fake.table("subscriptions")[0]!["last_payment_error"]).toBe("Card declined.");
  });

  it("is a safe no-op for an unknown subscription id (never fabricates a row)", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "free" });
    await expect(
      applySubscriptionStatus(fake, {
        razorpaySubscriptionId: "sub_does_not_exist",
        status: "active",
      }),
    ).resolves.toBeUndefined();
    const profile = fake.table("profiles").find((p) => p["id"] === USER_A)!;
    expect(profile["plan"]).toBe("free");
  });

  it("is idempotent: applying 'active' twice has the same effect as once", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "free", plan_source: "default" });
    seedSubscription(fake);

    await applySubscriptionStatus(fake, {
      razorpaySubscriptionId: "sub_razorpay_1",
      status: "active",
    });
    await applySubscriptionStatus(fake, {
      razorpaySubscriptionId: "sub_razorpay_1",
      status: "active",
    });

    const profile = fake.table("profiles").find((p) => p["id"] === USER_A)!;
    expect(profile["plan"]).toBe("pro");
    expect(fake.table("subscriptions")).toHaveLength(1);
  });
});
