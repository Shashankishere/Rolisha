import { describe, expect, it } from "vitest";
import { normalizeJob } from "@/lib/jobs/normalize";
import type { RawProviderJob } from "@/lib/jobs/types";

function rawJob(overrides: Partial<RawProviderJob> = {}): RawProviderJob {
  return {
    externalId: "ext-1",
    title: "Data Analyst",
    company: "Acme",
    location: "Remote",
    country: "US",
    employmentType: null,
    salaryMin: 60000,
    salaryMax: 80000,
    salaryCurrency: null,
    description: "Do data things.",
    experienceYearsMin: null,
    educationRequirement: null,
    url: null,
    postedAt: null,
    ...overrides,
  };
}

describe("normalizeJob — salary currency", () => {
  it("keeps a currency the provider already supplied, untouched", () => {
    const job = normalizeJob(rawJob({ country: "IN", salaryCurrency: "usd" }));
    // Provider-declared currency wins even if it looks like a mismatch with
    // country — normalizeJob never overrides an explicit value.
    expect(job.salaryCurrency).toBe("USD");
  });

  it("falls back to the country mapping when no currency is supplied (Adzuna's case)", () => {
    expect(normalizeJob(rawJob({ country: "IN", salaryCurrency: null })).salaryCurrency).toBe(
      "INR",
    );
    expect(normalizeJob(rawJob({ country: "GB", salaryCurrency: null })).salaryCurrency).toBe(
      "GBP",
    );
    expect(normalizeJob(rawJob({ country: "US", salaryCurrency: null })).salaryCurrency).toBe(
      "USD",
    );
  });

  it("leaves currency null when there is no currency and no recognized country", () => {
    expect(normalizeJob(rawJob({ country: null, salaryCurrency: null })).salaryCurrency).toBeNull();
  });
});
