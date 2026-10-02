/**
 * Centralized display-pricing registry for Rolisha.
 *
 * This is the single source of truth for what the pricing page (and any
 * other UI that needs to show a plan price) displays. India/INR is the
 * base price — the number that actually gets charged, via the Razorpay
 * plan configured server-side in `RAZORPAY_PLAN_ID_PRO`.
 *
 * Rolisha is presented as an India-only product for now: this table used
 * to also carry manually-set, approximate US/UK/EU conversions for a
 * region selector on the pricing page, but Razorpay checkout itself has
 * only ever been wired up for India/INR (international payments were
 * never actually accepted), so showing those other regions' prices only
 * invited customer confusion about what was actually purchasable. They
 * were removed along with the selector in routes/pricing.tsx. `RegionCode`
 * and `Record<RegionCode, RegionPricing>` are kept (rather than collapsing
 * to a single flat INR constant) so that re-introducing another region
 * later is a data change here, not a rewrite of the pricing page.
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

export type RegionCode = "IN";

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
