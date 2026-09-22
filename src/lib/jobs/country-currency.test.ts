import { describe, expect, it } from "vitest";
import { currencyForCountry, resolveCountryCode } from "@/lib/jobs/country-currency";

describe("currencyForCountry", () => {
  it("maps common 2-letter country codes to their currency", () => {
    expect(currencyForCountry("US")).toBe("USD");
    expect(currencyForCountry("IN")).toBe("INR");
    expect(currencyForCountry("GB")).toBe("GBP");
    expect(currencyForCountry("DE")).toBe("EUR");
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(currencyForCountry("in")).toBe("INR");
    expect(currencyForCountry("  us  ")).toBe("USD");
  });

  it("maps spelled-out country names", () => {
    expect(currencyForCountry("India")).toBe("INR");
    expect(currencyForCountry("United States")).toBe("USD");
    expect(currencyForCountry("United Kingdom")).toBe("GBP");
  });

  it("returns null for missing or unrecognized countries rather than guessing", () => {
    expect(currencyForCountry(null)).toBeNull();
    expect(currencyForCountry(undefined)).toBeNull();
    expect(currencyForCountry("")).toBeNull();
    expect(currencyForCountry("Narnia")).toBeNull();
    expect(currencyForCountry("XX")).toBeNull();
  });
});

describe("resolveCountryCode", () => {
  it("passes through a recognized 2-letter code regardless of case", () => {
    expect(resolveCountryCode("in")).toBe("IN");
    expect(resolveCountryCode("US")).toBe("US");
  });

  it("resolves a spelled-out country name to its code", () => {
    expect(resolveCountryCode("India")).toBe("IN");
    expect(resolveCountryCode("united states")).toBe("US");
  });

  it("returns null for missing or unrecognized input rather than guessing a default", () => {
    expect(resolveCountryCode(null)).toBeNull();
    expect(resolveCountryCode(undefined)).toBeNull();
    expect(resolveCountryCode("")).toBeNull();
    expect(resolveCountryCode("Narnia")).toBeNull();
    expect(resolveCountryCode("XX")).toBeNull();
  });
});
