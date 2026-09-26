/**
 * The single "run an Adzuna sync" entry point for TRUSTED, non-human
 * callers: the Nitro scheduled task (native Cloudflare Cron Trigger) and
 * the secret-gated HTTP cron fallback route. Both call this function and
 * nothing else — there is exactly one automated-sync code path.
 *
 * This is deliberately separate from `ingestAdzunaJobs` (the
 * `requireSupabaseAuth` + `requireAdmin`-gated server function backing the
 * admin UI's "Sync now" button): a scheduled Cloudflare Cron Trigger has no
 * user session to authenticate, so it cannot and should not go through
 * `requireAdmin`. Trust here comes from a different source entirely —
 * either the invocation is Cloudflare's own `scheduled()` event (which has
 * no public HTTP surface at all: nothing external can trigger it) or it
 * carries a verified `CRON_SECRET` bearer token (see
 * the HTTP fallback in `src/server.ts`). Both paths funnel into the exact
 * same `ingestJobs()` used by the admin UI — no second ingestion
 * implementation exists.
 *
 * Every run is recorded in `job_sync_runs` (service-role writes, admin-only
 * reads) so failures are observable without needing to check worker logs,
 * and a failed run never touches existing job rows beyond what
 * `ingestJobs()` itself already guarantees (per-record error handling,
 * nothing deleted, demo data never overwritten by real data or vice versa).
 */
import {
  AdzunaProviderError,
  createAdzunaAdapterFromEnv,
  isAdzunaConfigured,
} from "@/lib/jobs/adzuna-adapter.server";
import { ingestJobs } from "@/lib/jobs/ingest.server";

/* eslint-disable @typescript-eslint/no-explicit-any */
type AdminClient = any;

/** How long a real (non-demo) job can go un-seen by a sync before it's
 * marked inactive. Generous on purpose -- a slow week for a given search
 * query shouldn't deactivate postings that are still genuinely open. */
const STALE_AFTER_DAYS = 14;

export interface SyncRunSummary {
  runId: string;
  status: "success" | "failed";
  fetched: number;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  deactivated: number;
  durationMs: number;
  errorMessage: string | null;
}

export interface SyncTaskParams {
  query?: string | null;
  location?: string | null;
  country?: string | null;
  maxJobs?: number | null;
  trigger?: "scheduled" | "manual" | "cron_http";
}

/** Raised when the provider returned jobs but every one failed to save. Its
 * message is composed by this module (never echoes provider/URL content). */
class SyncSaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyncSaveError";
  }
}

function safeErrorMessage(error: unknown): string {
  // AdzunaProviderError.message is already guaranteed (by
  // adzuna-adapter.server.ts) to never embed the app id/key. Anything
  // else is a generic Error whose message we also control (thrown by our
  // own code, not by echoing arbitrary provider/network internals that
  // could carry request URLs with credentials in them).
  if (error instanceof AdzunaProviderError) return `${error.code}: ${error.message}`;
  return error instanceof Error ? error.message : "Unknown sync error.";
}

/** Marks jobs from this source inactive if a live sync hasn't seen them
 * recently. Never deletes rows, never touches demo sources, never touches
 * jobs from a different provider. Returns how many were deactivated. */
async function deactivateStaleJobs(supabaseAdmin: AdminClient, sourceId: string): Promise<number> {
  const staleBefore = new Date(Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("jobs")
    .update({ is_active: false })
    .eq("source_id", sourceId)
    .eq("is_active", true)
    .lt("last_seen_at", staleBefore)
    .select("id");
  if (error) {
    // Staleness marking is a best-effort follow-up step, not the core
    // sync outcome -- log and continue rather than failing the whole run
    // over it (the fresh data ingestion above already succeeded).
    console.error(`[adzuna-sync] stale-job pass failed: ${error.message ?? "unknown error"}`);
    return 0;
  }
  return (data ?? []).length;
}

/** Default and ceiling for the automatic run's job count (the adapter has its
 * own hard cap of 100 as well). */
const DEFAULT_SYNC_MAX_JOBS = 50;

/**
 * Reads the optional `ADZUNA_SYNC_*` search-scope variables defensively.
 *
 * Platform env-var UIs routinely create BLANK variables and people mistype
 * numbers, and both used to silently cripple the sync: `Number("")` is `0`
 * (the adapter then clamps to fetching a single job) and `Number("abc")` is
 * `NaN` (the adapter's loop condition is then never true, so zero jobs are
 * fetched and the run is reported as a healthy sync with nothing new). Blank
 * or invalid values now fall back to the documented default instead.
 */
export function resolveSyncConfig(env: Record<string, string | undefined> = process.env): {
  query: string | null;
  location: string | null;
  country: string | null;
  maxJobs: number;
} {
  const text = (value: string | undefined) => (value && value.trim() ? value.trim() : null);
  const parsedMax = Number.parseInt((env["ADZUNA_SYNC_MAX_JOBS"] ?? "").trim(), 10);
  return {
    query: text(env["ADZUNA_SYNC_QUERY"]),
    location: text(env["ADZUNA_SYNC_LOCATION"]),
    country: text(env["ADZUNA_SYNC_COUNTRY"]),
    maxJobs: Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : DEFAULT_SYNC_MAX_JOBS,
  };
}

/**
 * Runs one full Adzuna sync: config check -> fetch/normalize/classify/
 * upsert (via the existing `ingestJobs` pipeline, unchanged) -> stale-job
 * pass -> status recorded to `job_sync_runs`. Never throws -- callers (the
 * scheduled task, the HTTP fallback) always get a summary back so a
 * caller-side crash can't itself look like "sync failed silently".
 */
export async function runAdzunaSyncTask(
  supabaseAdmin: AdminClient,
  params: SyncTaskParams = {},
): Promise<SyncRunSummary> {
  const startedAt = Date.now();
  const trigger = params.trigger ?? "scheduled";

  // Recording the run is best-effort observability and must never be what
  // makes the sync itself throw. `supabaseAdmin` is a lazy proxy that throws
  // synchronously when SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are missing
  // from the scheduled environment, so this is guarded as well, not just the
  // `{ error }` result.
  let runId = "unrecorded";
  try {
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("job_sync_runs")
      .insert({ provider: "adzuna", trigger, status: "running" })
      .select("id")
      .single();
    if (!insertError && inserted) runId = (inserted as { id: string }).id;
    else
      console.error(
        `[adzuna-sync] could not record run start: ${insertError?.message ?? "no row returned"}`,
      );
  } catch (error) {
    console.error(`[adzuna-sync] could not record run start: ${safeErrorMessage(error)}`);
  }

  console.log(
    `[adzuna-sync] started=true trigger=${trigger} configured=${isAdzunaConfigured()} runId=${runId}`,
  );

  if (!isAdzunaConfigured()) {
    const errorMessage =
      "Adzuna is not configured: set ADZUNA_APP_ID and ADZUNA_APP_KEY (or ADZUNA_API_KEY).";
    if (runId !== "unrecorded") {
      await supabaseAdmin
        .from("job_sync_runs")
        .update({
          status: "failed",
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);
    }
    console.error(`[adzuna-sync] failed=true reason=not_configured runId=${runId}`);
    return {
      runId,
      status: "failed",
      fetched: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      deactivated: 0,
      durationMs: Date.now() - startedAt,
      errorMessage,
    };
  }

  try {
    const envConfig = resolveSyncConfig();
    const adapter = createAdzunaAdapterFromEnv({
      query: params.query ?? envConfig.query,
      location: params.location ?? envConfig.location,
      country: params.country ?? envConfig.country,
      maxJobs: params.maxJobs ?? envConfig.maxJobs,
      // For diagnostics only (see AdzunaSearchParams.trigger) -- lets a
      // scheduled run's logs/errors be told apart from a manual one even
      // though both call this exact same function with the exact same
      // resolved config.
      trigger,
    });

    const summary = await ingestJobs(supabaseAdmin, adapter);

    // Provider returned records but NONE could be saved (database outage,
    // schema drift, revoked service key, ...). That is a failed sync, not a
    // "success with some skips": recording it as healthy would leave an admin
    // -- and the stale-job pass below -- believing the catalogue was refreshed.
    if (summary.errors.length > 0 && summary.jobsInserted + summary.jobsUpdated === 0) {
      throw new SyncSaveError(
        `None of the ${summary.jobsReceived} fetched job(s) could be saved. ` +
          `First error: ${summary.errors[0]!.message}`,
      );
    }
    if (summary.errors.length > 0) {
      // Partial failure: the run still succeeded, but say so with samples
      // (messages only -- no job content) so it is diagnosable from the logs.
      console.error(
        `[adzuna-sync] partial=true failed=${summary.errors.length} of ${summary.jobsReceived} ` +
          `samples=${JSON.stringify(summary.errors.slice(0, 3).map((e) => e.message))}`,
      );
    }

    // Only deactivate stale postings for the source this sync actually
    // covers -- look it up by slug rather than assuming an id, since
    // ingestJobs() creates/reuses it internally.
    const { data: source } = await supabaseAdmin
      .from("job_sources")
      .select("id")
      .eq("slug", adapter.sourceSlug)
      .maybeSingle();
    const deactivated = source
      ? await deactivateStaleJobs(supabaseAdmin, (source as { id: string }).id)
      : 0;

    const durationMs = Date.now() - startedAt;
    if (runId !== "unrecorded") {
      await supabaseAdmin
        .from("job_sync_runs")
        .update({
          status: "success",
          fetched_count: summary.jobsReceived,
          inserted_count: summary.jobsInserted,
          updated_count: summary.jobsUpdated,
          skipped_count: summary.jobsSkipped,
          failed_count: summary.errors.length,
          deactivated_count: deactivated,
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);
    }

    console.log(
      `[adzuna-sync] completed=true trigger=${trigger} fetched=${summary.jobsReceived} ` +
        `inserted=${summary.jobsInserted} updated=${summary.jobsUpdated} skipped=${summary.jobsSkipped} ` +
        `failed=${summary.errors.length} invalidFromProvider=${adapter.invalidRecordCount} ` +
        `deactivated=${deactivated} durationMs=${durationMs}`,
    );

    return {
      runId,
      status: "success",
      fetched: summary.jobsReceived,
      inserted: summary.jobsInserted,
      updated: summary.jobsUpdated,
      skipped: summary.jobsSkipped,
      failed: summary.errors.length,
      deactivated,
      durationMs,
      errorMessage: null,
    };
  } catch (error) {
    const errorMessage = safeErrorMessage(error);
    const durationMs = Date.now() - startedAt;
    if (runId !== "unrecorded") {
      try {
        await supabaseAdmin
          .from("job_sync_runs")
          .update({
            status: "failed",
            error_message: errorMessage,
            completed_at: new Date().toISOString(),
          })
          .eq("id", runId);
      } catch (recordError) {
        // Reporting a failure must not itself become an unhandled rejection.
        console.error(`[adzuna-sync] could not record failure: ${safeErrorMessage(recordError)}`);
      }
    }
    // Never re-throw: existing jobs are left exactly as ingestJobs() left
    // them (nothing partial gets deleted or replaced with fake data), and
    // the next scheduled run gets a clean retry.
    console.error(
      `[adzuna-sync] failed=true trigger=${trigger} durationMs=${durationMs} error="${errorMessage}"`,
    );
    return {
      runId,
      status: "failed",
      fetched: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      deactivated: 0,
      durationMs,
      errorMessage,
    };
  }
}

// ---------------------------------------------------------------------------
// Sync history (admin-only read) — extracted into its own testable function
// (rather than living inline in the createServerFn handler in
// jobs.functions.ts) for the same reason the sync runner itself is: so its
// failure-handling behavior can be unit tested directly.
// ---------------------------------------------------------------------------

export interface SyncRunView {
  id: string;
  provider: string;
  trigger: "scheduled" | "manual" | "cron_http";
  status: "running" | "success" | "failed";
  startedAt: string;
  completedAt: string | null;
  fetchedCount: number;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  deactivatedCount: number;
  errorMessage: string | null;
}

export interface SyncHistoryResult {
  /** false when the query itself failed (e.g. the `job_sync_runs` table/
   * migration isn't applied yet, or a real DB error) — distinct from
   * `runs: []` meaning "genuinely no syncs have run yet". The admin page
   * stays fully usable (Adzuna status + manual "Sync now") even when this
   * is false; only the history panel degrades. */
  available: boolean;
  runs: SyncRunView[];
  errorMessage: string | null;
}

const HISTORY_UNAVAILABLE_MESSAGE =
  "Unable to load ingestion history. Check the server configuration or database connection.";

/**
 * Admin-only: recent Adzuna sync run history (scheduled, manual, and HTTP
 * cron fallback all appear here, distinguished by `trigger`). Deliberately
 * never throws for a query failure (missing table/migration, transient DB
 * error) — `requireAdmin` still throws normally for a real authorization
 * failure, but once past that, this always resolves with a result the UI
 * can render an actionable message from, instead of taking down the whole
 * /admin/jobs page over a history panel that isn't essential to actually
 * running a sync.
 */
export async function getSyncHistory(
  supabase: AdminClient,
  userId: string,
): Promise<SyncHistoryResult> {
  const { requireAdmin } = await import("@/lib/jobs/require-admin.server");
  await requireAdmin(supabase, userId);

  try {
    const { data, error } = await supabase
      .from("job_sync_runs")
      .select("*")
      .eq("provider", "adzuna")
      .order("started_at", { ascending: false })
      .limit(10);

    if (error) {
      // Safe diagnostic only — the raw Postgres/PostgREST error message
      // (e.g. "relation \"job_sync_runs\" does not exist" if the Phase 3.5
      // migration hasn't been applied yet) is logged server-side for an
      // admin/developer to act on, never sent to the browser as-is.
      console.error(`[admin-jobs] sync history query failed: ${error.message ?? "unknown error"}`);
      return { available: false, runs: [], errorMessage: HISTORY_UNAVAILABLE_MESSAGE };
    }

    return {
      available: true,
      errorMessage: null,
      runs: ((data ?? []) as any[]).map((row) => ({
        id: row.id,
        provider: row.provider,
        trigger: row.trigger,
        status: row.status,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        fetchedCount: row.fetched_count,
        insertedCount: row.inserted_count,
        updatedCount: row.updated_count,
        skippedCount: row.skipped_count,
        failedCount: row.failed_count,
        deactivatedCount: row.deactivated_count,
        errorMessage: row.error_message,
      })),
    };
  } catch (err) {
    console.error(
      `[admin-jobs] sync history unexpected error: ${err instanceof Error ? err.message : "unknown error"}`,
    );
    return { available: false, runs: [], errorMessage: HISTORY_UNAVAILABLE_MESSAGE };
  }
}
