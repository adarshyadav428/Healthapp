-- 026_anonymous_users.sql
-- Allows anonymous (deferred-signup) auth users to exist.
--
-- Background: signInAnonymously() inserts a row into auth.users with a NULL
-- email. The on_auth_user_created trigger (001_initial.sql) copies NEW.email
-- into profiles.email, which was declared NOT NULL — so the insert raised,
-- which aborted the auth.users insert, which made anonymous sign-in fail
-- outright. Dropping NOT NULL is the prerequisite for the whole feature.
--
-- The UNIQUE constraint on profiles.email is deliberately kept: Postgres
-- treats NULLs as distinct for uniqueness purposes, so any number of
-- anonymous profiles coexist happily while registered emails stay unique.

ALTER TABLE profiles ALTER COLUMN email DROP NOT NULL;

-- Keep profiles.email in step with auth.users.email.
--
-- Until now profiles.email was written exactly once, by the INSERT trigger,
-- and never updated — which was harmless when email was set at signup and
-- never changed. Deferred signup breaks that assumption: an anonymous user
-- converts via updateUser({ email, password }), which sets auth.users.email
-- on an existing row. Without this trigger their profiles.email would stay
-- NULL forever and they'd look anonymous to every query that checks it.
--
-- This also fixes the pre-existing (if latent) case of a registered user
-- changing their email address.
CREATE OR REPLACE FUNCTION public.handle_user_email_change()
RETURNS trigger AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE profiles SET email = NEW.email WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;
CREATE TRIGGER on_auth_user_email_changed
AFTER UPDATE OF email ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_user_email_change();

-- Lets the cleanup cron and any anon-aware gate identify anonymous accounts
-- without a round trip to auth.users on every check.
CREATE INDEX IF NOT EXISTS profiles_email_null_idx
  ON profiles (created_at)
  WHERE email IS NULL;
