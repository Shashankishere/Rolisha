-- Real learning system: a topic per skill (e.g. "API Design"), each with an
-- ordered set of lessons, linked to the *existing* assessments table for its
-- quiz (reuses the already-built, server-graded quiz engine instead of
-- inventing a parallel one) and per-user progress tracking so lesson
-- completion, "learning" vs "completed" status, and quiz results persist
-- across visits.

CREATE TABLE public.learning_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  why_it_matters TEXT NOT NULL,
  difficulty public.difficulty_level NOT NULL DEFAULT 'beginner',
  estimated_hours NUMERIC(4,1) NOT NULL DEFAULT 2,
  objectives TEXT[] NOT NULL DEFAULT '{}',
  common_mistakes TEXT[] NOT NULL DEFAULT '{}',
  target_level public.proficiency_level NOT NULL DEFAULT 'intermediate',
  assessment_id UUID REFERENCES public.assessments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_learning_topics_skill ON public.learning_topics(skill_id);
GRANT SELECT ON public.learning_topics TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.learning_topics TO authenticated;
GRANT ALL ON public.learning_topics TO service_role;
ALTER TABLE public.learning_topics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "learning_topics public read" ON public.learning_topics;
CREATE POLICY "learning_topics public read" ON public.learning_topics FOR SELECT USING (true);
DROP POLICY IF EXISTS "learning_topics admin write" ON public.learning_topics;
CREATE POLICY "learning_topics admin write" ON public.learning_topics FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.learning_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES public.learning_topics(id) ON DELETE CASCADE,
  sort_order INT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  example TEXT,
  practice TEXT,
  UNIQUE (topic_id, sort_order)
);
CREATE INDEX IF NOT EXISTS idx_learning_lessons_topic ON public.learning_lessons(topic_id);
GRANT SELECT ON public.learning_lessons TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.learning_lessons TO authenticated;
GRANT ALL ON public.learning_lessons TO service_role;
ALTER TABLE public.learning_lessons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "learning_lessons public read" ON public.learning_lessons;
CREATE POLICY "learning_lessons public read" ON public.learning_lessons FOR SELECT USING (true);
DROP POLICY IF EXISTS "learning_lessons admin write" ON public.learning_lessons;
CREATE POLICY "learning_lessons admin write" ON public.learning_lessons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.user_learning_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  topic_id UUID NOT NULL REFERENCES public.learning_topics(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'learning', -- 'learning' | 'completed' (no row = 'not_started')
  completed_lessons INTEGER[] NOT NULL DEFAULT '{}',
  skipped BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE (user_id, topic_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_learning_progress TO authenticated;
GRANT ALL ON public.user_learning_progress TO service_role;
ALTER TABLE public.user_learning_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own learning progress" ON public.user_learning_progress;
CREATE POLICY "own learning progress" ON public.user_learning_progress FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
