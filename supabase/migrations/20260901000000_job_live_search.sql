-- PHASE 3.5/4.5 — DYNAMIC ADZUNA JOB SEARCH
--
-- Supports the on-demand live-search path (dynamic-search.server.ts): when
-- a Jobs Explorer search doesn't have enough fresh matches in `public.jobs`,
-- the server calls Adzuna directly for that specific query/location/country
-- and upserts the results through the existing `ingestJobs()` pipeline
-- (same as scheduled/manual sync -- no second ingestion path).
--
-- `job_live_searches` exists purely to prevent hammering Adzuna: before
-- triggering a live search, the server checks whether the exact same
-- normalized query was searched recently and skips the call if so (falling
-- back to whatever's already in Supabase). One row per unique
-- query/location/country combination, upserted on `query_key` -- this is
-- bookkeeping, not user data, so (like `payment_events`) it has RLS enabled
-- with no policies for `authenticated` at all: service-role only.

CREATE TABLE public.job_live_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_key TEXT NOT NULL UNIQUE,
  query TEXT,
  location TEXT,
  country TEXT,
  jobs_found INT NOT NULL DEFAULT 0,
  searched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.job_live_searches TO service_role;
ALTER TABLE public.job_live_searches ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS job_live_searches_searched_at_idx ON public.job_live_searches(searched_at DESC);
