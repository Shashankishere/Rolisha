-- The admin panel's role-management writes go through the service-role
-- client (see src/integrations/supabase/client.server.ts), gated by
-- requireAdmin() checked first against the caller's own RLS-scoped session
-- (see src/lib/jobs/require-admin.server.ts). That check reads user_roles
-- under the existing "own roles read" policy, which already lets an admin
-- see every row — no schema change needed there.
--
-- This migration adds the missing *write* policy so admin role management
-- is also correctly scoped at the database layer in depth, not only via
-- which server code happens to call it. (careers already has an "admin
-- write" policy from the initial schema migration, so nothing more is
-- needed there for career activation toggles.)

DROP POLICY IF EXISTS "admin manage roles" ON public.user_roles;
CREATE POLICY "admin manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
