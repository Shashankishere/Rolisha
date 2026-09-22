-- CONSOLIDATE PREMIUM INTO PRO
--
-- Rolisha now has exactly two user-facing plans, Free and Pro. The
-- separate Premium tier (which used to gate resume analysis, interview
-- prep, mock interviews, career switching, and AI career recommendations
-- above Pro) has been removed from the application; every one of those
-- features is now a Pro feature instead (see src/lib/subscription.ts).
--
-- This migration only NORMALIZES DATA. It intentionally does NOT:
--   * drop 'premium' from the `plan_tier` enum -- Postgres has no
--     "DROP VALUE" for enums (only ADD VALUE), so removing it would mean
--     recreating the type and every column/index/policy that references
--     it. That's real migration risk for a value the application will
--     simply never write again after this point. Leaving the enum value
--     in place is inert and safe; this migration is the actual fix.
--   * touch `public.subscriptions.plan_tier`, which is a historical
--     billing record (which Razorpay plan a subscription was actually
--     created against). A subscription created before this change can
--     correctly keep reading 'premium' forever -- that's real history,
--     not a bug -- so it is deliberately left alone. The application
--     layer (src/lib/payments/subscription-sync.server.ts) already
--     normalizes any such row to a Pro-level grant on
--     `public.profiles.plan` when syncing status, so no legacy
--     subscriber loses access.
--
-- What it DOES do: any *profile* still holding the now-removed
-- `plan = 'premium'` is moved to `plan = 'pro'` -- profiles.plan is the
-- live, user-facing plan (unlike the historical subscriptions table), so
-- it must only ever read 'free' or 'pro' going forward. This is exactly
-- the "existing Premium users should receive the consolidated Pro
-- feature set" requirement: nobody loses access, nobody is left on a
-- plan that no longer exists in the product.

UPDATE public.profiles
SET plan = 'pro'
WHERE plan = 'premium';

COMMENT ON TYPE public.plan_tier IS
  'free | pro are the only plans the application assigns or checks against as of the Premium consolidation (2026-09-19). The historical ''premium'' value is kept in the enum only because Postgres cannot drop enum values without recreating the type; it must never be written to profiles.plan again. public.subscriptions.plan_tier may still legitimately read ''premium'' for a subscription created before this date -- that is a preserved historical billing record, not a live plan.';
