-- 034_foods_rls_ownership.sql
--
-- Close a data-destruction hole in the shared `foods` catalogue.
--
-- 001_initial.sql created these:
--
--   CREATE POLICY foods_update ON foods FOR UPDATE USING (auth.uid() IS NOT NULL) ...
--   CREATE POLICY foods_delete ON foods FOR DELETE USING (auth.uid() IS NOT NULL);
--
-- "Are you logged in" is not an ownership check. Any authenticated user could
-- call PostgREST directly with an ordinary anon key and a valid session JWT and
-- UPDATE or DELETE *any* row in the shared catalogue — IFCT rows, OFF rows, or
-- another user's custom food. Ownership was only ever enforced in JavaScript, in
-- app/api/foods/custom/route.ts, on a session-scoped client; skipping that route
-- skipped the check entirely.
--
-- DELETE was the dangerous half. Four tables cascade off foods:
--
--   food_logs.food_id        ON DELETE CASCADE  (001_initial.sql)
--   food_favourites.food_id  ON DELETE CASCADE  (004_favourites_saved_meals_measurements.sql)
--   saved_meal_items.food_id ON DELETE CASCADE  (004_favourites_saved_meals_measurements.sql)
--   food_dismissals.food_id  ON DELETE CASCADE  (030_food_dismissals.sql)
--
-- So one DELETE of a popular row ("Cooked Rice (Chawal)") silently removed that
-- food from EVERY user's diary, with no error and no way to tell it had
-- happened. Found by the 2026-07-31 audit; see docs/deep-dive-audit-2026-07-31.md
-- finding P0-1.
--
-- The rule below: a user may only write catalogue rows they own. Custom foods
-- are inserted by app/api/foods/custom/route.ts as
--
--   source     = 'user'
--   source_id  = 'user_' || <auth uid> || '_' || <epoch ms>
--
-- so ownership is derivable from source_id without adding a column (and without
-- a rewrite of the existing rows, which keep working unchanged).
--
-- SELECT is deliberately left open to any authenticated user: the catalogue is
-- shared by design, and search depends on reading every source.
--
-- Every OTHER write path into `foods` uses the service-role client, which
-- bypasses RLS and is unaffected: seeding (admin/seed-indian-foods), camera and
-- chat estimate rows, Open Food Facts persistence in the search route, and — as
-- of this change — the barcode lookup, which was the one session-client
-- catalogue writer and has been moved to createAdminClient() alongside this
-- migration. If a future route writes `foods` with a user-scoped client for
-- anything other than that user's own custom food, it will fail closed here.
-- That is the intended behaviour: use the admin client for catalogue writes.

-- Owns a catalogue row = it is a custom food whose source_id carries this uid.
-- STABLE + explicit search_path so it is safe to call from a policy.
CREATE OR REPLACE FUNCTION public.owns_custom_food(row_source text, row_source_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT row_source = 'user'
     AND auth.uid() IS NOT NULL
     AND row_source_id LIKE 'user_' || auth.uid()::text || '_%';
$$;

DROP POLICY IF EXISTS foods_insert ON foods;
DROP POLICY IF EXISTS foods_update ON foods;
DROP POLICY IF EXISTS foods_delete ON foods;

-- INSERT: a user may only add their own custom food. Previously any
-- authenticated user could insert arbitrary rows into the shared catalogue,
-- which is a spam/poisoning vector even though it destroys nothing.
CREATE POLICY foods_insert ON foods
  FOR INSERT
  WITH CHECK (public.owns_custom_food(source, source_id));

-- UPDATE: only your own custom food, and you may not rewrite it into someone
-- else's row (hence the same predicate in WITH CHECK).
CREATE POLICY foods_update ON foods
  FOR UPDATE
  USING (public.owns_custom_food(source, source_id))
  WITH CHECK (public.owns_custom_food(source, source_id));

-- DELETE: only your own custom food. This is the cascade-bearing one.
CREATE POLICY foods_delete ON foods
  FOR DELETE
  USING (public.owns_custom_food(source, source_id));

-- foods_select is intentionally untouched:
--   CREATE POLICY foods_select ON foods FOR SELECT USING (auth.uid() IS NOT NULL);
