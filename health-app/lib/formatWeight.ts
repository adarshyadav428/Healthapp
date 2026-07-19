/**
 * Display formatting for weights.
 *
 * Every weight column is an unconstrained Postgres `numeric`
 * (`001_initial.sql`: `weight_kg numeric NOT NULL`, plus `current_weight_kg` /
 * `target_weight_kg` / `start_weight_kg` on profiles). PostgREST serialises
 * unconstrained `numeric` as a JSON **string**, not a number, because the type
 * has arbitrary precision and a JS float could silently lose digits. So the
 * value that actually reaches a component is `"84.50000000000000000000"` —
 * even though `types/index.ts` declares `weight_kg: number`.
 *
 * Rendering that raw put a wall of zeros across the Trends stat card, clipped
 * at the card edge. `.toFixed()` alone would not have saved us either: it is
 * not a method on a string, so it throws on the real runtime value.
 *
 * Hence this helper takes `string | number` rather than trusting the declared
 * type, and coerces before rounding. Keep using it for any weight that comes
 * from the database; a weight that came from a form input is already a real
 * number, but passing it through here is harmless and keeps call sites
 * uniform.
 */
export function formatKg(
  value: string | number | null | undefined,
  fallback = '—',
): string {
  if (value === null || value === undefined || value === '') return fallback
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return n.toFixed(1)
}
