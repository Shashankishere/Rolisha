/**
 * Job Intelligence — shared types.
 *
 * These types define the provider-independent contract between a job source
 * (an "adapter") and Rolisha's normalization/ingestion pipeline. They are
 * intentionally limited to fields the existing `jobs` table can actually
 * store — see the `RawProviderJob` doc comments for fields the schema cannot
 * yet represent.
 */
import type { EducationLevel, WorkMode } from "@/lib/domain";

/**
 * What an adapter returns for a single posting, before normalization.
 * This is deliberately permissive (strings/nulls) because providers differ
 * in what they supply and how they format it — normalization is responsible
 * for turning this into something clean.
 */
export interface RawProviderJob {
  /** Provider's own identifier for this posting. Required for reliable de-duplication. */
  externalId: string;
  title: string;
  company: string;
  location?: string | null | undefined;
  /** ISO 3166-ish country name/code as supplied by the provider — not validated here. */
  country?: string | null | undefined;
  description?: string | null | undefined;
  url?: string | null | undefined;
  salaryMin?: number | null | undefined;
  salaryMax?: number | null | undefined;
  salaryCurrency?: string | null | undefined;
  /**
   * Free-text employment type (e.g. "full-time", "contract"). NOTE: the current
   * `jobs` table has no column for this. It is currently discarded during
   * normalization — see NORMALIZATION_GAPS below.
   */
  employmentType?: string | null | undefined;
  /** Minimum years of experience, if the provider states it directly. */
  experienceYearsMin?: number | null | undefined;
  /** Free-text education requirement; mapped to EducationLevel on a best-effort basis. */
  educationRequirement?: string | null | undefined;
  /** ISO 8601 date/time the posting went live, if known. */
  postedAt?: string | null | undefined;
  /**
   * Arbitrary provider metadata (raw response fragment, tags, etc). NOTE: the
   * current `jobs` table has no JSON/metadata column, so this is currently
   * discarded during normalization — see NORMALIZATION_GAPS below.
   */
  rawMetadata?: Record<string, unknown> | null | undefined;
}

/**
 * A job after normalization, shaped 1:1 to the columns the `jobs` table
 * actually has (see supabase/migrations — the CREATE TABLE public.jobs block).
 * This is the only shape the ingestion pipeline is allowed to write to the DB.
 */
export interface NormalizedJob {
  externalId: string | null;
  title: string;
  company: string;
  location: string | null;
  country: string | null;
  workMode: WorkMode | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  description: string | null;
  experienceYearsMin: number | null;
  educationRequirement: EducationLevel | null;
  sourceUrl: string | null;
  postedAt: string | null;
  /** Best-effort matched career for this posting, if the adapter/normalizer can infer one. */
  careerId: string | null;
}

/**
 * Fields Rolisha's ingestion contract can conceptually receive from a
 * provider but the current schema cannot store. Kept here as living
 * documentation rather than silently dropped — see Task 2/12 in the Job
 * Intelligence implementation notes.
 */
export const NORMALIZATION_GAPS = [
  "employmentType (full-time/part-time/contract) — no column on `jobs`",
  "rawMetadata (provider-specific JSON) — no jsonb column on `jobs`",
] as const;

/**
 * Provider-independent contract a job source must implement. Each adapter is
 * responsible only for returning raw jobs — normalization, skill extraction,
 * and persistence are handled centrally by the ingestion service so behaviour
 * stays identical across providers.
 */
export interface JobSourceAdapter {
  /** Unique, stable slug — matches `job_sources.slug`. */
  readonly sourceSlug: string;
  readonly sourceName: string;
  readonly baseUrl?: string | null;
  /** Whether jobs from this adapter should be flagged `is_demo` in the DB. */
  readonly isDemo: boolean;
  fetchJobs(): Promise<RawProviderJob[]>;
}

export interface IngestionError {
  externalId: string | null;
  message: string;
}

export interface IngestionSummary {
  sourceSlug: string;
  jobsReceived: number;
  jobsInserted: number;
  jobsUpdated: number;
  jobsSkipped: number;
  skillsExtracted: number;
  /** Postings that received a non-null `career_id` from `classifyCareer()`. */
  careersClassified: number;
  errors: IngestionError[];
}
