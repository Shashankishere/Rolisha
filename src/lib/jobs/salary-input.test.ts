import { describe, expect, it } from "vitest";
import { parseSalaryInputValue, salaryValueToInputText } from "./salary-input";

describe("parseSalaryInputValue", () => {
  it("parses a plain integer typed naturally", () => {
    expect(parseSalaryInputValue("50000")).toBe(50000);
  });

  it("treats an empty or whitespace-only string as no value", () => {
    expect(parseSalaryInputValue("")).toBeNull();
    expect(parseSalaryInputValue("   ")).toBeNull();
  });

  it("treats unparseable text as no value rather than NaN", () => {
    expect(parseSalaryInputValue("abc")).toBeNull();
  });

  it("treats a negative number as no value", () => {
    expect(parseSalaryInputValue("-5")).toBeNull();
  });

  it("accepts zero", () => {
    expect(parseSalaryInputValue("0")).toBe(0);
  });

  it("does not truncate or otherwise alter each digit as it's typed", () => {
    // Regression guard for the "5, 50, 500, 5000, 50000" progressive-render
    // bug: each successive prefix of the full value must parse to exactly
    // that prefix's numeric value, not something derived from re-parsing
    // an already-committed number.
    const typed = ["5", "50", "500", "5000", "50000"];
    const parsedValues = typed.map(parseSalaryInputValue);
    expect(parsedValues).toEqual([5, 50, 500, 5000, 50000]);
  });
});

describe("salaryValueToInputText", () => {
  it("renders null as an empty string", () => {
    expect(salaryValueToInputText(null)).toBe("");
  });

  it("renders a number as its plain digit string", () => {
    expect(salaryValueToInputText(50000)).toBe("50000");
  });
});

describe("parseSalaryInputValue / salaryValueToInputText round-trip", () => {
  it("round-trips values a committed filter could hold", () => {
    for (const value of [0, 5, 50000, 1000000]) {
      expect(parseSalaryInputValue(salaryValueToInputText(value))).toBe(value);
    }
  });

  it("round-trips the empty filter state", () => {
    expect(parseSalaryInputValue(salaryValueToInputText(null))).toBeNull();
  });
});
