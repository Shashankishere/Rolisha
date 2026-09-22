import { describe, expect, it } from "vitest";
import {
  currencySymbol,
  formatSalary,
  formatSalaryRange,
  readinessStatusMessage,
  skillGapReason,
  stripMonthNumberPrefix,
} from "@/lib/domain";

describe("readinessStatusMessage", () => {
  it("returns a distinct message for each readiness band", () => {
    const messages = new Set([
      readinessStatusMessage(0),
      readinessStatusMessage(45),
      readinessStatusMessage(70),
      readinessStatusMessage(95),
    ]);
    expect(messages.size).toBe(4);
  });

  it("is monotonic at the band boundaries (30/60/85)", () => {
    expect(readinessStatusMessage(29)).not.toBe(readinessStatusMessage(30));
    expect(readinessStatusMessage(59)).not.toBe(readinessStatusMessage(60));
    expect(readinessStatusMessage(84)).not.toBe(readinessStatusMessage(85));
  });

  it("never returns an empty string for any valid score", () => {
    for (const score of [0, 1, 29, 30, 59, 60, 84, 85, 100]) {
      expect(readinessStatusMessage(score).length).toBeGreaterThan(0);
    }
  });
});

describe("skillGapReason", () => {
  it("prefers a real live job-demand percentage when available", () => {
    const reason = skillGapReason({
      importance: "medium",
      status: "missing",
      liveJobDemandPercentage: 62,
      demandPercentage: 40,
      prerequisites: ["SQL"],
      targetRole: "Data Analyst",
    });
    expect(reason).toContain("62%");
    expect(reason).toContain("live job postings");
  });

  it("falls back to the curated career demand percentage when there is no live signal", () => {
    const reason = skillGapReason({
      importance: "medium",
      status: "missing",
      liveJobDemandPercentage: null,
      demandPercentage: 55,
      targetRole: "Data Analyst",
    });
    expect(reason).toContain("55%");
    expect(reason).toContain("Data Analyst");
  });

  it("falls back to prerequisite relationships when no demand data exists", () => {
    const reason = skillGapReason({
      importance: "high",
      status: "missing",
      liveJobDemandPercentage: null,
      demandPercentage: null,
      prerequisites: ["Python", "Statistics"],
      targetRole: "Data Scientist",
    });
    expect(reason).toContain("Python, Statistics");
  });

  it("falls back to importance-based reasoning as the last resort, and never mentions data availability", () => {
    for (const importance of ["critical", "high", "medium", "nice_to_have"] as const) {
      const reason = skillGapReason({
        importance,
        status: "missing",
        liveJobDemandPercentage: null,
        demandPercentage: null,
        prerequisites: [],
        targetRole: "Backend Developer",
      });
      expect(reason.length).toBeGreaterThan(0);
      expect(reason.toLowerCase()).not.toContain("not enough");
      expect(reason.toLowerCase()).not.toContain("live job data");
    }
  });

  it("defaults to a generic role name when no target role is set", () => {
    const reason = skillGapReason({ importance: "critical", status: "missing" });
    expect(reason).toContain("your target career");
  });
});

describe("formatSalary / formatSalaryRange (India localization)", () => {
  it("formats INR amounts using lakhs-per-annum convention", () => {
    expect(formatSalary(400000, "INR")).toBe("₹4 LPA");
    expect(formatSalary(1200000, "INR")).toBe("₹12 LPA");
    expect(formatSalary(950000, "INR")).toBe("₹9.5 LPA");
  });

  it("renders an INR range in the expected '₹X LPA – ₹Y LPA' shape", () => {
    expect(formatSalaryRange(400000, 1200000, "INR")).toBe("₹4 LPA – ₹12 LPA");
    expect(formatSalaryRange(500000, 950000, "INR")).toBe("₹5 LPA – ₹9.5 LPA");
  });

  it("falls back to plain rupee formatting under one lakh instead of an odd LPA fraction", () => {
    const label = formatSalary(50000, "INR");
    expect(label).toContain("₹");
    expect(label).not.toContain("LPA");
  });

  it("never presents a USD sign for INR data, and never presents INR for USD data", () => {
    const inr = formatSalaryRange(400000, 1200000, "INR");
    expect(inr).not.toContain("$");
    const usd = formatSalaryRange(70000, 130000, "USD");
    expect(usd).not.toContain("₹");
    expect(usd).toContain("$");
  });

  it("does not invent a currency when none is known, for any region", () => {
    expect(formatSalaryRange(70000, 130000, null)).toBe("Salary currency unavailable");
    expect(formatSalaryRange(null, null, "INR")).toBe("Salary not provided");
  });

  it("still formats other regions' currencies correctly (non-India behaviour is untouched)", () => {
    expect(formatSalaryRange(45000, 75000, "GBP")).toMatch(/£/);
  });

  it("formats a EUR salary using the correct symbol, not USD or INR", () => {
    const label = formatSalaryRange(45000, 65000, "EUR");
    expect(label).toContain("€");
    expect(label).not.toContain("$");
    expect(label).not.toContain("₹");
  });

  it("renders a salary with only a minimum as a single figure, not a broken range", () => {
    expect(formatSalaryRange(600000, null, "INR")).toBe("₹6 LPA");
    expect(formatSalaryRange(70000, null, "USD")).toMatch(/^\$/);
    expect(formatSalaryRange(70000, null, "USD")).not.toContain("–");
  });

  it("renders a salary with only a maximum as a single figure, not a broken range", () => {
    expect(formatSalaryRange(null, 1000000, "INR")).toBe("₹10 LPA");
    expect(formatSalaryRange(null, 130000, "USD")).toMatch(/^\$/);
    expect(formatSalaryRange(null, 130000, "USD")).not.toContain("–");
  });

  it(
    "produces a sane live INR/LPA preview for every stage of typing a target salary " +
      "digit-by-digit (Settings' Target Salary field renders this alongside the raw " +
      "input -- never reformatting the input itself -- so this must never throw or " +
      "return something nonsensical mid-keystroke)",
    () => {
      const typedSoFar = ["5", "50", "500", "5000", "50000", "100000"];
      const previews = typedSoFar.map((digits) => formatSalary(Number(digits), "INR"));

      for (const preview of previews) {
        expect(preview).toContain("₹");
        expect(preview).not.toContain("$");
        expect(preview).not.toContain("NaN");
      }
      // Once six figures are typed it's read as an LPA amount.
      expect(previews.at(-1)).toBe("₹1 LPA");
    },
  );
});

describe("currencySymbol", () => {
  it("returns the correct symbol for common currencies", () => {
    expect(currencySymbol("INR")).toBe("₹");
    expect(currencySymbol("USD")).toBe("$");
    expect(currencySymbol("GBP")).toBe("£");
    expect(currencySymbol("EUR")).toBe("€");
  });

  it("falls back to the currency code itself for an unrecognized/invalid code rather than throwing", () => {
    expect(currencySymbol("NOTREAL")).toBe("NOTREAL");
  });
});

describe("stripMonthNumberPrefix", () => {
  it(
    "removes the redundant 'Month N: ' prefix a roadmap month's stored title " +
      "always has, for a display context that already shows the month number " +
      "another way (production regression: the roadmap page's compact " +
      "career-path stepper used to render the full string in an 80px " +
      "single-line truncated box, so every step showed 'Month 1: Fou...')",
    () => {
      expect(stripMonthNumberPrefix("Month 1: Foundations")).toBe("Foundations");
      expect(stripMonthNumberPrefix("Month 6: Applying")).toBe("Applying");
      expect(stripMonthNumberPrefix("Month 12: Interview readiness")).toBe("Interview readiness");
    },
  );

  it("leaves a title with no 'Month N:' prefix unchanged", () => {
    expect(stripMonthNumberPrefix("Foundations")).toBe("Foundations");
  });
});
