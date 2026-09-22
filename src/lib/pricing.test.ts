import { afterEach, describe, expect, it, vi } from "vitest";
import { formatPrice, guessRegion, REGION_PRICING } from "@/lib/pricing";

describe("pricing registry", () => {
  it("uses the current base INR price for Pro", () => {
    expect(REGION_PRICING.IN.pro).toBe(299);
    expect(REGION_PRICING.IN.currency).toBe("INR");
  });

  it("keeps every other region as an explicit, distinct manual conversion (never the raw INR number)", () => {
    for (const code of ["US", "GB", "EU"] as const) {
      const region = REGION_PRICING[code];
      expect(region.currency).not.toBe("INR");
      expect(region.pro).not.toBe(REGION_PRICING.IN.pro);
    }
  });

  it("formats INR with no decimal places", () => {
    expect(formatPrice(299, REGION_PRICING.IN)).toBe("₹299");
    expect(formatPrice(0, REGION_PRICING.IN)).toBe("₹0");
  });

  it("formats a non-whole-number USD price with cents", () => {
    expect(formatPrice(REGION_PRICING.US.pro, REGION_PRICING.US)).toBe("$3.60");
  });

  it("defaults to India when the locale can't be mapped to a known region", () => {
    vi.stubGlobal("navigator", { language: "xx-ZZ" });
    expect(guessRegion()).toBe("IN");
  });

  it("still resolves an Indian browser locale to India", () => {
    vi.stubGlobal("navigator", { language: "en-IN" });
    expect(guessRegion()).toBe("IN");
  });

  it("lists India first, so it's also first in the currency selector", () => {
    expect(Object.keys(REGION_PRICING)[0]).toBe("IN");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });
});
