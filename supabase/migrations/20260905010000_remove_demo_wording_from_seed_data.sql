-- Removes user-visible "Demo" wording from the seeded sample jobs shipped
-- with the product (20260822065725_...). This is a data update, not a
-- schema change: the seeded rows stay exactly as they are (still flagged
-- `is_demo = true`, still removable via the admin "Remove seeded listings"
-- action on /admin/jobs) — only the text a visitor actually sees changes.
--
-- Two things were visible to end users before this migration:
--   1. Company names on job cards / job detail read "Demo Company A"..."J".
--   2. The job detail page's "Source" field read "Demo sample set" (from
--      job_sources.name).
-- Neither of those is the internal `is_demo` flag itself — that stays.
update public.jobs
set company = replace(company, 'Demo Company', 'Sample Employer')
where is_demo = true
  and company like 'Demo Company%';

update public.job_sources
set name = 'Sample postings'
where slug = 'demo-sample';
