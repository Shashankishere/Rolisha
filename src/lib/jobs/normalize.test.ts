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

describe("normalizeJob — description cleanup", () => {
  const messy =
    "Frontend Developer Location: Onsite – Bangalore Experience: 6 years Role Overview We are seeking a seasoned Frontend Developer. Responsibilities: build UIs";

  it("splits pasted fields and sections onto their own lines", () => {
    const job = normalizeJob(rawJob({ title: "Frontend Developer", description: messy }));
    expect(job.description).toBe(
      "Location: Onsite – Bangalore\n\nRole Overview:\nWe are seeking a seasoned Frontend Developer.\n\nResponsibilities:\nbuild UIs",
    );
  });

  it("fills experience and work mode from the text when the provider gives none", () => {
    const job = normalizeJob(
      rawJob({ title: "Frontend Developer", location: "India", description: messy }),
    );
    expect(job.experienceYearsMin).toBe(6);
    expect(job.workMode).toBe("onsite");
  });

  it("never overrides provider-supplied values", () => {
    const job = normalizeJob(
      rawJob({ location: "Remote", experienceYearsMin: 2, description: messy }),
    );
    expect(job.experienceYearsMin).toBe(2);
    expect(job.workMode).toBe("remote");
  });

  it("leaves descriptions without labels alone and is idempotent", () => {
    const plain = normalizeJob(rawJob({ description: "Do data things." }));
    expect(plain.description).toBe("Do data things.");
    expect(plain.experienceYearsMin).toBeNull();
    const once = normalizeJob(rawJob({ title: "Frontend Developer", description: messy }));
    const twice = normalizeJob(
      rawJob({ title: "Frontend Developer", description: once.description }),
    );
    expect(twice.description).toBe(once.description);
  });
});