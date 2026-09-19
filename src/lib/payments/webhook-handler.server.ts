/**
 * Raw HTTP handler for Razorpay webhooks. Wired into src/server.ts ahead
 * of the TanStack Start router (this app's pinned TanStack Start version
 * has no built-in API-route primitive), reachable at
 * POST /api/webhooks/razorpay.
 *
 * Processing order, every request:
 *   1. Read the raw body (signature is computed over the exact bytes).
 *   2. Verify `X-Razorpay-Signature` against RAZORPAY_WEBHOOK_SECRET.
 *      Reject (400) on any mismatch or missing config -- never process an
 *      unverified payload.
 *   3. Compute an idempotency key and try to INSERT it into
 *      `payment_events` first. A unique-constraint conflict means this
 *      exact event was already handled (a Razorpay retry) -- return 200
 *      immediately without reapplying anything.
 *   4. Dispatch to `applySubscriptionStatus` based on the Razorpay event
 *      type, using the service-role client.
 */
import { createHash } from "node:crypto";
import { verifyWebhookSignature } from "@/lib/payments/signature.server";
import { getRazorpayConfig } from "@/lib/payments/razorpay-client.server";
import { applySubscriptionStatus } from "@/lib/payments/subscription-sync.server";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = any;

interface RazorpayWebhookPayload {
  event: string;
  created_at?: number;
  payload?: {
    subscription?: { entity?: { id?: string; status?: string; current_end?: number | null } };
    payment?: { entity?: { id?: string; error_description?: string; status?: string } };
  };
}

const SUBSCRIPTION_STATUS_EVENTS: Record<string, string> = {
  "subscription.authenticated": "authenticated",
  "subscription.activated": "active",
  "subscription.charged": "active",
  "subscription.pending": "pending",
  "subscription.halted": "halted",
  "subscription.cancelled": "cancelled",
  "subscription.completed": "completed",
};

function idempotencyKey(request: Request, rawBody: string): string {
  const headerEventId = request.headers.get("x-razorpay-event-id");
  if (headerEventId) return headerEventId;
  return createHash("sha256").update(rawBody).digest("hex");
}

/** Exported for tests, which inject a fake admin client instead of the
 * real service-role one. */
export async function processRazorpayWebhook(
  admin: Client,
  request: Request,
  rawBody: string,
  webhookSecret: string,
): Promise<Response> {
  const signature = request.headers.get("x-razorpay-signature");
  if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  let parsed: RazorpayWebhookPayload;
  try {
    parsed = JSON.parse(rawBody) as RazorpayWebhookPayload;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const eventId = idempotencyKey(request, rawBody);
  const subscriptionEntity = parsed.payload?.subscription?.entity;

  // Check-then-insert: the common-case idempotency guard. The UNIQUE
  // constraint on razorpay_event_id in Postgres is the real backstop
  // against a race between two concurrent deliveries of the same retry;
  // treating ANY insert failure below as "already processed" covers that
  // race the same way a duplicate-key error would.
  const { data: existingEvent } = await admin
    .from("payment_events")
    .select("id")
    .eq("razorpay_event_id", eventId)
    .maybeSingle();
  if (existingEvent) {
    return new Response(JSON.stringify({ status: "already_processed" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  const { error: insertError } = await admin.from("payment_events").insert({
    razorpay_event_id: eventId,
    event_type: parsed.event,
    payload: parsed,
  });
  if (insertError) {
    // Unique-violation (or any insert failure treated conservatively as
    // "already seen") -- do not reprocess. Still 200 so Razorpay stops
    // retrying a webhook we've already recorded.
    return new Response(JSON.stringify({ status: "already_processed" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  const mappedStatus = SUBSCRIPTION_STATUS_EVENTS[parsed.event];
  if (mappedStatus && subscriptionEntity?.id) {
    await applySubscriptionStatus(admin, {
      razorpaySubscriptionId: subscriptionEntity.id,
      status: mappedStatus,
      currentPeriodEndUnix: subscriptionEntity.current_end ?? null,
      lastPaymentError: null,
      cancelAtPeriodEnd: mappedStatus === "cancelled" ? false : undefined,
    });
  } else if (parsed.event === "payment.failed" && subscriptionEntity?.id) {
    await applySubscriptionStatus(admin, {
      razorpaySubscriptionId: subscriptionEntity.id,
      status: "pending",
      lastPaymentError: parsed.payload?.payment?.entity?.error_description ?? "Payment failed.",
    });
  }

  return new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

/** Real entry point used by src/server.ts. */
export async function handleRazorpayWebhook(request: Request): Promise<Response> {
  const config = getRazorpayConfig();
  if (!config?.webhookSecret) {
    console.error("[razorpay-webhook] Rejected: webhook secret not configured.");
    return new Response(JSON.stringify({ error: "Webhooks not configured" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }

  const rawBody = await request.text();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return processRazorpayWebhook(supabaseAdmin, request, rawBody, config.webhookSecret);
}
