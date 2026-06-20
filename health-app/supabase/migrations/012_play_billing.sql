-- 012_play_billing.sql
-- Add Google Play Billing as a second entitlement provider alongside Stripe.
-- Both providers write to `subscriptions` using the SAME `status` vocabulary
-- ('active' | 'trialing' | 'past_due' | 'canceled') so every Pro gate that reads
-- status in ('active','trialing') keeps working with no code change.

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS play_purchase_token text,
  ADD COLUMN IF NOT EXISTS play_product_id text;

-- Constrain provider to the two supported channels.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_provider_check'
  ) THEN
    ALTER TABLE subscriptions
      ADD CONSTRAINT subscriptions_provider_check
      CHECK (provider IN ('stripe', 'google_play'));
  END IF;
END $$;

-- Look up / dedupe by Play purchase token (used by /api/play/verify and the RTDN webhook).
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_play_purchase_token
  ON subscriptions (play_purchase_token)
  WHERE play_purchase_token IS NOT NULL;
