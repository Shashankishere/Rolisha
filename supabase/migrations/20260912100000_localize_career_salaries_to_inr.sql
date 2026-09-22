-- ============================================================
-- LOCALIZE CAREER SALARIES TO INDIA (INR / LPA)
-- ============================================================
-- RoleReady's primary market is India. The `careers` table was seeded
-- with illustrative USD figures (see 20260822065725_..., 20260906010000_...)
-- that were never sourced from a live provider -- just round-number
-- placeholders. Presenting those as USD to an India-first audience was
-- wrong, and mechanically converting them at a made-up FX rate would have
-- been dishonest in the other direction (the app explicitly promises
-- "no fabricated market statistics").
--
-- Instead, each `typical_salary_min`/`typical_salary_max` below is an
-- approximate "typical range" (roughly fresher-to-established-mid-level,
-- matching this app's audience of people building toward their first or
-- next role in the path) drawn from public 2026 India salary aggregators
-- (AmbitionBox, Glassdoor, Naukri, Instahyre) as of this migration. These
-- are honest market approximations, not a live feed -- if/when a real
-- salary data provider is connected, replace these rows instead of
-- treating them as authoritative.
--
-- salary_currency moves from the table's 'USD' default to 'INR' for
-- every existing row; formatSalaryRange/formatSalary in src/lib/domain.ts
-- already render INR using Indian digit grouping and (new in this pass)
-- an LPA-style range for whole-lakh amounts, so no component needs to
-- change to pick this up.

UPDATE public.careers SET typical_salary_min = 400000,  typical_salary_max = 1200000, salary_currency = 'INR' WHERE slug = 'data-analyst';
UPDATE public.careers SET typical_salary_min = 500000,  typical_salary_max = 1600000, salary_currency = 'INR' WHERE slug = 'software-engineer';
UPDATE public.careers SET typical_salary_min = 450000,  typical_salary_max = 1300000, salary_currency = 'INR' WHERE slug = 'frontend-developer';
UPDATE public.careers SET typical_salary_min = 500000,  typical_salary_max = 1500000, salary_currency = 'INR' WHERE slug = 'backend-developer';
UPDATE public.careers SET typical_salary_min = 600000,  typical_salary_max = 2000000, salary_currency = 'INR' WHERE slug = 'data-scientist';
UPDATE public.careers SET typical_salary_min = 400000,  typical_salary_max = 1400000, salary_currency = 'INR' WHERE slug = 'cybersecurity-analyst';
UPDATE public.careers SET typical_salary_min = 700000,  typical_salary_max = 2200000, salary_currency = 'INR' WHERE slug = 'product-manager';
UPDATE public.careers SET typical_salary_min = 400000,  typical_salary_max = 1100000, salary_currency = 'INR' WHERE slug = 'ui-ux-designer';
UPDATE public.careers SET typical_salary_min = 500000,  typical_salary_max = 1500000, salary_currency = 'INR' WHERE slug = 'full-stack-developer';
UPDATE public.careers SET typical_salary_min = 450000,  typical_salary_max = 1300000, salary_currency = 'INR' WHERE slug = 'mobile-app-developer';
UPDATE public.careers SET typical_salary_min = 600000,  typical_salary_max = 1700000, salary_currency = 'INR' WHERE slug = 'data-engineer';
UPDATE public.careers SET typical_salary_min = 500000,  typical_salary_max = 1300000, salary_currency = 'INR' WHERE slug = 'business-intelligence-analyst';
UPDATE public.careers SET typical_salary_min = 800000,  typical_salary_max = 2200000, salary_currency = 'INR' WHERE slug = 'machine-learning-engineer';
UPDATE public.careers SET typical_salary_min = 800000,  typical_salary_max = 2400000, salary_currency = 'INR' WHERE slug = 'ai-engineer';
UPDATE public.careers SET typical_salary_min = 500000,  typical_salary_max = 1800000, salary_currency = 'INR' WHERE slug = 'devops-engineer';
UPDATE public.careers SET typical_salary_min = 500000,  typical_salary_max = 1700000, salary_currency = 'INR' WHERE slug = 'cloud-engineer';
UPDATE public.careers SET typical_salary_min = 800000,  typical_salary_max = 2000000, salary_currency = 'INR' WHERE slug = 'site-reliability-engineer';
UPDATE public.careers SET typical_salary_min = 1000000, typical_salary_max = 2500000, salary_currency = 'INR' WHERE slug = 'solutions-architect';
UPDATE public.careers SET typical_salary_min = 600000,  typical_salary_max = 1800000, salary_currency = 'INR' WHERE slug = 'cybersecurity-engineer';
UPDATE public.careers SET typical_salary_min = 600000,  typical_salary_max = 2000000, salary_currency = 'INR' WHERE slug = 'cloud-security-engineer';
UPDATE public.careers SET typical_salary_min = 350000,  typical_salary_max = 900000,  salary_currency = 'INR' WHERE slug = 'qa-engineer';
UPDATE public.careers SET typical_salary_min = 450000,  typical_salary_max = 1100000, salary_currency = 'INR' WHERE slug = 'qa-automation-engineer';
UPDATE public.careers SET typical_salary_min = 500000,  typical_salary_max = 1300000, salary_currency = 'INR' WHERE slug = 'database-administrator';
UPDATE public.careers SET typical_salary_min = 900000,  typical_salary_max = 2400000, salary_currency = 'INR' WHERE slug = 'technical-product-manager';
UPDATE public.careers SET typical_salary_min = 500000,  typical_salary_max = 1300000, salary_currency = 'INR' WHERE slug = 'product-analyst';
UPDATE public.careers SET typical_salary_min = 500000,  typical_salary_max = 1400000, salary_currency = 'INR' WHERE slug = 'business-analyst';
UPDATE public.careers SET typical_salary_min = 600000,  typical_salary_max = 1600000, salary_currency = 'INR' WHERE slug = 'project-manager';

-- Any career added later without explicit salary data should default to
-- INR going forward, not the table's original USD default.
ALTER TABLE public.careers ALTER COLUMN salary_currency SET DEFAULT 'INR';
