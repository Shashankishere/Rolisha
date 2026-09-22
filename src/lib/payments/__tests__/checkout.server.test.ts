import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "@/lib/jobs/__tests__/fake-supabase";
import { seedProfile, USER_A, USER_B } from "@/lib/jobs/__tests__/fixtures";

const ORIGINAL_ENV = { ...process.env };

function setConfigEnv() {
  process.env["RAZORPAY_KEY_ID"] = "rzp_test_123";
  process.env["RAZORPAY_KEY_SECRET"] = "secret_123";
  process.env["RAZORPAY_WEBHOOK_SECRET"] = "whsec_123";
  process.env["RAZORPAY_PLAN_ID_PRO"] = "plan_pro";
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
  return {
    ...actual,
    createOrFetchCustomer: vi.fn(),
    createSubscription: vi.fn(),
  };
});

import { createOrFetchCustomer, createSubscription } from "@/lib/payments/razorpay-client.server";
import { createCheckoutSession, verifyCheckoutSession } from "@/lib/payments/checkout.server";

beforeEach(() => {
  adminFake = createFakeSupabase();
  vi.mocked(createOrFetchCustomer).mockReset();
  vi.mocked(createSubscription).mockReset();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("createCheckoutSession", () => {
  it("creates a Razorpay customer + subscription and records it locally", async () => {
    setConfigEnv();
    const userClient = createFakeSupabase();
    seedProfile(userClient, USER_A, { email: "user@example.com", full_name: "User A" });

    vi.mocked(createOrFetchCustomer).mockResolvedValue({ id: "cust_1", email: "user@example.com" });
    vi.mocked(createSubscription).mockResolvedValue({
      id: "sub_new_1",
      plan_id: "plan_pro",
      status: "created",
      current_end: null,
    });

    const session = await createCheckoutSession(userClient, USER_A, "pro");

    expect(session.razorpaySubscriptionId).toBe("sub_new_1");
    expect(session.razorpayKeyId).toBe("rzp_test_123");
    expect(adminFake.table("billing_customers")).toHaveLength(1);
    expect(adminFake.table("subscriptions")).toHaveLength(1);
    expect(adminFake.table("subscriptions")[0]).toMatchObject({
      user_id: USER_A,
      plan_tier: "pro",
      razorpay_subscription_id: "sub_new_1",
    });
  });

  it("reuses an existing billing customer instead of creating a second one", async () => {
    setConfigEnv();
    const userClient = createFakeSupabase();
    seedProfile(userClient, USER_A, { email: "user@example.com" });
    adminFake
      .table("billing_customers")
      .push({ user_id: USER_A, razorpay_customer_id: "cust_existing" });

    vi.mocked(createSubscription).mockResolvedValue({
      id: "sub_new_2",
      plan_id: "plan_pro",
      status: "created",
      current_end: null,
    });

    await createCheckoutSession(userClient, USER_A, "pro");

    expect(createOrFetchCustomer).not.toHaveBeenCalled();
    expect(adminFake.table("billing_customers")).toHaveLength(1);
  });

  it("throws an honest configuration error when Razorpay isn't configured", async () => {
    delete process.env["RAZORPAY_KEY_ID"];
    delete process.env["RAZORPAY_KEY_SECRET"];
    const userClient = createFakeSupabase();
    seedProfile(userClient, USER_A);

    await expect(createCheckoutSession(userClient, USER_A, "pro")).rejects.toThrow(/configured/i);
  });
});

describe("verifyCheckoutSession", () => {
  it("applies the plan when the signature is valid and the subscription belongs to the caller", async () => {
    setConfigEnv();
    adminFake.table("subscriptions").push({
      id: "row-1",
      user_id: USER_A,
      plan_tier: "pro",
      razorpay_subscription_id: "sub_verify_1",
      status: "created",
    });
    seedProfile(adminFake, USER_A, { plan: "free", plan_source: "default" });

    const sig = createHmac("sha256", "secret_123")
      .update("pay_1|sub_verify_1", "utf8")
      .digest("hex");
    const result = await verifyCheckoutSession(USER_A, {
      razorpayPaymentId: "pay_1",
      razorpaySubscriptionId: "sub_verify_1",
      razorpaySignature: sig,
    });

    expect(result).toEqual({ verified: true, applied: true });
    const profile = adminFake.table("profiles").find((p) => p["id"] === USER_A)!;
    expect(profile["plan"]).toBe("pro");
  });

  it("rejects an invalid signature without applying anything", async () => {
    setConfigEnv();
    adminFake.table("subscriptions").push({
      id: "row-1",
      user_id: USER_A,
      plan_tier: "pro",
      razorpay_subscription_id: "sub_verify_2",
      status: "created",
    });
    seedProfile(adminFake, USER_A, { plan: "free" });

    const result = await verifyCheckoutSession(USER_A, {
      razorpayPaymentId: "pay_1",
      razorpaySubscriptionId: "sub_verify_2",
      razorpaySignature: "not-a-real-signature",
    });

    expect(result).toEqual({ verified: false, applied: false });
    const profile = adminFake.table("profiles").find((p) => p["id"] === USER_A)!;
    expect(profile["plan"]).toBe("free");
  });

  it("refuses to apply a subscription that belongs to a different user, even with a valid signature", async () => {
    setConfigEnv();
    adminFake.table("subscriptions").push({
      id: "row-1",
      user_id: USER_B,
      plan_tier: "pro",
      razorpay_subscription_id: "sub_someone_else",
      status: "created",
    });
    seedProfile(adminFake, USER_A, { plan: "free" });
    seedProfile(adminFake, USER_B, { plan: "free" });

    const sig = createHmac("sha256", "secret_123")
      .update("pay_1|sub_someone_else", "utf8")
      .digest("hex");
    // USER_A tries to claim USER_B's subscription id.
    const result = await verifyCheckoutSession(USER_A, {
      razorpayPaymentId: "pay_1",
      razorpaySubscriptionId: "sub_someone_else",
      razorpaySignature: sig,
    });

    expect(result).toEqual({ verified: false, applied: false });
    const profileA = adminFake.table("profiles").find((p) => p["id"] === USER_A)!;
    const profileB = adminFake.table("profiles").find((p) => p["id"] === USER_B)!;
    expect(profileA["plan"]).toBe("free");
    expect(profileB["plan"]).toBe("free");
  });
});
