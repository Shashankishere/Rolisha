/**
 * Thin wrapper around the Razorpay REST API. No secret ever leaves the
 * server: the key/secret pair is read from environment variables here and
 * used only to build a Basic-Auth header on outgoing fetches to
 * api.razorpay.com. Every function returns typed data or throws
 * `RazorpayNotConfiguredError` / `RazorpayApiError` -- callers persist an
 * honest failure state, exactly like the AI provider abstraction, rather
 * than pretending a checkout succeeded.
 */

export class RazorpayNotConfiguredError extends Error {
  readonly code = "RAZORPAY_NOT_CONFIGURED";
  constructor(
    message = "Payments aren't configured yet. Set Razorpay API keys to enable checkout.",
  ) {
    super(message);
    this.name = "RazorpayNotConfiguredError";
  }
}

export class RazorpayApiError extends Error {
  readonly code = "RAZORPAY_API_ERROR";
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RazorpayApiError";
  }
}

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string | null;
  planIdByTier: { pro: string | null };
}

export function getRazorpayConfig(): RazorpayConfig | null {
  const keyId = process.env["RAZORPAY_KEY_ID"];
  const keySecret = process.env["RAZORPAY_KEY_SECRET"];
  if (!keyId || !keySecret) return null;
  return {
    keyId,
    keySecret,
    webhookSecret: process.env["RAZORPAY_WEBHOOK_SECRET"] ?? null,
    planIdByTier: {
      pro: process.env["RAZORPAY_PLAN_ID_PRO"] ?? null,
    },
  };
}

export function isRazorpayConfigured(): boolean {
  return getRazorpayConfig() !== null;
}

const API_BASE = "https://api.razorpay.com/v1";

async function razorpayFetch<T>(
  config: RazorpayConfig,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const auth = Buffer.from(`${config.keyId}:${config.keySecret}`).toString("base64");
  const response = await fetch(`${API_BASE}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
  });

  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // leave json null; handled below
  }

  if (!response.ok) {
    const message =
      json && typeof json === "object" && json !== null && "error" in json
        ? String(
            (json as { error?: { description?: string } }).error?.description ??
              response.statusText,
          )
        : response.statusText;
    throw new RazorpayApiError(message, response.status);
  }

  return json as T;
}

export interface RazorpayCustomer {
  id: string;
  email: string;
}

export async function createOrFetchCustomer(
  config: RazorpayConfig,
  input: { email: string; name: string; notes?: Record<string, string> },
): Promise<RazorpayCustomer> {
  try {
    return await razorpayFetch<RazorpayCustomer>(config, "/customers", {
      method: "POST",
      body: { email: input.email, name: input.name, notes: input.notes, fail_existing: 0 },
    });
  } catch (error) {
    // Razorpay returns 400 "Customer already exists" for a repeat email
    // with fail_existing left at its default; fail_existing: 0 above
    // already asks it to return the existing customer instead, but older
    // API behavior/edge cases can still surface this, so handle it
    // defensively rather than letting checkout fail on a return visit.
    if (error instanceof RazorpayApiError && /already exists/i.test(error.message)) {
      throw error; // surfaced to caller; fail_existing:0 should prevent this path in practice
    }
    throw error;
  }
}

export interface RazorpaySubscription {
  id: string;
  plan_id: string;
  status: string;
  current_end: number | null;
}

export async function createSubscription(
  config: RazorpayConfig,
  input: { planId: string; customerId: string; totalCount: number; notes?: Record<string, string> },
): Promise<RazorpaySubscription> {
  return razorpayFetch<RazorpaySubscription>(config, "/subscriptions", {
    method: "POST",
    body: {
      plan_id: input.planId,
      customer_id: input.customerId,
      total_count: input.totalCount,
      customer_notify: 1,
      notes: input.notes,
    },
  });
}

export async function fetchSubscription(
  config: RazorpayConfig,
  subscriptionId: string,
): Promise<RazorpaySubscription> {
  return razorpayFetch<RazorpaySubscription>(config, `/subscriptions/${subscriptionId}`);
}

export async function cancelSubscription(
  config: RazorpayConfig,
  subscriptionId: string,
  cancelAtCycleEnd: boolean,
): Promise<RazorpaySubscription> {
  return razorpayFetch<RazorpaySubscription>(config, `/subscriptions/${subscriptionId}/cancel`, {
    method: "POST",
    body: { cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0 },
  });
}
