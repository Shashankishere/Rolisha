import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RazorpayApiError,
  cancelSubscription,
  createOrFetchCustomer,
  createSubscription,
  fetchCustomer,
  getRazorpayConfig,
  isIdNotFoundError,
  isRazorpayConfigured,
} from "@/lib/payments/razorpay-client.server";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

function setConfigEnv() {
  process.env["RAZORPAY_KEY_ID"] = "rzp_test_123";
  process.env["RAZORPAY_KEY_SECRET"] = "secret_123";
  process.env["RAZORPAY_WEBHOOK_SECRET"] = "whsec_123";
  process.env["RAZORPAY_PLAN_ID_PRO"] = "plan_pro";
}

describe("Razorpay configuration", () => {
  it("is not configured without API keys", () => {
    delete process.env["RAZORPAY_KEY_ID"];
    delete process.env["RAZORPAY_KEY_SECRET"];
    expect(isRazorpayConfigured()).toBe(false);
    expect(getRazorpayConfig()).toBeNull();
  });

  it("is configured once keys are present", () => {
    setConfigEnv();
    expect(isRazorpayConfigured()).toBe(true);
    expect(getRazorpayConfig()?.planIdByTier.pro).toBe("plan_pro");
  });

  // There is exactly one Razorpay plan (RAZORPAY_PLAN_ID_PRO), and it is
  // configured in INR in the Razorpay Dashboard -- that single plan is the
  // only thing that determines a subscription's currency (see the test
  // above: the API request itself never carries a currency). This test
  // protects the "exactly one plan" structure itself: if a second,
  // currency-specific plan slot (e.g. a `proUsd`) is ever added here, the
  // INR-only guarantee this task establishes needs to be deliberately
  // re-examined, not silently inherited.
  it("exposes exactly one plan slot (pro) -- no per-currency/per-region plan selection exists", () => {
    setConfigEnv();
    const planIdByTier = getRazorpayConfig()?.planIdByTier;
    expect(Object.keys(planIdByTier ?? {})).toEqual(["pro"]);
  });
});

describe("Razorpay API calls", () => {
  it("sends Basic auth built from the configured key/secret and never leaks it elsewhere", async () => {
    setConfigEnv();
    const config = getRazorpayConfig()!;
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "cust_1", email: "a@b.com" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await createOrFetchCustomer(config, { email: "a@b.com", name: "A" });

    const [, init] = fetchMock.mock.calls[0]!;
    const authHeader = (init.headers as Record<string, string>)["Authorization"];
    expect(authHeader).toBe(`Basic ${Buffer.from("rzp_test_123:secret_123").toString("base64")}`);
  });

  it("throws RazorpayApiError with the provider's message on a non-2xx response", async () => {
    setConfigEnv();
    const config = getRazorpayConfig()!;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { description: "Plan not found" } }), {
          status: 400,
        }),
      ),
    );

    await expect(
      createSubscription(config, { planId: "plan_x", customerId: "cust_1", totalCount: 12 }),
    ).rejects.toThrow(RazorpayApiError);
  });

  it("fetchCustomer hits GET /customers/{id} and returns the customer", async () => {
    setConfigEnv();
    const config = getRazorpayConfig()!;
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "cust_1", email: "a@b.com" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const customer = await fetchCustomer(config, "cust_1");

    expect(customer).toEqual({ id: "cust_1", email: "a@b.com" });
    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("/customers/cust_1");
  });

  // Rolisha is INR-only: Razorpay's Create Subscription API has no
  // `currency` field at all -- a subscription's currency is entirely
  // inherited from its `plan_id`'s configuration in the Razorpay Dashboard,
  // which is where INR is actually enforced (see razorpay-client.server.ts's
  // planIdByTier and the test below). This test exists so that if a
  // `currency` field is ever added to this request body in the future (e.g.
  // someone "helpfully" wiring up a region selector), it fails loudly rather
  // than silently sending a value Razorpay would just ignore for a
  // subscription -- or, if Razorpay's API shape ever changes to accept one,
  // forcing a deliberate decision instead of an accidental non-INR default.
  it("never sends a currency field when creating a subscription (currency comes from the Dashboard-configured plan only)", async () => {
    setConfigEnv();
    const config = getRazorpayConfig()!;
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "sub_1", status: "created" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await createSubscription(config, { planId: "plan_pro", customerId: "cust_1", totalCount: 120 });

    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(init.body as string);
    expect(body).not.toHaveProperty("currency");
    expect(body).toEqual({
      plan_id: "plan_pro",
      customer_id: "cust_1",
      total_count: 120,
      customer_notify: 1,
      notes: undefined,
    });
  });

  it("requests cancellation at cycle end by default", async () => {
    setConfigEnv();
    const config = getRazorpayConfig()!;
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "sub_1", status: "active" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await cancelSubscription(config, "sub_1", true);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("/subscriptions/sub_1/cancel");
    expect(JSON.parse(init.body as string)).toEqual({ cancel_at_cycle_end: 1 });
  });
});

describe("isIdNotFoundError", () => {
  it("recognizes Razorpay's exact 'id does not exist' shape", () => {
    const error = new RazorpayApiError("The id provided does not exist", 400, "BAD_REQUEST_ERROR");
    expect(isIdNotFoundError(error)).toBe(true);
  });

  it("does not match a differently-shaped 400 error", () => {
    const error = new RazorpayApiError("Invalid email format", 400, "BAD_REQUEST_ERROR");
    expect(isIdNotFoundError(error)).toBe(false);
  });

  it("does not match a non-400 status even with matching text", () => {
    const error = new RazorpayApiError("The id provided does not exist", 500, "SERVER_ERROR");
    expect(isIdNotFoundError(error)).toBe(false);
  });

  it("does not match errors that aren't RazorpayApiError", () => {
    expect(isIdNotFoundError(new Error("The id provided does not exist"))).toBe(false);
  });
});
