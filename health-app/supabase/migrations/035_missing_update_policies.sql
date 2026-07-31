-- 035_missing_update_policies.sql
--
-- Two tables have RLS enabled with SELECT/INSERT/DELETE policies but no UPDATE
-- policy. Under RLS, "no policy" means "denied" — so an UPDATE silently affects
-- zero rows or errors, rather than doing the obvious thing. Found by the
-- 2026-07-31 audit; see docs/deep-dive-audit-2026-07-31.md findings P1-1 and P1-10.
--
-- ── push_subscriptions (P1-1, a live bug) ────────────────────────────────────
--
-- 020_push_subscriptions.sql created select/insert/delete only. But
-- app/api/push/subscribe/route.ts writes with:
--
--   supabase.from('push_subscriptions')
--     .upsert({...}, { onConflict: 'endpoint' })
--
-- on the USER-SCOPED client. An upsert that resolves to an UPDATE — which is
-- exactly what happens when a browser re-subscribes an endpoint it already
-- registered, the normal push-renewal path — needs UPDATE permission and does
-- not have it. The failure is quiet, and push is the app's only re-engagement
-- channel, so it degrades retention invisibly.
--
-- The endpoint is unique across users, so the policy must also stop user B from
-- claiming an endpoint row owned by user A: USING scopes the rows you may touch,
-- WITH CHECK stops you writing a row you would no longer own.

-- Idempotent: CREATE POLICY errors if the name already exists, and in the
-- Supabase SQL editor one failed statement aborts the whole run — so a partly
-- applied migration looks identical to one that never ran.
DROP POLICY IF EXISTS "Users update own push subscriptions" ON push_subscriptions;

CREATE POLICY "Users update own push subscriptions"
  ON push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── saved_meal_items (P1-10, latent) ─────────────────────────────────────────
--
-- Nothing updates this table today (app/api/meals/saved/route.ts only inserts,
-- selects and deletes), so this is pre-emptive: the first "edit a combo's
-- quantity" feature would otherwise silently no-op instead of failing loudly.
-- Same shape as the sibling policies in
-- 004_favourites_saved_meals_measurements.sql — ownership is proved through the
-- parent saved_meals row, not a user_id column on this table.

DROP POLICY IF EXISTS "Users update own meal items" ON saved_meal_items;

CREATE POLICY "Users update own meal items" ON saved_meal_items
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM saved_meals WHERE id = saved_meal_items.meal_id AND user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM saved_meals WHERE id = saved_meal_items.meal_id AND user_id = auth.uid())
  );
