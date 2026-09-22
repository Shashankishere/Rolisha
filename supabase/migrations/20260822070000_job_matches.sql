-- JOB MATCHES
-- Persists the transparent scoreJobMatch() result for a user against a job,
-- so the UI can list/sort saved matches without recomputing every time.
-- Intentionally minimal: no duplication of job or skill data, just the score
-- and the two ID lists needed to render a breakdown.
CREATE TABLE public.job_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  overall_score INT NOT NULL,
  skills_score INT NOT NULL,
  experience_score INT NOT NULL,
  education_score INT NOT NULL,
  location_score INT NOT NULL,
  salary_score INT NOT NULL,
  matched_skill_ids UUID[] NOT NULL DEFAULT '{}',
  missing_skill_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_matches TO authenticated;
GRANT ALL ON public.job_matches TO service_role;

ALTER TABLE public.job_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own job_matches" ON public.job_matches;
CREATE POLICY "own job_matches" ON public.job_matches
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS job_matches_user_idx ON public.job_matches(user_id);
CREATE INDEX IF NOT EXISTS job_matches_job_idx ON public.job_matches(job_id);

DROP TRIGGER IF EXISTS job_matches_updated ON public.job_matches;
CREATE TRIGGER job_matches_updated
  BEFORE UPDATE ON public.job_matches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
