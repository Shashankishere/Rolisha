-- Replaces the "tick a checkbox to complete a task" project workflow with a
-- real task workspace: a task can only become completed by submitting
-- evidence of the work (a written explanation, and optionally a link to the
-- repo/deployed project/etc).
--
-- Keeps the existing `completed_tasks` column (still the source of truth for
-- "which task indexes count toward milestone/project completion" — read by
-- listProjectsForUser and the completion check in setProjectStatus) and adds
-- `task_progress`, a JSONB map from task index (as a string key) to that
-- task's workspace state:
--   { "0": { "status": "in_progress" | "completed",
--             "note": "...", "link": "https://..." | null,
--             "updatedAt": "2026-09-05T12:00:00.000Z" } }
-- A task's entry only ever reaches "completed" through the server-side
-- submit path, which also adds its index to `completed_tasks` — so nothing
-- new needs to change how milestone/project completion is computed.
ALTER TABLE public.user_projects
  ADD COLUMN IF NOT EXISTS task_progress JSONB NOT NULL DEFAULT '{}'::jsonb;
