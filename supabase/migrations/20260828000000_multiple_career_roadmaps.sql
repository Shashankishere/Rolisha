-- PHASE 2 — MULTIPLE CAREER ROADMAPS (Pro)
--
-- `roadmaps` already has a `career_id` per row (a roadmap has always been
-- tied to a specific target career, not just "the user's current one"), so
-- supporting more than one concurrently-tracked roadmap per user doesn't
-- need a new table -- it needs `is_active` to stop meaning "the one and
-- only current roadmap" and start meaning "still being tracked" (a career
-- track the user hasn't abandoned), with a separate `is_primary` flag
-- marking which one is currently mirrored by `profiles.career_id` and shown
-- as *the* roadmap everywhere else in the app (dashboard, /roadmap,
-- /skills, /projects, /assessments).
--
-- Each roadmap's own `roadmap_months`/`roadmap_tasks` rows are already
-- scoped by `roadmap_id`, so per-track progress was already isolated by
-- construction -- switching which roadmap is primary was the only missing
-- piece.

ALTER TABLE public.roadmaps
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.roadmaps.is_active IS
  'Still being tracked by the user (a career track they have not abandoned). A user can have several is_active roadmaps at once on Pro/Premium -- one per target career.';
COMMENT ON COLUMN public.roadmaps.is_primary IS
  'The roadmap currently mirrored by profiles.career_id and shown as the default /roadmap, /skills, /projects, /assessments view. Exactly one true per user among active roadmaps.';

-- Exactly one primary roadmap per user at a time.
CREATE UNIQUE INDEX IF NOT EXISTS roadmaps_one_primary_per_user
  ON public.roadmaps (user_id)
  WHERE is_primary;
