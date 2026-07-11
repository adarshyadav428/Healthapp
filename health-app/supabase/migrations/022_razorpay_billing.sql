-- 022_razorpay_billing.sql
-- Razorpay replaces Stripe as the web checkout path (Stripe barely supports
-- India-domestic INR recurring billing under RBI mandate rules). Existing
-- Stripe subscribers are NOT migrated — they keep their subscription via the
-- Stripe webhook/portal until they cancel or it lapses; only new web
-- checkouts go through Razorpay from here on. Same shared `subscriptions`
-- table and status vocabulary as Stripe/Play, so every Pro gate keeps
-- working with no code change.

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS razorpay_customer_id text,
  ADD COLUMN IF NOT EXISTS razorpay_subscription_id text;

DO $$
BEGIN
  ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_provider_check;
  ALTER TABLE subscriptions
    ADD CONSTRAINT subscriptions_provider_check
    CHECK (provider IN ('stripe', 'google_play', 'razorpay'));
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_razorpay_subscription_id
  ON subscriptions (razorpay_subscription_id)
  WHERE razorpay_subscription_id IS NOT NULL;
