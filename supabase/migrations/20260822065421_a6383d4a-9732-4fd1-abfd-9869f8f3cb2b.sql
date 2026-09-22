
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');
CREATE TYPE public.proficiency_level AS ENUM ('none','beginner','intermediate','advanced','expert');
CREATE TYPE public.skill_importance AS ENUM ('nice_to_have','medium','high','critical');
CREATE TYPE public.experience_level AS ENUM ('none','lt_1','1_2','2_5','5_plus');
CREATE TYPE public.education_level AS ENUM ('high_school','diploma','bachelors','masters','phd','other');
CREATE TYPE public.work_mode AS ENUM ('remote','hybrid','onsite','any');
CREATE TYPE public.application_status AS ENUM ('saved','applied','interview','offer','rejected');
CREATE TYPE public.resource_type AS ENUM ('documentation','course','video','book','practice','project');
CREATE TYPE public.difficulty_level AS ENUM ('beginner','intermediate','advanced');
CREATE TYPE public.plan_tier AS ENUM ('free','pro','premium');

-- SHARED TRIGGER
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  target_role TEXT,
  career_id UUID,
  education_level public.education_level,
  degree TEXT,
  field_of_study TEXT,
  graduation_year INT,
  experience public.experience_level DEFAULT 'none',
  hours_per_week INT DEFAULT 10 CHECK (hours_per_week BETWEEN 1 AND 40),
  salary_currency TEXT DEFAULT 'USD',
  salary_min NUMERIC,
  salary_target NUMERIC,
  country TEXT,
  city TEXT,
  work_mode public.work_mode DEFAULT 'any',
  learning_style TEXT,
  plan public.plan_tier NOT NULL DEFAULT 'free',
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS profiles_updated ON public.profiles;
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

DROP POLICY IF EXISTS "own profile read" ON public.profiles;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "own profile insert" ON public.profiles;
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "own profile update" ON public.profiles;
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "own roles read" ON public.user_roles;
CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- new user handler
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'), NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- SKILLS CATALOG
CREATE TABLE public.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.skills TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.skills TO authenticated;
GRANT ALL ON public.skills TO service_role;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "skills public read" ON public.skills;
CREATE POLICY "skills public read" ON public.skills FOR SELECT USING (true);
DROP POLICY IF EXISTS "skills admin write" ON public.skills;
CREATE POLICY "skills admin write" ON public.skills FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP TRIGGER IF EXISTS skills_updated ON public.skills;
CREATE TRIGGER skills_updated BEFORE UPDATE ON public.skills FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS skills_aliases_idx ON public.skills USING GIN (aliases);

-- CAREERS
CREATE TABLE public.careers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  short_description TEXT,
  description TEXT,
  seo_title TEXT,
  seo_description TEXT,
  typical_salary_min NUMERIC,
  typical_salary_max NUMERIC,
  salary_currency TEXT DEFAULT 'USD',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.careers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.careers TO authenticated;
GRANT ALL ON public.careers TO service_role;
ALTER TABLE public.careers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "careers public read" ON public.careers;
CREATE POLICY "careers public read" ON public.careers FOR SELECT USING (true);
DROP POLICY IF EXISTS "careers admin write" ON public.careers;
CREATE POLICY "careers admin write" ON public.careers FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP TRIGGER IF EXISTS careers_updated ON public.careers;
CREATE TRIGGER careers_updated BEFORE UPDATE ON public.careers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.profiles ADD CONSTRAINT profiles_career_fk FOREIGN KEY (career_id) REFERENCES public.careers(id) ON DELETE SET NULL;

CREATE TABLE public.career_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  career_id UUID NOT NULL REFERENCES public.careers(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  importance public.skill_importance NOT NULL DEFAULT 'medium',
  required_level public.proficiency_level NOT NULL DEFAULT 'intermediate',
  demand_percentage INT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (career_id, skill_id)
);
GRANT SELECT ON public.career_skills TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.career_skills TO authenticated;
GRANT ALL ON public.career_skills TO service_role;
ALTER TABLE public.career_skills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "career_skills public read" ON public.career_skills;
CREATE POLICY "career_skills public read" ON public.career_skills FOR SELECT USING (true);
DROP POLICY IF EXISTS "career_skills admin write" ON public.career_skills;
CREATE POLICY "career_skills admin write" ON public.career_skills FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS career_skills_career_idx ON public.career_skills(career_id);

-- USER SKILLS
CREATE TABLE public.user_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  skill_id UUID REFERENCES public.skills(id) ON DELETE CASCADE,
  custom_skill_name TEXT,
  level public.proficiency_level NOT NULL DEFAULT 'beginner',
  source TEXT NOT NULL DEFAULT 'self_reported',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_skills TO authenticated;
GRANT ALL ON public.user_skills TO service_role;
ALTER TABLE public.user_skills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own user_skills" ON public.user_skills;
CREATE POLICY "own user_skills" ON public.user_skills FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE UNIQUE INDEX IF NOT EXISTS user_skills_unique_skill ON public.user_skills(user_id, skill_id) WHERE skill_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS user_skills_user_idx ON public.user_skills(user_id);
DROP TRIGGER IF EXISTS user_skills_updated ON public.user_skills;
CREATE TRIGGER user_skills_updated BEFORE UPDATE ON public.user_skills FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- JOB SOURCES + JOBS
CREATE TABLE public.job_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  adapter TEXT NOT NULL DEFAULT 'manual',
  base_url TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  is_demo BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.job_sources TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.job_sources TO authenticated;
GRANT ALL ON public.job_sources TO service_role;
ALTER TABLE public.job_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "job_sources public read" ON public.job_sources;
CREATE POLICY "job_sources public read" ON public.job_sources FOR SELECT USING (true);
DROP POLICY IF EXISTS "job_sources admin write" ON public.job_sources;
CREATE POLICY "job_sources admin write" ON public.job_sources FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES public.job_sources(id) ON DELETE SET NULL,
  external_id TEXT,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  country TEXT,
  work_mode public.work_mode DEFAULT 'onsite',
  salary_min NUMERIC,
  salary_max NUMERIC,
  salary_currency TEXT,
  description TEXT,
  experience_years_min INT,
  education_requirement public.education_level,
  career_id UUID REFERENCES public.careers(id) ON DELETE SET NULL,
  source_url TEXT,
  posted_at TIMESTAMPTZ,
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_demo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.jobs TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "jobs public read" ON public.jobs;
CREATE POLICY "jobs public read" ON public.jobs FOR SELECT USING (true);
DROP POLICY IF EXISTS "jobs admin write" ON public.jobs;
CREATE POLICY "jobs admin write" ON public.jobs FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS jobs_career_idx ON public.jobs(career_id);
CREATE UNIQUE INDEX IF NOT EXISTS jobs_source_external_idx ON public.jobs(source_id, external_id) WHERE external_id IS NOT NULL;
DROP TRIGGER IF EXISTS jobs_updated ON public.jobs;
CREATE TRIGGER jobs_updated BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.job_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  is_required BOOLEAN NOT NULL DEFAULT true,
  raw_text TEXT,
  UNIQUE (job_id, skill_id)
);
GRANT SELECT ON public.job_skills TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.job_skills TO authenticated;
GRANT ALL ON public.job_skills TO service_role;
ALTER TABLE public.job_skills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "job_skills public read" ON public.job_skills;
CREATE POLICY "job_skills public read" ON public.job_skills FOR SELECT USING (true);
DROP POLICY IF EXISTS "job_skills admin write" ON public.job_skills;
CREATE POLICY "job_skills admin write" ON public.job_skills FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS job_skills_job_idx ON public.job_skills(job_id);

-- ROADMAPS
CREATE TABLE public.roadmaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  career_id UUID REFERENCES public.careers(id) ON DELETE SET NULL,
  target_role TEXT NOT NULL,
  summary TEXT,
  readiness_score INT NOT NULL DEFAULT 0,
  hours_per_week INT NOT NULL DEFAULT 10,
  generated_by TEXT NOT NULL DEFAULT 'ai',
  model TEXT,
  jobs_analyzed INT NOT NULL DEFAULT 0,
  data_mode TEXT NOT NULL DEFAULT 'demo',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roadmaps TO authenticated;
GRANT ALL ON public.roadmaps TO service_role;
ALTER TABLE public.roadmaps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own roadmaps" ON public.roadmaps;
CREATE POLICY "own roadmaps" ON public.roadmaps FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS roadmaps_user_idx ON public.roadmaps(user_id);
DROP TRIGGER IF EXISTS roadmaps_updated ON public.roadmaps;
CREATE TRIGGER roadmaps_updated BEFORE UPDATE ON public.roadmaps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.roadmap_months (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id UUID NOT NULL REFERENCES public.roadmaps(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  month_number INT NOT NULL,
  title TEXT NOT NULL,
  goal TEXT,
  topics TEXT[] NOT NULL DEFAULT '{}',
  skills TEXT[] NOT NULL DEFAULT '{}',
  estimated_hours INT NOT NULL DEFAULT 20,
  project_title TEXT,
  project_description TEXT,
  milestone TEXT,
  assessment_skill TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (roadmap_id, month_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roadmap_months TO authenticated;
GRANT ALL ON public.roadmap_months TO service_role;
ALTER TABLE public.roadmap_months ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own roadmap_months" ON public.roadmap_months;
CREATE POLICY "own roadmap_months" ON public.roadmap_months FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.roadmap_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id UUID NOT NULL REFERENCES public.roadmaps(id) ON DELETE CASCADE,
  month_id UUID NOT NULL REFERENCES public.roadmap_months(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  week_number INT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  skill_name TEXT,
  estimated_hours INT NOT NULL DEFAULT 5,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roadmap_tasks TO authenticated;
GRANT ALL ON public.roadmap_tasks TO service_role;
ALTER TABLE public.roadmap_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own roadmap_tasks" ON public.roadmap_tasks;
CREATE POLICY "own roadmap_tasks" ON public.roadmap_tasks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS roadmap_tasks_month_idx ON public.roadmap_tasks(month_id);

-- PROJECT CATALOG
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT,
  difficulty public.difficulty_level NOT NULL DEFAULT 'intermediate',
  estimated_hours INT NOT NULL DEFAULT 12,
  career_id UUID REFERENCES public.careers(id) ON DELETE SET NULL,
  skills TEXT[] NOT NULL DEFAULT '{}',
  dataset_suggestion TEXT,
  requirements TEXT[] NOT NULL DEFAULT '{}',
  expected_output TEXT,
  readme_outline TEXT[] NOT NULL DEFAULT '{}',
  resume_bullet TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.projects TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "projects public read" ON public.projects;
CREATE POLICY "projects public read" ON public.projects FOR SELECT USING (true);
DROP POLICY IF EXISTS "projects admin write" ON public.projects;
CREATE POLICY "projects admin write" ON public.projects FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.user_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'started',
  repo_url TEXT,
  notes TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE (user_id, project_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_projects TO authenticated;
GRANT ALL ON public.user_projects TO service_role;
ALTER TABLE public.user_projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own user_projects" ON public.user_projects;
CREATE POLICY "own user_projects" ON public.user_projects FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RESOURCES
CREATE TABLE public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  provider TEXT,
  url TEXT NOT NULL,
  type public.resource_type NOT NULL DEFAULT 'documentation',
  skill_id UUID REFERENCES public.skills(id) ON DELETE SET NULL,
  career_id UUID REFERENCES public.careers(id) ON DELETE SET NULL,
  is_free BOOLEAN NOT NULL DEFAULT true,
  estimated_hours INT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.resources TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.resources TO authenticated;
GRANT ALL ON public.resources TO service_role;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "resources public read" ON public.resources;
CREATE POLICY "resources public read" ON public.resources FOR SELECT USING (true);
DROP POLICY IF EXISTS "resources admin write" ON public.resources;
CREATE POLICY "resources admin write" ON public.resources FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS resources_skill_idx ON public.resources(skill_id);

-- ASSESSMENTS
CREATE TABLE public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  skill_id UUID REFERENCES public.skills(id) ON DELETE SET NULL,
  difficulty public.difficulty_level NOT NULL DEFAULT 'beginner',
  description TEXT,
  pass_score INT NOT NULL DEFAULT 60,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.assessments TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.assessments TO authenticated;
GRANT ALL ON public.assessments TO service_role;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "assessments public read" ON public.assessments;
CREATE POLICY "assessments public read" ON public.assessments FOR SELECT USING (true);
DROP POLICY IF EXISTS "assessments admin write" ON public.assessments;
CREATE POLICY "assessments admin write" ON public.assessments FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.assessment_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  options TEXT[] NOT NULL,
  correct_index INT NOT NULL,
  explanation TEXT,
  sort_order INT NOT NULL DEFAULT 0
);
GRANT SELECT ON public.assessment_questions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.assessment_questions TO authenticated;
GRANT ALL ON public.assessment_questions TO service_role;
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "questions read authed" ON public.assessment_questions;
CREATE POLICY "questions read authed" ON public.assessment_questions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "questions admin write" ON public.assessment_questions;
CREATE POLICY "questions admin write" ON public.assessment_questions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS assessment_questions_assessment_idx ON public.assessment_questions(assessment_id);

CREATE TABLE public.assessment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  score INT NOT NULL,
  total_questions INT NOT NULL,
  answers JSONB NOT NULL DEFAULT '[]',
  resulting_level public.proficiency_level,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_attempts TO authenticated;
GRANT ALL ON public.assessment_attempts TO service_role;
ALTER TABLE public.assessment_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own attempts" ON public.assessment_attempts;
CREATE POLICY "own attempts" ON public.assessment_attempts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- APPLICATIONS
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  url TEXT,
  location TEXT,
  salary TEXT,
  status public.application_status NOT NULL DEFAULT 'saved',
  applied_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own applications" ON public.applications;
CREATE POLICY "own applications" ON public.applications FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS applications_user_idx ON public.applications(user_id);
DROP TRIGGER IF EXISTS applications_updated ON public.applications;
CREATE TRIGGER applications_updated BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PROGRESS EVENTS
CREATE TABLE public.progress_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  label TEXT,
  readiness_score INT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.progress_events TO authenticated;
GRANT ALL ON public.progress_events TO service_role;
ALTER TABLE public.progress_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own progress_events" ON public.progress_events;
CREATE POLICY "own progress_events" ON public.progress_events FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS progress_events_user_idx ON public.progress_events(user_id, created_at DESC);

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own notifications" ON public.notifications;
CREATE POLICY "own notifications" ON public.notifications FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications(user_id, created_at DESC);

-- ANALYTICS
CREATE TABLE public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  event_name TEXT NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.analytics_events TO authenticated;
GRANT SELECT ON public.analytics_events TO authenticated;
GRANT ALL ON public.analytics_events TO service_role;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "insert own analytics" ON public.analytics_events;
CREATE POLICY "insert own analytics" ON public.analytics_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "admin read analytics" ON public.analytics_events;
CREATE POLICY "admin read analytics" ON public.analytics_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS analytics_events_name_idx ON public.analytics_events(event_name, created_at DESC);

-- SAVED JOBS
CREATE TABLE public.saved_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_id)
);
GRANT SELECT, INSERT, DELETE ON public.saved_jobs TO authenticated;
GRANT ALL ON public.saved_jobs TO service_role;
ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own saved_jobs" ON public.saved_jobs;
CREATE POLICY "own saved_jobs" ON public.saved_jobs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
