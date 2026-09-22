-- PHASE 4 — PAYMENTS (Razorpay)
--
-- Provider: Razorpay. Chosen because this product's primary, default
-- market/currency is India/INR (see src/routes/pricing.tsx — India is the
-- default region and the only one with committed-looking pricing), and:
--   - Stripe India is invite-only for new merchants, settles Indian
--     accounts in INR only with added conversion friction for
--     international pricing, and requires GSTIN/PAN/full business
--     registration -- a poor fit for launching India-first billing.
--   - Razorpay is built for India: native UPI/UPI-Autopay support (India's
--     dominant payment rail, RBI e-mandate compliant for recurring
--     billing), a Subscriptions API with webhook-driven lifecycle events,
--     refunds, a full test/sandbox mode, and signed webhooks.
--
-- This migration does NOT touch `profiles.plan` directly -- that column
-- is already locked to service-role-only writes (see
-- 20260827000000_subscription_gating.sql). Webhook/checkout code always
-- goes through supabaseAdmin (service role) to flip it, exactly like the
-- admin panel does, so a Razorpay subscription can grant a plan through
-- the very same narrow path an admin uses -- there is no second,
-- parallel plan-assignment mechanism.

-- Extend plan_source to allow a real, provider-backed subscription value
-- distinct from 'default' (never paid for) and 'manual_admin' (hand-set
-- for testing) -- so the UI can tell the difference between "an admin
-- gave me this" and "I am actually paying for this".
ALTER TABLE public.profiles DROP CONSTRAINT profiles_plan_source_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_plan_source_check
    CHECK (plan_source IN ('default', 'manual_admin', 'razorpay_subscription'));

-- ============================================================
-- 1. BILLING CUSTOMERS — one Razorpay customer per user.
-- ============================================================
CREATE TABLE public.billing_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  razorpay_customer_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.billing_customers TO authenticated;
GRANT ALL ON public.billing_customers TO service_role;
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
-- Users may only ever READ their own billing customer row. Creating one
-- happens exclusively server-side (checkout.server.ts) via the
-- service-role client -- there is deliberately no INSERT/UPDATE policy
-- for `authenticated`, so a user can never fabricate or rewrite another
-- user's Razorpay customer link from the browser.
DROP POLICY IF EXISTS "read own billing customer" ON public.billing_customers;
CREATE POLICY "read own billing customer" ON public.billing_customers
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- 2. SUBSCRIPTIONS — local mirror of Razorpay subscription lifecycle.
-- ============================================================
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  plan_tier TEXT NOT NULL CHECK (plan_tier IN ('pro', 'premium')),
  razorpay_subscription_id TEXT NOT NULL UNIQUE,
  razorpay_plan_id TEXT NOT NULL,
  -- Mirrors Razorpay's subscription status values directly (see Razorpay
  -- Subscriptions API docs): created -> authenticated -> active, with
  -- pending/halted/cancelled/completed/expired as terminal/interruption
  -- states. Kept as the provider's own vocabulary rather than inventing a
  -- parallel one, so a support engineer reading the Razorpay dashboard and
  -- this table sees the same words.
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'authenticated', 'active', 'pending', 'halted', 'cancelled', 'completed', 'expired')),
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  current_period_end TIMESTAMPTZ,
  last_payment_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
-- Read-only for the owning user, same reasoning as billing_customers:
-- every write (create at checkout, update on webhook, cancel) is a
-- trusted server-side operation using the service-role client, verified
-- against Razorpay's signature first. The browser is never the source of
-- truth for its own subscription state.
DROP POLICY IF EXISTS "read own subscription" ON public.subscriptions;
CREATE POLICY "read own subscription" ON public.subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON public.subscriptions(user_id, created_at DESC);
DROP TRIGGER IF EXISTS subscriptions_updated ON public.subscriptions;
CREATE TRIGGER subscriptions_updated
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. PAYMENT EVENTS — raw webhook log + idempotency guard.
-- ============================================================
-- The UNIQUE constraint on razorpay_event_id is the idempotency
-- mechanism: the webhook handler always attempts to INSERT the event
-- first, and treats a unique-violation as "already processed this event,
-- return 200 and do nothing else" -- so a Razorpay retry (which resends
-- the identical event id) can never double-apply a charge or double-grant
-- a plan change.
CREATE TABLE public.payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razorpay_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No policies granted to `authenticated` at all -- this table holds raw
-- provider payloads and is service-role/admin-only, by omission (RLS
-- enabled, zero policies for that role = no access).
GRANT ALL ON public.payment_events TO service_role;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS payment_events_subscription_idx ON public.payment_events(subscription_id, received_at DESC);
