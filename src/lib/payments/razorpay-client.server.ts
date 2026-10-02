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
    /** Razorpay's own `error.code` from the response body (e.g.
     * `BAD_REQUEST_ERROR`), when present. Distinct from `code` above,
     * which is this error class's own fixed discriminant. */
    readonly providerCode?: string,
  ) {
    super(message);
    this.name = "RazorpayApiError";
  }
}

/**
 * Narrow, explicit check for the one condition callers are allowed to
 * silently recover from: Razorpay reporting that an id referenced in a
 * request does not exist for the configured account/mode. This is only
 * safe to interpret this way when the error comes from a call that
 * references a single id (e.g. `GET /customers/{id}`) -- a mixed-payload
 * call like subscription creation also references a plan id, so the same
 * message there wouldn't tell you *which* id is bad. Callers must only
 * use this against single-id lookups.
 */
export function isIdNotFoundError(error: unknown): boolean {
  return (
    error instanceof RazorpayApiError &&
    error.status === 400 &&
    /does not exist/i.test(error.message)
  );
}

// Rolisha is INR-only. There is deliberately exactly one plan slot (`pro`),
// pointed at the single Razorpay Dashboard plan (RAZORPAY_PLAN_ID_PRO)
// configured in INR. Razorpay's Create Subscription API has no `currency`
// parameter at all -- a subscription's currency is entirely inherited from
// its plan -- so with one INR plan and no other plan slot to select, the
// checkout/subscription-creation path cannot produce a non-INR transaction.
// Adding a second, currency-specific plan here (e.g. a `proUsd`) would be
// the point at which that guarantee needs to be revisited; see the
// "exactly one plan slot" and "never sends a currency field" tests in
// __tests__/razorpay-client.server.test.ts.
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
    const errorBody =
      json && typeof json === "object" && json !== null && "error" in json
        ? (json as { error?: { code?: string; description?: string } }).error
        : undefined;
    const message = String(errorBody?.description ?? response.statusText);
    throw new RazorpayApiError(message, response.status, errorBody?.code);
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

/**
 * Single-id lookup used to confirm a *stored* customer id is still valid
 * for the currently configured Razorpay account/mode before reusing it
 * (see checkout.server.ts). Because this call references exactly one id,
 * a resulting `isIdNotFoundError` unambiguously means "this customer id",
 * unlike the same error shape from `createSubscription`.
 */
export async function fetchCustomer(
  config: RazorpayConfig,
  customerId: string,
): Promise<RazorpayCustomer> {
  return razorpayFetch<RazorpayCustomer>(config, `/customers/${customerId}`);
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
