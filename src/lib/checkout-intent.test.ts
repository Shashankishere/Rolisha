/**
 * Checkout-intent + pricing-CTA regressions.
 *
 * Follows the repo's existing source-reading pattern (see
 * pricing-page-copy.test.ts / marketing-copy-regressions.test.ts): the test
 * runner is Node-only with no DOM (vitest.config.ts only includes
 * `src/**\/*.test.ts`, and there is no jsdom/testing-library in this repo),
 * so client component behavior that can't be unit-tested directly is
 * asserted against its own source instead. Pure logic (the checkout guard,
 * the total_count default) is covered by real unit tests in
 * payments/__tests__/checkout.server.test.ts.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf-8");

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
}

const pricingSource = stripComments(read("src/routes/pricing.tsx"));
const checkoutButtonSource = stripComments(read("src/components/site/checkout-button.tsx"));
const authSource = stripComments(read("src/routes/auth.tsx"));
const useProCheckoutSource = stripComments(read("src/lib/payments/use-pro-checkout.ts"));

describe("pricing page reflects the signed-in user's real plan", () => {
  it("reads the same subscription-status query every other authenticated page uses", () => {
    expect(pricingSource).toContain('queryKey: ["subscription-status"]');
    expect(pricingSource).toContain("getSubscriptionStatus");
    // Public page: must not fetch plan data for a signed-out visitor.
    expect(pricingSource).toMatch(/enabled:\s*!!user/);
  });

  it("never shows 'Upgrade to Pro' as the clickable CTA for a user already on Pro", () => {
    // The Pro-user branch must be checked before the CheckoutButton branch,
    // so an already-Pro visitor never reaches the "Upgrade to Pro" button.
    const checkoutButtonIndex = pricingSource.indexOf("<CheckoutButton");
    const currentPlanIndex = pricingSource.indexOf("Current Plan");
    expect(currentPlanIndex).toBeGreaterThan(-1);
    expect(checkoutButtonIndex).toBeGreaterThan(-1);
    expect(currentPlanIndex).toBeLessThan(checkoutButtonIndex);
    expect(pricingSource).toMatch(/userPlan === "pro"/);
  });

  it("offers a way to manage the subscription instead of buying it again", () => {
    expect(pricingSource).toContain("Manage Subscription");
    expect(pricingSource).toContain('to="/settings"');
  });
});

describe("post-auth checkout intent (pricing page)", () => {
  it("declares a validated, closed-enum `checkout` search param", () => {
    expect(pricingSource).toMatch(/checkout:\s*z\.enum\(\["pro"\]\)\.optional\(\)/);
  });

  it("waits for both auth and plan to resolve before acting on checkout intent", () => {
    expect(pricingSource).toMatch(/authLoading\s*\|\|\s*!user/);
    expect(pricingSource).toMatch(/subscriptionStatus === undefined/);
  });

  it("never starts a new Pro checkout for a user who is already Pro", () => {
    expect(pricingSource).toMatch(/userPlan !== "pro"/);
  });

  it("clears the checkout intent from the URL as soon as it acts, so it can't repeat on refresh/abandon", () => {
    expect(pricingSource).toMatch(/search:\s*\{\}/);
    expect(pricingSource).toMatch(/replace:\s*true/);
  });

  it("guards the auto-checkout effect so it can only fire once per visit", () => {
    expect(pricingSource).toContain("attemptedAutoCheckout");
    expect(pricingSource).toContain("useRef(false)");
  });
});

describe("checkout button preserves intent for a signed-out visitor", () => {
  it("sends a signed-out click to /auth with both an internal redirect and the checkout intent", () => {
    expect(checkoutButtonSource).toContain('to: "/auth"');
    expect(checkoutButtonSource).toMatch(/redirect:\s*"\/pricing"/);
    expect(checkoutButtonSource).toMatch(/checkout:\s*planTier/);
  });

  it("shares the same checkout flow (useProCheckout) as the pricing page's auto-checkout", () => {
    expect(checkoutButtonSource).toContain("useProCheckout");
  });
});

describe("shared checkout flow (useProCheckout)", () => {
  it("never treats the client-side Razorpay success callback as final -- always re-verifies server-side", () => {
    expect(useProCheckoutSource).toContain("verifyCheckoutSession");
    expect(useProCheckoutSource).toContain("result.verified");
  });

  it("invalidates the same subscription-status query key the pricing page reads", () => {
    expect(useProCheckoutSource).toContain(
      'invalidateQueries({ queryKey: ["subscription-status"] })',
    );
  });
});

describe("auth flow preserves checkout intent through signup, login, and OAuth", () => {
  it("validates `checkout` as a closed enum, never an arbitrary trusted string", () => {
    expect(authSource).toMatch(/checkout:\s*z\.enum\(\["pro"\]\)\.optional\(\)/);
  });

  it("only ever redirects to internal application routes (never an arbitrary external URL)", () => {
    expect(authSource).toContain("function safePath(");
    expect(authSource).toMatch(/!value\.startsWith\("\/"\)/);
    expect(authSource).toMatch(/value\.startsWith\("\/\/"\)/);
  });

  it("carries checkout intent through email confirmation and Google OAuth redirects", () => {
    expect(authSource).toContain("function destinationUrl(");
    expect(authSource).toMatch(/emailRedirectTo:\s*destinationUrl\(\)/);
    expect(authSource).toMatch(/redirectTo:\s*destinationUrl\(\)/);
  });

  it("restores checkout intent on the final post-auth redirect (covers both signup and login)", () => {
    expect(authSource).toMatch(
      /navigate\(\{\s*\n?\s*to:\s*destination,\s*\n?\s*search:\s*search\.checkout/,
    );
  });
});
