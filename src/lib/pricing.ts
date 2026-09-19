/**
 * Centralized display-pricing registry for Rolisha.
 *
 * This is the single source of truth for what the pricing page (and any
 * other UI that needs to show a plan price) displays. India/INR is the
 * base price — the number that actually gets charged, via the Razorpay
 * plan configured server-side in `RAZORPAY_PLAN_ID_PRO`. Every other
 * region here is a manually-set, approximate conversion kept in this same
 * table rather than computed from a live exchange rate, so the number
 * shown is stable rather than fluctuating with FX markets.
 *
 * Rolisha has exactly two user-facing plans, Free and Pro — there used to
 * be a third "Premium" tier above Pro with its own price here; it was
 * removed before launch and Pro's price was left exactly as it was.
 *
 * IMPORTANT: changing the INR figure here only changes what the pricing
 * page *displays*. The amount Razorpay actually charges is controlled by
 * the Razorpay plan referenced by `RAZORPAY_PLAN_ID_PRO` in the Razorpay
 * dashboard — that must be kept in sync with this file manually. See
 * docs/adzuna-sync.md-style admin notes; there is no automated
 * reconciliation between the two.
 */

export type RegionCode = "IN" | "US" | "GB" | "EU";

export interface RegionPricing {
  label: string;
  currency: string;
  locale: string;
  /** Explicit plan price for this region — deliberately hardcoded rather
   * than derived from a live/fixed exchange rate, so the figure shown is a
   * real, stable price rather than an unstable currency conversion. */
  pro: number;
}

/** Base price: Pro = INR 299/mo, unchanged by the Premium-tier removal.
 * Update here only. */
export const REGION_PRICING: Record<RegionCode, RegionPricing> = {
  IN: { label: "India (₹ INR)", currency: "INR", locale: "en-IN", pro: 299 },
  US: {
    label: "United States ($ USD)",
    currency: "USD",
    locale: "en-US",
    pro: 3.6,
  },
  GB: {
    label: "United Kingdom (£ GBP)",
    currency: "GBP",
    locale: "en-GB",
    pro: 2.9,
  },
  EU: { label: "Europe (€ EUR)", currency: "EUR", locale: "de-DE", pro: 3.3 },
};

export function formatPrice(amount: number, region: RegionPricing): string {
  const fractionDigits = region.currency === "INR" ? 0 : 2;
  return new Intl.NumberFormat(region.locale, {
    style: "currency",
    currency: region.currency,
    minimumFractionDigits: amount === 0 || amount % 1 === 0 ? 0 : fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}

/** Best-effort, client-side-only region guess from the browser's locale —
 * never authoritative, always overridable via the region selector, and
 * defaults to India (Rolisha's primary audience and the only region with
 * live Razorpay checkout today) when it can't tell. */
export function guessRegion(): RegionCode {
  if (typeof navigator === "undefined") return "IN";
  const lang = navigator.language || "";
  if (/-IN$/i.test(lang)) return "IN";
  if (/-GB$/i.test(lang)) return "GB";
  if (/-US$/i.test(lang)) return "US";
  if (/^(de|fr|es|it|nl|pt|pl)/i.test(lang)) return "EU";
  return "IN";
}
