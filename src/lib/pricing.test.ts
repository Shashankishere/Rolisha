import { describe, expect, it } from "vitest";
import { formatPrice, REGION_PRICING } from "@/lib/pricing";

describe("pricing registry", () => {
  it("uses the current base INR price for Pro", () => {
    expect(REGION_PRICING.IN.pro).toBe(299);
    expect(REGION_PRICING.IN.currency).toBe("INR");
  });

  it("formats INR with no decimal places", () => {
    expect(formatPrice(299, REGION_PRICING.IN)).toBe("₹299");
    expect(formatPrice(0, REGION_PRICING.IN)).toBe("₹0");
  });

  // Rolisha is presented as an India-only product for now: the US/UK/EU
  // conversions and the pricing-page region selector that showed them have
  // been removed (see routes/pricing.tsx). This protects that regression --
  // if another region is ever reintroduced here, it should be a deliberate
  // change to this file, not an accidental one.
  it("exposes exactly one region (India) -- no other region is a selectable source of truth", () => {
    expect(Object.keys(REGION_PRICING)).toEqual(["IN"]);
    expect("US" in REGION_PRICING).toBe(false);
    expect("GB" in REGION_PRICING).toBe(false);
    expect("EU" in REGION_PRICING).toBe(false);
  });
});