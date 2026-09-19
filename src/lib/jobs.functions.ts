import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MatchBreakdown } from "@/lib/domain";
import type { JobDetail, JobListResult } from "@/lib/jobs/explorer-types";

const rawProviderJobSchema = z.object({
  externalId: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(200),
  company: z.string().trim().min(1).max(200),
  location: z.string().trim().max(200).nullable().optional(),
  country: z.string().trim().max(80).nullable().optional(),
  description: z.string().trim().max(20_000).nullable().optional(),
  url: z.string().trim().url().max(500).nullable().optional(),
  salaryMin: z.number().min(0).max(10_000_000).nullable().optional(),
  salaryMax: z.number().min(0).max(10_000_000).nullable().optional(),
  salaryCurrency: z.string().trim().max(8).nullable().optional(),
  employmentType: z.string().trim().max(60).nullable().optional(),
  experienceYearsMin: z.number().min(0).max(50).nullable().optional(),
  educationRequirement: z.string().trim().max(120).nullable().optional(),
  postedAt: z.string().trim().max(40).nullable().optional(),
});

const ingestManualJobsSchema = z.object({
  sourceSlug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens only."),
  sourceName: z.string().trim().min(2).max(120),
  baseUrl: z.string().trim().url().max(300).nullable().optional(),
  jobs: z.array(rawProviderJobSchema).min(1).max(200),
});

/**
 * Admin-only: ingests a batch of real, admin-supplied job postings through
 * the provider-independent pipeline (normalize -> upsert -> extract skills).
 * No live external provider is connected yet — this is the on-ramp for one
 * (a curated/manual source) while that integration is pending.
 */
export const ingestManualJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => ingestManualJobsSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/jobs/require-admin.server");
    await requireAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ManualJobSourceAdapter } = await import("@/lib/jobs/manual-adapter");
    const { ingestJobs } = await import("@/lib/jobs/ingest.server");

    const adapter = new ManualJobSourceAdapter({
      sourceSlug: data.sourceSlug,
      sourceName: data.sourceName,
      baseUrl: data.baseUrl ?? null,
      jobs: data.jobs,
    });

    return ingestJobs(supabaseAdmin, adapter);
  });

/**
 * Admin-only: reports whether the Adzuna provider has server-side credentials
 * configured, without revealing the credentials themselves. Used by the
 * admin ingestion UI to show "Configured" / "Not configured".
 */
export const getAdzunaStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({ context }): Promise<{ configured: boolean; scheduleLabel: "daily" | "hourly" }> => {
      const { requireAdmin } = await import("@/lib/jobs/require-admin.server");
      await requireAdmin(context.supabase, context.userId);

      const { isAdzunaConfigured } = await import("@/lib/jobs/adzuna-adapter.server");
      // Not a secret — just which cron expression this deployment was built
      // with (see vite.config.ts). Shown so an admin can tell "automatic
      // sync is configured to run daily/hourly" without reading deploy logs.
      const scheduleLabel =
        (process.env["ADZUNA_SYNC_SCHEDULE"] ?? "daily").toLowerCase() === "hourly"
          ? "hourly"
          : "daily";
      return { configured: isAdzunaConfigured(), scheduleLabel };
    },
  );

const ingestAdzunaJobsSchema = z.object({
  query: z.string().trim().max(200).optional(),
  location: z.string().trim().max(200).optional(),
  country: z
    .string()
    .trim()
    .regex(/^[a-zA-Z]{2}$/, "Use a 2-letter country code, e.g. us, gb, in.")
    .optional(),
  maxJobs: z.number().int().min(1).max(50).optional(),
});

/**
 * Admin-only: live ingestion from the Adzuna API through the same
 * provider-independent pipeline as `ingestManualJobs` (normalize -> classify
 * -> upsert -> extract skills). Credentials never leave the server — see
 * `adzuna-adapter.server.ts`.
 */
/**
 * Admin-only: removes seeded demo jobs (`is_demo = true`) once real Adzuna
 * data is confirmed present. Refuses to run (returns `skipped: true`) if no
 * live jobs exist yet, rather than silently emptying the Jobs Explorer.
 */
export const cleanupDemoJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("@/lib/jobs/require-admin.server");
    await requireAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { removeDemoJobs } = await import("@/lib/jobs/ingest.server");
    return removeDemoJobs(supabaseAdmin);
  });

export const ingestAdzunaJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => ingestAdzunaJobsSchema.parse(data ?? {}))
  .handler(async ({ context, data }) => {
    const { requireAdmin } = await import("@/lib/jobs/require-admin.server");
    await requireAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runAdzunaSyncTask } = await import("@/lib/jobs/adzuna-sync-task.server");

    // Manual "Sync now" and the automatic scheduled/HTTP-cron sync now
    // share the exact same runner (runAdzunaSyncTask -> ingestJobs) — this
    // is just the "manual" trigger label on the same underlying pipeline,
    // so status recording, stale-job handling, and logging behave
    // identically no matter what kicked the sync off.
    const summary = await runAdzunaSyncTask(supabaseAdmin, {
      query: data.query ?? null,
      location: data.location ?? null,
      country: data.country ?? null,
      maxJobs: data.maxJobs ?? null,
      trigger: "manual",
    });

    if (summary.status === "failed") {
      throw new Error(summary.errorMessage ?? "Adzuna sync failed.");
    }
    return summary;
  });

export type { SyncHistoryResult, SyncRunView } from "@/lib/jobs/adzuna-sync-task.server";

/**
 * Admin-only: recent Adzuna sync run history (scheduled, manual, and HTTP
 * cron fallback all appear here, distinguished by `trigger`) so an admin
 * can see whether automatic sync is actually running without needing
 * worker-log access.
 *
 * Deliberately never throws for a query failure (missing table/migration,
 * transient DB error) — `requireAdmin` still throws normally for a real
 * authorization failure, but once past that, this always resolves with a
 * result the UI can render an actionable message from, instead of taking
 * down the whole /admin/jobs page over a history panel that isn't
 * essential to actually running a sync. See `getSyncHistory` in
 * `adzuna-sync-task.server.ts` for the actual (unit-tested) logic.
 */
export const getAdzunaSyncRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getSyncHistory } = await import("@/lib/jobs/adzuna-sync-task.server");
    return getSyncHistory(context.supabase, context.userId);
  });

/**
 * Admin-only: recent on-demand live searches (what users actually searched
 * that triggered a real-time Adzuna pull), distinct from the scheduled/
 * manual sync history above. See `dynamic-search.server.ts`.
 */
export const getLiveSearchHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("@/lib/jobs/require-admin.server");
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getRecentLiveSearches } = await import("@/lib/jobs/dynamic-search.server");
    return getRecentLiveSearches(supabaseAdmin);
  });

const experienceBandSchema = z.enum(["entry", "junior", "mid", "senior"]);
const jobSortSchema = z.enum(["best_match", "newest", "salary_desc", "salary_asc"]);
const workModeFilterSchema = z.enum(["remote", "hybrid", "onsite", "any"]);

const listJobsSchema = z.object({
  search: z.string().trim().max(200).optional(),
  careerId: z.string().uuid().nullable().optional(),
  location: z.string().trim().max(200).optional(),
  workMode: workModeFilterSchema.optional(),
  salaryMin: z.number().min(0).max(10_000_000).nullable().optional(),
  salaryMax: z.number().min(0).max(10_000_000).nullable().optional(),
  experience: experienceBandSchema.nullable().optional(),
  skillIds: z.array(z.string().uuid()).max(20).optional(),
  sort: jobSortSchema.optional(),
  page: z.number().int().min(1).max(1000).optional(),
  pageSize: z.number().int().min(1).max(50).optional(),
});

/**
 * Jobs Explorer listing: search + filters + sort, real server-side pagination.
 * Authenticated because match% and saved-state are per-user — see list.server.ts
 * for how "Best Match" sort is handled without pushing user profile data into SQL.
 */
export const listJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => listJobsSchema.parse(data ?? {}))
  .handler(async ({ context, data }): Promise<JobListResult> => {
    // GET server functions are ordinary GET requests at the HTTP level, and
    // this response is per-user (match scores, saved state) and depends on
    // data that can change from one request to the next (live Adzuna
    // ingestion, a just-updated salary) -- it must never be served from a
    // shared browser/proxy/edge cache. React Query's own `staleTime`
    // already governs when the CLIENT chooses to reuse a response; this
    // header only prevents something in between (a CDN edge cache on the
    // Cloudflare Worker this app deploys to, a browser's HTTP cache) from
    // handing back a stale one on top of that -- it never asks React Query
    // to skip its own cache.
    setResponseHeader("Cache-Control", "private, no-store");
    const { listJobsCore } = await import("@/lib/jobs/list.server");

    const filters = {
      search: data.search ?? "",
      careerId: data.careerId ?? null,
      location: data.location ?? "",
      workMode: data.workMode ?? "any",
      salaryMin: data.salaryMin ?? null,
      salaryMax: data.salaryMax ?? null,
      experience: data.experience ?? null,
      skillIds: data.skillIds ?? [],
    };
    const sort = data.sort ?? "newest";
    const page = data.page ?? 1;
    const pageSize = data.pageSize ?? 12;

    let result = await listJobsCore(
      context.supabase,
      context.userId,
      filters,
      sort,
      page,
      pageSize,
    );

    // Only worth considering a live Adzuna search when the user actually
    // typed something specific -- an empty/default search has no
    // meaningful Adzuna query and would otherwise fire on every visit to
    // the Jobs Explorer. `ensureFreshJobsForSearch` makes the rest of the
    // "is this actually warranted" decision (enough fresh matches already?
    // configured? rate-limited?) internally.
    const hasSearchIntent = filters.search.trim().length > 0 || filters.location.trim().length > 0;
    if (hasSearchIntent) {
      const { ensureFreshJobsForSearch } = await import("@/lib/jobs/dynamic-search.server");
      const { resolveCountryCode } = await import("@/lib/jobs/country-currency");
      const { loadProfile } = await import("@/lib/me.server");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // Adzuna requires a country code; fall back to this product's
      // primary market (see pricing.tsx's own India-first default) rather
      // than guessing something unrelated to the user.
      const profile = await loadProfile(context.supabase, context.userId).catch(() => null);
      const country = resolveCountryCode(profile?.country) ?? "in";

      const outcome = await ensureFreshJobsForSearch(supabaseAdmin, {
        query: filters.search,
        location: filters.location,
        country,
        existingMatchCount: result.total,
      });

      if (outcome.triggered && outcome.jobsFound > 0) {
        // Re-read from Supabase (RLS-scoped client, respecting the user's
        // own plan-based visibility limits) now that the live search may
        // have added fresh rows.
        result = await listJobsCore(
          context.supabase,
          context.userId,
          filters,
          sort,
          page,
          pageSize,
        );
      }
      result = { ...result, liveSearch: outcome };
    }

    return result;
  });

const jobIdSchema = z.object({ jobId: z.string().uuid() });

/** Full job detail for `/jobs/$jobId`: description, required/preferred skills, match breakdown. */
export const getJobDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => jobIdSchema.parse(data))
  .handler(async ({ context, data }): Promise<JobDetail | null> => {
    // See the matching comment on `listJobs` above -- same reasoning
    // applies here (per-user match/saved state, and the job's own salary
    // can be updated by a live/scheduled sync at any time).
    setResponseHeader("Cache-Control", "private, no-store");
    const { loadJobDetailCore } = await import("@/lib/jobs/list.server");
    const { getUserPlan } = await import("@/lib/subscription.server");
    const plan = await getUserPlan(context.supabase, context.userId);
    return loadJobDetailCore(context.supabase, context.userId, data.jobId, plan);
  });

/** Saves a job for the current user (idempotent). */
export const saveJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => jobIdSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { saveJobCore } = await import("@/lib/jobs/saved-jobs.server");
    return saveJobCore(context.supabase, context.userId, data.jobId);
  });

/** Unsaves a job for the current user. */
export const unsaveJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => jobIdSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { unsaveJobCore } = await import("@/lib/jobs/saved-jobs.server");
    return unsaveJobCore(context.supabase, context.userId, data.jobId);
  });

const addMissingSkillsSchema = z.object({
  jobId: z.string().uuid(),
  skillIds: z.array(z.string().uuid()).min(1).max(20),
});

/**
 * Adds a job's missing skill(s) to the user's active roadmap. New logic (see
 * roadmap-add.server.ts) — does not regenerate the roadmap or touch scoreJobMatch.
 */
export const addMissingSkillsToRoadmap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => addMissingSkillsSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { addMissingSkillsToRoadmap: addSkills } = await import("@/lib/jobs/roadmap-add.server");
    return addSkills(context.supabase, context.userId, data.jobId, data.skillIds);
  });

/** Computes the current user's match for a job without persisting it. */
export const getJobMatch = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => jobIdSchema.parse(data))
  .handler(async ({ context, data }): Promise<MatchBreakdown & { jobId: string }> => {
    const { calculateJobMatch } = await import("@/lib/jobs/match.server");
    return calculateJobMatch(context.supabase, context.userId, data.jobId);
  });

/** Computes and saves the current user's match for a job. */
export const saveJobMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => jobIdSchema.parse(data))
  .handler(async ({ context, data }): Promise<MatchBreakdown & { jobId: string }> => {
    const { saveJobMatch: persist } = await import("@/lib/jobs/match.server");
    return persist(context.supabase, context.userId, data.jobId);
  });
