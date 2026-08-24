-- 039_onboarding_personalisation.sql
--
-- Two answers collected during onboarding that describe the *person* rather
-- than the body: what has made losing weight hard for them before, and whether
-- they have ever counted calories.
--
-- Why store them at all, rather than asking for effect and discarding:
--   - `obstacles` is the only structured signal the app has about *why* a user
--     goes over. Everything else it knows (weight, TDEE, logs) describes what
--     happened, never what to do differently. It drives the plan reveal today
--     and is the natural input for coaching copy later.
--   - `tracking_experience` separates a first-timer from someone who has tried
--     and stopped. Those two need opposite reassurance, and the app currently
--     writes one line for both.
--
-- Both are nullable with no default and no backfill. Every existing user
-- onboarded before these questions existed, and NULL is the honest
-- representation of "never asked" — a default would invent an answer and the
-- plan card keyed off it would then state something the user never said.
--
-- Idempotent (migrations here are applied by hand in the Supabase SQL editor).

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS obstacles text[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tracking_experience text;

-- Values are validated by Zod at the API boundary (lib/validations.ts). The
-- CHECK is the second line of defence, so a bad row cannot be written by a
-- direct SQL edit either. Kept NULL-permissive on purpose, per the above.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_tracking_experience_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_tracking_experience_check
      CHECK (tracking_experience IS NULL OR tracking_experience IN ('never', 'tried', 'current'));
  END IF;
END $$;

-- Cap the array so a crafted request cannot write an unbounded list. The UI
-- allows at most 3; this allows a little headroom without allowing abuse.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_obstacles_len_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_obstacles_len_check
      CHECK (obstacles IS NULL OR array_length(obstacles, 1) <= 6);
  END IF;
END $$;
