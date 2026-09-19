import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createFakeSupabase } from "@/lib/jobs/__tests__/fake-supabase";
import { seedProfile, USER_A } from "@/lib/jobs/__tests__/fixtures";
import { processRazorpayWebhook } from "@/lib/payments/webhook-handler.server";

const SECRET = "whsec_test";

function sign(body: string): string {
  return createHmac("sha256", SECRET).update(body, "utf8").digest("hex");
}

function makeRequest(body: string, signature: string | null, eventId?: string): Request {
  const headers = new Headers();
  if (signature) headers.set("x-razorpay-signature", signature);
  if (eventId) headers.set("x-razorpay-event-id", eventId);
  return new Request("https://app.example.com/api/webhooks/razorpay", {
    method: "POST",
    headers,
    body,
  });
}

function seedSubscription(fake: ReturnType<typeof createFakeSupabase>) {
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
  });
}

describe("processRazorpayWebhook", () => {
  it("rejects a request with an invalid signature (400, nothing applied)", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "free" });
    seedSubscription(fake);
    const body = JSON.stringify({
      event: "subscription.activated",
      payload: { subscription: { entity: { id: "sub_razorpay_1", status: "active" } } },
    });

    const response = await processRazorpayWebhook(
      fake,
      makeRequest(body, "bad-signature"),
      body,
      SECRET,
    );

    expect(response.status).toBe(400);
    const profile = fake.table("profiles").find((p) => p["id"] === USER_A)!;
    expect(profile["plan"]).toBe("free");
    expect(fake.table("payment_events")).toHaveLength(0);
  });

  it("activates the plan on a validly signed subscription.activated event", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "free", plan_source: "default" });
    seedSubscription(fake);
    const body = JSON.stringify({
      event: "subscription.activated",
      payload: {
        subscription: {
          entity: { id: "sub_razorpay_1", status: "active", current_end: 1893456000 },
        },
      },
    });

    const response = await processRazorpayWebhook(
      fake,
      makeRequest(body, sign(body), "evt_1"),
      body,
      SECRET,
    );

    expect(response.status).toBe(200);
    const profile = fake.table("profiles").find((p) => p["id"] === USER_A)!;
    expect(profile["plan"]).toBe("pro");
    expect(fake.table("payment_events")).toHaveLength(1);
  });

  it("is idempotent: a retried webhook with the same event id is not reprocessed", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "free", plan_source: "default" });
    seedSubscription(fake);
    const body = JSON.stringify({
      event: "subscription.activated",
      payload: { subscription: { entity: { id: "sub_razorpay_1", status: "active" } } },
    });

    const first = await processRazorpayWebhook(
      fake,
      makeRequest(body, sign(body), "evt_dup"),
      body,
      SECRET,
    );
    // Simulate a downgrade happening in between so we can prove the retry
    // does NOT re-apply and flip it back.
    const profileRow = fake.table("profiles").find((p) => p["id"] === USER_A)!;
    profileRow["plan"] = "free";
    profileRow["plan_source"] = "default";

    const second = await processRazorpayWebhook(
      fake,
      makeRequest(body, sign(body), "evt_dup"),
      body,
      SECRET,
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ status: "already_processed" });
    // Only one event row recorded despite two deliveries.
    expect(fake.table("payment_events")).toHaveLength(1);
    // The retry must NOT have re-applied the activation over our manual change.
    const profileAfter = fake.table("profiles").find((p) => p["id"] === USER_A)!;
    expect(profileAfter["plan"]).toBe("free");
  });

  it("downgrades the plan on subscription.cancelled", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro", plan_source: "razorpay_subscription" });
    seedSubscription(fake);
    fake.table("subscriptions")[0]!["status"] = "active";
    const body = JSON.stringify({
      event: "subscription.cancelled",
      payload: { subscription: { entity: { id: "sub_razorpay_1", status: "cancelled" } } },
    });

    const response = await processRazorpayWebhook(
      fake,
      makeRequest(body, sign(body)),
      body,
      SECRET,
    );

    expect(response.status).toBe(200);
    const profile = fake.table("profiles").find((p) => p["id"] === USER_A)!;
    expect(profile["plan"]).toBe("free");
  });

  it("records a payment.failed event with the failure reason, without changing the plan", async () => {
    const fake = createFakeSupabase();
    seedProfile(fake, USER_A, { plan: "pro", plan_source: "razorpay_subscription" });
    seedSubscription(fake);
    fake.table("subscriptions")[0]!["status"] = "active";
    const body = JSON.stringify({
      event: "payment.failed",
      payload: {
        subscription: { entity: { id: "sub_razorpay_1" } },
        payment: { entity: { id: "pay_1", error_description: "Insufficient funds" } },
      },
    });

    const response = await processRazorpayWebhook(
      fake,
      makeRequest(body, sign(body)),
      body,
      SECRET,
    );

    expect(response.status).toBe(200);
    expect(fake.table("subscriptions")[0]!["last_payment_error"]).toBe("Insufficient funds");
    const profile = fake.table("profiles").find((p) => p["id"] === USER_A)!;
    expect(profile["plan"]).toBe("pro"); // access retained during retry window
  });
});
