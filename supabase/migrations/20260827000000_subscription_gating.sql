-- PHASE 1 — SUBSCRIPTION ARCHITECTURE + FEATURE GATING
--
-- profiles.plan already exists (plan_tier enum: free/pro/premium, default
-- 'free' — see 20260822065421). This migration does two things:
--
-- 1. SECURITY FIX: the existing "own profile update" policy
--    (`USING (auth.uid() = id) WITH CHECK (auth.uid() = id)`) is a
--    row-level policy — it does not restrict which *columns* a user can
--    write on their own row. As written, an authenticated user could call
--    `supabase.from('profiles').update({ plan: 'premium' }).eq('id', me)`
--    directly from the browser and grant themselves a paid plan. Row-level
--    security alone cannot prevent this; Postgres column-level privileges
--    can. We REVOKE UPDATE on the plan (and new plan-metadata) columns
--    from the `authenticated` role entirely. Only the service-role client
--    (used exclusively by requireAdmin()-gated server functions — see
--    src/lib/admin.server.ts) can write these columns going forward.
--
-- 2. Adds lightweight metadata so a manually-assigned plan (this phase's
--    only way to change plans, ahead of real billing) is clearly
--    labelled as such in the UI, rather than looking like an active paid
--    subscription.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_source TEXT NOT NULL DEFAULT 'default'
    CHECK (plan_source IN ('default', 'manual_admin')),
  ADD COLUMN IF NOT EXISTS plan_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan_updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.plan_source IS
  'default = whatever the signup default is; manual_admin = an admin changed this by hand via the admin panel (Phase 1, ahead of real billing). Never set to imply an active payment.';

-- Users can read their own plan (already true via "own profile read"), but
-- can never write plan/plan_source/plan_updated_at/plan_updated_by
-- themselves — only the service-role client can, and only after
-- requireAdmin() passes in application code.
REVOKE UPDATE (plan, plan_source, plan_updated_at, plan_updated_by)
  ON public.profiles FROM authenticated;
