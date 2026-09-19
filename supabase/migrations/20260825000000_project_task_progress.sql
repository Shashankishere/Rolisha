-- Adds per-task progress tracking to user_projects so the Projects page can
-- be a real learning workspace (open a project, work through its steps,
-- come back later and continue) rather than only a started/completed toggle.
--
-- Tasks themselves are not a new table: each project's `requirements` array
-- (already seeded, e.g. "Clean and de-duplicate the raw export") is treated
-- as its ordered list of steps. `completed_tasks` stores the indexes (into
-- that array) the user has checked off. This avoids inventing a parallel
-- tasks schema for content that already exists.
ALTER TABLE public.user_projects
  ADD COLUMN IF NOT EXISTS completed_tasks INTEGER[] NOT NULL DEFAULT '{}';
