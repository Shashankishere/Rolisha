-- ============================================================
-- BACKFILL: roadmap_months.estimated_hours FROM ACTUAL TASKS
-- ============================================================
-- Root cause (see src/lib/roadmap.server.ts buildRoadmap): a month's
-- displayed "N h planned" badge used to be computed as `weeklyHours * 4`,
-- independent of the tasks actually generated for that month. That's
-- usually equal to the real workload, but a month made up of lighter
-- "keep it sharp" consolidation weeks (e.g. a user with no outstanding
-- skill gap for that stretch) legitimately schedules LESS than a full
-- week's hours per week -- so the badge could overstate the real
-- workload (the exact "24 hr planned but tasks don't add up to 24"
-- symptom).
--
-- The application code has been fixed to derive `estimatedHours` from the
-- actual generated tasks going forward. This migration corrects every
-- ALREADY-PERSISTED roadmap_months row the same way, so historical
-- roadmaps (generated before this fix shipped) show accurate numbers too
-- instead of only new roadmaps being correct. This is read-only with
-- respect to roadmap_tasks -- it only rewrites the derived total on
-- roadmap_months, never touches task rows.

UPDATE public.roadmap_months AS m
SET estimated_hours = COALESCE(t.actual_hours, 0)
FROM (
  SELECT month_id, SUM(estimated_hours) AS actual_hours
  FROM public.roadmap_tasks
  GROUP BY month_id
) AS t
WHERE t.month_id = m.id
  AND m.estimated_hours IS DISTINCT FROM COALESCE(t.actual_hours, 0);

-- Months with zero persisted tasks (shouldn't happen given the generator's
-- guarantees, but handled defensively rather than left stale/undefined):
UPDATE public.roadmap_months AS m
SET estimated_hours = 0
WHERE m.estimated_hours IS DISTINCT FROM 0
  AND NOT EXISTS (
    SELECT 1 FROM public.roadmap_tasks rt WHERE rt.month_id = m.id
  );
