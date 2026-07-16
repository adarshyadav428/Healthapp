-- 023_billing_hardening.sql
-- 1) A Google Play purchase token entitles exactly one account. The verify
--    route upserts on user_id (the table PK), so without this index a token
--    shared between accounts would happily create one entitled row per user.
--    The route pre-checks and returns 409, but the index is the guarantee
--    under concurrent requests.
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_play_purchase_token
  ON subscriptions (play_purchase_token)
  WHERE play_purchase_token IS NOT NULL;

-- 2) Razorpay cancellations now take effect at the end of the billing cycle
--    (cancel_at_cycle_end) instead of immediately. Between the cancel request
--    and the subscription.cancelled webhook at cycle end, status stays
--    'active' and this flag records the scheduled cancellation.
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;
