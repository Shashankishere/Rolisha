/**
 * Jobs Explorer — shared types between the server functions in
 * `jobs.functions.ts` and the `/jobs` route components. Kept separate from
 * `jobs/types.ts` (the ingestion contract) because this is a different
 * concern: reading/matching/saving jobs, not adapting provider data.
 */
import type { EducationLevel, MatchBreakdown, WorkMode } from "@/lib/domain";

export type JobSortOption = "best_match" | "newest" | "salary_desc" | "salary_asc";
export type ExperienceBand = "entry" | "junior" | "mid" | "senior";

export const EXPERIENCE_BAND_LABEL: Record<ExperienceBand, string> = {
  entry: "Entry",
  junior: "Junior",
  mid: "Mid",
  senior: "Senior",
};

/** Inclusive [min, max) years mapped to each band. max=null means unbounded. */
export const EXPERIENCE_BAND_YEARS: Record<ExperienceBand, { min: number; max: number | null }> = {
  entry: { min: 0, max: 1 },
  junior: { min: 1, max: 2 },
  mid: { min: 2, max: 5 },
  senior: { min: 5, max: null },
};

export interface JobFilters {
  search: string;
  careerId: string | null;
  location: string;
  workMode: WorkMode | "any";
  salaryMin: number | null;
  salaryMax: number | null;
  experience: ExperienceBand | null;
  skillIds: string[];
}

export const DEFAULT_JOB_FILTERS: JobFilters = {
  search: "",
  careerId: null,
  location: "",
  workMode: "any",
  salaryMin: null,
  salaryMax: null,
  experience: null,
  skillIds: [],
};

export interface JobSkillRef {
  id: string;
  name: string;
}

export interface JobListItem {
  id: string;
  title: string;
  company: string;
  location: string | null;
  country: string | null;
  workMode: WorkMode | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  postedAt: string | null;
  retrievedAt: string;
  isDemo: boolean;
  sourceName: string | null;
  isSaved: boolean;
  match: MatchBreakdown | null;
  matchedSkills: JobSkillRef[];
  missingSkills: JobSkillRef[];
}

export interface JobListResult {
  jobs: JobListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  /** Describes the whole ACTIVE catalogue, never the filtered page: "demo" when
   * there is no live (non-demo) active job anywhere -- i.e. no live source is
   * feeding the product yet; "live" when every active job is live; "mixed"
   * when live jobs coexist with leftover demo rows. Deliberately independent
   * of the filters so a search that matches nothing is never mistaken for a
   * missing live source. Never fabricated — derived from is_demo. */
  dataMode: "demo" | "live" | "mixed";
  /** True when best_match sorting had to cap the candidate pool before
   * scoring (see list.server.ts). Surfaced so the UI can be honest about it. */
  scoredSubsetOnly: boolean;
  /** Present only when this request triggered an on-demand Adzuna search
   * (see dynamic-search.server.ts) because Supabase didn't already have
   * enough fresh matches. Absent (undefined) when no live search was
   * attempted -- distinct from a live search that ran and found nothing. */
  liveSearch?: {
    triggered: boolean;
    jobsFound: number;
    errorMessage: string | null;
  };
}

export interface JobDetail {
  id: string;
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
  postedAt: string | null;
  retrievedAt: string;
  isDemo: boolean;
  sourceName: string | null;
  sourceUrl: string | null;
  isSaved: boolean;
  requiredSkills: JobSkillRef[];
  preferredSkills: JobSkillRef[];
  match: MatchBreakdown;
  matchedSkills: JobSkillRef[];
  missingSkills: JobSkillRef[];
  /** True when the itemized "why this job matches you" skill lists are
   * hidden behind the `advanced_job_matching` Pro gate. The overall score
   * still shows either way (needed for browsing/sorting the job list). */
  matchBreakdownLocked: boolean;
}
