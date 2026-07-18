-- 027_email_verification.sql
-- Tracks whether a user has actually proven they own their email address.
--
-- Background: to let people into the app immediately, "Confirm email" gets
-- switched OFF in the Supabase dashboard. But Supabase then *auto-confirms*
-- every new signup — it stamps auth.users.email_confirmed_at at creation — so
-- that column stops meaning "this address was proven" and becomes useless as a
-- signal. We therefore track ownership ourselves.
--
-- NULL = not yet proven. Set only when the user clicks a link delivered to
-- that address (magic link, signup confirmation, or a Google OAuth sign-in,
-- where Google has already verified it) — see app/auth/callback/route.ts.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

-- Backfill everyone who signed up while confirmation was still mandatory.
-- They already proved ownership, and nagging them for it again would be both
-- wrong and a good way to make people distrust the prompt.
--
-- ⚠️ ORDER MATTERS: run this migration BEFORE turning "Confirm email" off.
-- Once that setting is off, email_confirmed_at is auto-populated at signup, so
-- anyone who registers between the toggle and this backfill would be marked
-- verified without ever having proven anything.
UPDATE profiles p
SET email_verified_at = u.email_confirmed_at
FROM auth.users u
WHERE u.id = p.id
  AND u.email_confirmed_at IS NOT NULL
  AND p.email_verified_at IS NULL;

-- Partial index: the verification nudge only ever queries for the unverified,
-- and that set shrinks as people convert.
CREATE INDEX IF NOT EXISTS profiles_email_unverified_idx
  ON profiles (created_at)
  WHERE email_verified_at IS NULL;
