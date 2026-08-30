-- 040_body_focus.sql
--
-- Onboarding gained two questions: what the user is actually trying to do with
-- their body, and roughly what build they're starting from.
--
-- `body_focus` is the NEW user-facing goal selector and has four values:
--   fat_loss | recomp | maintain | muscle_gain
-- `goal` deliberately stays three-valued (lose | maintain | gain) and is
-- DERIVED from body_focus by planForFocus() in lib/bodyType.ts. Around twenty
-- modules branch on `goal` (deficit-calculator, plateau, adaptiveTarget,
-- planCards, goalProjection, WeightStats, the paywall); adding a fourth value
-- there would mean re-auditing every one of them for no gain.
--
-- `body_type` is a self-reported build (skinny | skinny_fat | average | soft |
-- athletic) whose only job is to preselect a body_focus. It is a preference,
-- never a measurement — nothing derives a body-fat percentage from it.
--
-- Both are plain nullable text with no CHECK constraint, matching `goal`,
-- `sex` and `activity_level`, which are all Zod-enforced only. Existing rows
-- stay NULL and are handled by focusFromProfile() in lib/bodyType.ts.
--
-- Idempotent: these are applied by hand in the Supabase SQL editor.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS body_focus text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS body_type  text;
