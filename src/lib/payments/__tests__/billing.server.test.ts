import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "@/lib/jobs/__tests__/fake-supabase";
import { seedProfile, USER_A } from "@/lib/jobs/__tests__/fixtures";

const ORIGINAL_ENV = { ...process.env };
function setConfigEnv() {
  process.env["RAZORPAY_KEY_ID"] = "rzp_test_123";
  process.env["RAZORPAY_KEY_SECRET"] = "secret_123";
}

let adminFake: ReturnType<typeof createFakeSupabase>;
vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    return adminFake;
  },
}));

vi.mock("@/lib/payments/razorpay-client.server", async () => {
  const actual = await vi.importActual<typeof import("@/lib/payments/razorpay-client.server")>(
    "@/lib/payments/razorpay-client.server",
  );
  return { ...actual, cancelSubscription: vi.fn() };
});

import { cancelSubscription as cancelViaRazorpay } from "@/lib/payments/razorpay-client.server";
import { cancelUserSubscription, getCurrentSubscription } from "@/lib/payments/billing.server";

beforeEach(() => {
  adminFake = createFakeSupabase();
  vi.mocked(cancelViaRazorpay).mockReset();
});
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

function seedActiveSubscription(fake: ReturnType<typeof createFakeSupabase>) {
  fake.table("subscriptions").push({
    id: "row-1",
    user_id: USER_A,
    plan_tier: "pro",
    razorpay_subscription_id: "sub_cancel_1",
    razorpay_plan_id: "plan_pro",
    status: "active",
    cancel_at_period_end: false,
    current_period_end: null,
    last_payment_error: null,
    created_at: new Date().toISOString(),
  });
}

describe("cancelUserSubscription", () => {
  it("cancels at cycle end by default and retains access until then", async () => {
    setConfigEnv();
    const shared = createFakeSupabase();
    adminFake = shared; // same underlying "database" as the user's RLS client, as in production
    seedProfile(shared, USER_A, { plan: "pro", plan_source: "razorpay_subscription" });
    seedActiveSubscription(shared);

    vi.mocked(cancelViaRazorpay).mockResolvedValue({
      id: "sub_cancel_1",
      plan_id: "plan_pro",
      status: "active",
      current_end: null,
    });

    const updated = await cancelUserSubscription(shared, USER_A);

    expect(cancelViaRazorpay).toHaveBeenCalledWith(expect.anything(), "sub_cancel_1", true);
    expect(updated.cancelAtPeriodEnd).toBe(true);
    const profile = shared.table("profiles").find((p) => p["id"] === USER_A)!;
    expect(profile["plan"]).toBe("pro");
  });

  it("throws when there is no active subscription to cancel", async () => {
    setConfigEnv();
    const userClient = createFakeSupabase();
    seedProfile(userClient, USER_A, { plan: "free" });

    await expect(cancelUserSubscription(userClient, USER_A)).rejects.toThrow(
      /no active subscription/i,
    );
    expect(cancelViaRazorpay).not.toHaveBeenCalled();
  });
});

describe("getCurrentSubscription", () => {
  it("returns null when the user has never subscribed", async () => {
    const userClient = createFakeSupabase();
    seedProfile(userClient, USER_A);
    await expect(getCurrentSubscription(userClient, USER_A)).resolves.toBeNull();
  });

  it("returns the most recent subscription", async () => {
    const userClient = createFakeSupabase();
    seedProfile(userClient, USER_A);
    userClient.table("subscriptions").push(
      {
        id: "old",
        user_id: USER_A,
        plan_tier: "pro",
        status: "cancelled",
        cancel_at_period_end: false,
        current_period_end: null,
        last_payment_error: null,
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "new",
        user_id: USER_A,
        plan_tier: "premium",
        status: "active",
        cancel_at_period_end: false,
        current_period_end: null,
        last_payment_error: null,
        created_at: "2026-06-01T00:00:00Z",
      },
    );

    const result = await getCurrentSubscription(userClient, USER_A);
    expect(result?.id).toBe("new");
    expect(result?.planTier).toBe("premium");
  });
});
