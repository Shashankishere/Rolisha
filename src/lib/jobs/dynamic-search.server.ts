/**
 * On-demand Adzuna search for the Jobs Explorer.
 *
 * The Jobs Explorer always reads from `public.jobs` (via `listJobsCore`) —
 * this module's only job is deciding whether that read needs a fresh Adzuna
 * fetch first, and if so, running the *exact same* `ingestJobs()` pipeline
 * the scheduled sync and manual admin sync already use. There is no second
 * ingestion implementation here.
 *
 * Trigger conditions (all must hold):
 *  - The user actually typed a search term or location (an empty search has
 *    no meaningful Adzuna query, and would otherwise fire on every default
 *    page load).
 *  - Supabase doesn't already have enough fresh, active, matching jobs.
 *  - Adzuna is configured.
 *  - This exact query/location/country combination wasn't already searched
 *    live within the cooldown window (rate-limit protection — see
 *    `job_live_searches`).
 *
 * Failure handling: never throws. A failed live search just means the
 * Jobs Explorer falls back to whatever Supabase already has (which may be
 * nothing, in which case the honest "No matching jobs found" empty state
 * is what the user sees — never a fabricated result).
 */
import {
  AdzunaProviderError,
  createAdzunaAdapterFromEnv,
  isAdzunaConfigured,
} from "@/lib/jobs/adzuna-adapter.server";
import { ingestJobs } from "@/lib/jobs/ingest.server";

/* eslint-disable @typescript-eslint/no-explicit-any */
type AdminClient = any;

export const MIN_FRESH_RESULTS_BEFORE_LIVE_SEARCH = 5;
export const LIVE_SEARCH_COOLDOWN_MS = 10 * 60 * 1000;
export const LIVE_SEARCH_MAX_JOBS = 30;

export interface LiveSearchParams {
  query: string;
  location: string;
  country: string | null;
  existingMatchCount: number;
}

export interface LiveSearchOutcome {
  triggered: boolean;
  jobsFound: number;
  errorMessage: string | null;
}

function buildQueryKey(query: string, location: string, country: string | null): string {
  return `${query.trim().toLowerCase()}|${location.trim().toLowerCase()}|${(country ?? "").trim().toLowerCase()}`;
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof AdzunaProviderError) return error.message;
  return error instanceof Error ? error.message : "Live job search failed.";
}

async function recordSearch(
  supabaseAdmin: AdminClient,
  queryKey: string,
  params: LiveSearchParams,
  jobsFound: number,
): Promise<void> {
  try {
    await supabaseAdmin.from("job_live_searches").upsert(
      {
        query_key: queryKey,
        query: params.query || null,
        location: params.location || null,
        country: params.country,
        jobs_found: jobsFound,
        searched_at: new Date().toISOString(),
      },
      { onConflict: "query_key" },
    );
  } catch {
    // Best-effort bookkeeping only -- never let a failure here mask the
    // real search outcome.
  }
}

/**
 * Admin-only read of recent on-demand live searches — what users actually
 * searched that triggered a real-time Adzuna pull, distinct from the
 * scheduled/manual sync history in `job_sync_runs`. Never throws for a
 * query failure, matching the same graceful-degradation pattern as
 * `getSyncHistory` (e.g. if this migration hasn't been applied yet).
 */
export interface LiveSearchHistoryEntry {
  id: string;
  query: string | null;
  location: string | null;
  country: string | null;
  jobsFound: number;
  searchedAt: string;
}

export interface LiveSearchHistoryResult {
  available: boolean;
  entries: LiveSearchHistoryEntry[];
  errorMessage: string | null;
}

export async function getRecentLiveSearches(
  supabaseAdmin: AdminClient,
): Promise<LiveSearchHistoryResult> {
  try {
    const { data, error } = await supabaseAdmin
      .from("job_live_searches")
      .select("*")
      .order("searched_at", { ascending: false })
      .limit(10);
    if (error) {
      console.error(`[jobs-live-search] history query failed: ${error.message ?? "unknown error"}`);
      return {
        available: false,
        entries: [],
        errorMessage: "Unable to load on demand search history.",
      };
    }
    return {
      available: true,
      errorMessage: null,
      entries: ((data ?? []) as any[]).map((row) => ({
        id: row.id,
        query: row.query,
        location: row.location,
        country: row.country,
        jobsFound: row.jobs_found,
        searchedAt: row.searched_at,
      })),
    };
  } catch (err) {
    console.error(
      `[jobs-live-search] history unexpected error: ${err instanceof Error ? err.message : "unknown error"}`,
    );
    return {
      available: false,
      entries: [],
      errorMessage: "Unable to load on demand search history.",
    };
  }
}

/**
 * Decides whether an on-demand Adzuna search is warranted for this request
 * and, if so, runs it through the existing ingestion pipeline. Always
 * resolves (never throws) — callers proceed to read from Supabase either
 * way.
 */
export async function ensureFreshJobsForSearch(
  supabaseAdmin: AdminClient,
  params: LiveSearchParams,
): Promise<LiveSearchOutcome> {
  const hasQuery = params.query.trim().length > 0 || params.location.trim().length > 0;
  if (!hasQuery) return { triggered: false, jobsFound: 0, errorMessage: null };
  if (params.existingMatchCount >= MIN_FRESH_RESULTS_BEFORE_LIVE_SEARCH) {
    return { triggered: false, jobsFound: 0, errorMessage: null };
  }
  if (!isAdzunaConfigured()) return { triggered: false, jobsFound: 0, errorMessage: null };

  const queryKey = buildQueryKey(params.query, params.location, params.country);

  const { data: recent } = await supabaseAdmin
    .from("job_live_searches")
    .select("searched_at")
    .eq("query_key", queryKey)
    .maybeSingle();
  if (recent) {
    const elapsedMs =
      Date.now() - new Date((recent as { searched_at: string }).searched_at).getTime();
    if (elapsedMs < LIVE_SEARCH_COOLDOWN_MS) {
      return { triggered: false, jobsFound: 0, errorMessage: null };
    }
  }

  try {
    const adapter = createAdzunaAdapterFromEnv({
      query: params.query || null,
      location: params.location || null,
      country: params.country,
      maxJobs: LIVE_SEARCH_MAX_JOBS,
    });

    const summary = await ingestJobs(supabaseAdmin, adapter);
    await recordSearch(supabaseAdmin, queryKey, params, summary.jobsReceived);

    console.log(
      `[jobs-live-search] triggered=true query="${params.query}" location="${params.location}" ` +
        `country="${params.country ?? ""}" fetched=${summary.jobsReceived} inserted=${summary.jobsInserted} ` +
        `updated=${summary.jobsUpdated}`,
    );

    return { triggered: true, jobsFound: summary.jobsReceived, errorMessage: null };
  } catch (error) {
    const errorMessage = safeErrorMessage(error);
    console.error(
      `[jobs-live-search] failed=true query="${params.query}" location="${params.location}" error="${errorMessage}"`,
    );
    // Still record the attempt so a persistently-failing search (e.g. bad
    // credentials) doesn't retry on every page load within the cooldown
    // window -- that would defeat the rate-limit guard entirely.
    await recordSearch(supabaseAdmin, queryKey, params, 0);
    return { triggered: true, jobsFound: 0, errorMessage };
  }
}
