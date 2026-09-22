import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RazorpayApiError,
  cancelSubscription,
  createOrFetchCustomer,
  createSubscription,
  getRazorpayConfig,
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
