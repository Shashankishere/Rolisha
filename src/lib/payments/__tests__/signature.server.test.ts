import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyCheckoutSignature, verifyWebhookSignature } from "@/lib/payments/signature.server";

const SECRET = "test-secret";

describe("verifyWebhookSignature", () => {
  it("accepts a correctly signed raw body", () => {
    const body = JSON.stringify({ event: "subscription.activated" });
    const sig = createHmac("sha256", SECRET).update(body, "utf8").digest("hex");
    expect(verifyWebhookSignature(body, sig, SECRET)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const body = JSON.stringify({ event: "subscription.activated" });
    const sig = createHmac("sha256", SECRET).update(body, "utf8").digest("hex");
    const tampered = JSON.stringify({ event: "subscription.cancelled" });
    expect(verifyWebhookSignature(tampered, sig, SECRET)).toBe(false);
  });

  it("rejects a missing signature header", () => {
    expect(verifyWebhookSignature("{}", null, SECRET)).toBe(false);
  });

  it("rejects a signature signed with the wrong secret", () => {
    const body = "{}";
    const sig = createHmac("sha256", "wrong-secret").update(body, "utf8").digest("hex");
    expect(verifyWebhookSignature(body, sig, SECRET)).toBe(false);
  });
});

describe("verifyCheckoutSignature", () => {
  it("accepts a correctly signed payment/subscription pair", () => {
    const paymentId = "pay_123";
    const subscriptionId = "sub_456";
    const sig = createHmac("sha256", SECRET)
      .update(`${paymentId}|${subscriptionId}`, "utf8")
      .digest("hex");
    expect(
      verifyCheckoutSignature({
        razorpayPaymentId: paymentId,
        razorpaySubscriptionId: subscriptionId,
        razorpaySignature: sig,
        keySecret: SECRET,
      }),
    ).toBe(true);
  });

  it("rejects a signature for a different subscription id (can't replay across subscriptions)", () => {
    const sig = createHmac("sha256", SECRET).update("pay_123|sub_456", "utf8").digest("hex");
    expect(
      verifyCheckoutSignature({
        razorpayPaymentId: "pay_123",
        razorpaySubscriptionId: "sub_OTHER",
        razorpaySignature: sig,
        keySecret: SECRET,
      }),
    ).toBe(false);
  });
});
