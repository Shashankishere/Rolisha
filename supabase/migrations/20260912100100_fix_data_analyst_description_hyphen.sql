-- The Data Analyst career description ("About this role" on the public
-- career detail page) reads "...statistics and business-intelligence
-- tooling..." -- a natural-language hyphen the earlier React-source hyphen
-- audit didn't catch because this text lives in seed data, not component
-- code. Fixing it here rather than editing the original INSERT migration.
--
-- Note: this migration only re-checks the one instance confirmed by
-- screen recording. A full sweep of every seed-data description/content
-- column for the same class of hyphen was not done in this pass -- see
-- the accompanying report.
UPDATE public.careers
SET description = REPLACE(
  description,
  'statistics and business-intelligence tooling',
  'statistics and business intelligence tooling'
)
WHERE slug = 'data-analyst';
