-- Product rebrand: RoleReady -> Rolisha.
--
-- This is a data-only fix, in the same spirit as
-- 20260905010000_remove_demo_wording_from_seed_data.sql and
-- 20260912100100_fix_data_analyst_description_hyphen.sql: it updates text
-- already sitting in seeded rows rather than editing the original INSERT
-- migrations that created them.
--
-- Scope: public.careers.seo_title / public.careers.seo_description only.
-- Those two columns render as the page <title> and meta description on
-- each career's public roadmap page (see the `seo_title`/`seo_description`
-- columns added in 20260822065421_..., populated by
-- 20260822065725_c8076282-7e0a-4dfd-be96-9ad6074106dc.sql and
-- 20260906010000_expand_careers_and_skills.sql).
--
-- Confirmed via search: all 20 seeded careers currently carry a seo_title
-- of the form '<Title> Career Roadmap | RoleReady'. No seo_description
-- values currently contain the old brand, but they're included below for
-- safety in case that changes before this runs. No other seeded columns
-- on this table reference the old brand.
--
-- This migration does NOT touch: table schema, RLS policies, grants,
-- triggers, auth, API/server code, career slugs/ids, or any business
-- logic -- only the two text columns above, and only on rows that still
-- contain the old brand.
--
-- Idempotent: the WHERE clause only matches rows that still contain one
-- of the old brand spellings ('RoleReady', 'Role Ready', 'role-ready',
-- 'roleready'), so re-running this after it has already applied touches
-- zero rows.
update public.careers
set
  seo_title = replace(replace(replace(replace(seo_title,
    'RoleReady', 'Rolisha'),
    'Role Ready', 'Rolisha'),
    'role-ready', 'Rolisha'),
    'roleready', 'Rolisha'),
  seo_description = replace(replace(replace(replace(seo_description,
    'RoleReady', 'Rolisha'),
    'Role Ready', 'Rolisha'),
    'role-ready', 'Rolisha'),
    'roleready', 'Rolisha')
where seo_title like '%RoleReady%'
   or seo_title like '%Role Ready%'
   or seo_title like '%role-ready%'
   or seo_title like '%roleready%'
   or seo_description like '%RoleReady%'
   or seo_description like '%Role Ready%'
   or seo_description like '%role-ready%'
   or seo_description like '%roleready%';
