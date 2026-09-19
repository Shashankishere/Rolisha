-- Completes the seed-data hyphen sweep the previous migration
-- (20260912100100_fix_data_analyst_description_hyphen.sql) flagged as
-- incomplete: the "Sales Performance Dashboard" project summary reads
-- "...into an executive-ready dashboard." -- the same class of
-- unnecessary natural-language hyphen, in a project `summary` column
-- rather than a career `description` column.
UPDATE public.projects
SET summary = REPLACE(
  summary,
  'into an executive-ready dashboard',
  'into an executive dashboard'
)
WHERE slug = 'sales-performance-dashboard';
