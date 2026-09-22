-- ============================================================
-- LOCALIZE public.profiles.salary_currency TO INR (Target Salary)
-- ============================================================
-- Root cause: `public.profiles.salary_currency` was created with
-- `DEFAULT 'USD'` (see the original schema migration). Rolisha is an
-- India-first product and exposes no currency picker anywhere in the UI
-- for a user's own Target Salary (unlike job postings, which correctly
-- keep each posting's own real currency) -- so every profile's target
-- salary is always displayed and interpreted as INR (see
-- src/lib/domain.ts's `formatSalary`/`formatInrLpa`, which render an INR
-- amount as "₹8 LPA"). The stale 'USD' default meant a brand new user's
-- Target Salary field silently showed "$" until they'd (never) had a
-- reason to change it.
--
-- This mirrors the same fix already applied to `public.careers` in
-- 20260912100000_localize_career_salaries_to_inr.sql: change the column
-- default for new rows, and backfill existing rows that only ever got
-- 'USD' because that used to be the default -- never because a user
-- actually chose it (there has never been a currency selector for this
-- field). A profile whose salary_currency was set to something else is
-- left untouched.

ALTER TABLE public.profiles ALTER COLUMN salary_currency SET DEFAULT 'INR';

UPDATE public.profiles
SET salary_currency = 'INR'
WHERE salary_currency = 'USD';
