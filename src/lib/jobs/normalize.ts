/**
 * Pure normalization layer for job postings.
 *
 * Deterministic, synchronous, no network/DB access. Converts a
 * `RawProviderJob` (whatever shape a provider happens to hand back) into a
 * `NormalizedJob` that matches the existing `jobs` table columns exactly.
 */
import type { EducationLevel, WorkMode } from "@/lib/domain";
import { currencyForCountry } from "@/lib/jobs/country-currency";
import type { NormalizedJob, RawProviderJob } from "@/lib/jobs/types";

function cleanString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanRequired(value: string | null | undefined, fallback = "Untitled"): string {
  return cleanString(value) ?? fallback;
}

/** Normalizes free-text locations like "  Remote , US " -> "Remote, US". */
function normalizeLocation(value: string | null | undefined): string | null {
  const cleaned = cleanString(value);
  if (!cleaned) return null;
  return cleaned
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

function normalizeWorkMode(
  location: string | null,
  employmentHint: string | null | undefined,
): WorkMode | null {
  const haystack = `${location ?? ""} ${employmentHint ?? ""}`.toLowerCase();
  if (/\bremote\b/.test(haystack)) return "remote";
  if (/\bhybrid\b/.test(haystack)) return "hybrid";
  if (/\bon[\s-]?site\b/.test(haystack)) return "onsite";
  return null;
}

const EDUCATION_KEYWORDS: [RegExp, EducationLevel][] = [
  [/\bph\.?d\b|doctorate/i, "phd"],
  [/master'?s|\bm\.?sc\b|\bm\.?a\b|\bmba\b/i, "masters"],
  [/bachelor'?s|\bb\.?sc\b|\bb\.?a\b|undergraduate degree/i, "bachelors"],
  [/diploma/i, "diploma"],
  [/high school/i, "high_school"],
];

function normalizeEducation(value: string | null | undefined): EducationLevel | null {
  const cleaned = cleanString(value);
  if (!cleaned) return null;
  for (const [pattern, level] of EDUCATION_KEYWORDS) {
    if (pattern.test(cleaned)) return level;
  }
  return null;
}

function normalizeSalaryValue(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

function normalizeCurrency(value: string | null | undefined): string | null {
  const cleaned = cleanString(value);
  return cleaned ? cleaned.toUpperCase().slice(0, 8) : null;
}

function normalizeExperienceYears(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}

function normalizePostedAt(value: string | null | undefined): string | null {
  const cleaned = cleanString(value);
  if (!cleaned) return null;
  const parsed = new Date(cleaned);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * Converts a raw provider job into the normalized shape the `jobs` table can
 * store. Pure and deterministic: the same input always yields the same
 * output. Does not touch the network or the database, and does not attempt
 * to guess a `careerId` — that mapping is left to the caller, since it
 * requires the (DB-loaded) careers catalog.
 */
export function normalizeJob(raw: RawProviderJob): NormalizedJob {
  const location = normalizeLocation(raw.location);
  const country = cleanString(raw.country);
  // Some providers (e.g. Adzuna's free search endpoint) never return a
  // currency code. Rather than leave it null and have the UI default to a
  // hardcoded "USD"/"$", fall back to a deterministic mapping from the
  // job's own country. This never overrides a currency the provider did
  // supply, and never converts amounts — just labels them correctly.
  const salaryCurrency = normalizeCurrency(raw.salaryCurrency) ?? currencyForCountry(country);
  return {
    externalId: cleanString(raw.externalId),
    title: cleanRequired(raw.title, "Untitled role"),
    company: cleanRequired(raw.company, "Unknown company"),
    location,
    country,
    workMode: normalizeWorkMode(location, raw.employmentType),
    salaryMin: normalizeSalaryValue(raw.salaryMin),
    salaryMax: normalizeSalaryValue(raw.salaryMax),
    salaryCurrency,
    description: cleanString(raw.description),
    experienceYearsMin: normalizeExperienceYears(raw.experienceYearsMin),
    educationRequirement: normalizeEducation(raw.educationRequirement),
    sourceUrl: cleanString(raw.url),
    postedAt: normalizePostedAt(raw.postedAt),
    careerId: null,
  };
}

/**
 * Stable de-duplication key for a normalized job within one source. When a
 * provider supplies an external id, that id is authoritative (and is also
 * enforced by the DB's unique index on (source_id, external_id)). When it
 * doesn't, we fall back to a best-effort content key so the ingestion service
 * can still avoid obvious duplicates in memory — this fallback is NOT
 * enforced at the database level (see NORMALIZATION_GAPS in types.ts).
 */
export function dedupeKey(job: NormalizedJob): string {
  if (job.externalId) return `id:${job.externalId}`;
  return `content:${job.title.toLowerCase()}|${job.company.toLowerCase()}|${(job.location ?? "").toLowerCase()}`;
}
