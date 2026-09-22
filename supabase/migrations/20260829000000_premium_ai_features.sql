-- PHASE 3 — PREMIUM AI FEATURES
-- Persistence for the 7 Premium workflows: AI resume analysis, resume
-- optimization, interview preparation, personalized interview questions,
-- mock interviews, career-switch analysis, and AI career recommendations.
--
-- Every table follows the existing convention in this repo: a bare
-- `user_id UUID NOT NULL` (no FK to auth.users — see profiles table for
-- precedent), RLS scoped to `auth.uid() = user_id`, explicit grants to
-- `authenticated`/`service_role`, and `updated_at` triggers reusing
-- `public.update_updated_at_column()` where a row can be mutated after
-- creation.
--
-- `status` + `error_message` columns exist on every AI-generated row so a
-- failed or not-yet-configured AI call can be persisted honestly (Part D:
-- "do not fabricate AI results... show an honest configuration/error
-- state"), instead of only ever representing success.

-- ============================================================
-- 1. AI RESUME ANALYSIS
-- ============================================================
CREATE TABLE public.resume_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  target_role TEXT NOT NULL,
  resume_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  error_message TEXT,
  overall_score INT CHECK (overall_score BETWEEN 0 AND 100),
  ats_score INT CHECK (ats_score BETWEEN 0 AND 100),
  ats_notes TEXT,
  skills_detected JSONB NOT NULL DEFAULT '[]',
  missing_skills JSONB NOT NULL DEFAULT '[]',
  strengths JSONB NOT NULL DEFAULT '[]',
  weaknesses JSONB NOT NULL DEFAULT '[]',
  experience_relevance TEXT,
  education_relevance TEXT,
  keyword_coverage JSONB NOT NULL DEFAULT '[]',
  job_description_alignment TEXT,
  recommendations JSONB NOT NULL DEFAULT '[]',
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.resume_analyses TO authenticated;
GRANT ALL ON public.resume_analyses TO service_role;
ALTER TABLE public.resume_analyses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own resume_analyses" ON public.resume_analyses;
CREATE POLICY "own resume_analyses" ON public.resume_analyses
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS resume_analyses_user_idx ON public.resume_analyses(user_id, created_at DESC);

-- ============================================================
-- 2. RESUME OPTIMIZATION
-- ============================================================
CREATE TABLE public.resume_optimizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  target_role TEXT NOT NULL,
  resume_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  error_message TEXT,
  summary TEXT,
  -- Array of { sectionName, currentText, recommendedText, rationale }.
  -- Never overwrites resume_text -- CURRENT vs RECOMMENDED are always
  -- presented side by side, and nothing here mutates the user's original
  -- input. "Applying" a suggestion is a purely client-side copy action.
  sections JSONB NOT NULL DEFAULT '[]',
  keyword_improvements JSONB NOT NULL DEFAULT '[]',
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.resume_optimizations TO authenticated;
GRANT ALL ON public.resume_optimizations TO service_role;
ALTER TABLE public.resume_optimizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own resume_optimizations" ON public.resume_optimizations;
CREATE POLICY "own resume_optimizations" ON public.resume_optimizations
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS resume_optimizations_user_idx ON public.resume_optimizations(user_id, created_at DESC);

-- ============================================================
-- 3. INTERVIEW PREPARATION
-- ============================================================
CREATE TABLE public.interview_prep_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  target_role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  error_message TEXT,
  technical_topics JSONB NOT NULL DEFAULT '[]',
  behavioral_topics JSONB NOT NULL DEFAULT '[]',
  role_specific_areas JSONB NOT NULL DEFAULT '[]',
  checklist JSONB NOT NULL DEFAULT '[]',
  study_recommendations JSONB NOT NULL DEFAULT '[]',
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_prep_sessions TO authenticated;
GRANT ALL ON public.interview_prep_sessions TO service_role;
ALTER TABLE public.interview_prep_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own interview_prep_sessions" ON public.interview_prep_sessions;
CREATE POLICY "own interview_prep_sessions" ON public.interview_prep_sessions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS interview_prep_sessions_user_idx ON public.interview_prep_sessions(user_id, created_at DESC);

-- ============================================================
-- 4. PERSONALIZED INTERVIEW QUESTIONS
-- ============================================================
CREATE TABLE public.interview_question_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  target_role TEXT NOT NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  error_message TEXT,
  -- Array of { category, question, whyItMatters, evaluates, answerGuidance, prepTopic }
  questions JSONB NOT NULL DEFAULT '[]',
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_question_sets TO authenticated;
GRANT ALL ON public.interview_question_sets TO service_role;
ALTER TABLE public.interview_question_sets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own interview_question_sets" ON public.interview_question_sets;
CREATE POLICY "own interview_question_sets" ON public.interview_question_sets
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS interview_question_sets_user_idx ON public.interview_question_sets(user_id, created_at DESC);

-- ============================================================
-- 5. MOCK INTERVIEWS
-- ============================================================
CREATE TABLE public.mock_interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  target_role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed')),
  error_message TEXT,
  question_count INT NOT NULL DEFAULT 5,
  -- Overall feedback populated once the session is finished: array of
  -- { area, note } plus a short summary. Per-turn feedback lives on
  -- mock_interview_turns.
  overall_feedback JSONB NOT NULL DEFAULT '[]',
  overall_summary TEXT,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mock_interview_sessions TO authenticated;
GRANT ALL ON public.mock_interview_sessions TO service_role;
ALTER TABLE public.mock_interview_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own mock_interview_sessions" ON public.mock_interview_sessions;
CREATE POLICY "own mock_interview_sessions" ON public.mock_interview_sessions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS mock_interview_sessions_user_idx ON public.mock_interview_sessions(user_id, created_at DESC);
DROP TRIGGER IF EXISTS mock_interview_sessions_updated ON public.mock_interview_sessions;
CREATE TRIGGER mock_interview_sessions_updated
  BEFORE UPDATE ON public.mock_interview_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.mock_interview_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.mock_interview_sessions(id) ON DELETE CASCADE,
  -- Denormalized for direct RLS scoping without a join, matching the
  -- pattern used by roadmap_tasks/roadmap_months alongside their parent.
  user_id UUID NOT NULL,
  turn_index INT NOT NULL,
  category TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT,
  answered_at TIMESTAMPTZ,
  -- { quality, relevance, completeness, communication, technicalDepth,
  --   areasToImprove: string[], followUpTopics: string[] }
  feedback JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, turn_index)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mock_interview_turns TO authenticated;
GRANT ALL ON public.mock_interview_turns TO service_role;
ALTER TABLE public.mock_interview_turns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own mock_interview_turns" ON public.mock_interview_turns;
CREATE POLICY "own mock_interview_turns" ON public.mock_interview_turns
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS mock_interview_turns_session_idx ON public.mock_interview_turns(session_id, turn_index);

-- ============================================================
-- 6. CAREER-SWITCH ANALYSIS
-- ============================================================
CREATE TABLE public.career_switch_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  current_role_name TEXT NOT NULL,
  target_role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  error_message TEXT,
  transferable_skills JSONB NOT NULL DEFAULT '[]',
  missing_skills JSONB NOT NULL DEFAULT '[]',
  experience_gaps JSONB NOT NULL DEFAULT '[]',
  project_gaps JSONB NOT NULL DEFAULT '[]',
  learning_requirements JSONB NOT NULL DEFAULT '[]',
  estimated_roadmap JSONB NOT NULL DEFAULT '[]',
  recommended_projects JSONB NOT NULL DEFAULT '[]',
  job_readiness_gaps JSONB NOT NULL DEFAULT '[]',
  summary TEXT,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.career_switch_analyses TO authenticated;
GRANT ALL ON public.career_switch_analyses TO service_role;
ALTER TABLE public.career_switch_analyses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own career_switch_analyses" ON public.career_switch_analyses;
CREATE POLICY "own career_switch_analyses" ON public.career_switch_analyses
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS career_switch_analyses_user_idx ON public.career_switch_analyses(user_id, created_at DESC);

-- ============================================================
-- 7. AI CAREER RECOMMENDATIONS
-- ============================================================
CREATE TABLE public.ai_career_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  error_message TEXT,
  -- Array of { role, fitReason, missingSkills, nextSteps, roadmapDirection,
  --            suitableProjects, jobSearchDirection }
  recommended_roles JSONB NOT NULL DEFAULT '[]',
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_career_recommendations TO authenticated;
GRANT ALL ON public.ai_career_recommendations TO service_role;
ALTER TABLE public.ai_career_recommendations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own ai_career_recommendations" ON public.ai_career_recommendations;
CREATE POLICY "own ai_career_recommendations" ON public.ai_career_recommendations
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS ai_career_recommendations_user_idx ON public.ai_career_recommendations(user_id, created_at DESC);
