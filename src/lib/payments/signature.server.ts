/**
 * Razorpay signs both webhooks and checkout success callbacks with
 * HMAC-SHA256. These are the only two places a "payment succeeded" claim
 * is trusted anywhere in this codebase, and both require passing this
 * verification against a *server-held* secret before anything else
 * happens -- a bare client-reported success is never sufficient (Part L /
 * Part M: "Never grant paid access solely because the browser says
 * payment succeeded").
 *
 * Uses Node's built-in crypto (available in the server runtime) and a
 * constant-time comparison so signature checking itself isn't a timing
 * side-channel.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function hmacHex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

/**
 * Verifies the `X-Razorpay-Signature` header against the *raw* request
 * body (must be the exact bytes Razorpay signed -- do not re-serialize
 * a parsed-then-stringified copy, which can reorder keys and break the
 * signature).
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader) return false;
  const expected = hmacHex(secret, rawBody);
  return safeEqual(expected, signatureHeader);
}

/**
 * Verifies the signature Razorpay Checkout returns to the browser after a
 * subscription payment, per Razorpay's documented scheme:
 * HMAC_SHA256(razorpay_payment_id + "|" + razorpay_subscription_id, key_secret).
 * This is an optional fast-path confirmation only -- the webhook remains
 * the durable source of truth (see subscription-sync.server.ts) in case
 * the browser closes before this call is made.
 */
export function verifyCheckoutSignature(params: {
  razorpayPaymentId: string;
  razorpaySubscriptionId: string;
  razorpaySignature: string;
  keySecret: string;
}): boolean {
  const payload = `${params.razorpayPaymentId}|${params.razorpaySubscriptionId}`;
  const expected = hmacHex(params.keySecret, payload);
  return safeEqual(expected, params.razorpaySignature);
}
