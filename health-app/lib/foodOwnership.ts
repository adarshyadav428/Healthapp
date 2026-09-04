/**
 * Whether `userId` may reference this food row — log it, favourite it, save it
 * into a combo, or have it surfaced as an AI-scan/chat match or a meal
 * suggestion.
 *
 * `foods_select` RLS (034_foods_rls_ownership.sql) is deliberately open to
 * every signed-in user, because the shared IFCT/curated/OFF catalogue has to
 * be readable by everyone. That means RLS is NOT a backstop for "may this
 * write reference that row" the way it is almost everywhere else in this
 * app — this function is the only thing standing between "I can read a row"
 * and "I may write a reference to it." Every food is referenceable by anyone
 * EXCEPT a `source='user'` custom food that belongs to a different account —
 * those are Pro-only, created via /api/foods/custom, and identified by their
 * `source_id` carrying the creator's id (`user_<uid>_<timestamp>`, the same
 * predicate 034's `owns_custom_food()` enforces at the database level for
 * INSERT/UPDATE/DELETE).
 *
 * The search route (app/api/foods/search) was fixed for this class first
 * (2026-09-04, audit P0-2): it excluded `source='user'` rows belonging to
 * other users from its results. That closed *discovery* through search, but
 * every other path that resolves a food_id — direct logging, AI name-match,
 * favouriting, saved combos, meal suggestions — had the identical gap and
 * none of them go through search. This function is the one check all of them
 * now share, so the class is closed once, not once per route.
 */
export function isFoodReferenceableBy(
  food: { source: string; source_id?: string | null },
  userId: string
): boolean {
  return food.source !== 'user' || (food.source_id?.startsWith(`user_${userId}_`) ?? false)
}
