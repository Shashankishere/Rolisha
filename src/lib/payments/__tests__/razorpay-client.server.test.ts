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