-- PHASE 3.5 — AUTOMATIC ADZUNA JOB INGESTION
--
-- Two additions, both required to automate ingestion safely:
--
-- 1. `jobs.last_seen_at` / `jobs.is_active` — stale-job handling. Every
--    ingestion run (manual or scheduled) stamps `last_seen_at = now()` on
--    every row it touches. A job that hasn't been seen in a live provider
--    response for a while gets marked `is_active = false` -- it is never
--    deleted, since historical postings remain useful data (past search
--    results, analytics, "this role existed" context). `last_seen_at`
--    defaults to `now()` for existing rows (a safe, conservative choice:
--    it means today's rows get a fresh 14-day grace window rather than
--    being immediately eligible for deactivation just because this
--    migration ran).
--
-- 2. `job_sync_runs` — a small observability log so "did the automatic
--    sync actually run, and what happened" is answerable without digging
--    through worker logs. Follows the same RLS convention already used by
--    `public.jobs` itself (`public.has_role(auth.uid(), 'admin')`), since
--    this is admin operational data, not per-user data.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS jobs_source_active_seen_idx
  ON public.jobs(source_id, is_active, last_seen_at);

CREATE TABLE public.job_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  trigger TEXT NOT NULL DEFAULT 'scheduled' CHECK (trigger IN ('scheduled', 'manual', 'cron_http')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  fetched_count INT NOT NULL DEFAULT 0,
  inserted_count INT NOT NULL DEFAULT 0,
  updated_count INT NOT NULL DEFAULT 0,
  skipped_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  deactivated_count INT NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Service-role only writes (the sync task always runs with the
-- service-role client, same as ingestJobs() itself); admin-only reads
-- through the existing admin-role Postgres function so the admin UI can
-- show sync history without a new app-level auth path.
GRANT ALL ON public.job_sync_runs TO service_role;
GRANT SELECT ON public.job_sync_runs TO authenticated;
ALTER TABLE public.job_sync_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin read job_sync_runs" ON public.job_sync_runs;
CREATE POLICY "admin read job_sync_runs" ON public.job_sync_runs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS job_sync_runs_provider_started_idx ON public.job_sync_runs(provider, started_at DESC);
