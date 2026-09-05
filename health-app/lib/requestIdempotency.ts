import type { SupabaseClient } from '@supabase/supabase-js'
import { istDateStr } from './dateUtils'

/**
 * Insert one row keyed by a client-supplied idempotency key
 * (`client_request_id`), unique per `(user_id, client_request_id)` — see
 * migration 046. A rapid double-tap, a race between two near-simultaneous
 * requests, or a client retry after a timeout all carry the SAME key (it is
 * generated once per logical submission, not per HTTP call), so whichever
 * insert lands first wins and every other one is recognised as a replay of
 * that same submission rather than a new row. A genuinely separate entry
 * (the user opens the form again) gets a fresh key and is never affected.
 *
 * `client_request_id` is optional on the caller's row — omitting it (an
 * older client, or a caller that doesn't need this) just disables dedup for
 * that insert, since a partial unique index never conflicts on NULL.
 *
 * 2026-09-05 adversarial-audit F3.
 */
export async function insertIdempotent<T>(
  supabase: SupabaseClient,
  table: string,
  userId: string,
  row: Record<string, unknown>,
  selectColumns: string
): Promise<{ ok: true; data: T; alreadyExisted: boolean } | { ok: false; error: string }> {
  const { data, error } = await supabase.from(table).insert(row).select(selectColumns).single()
  if (!error) return { ok: true, data: data as T, alreadyExisted: false }

  const clientRequestId = row.client_request_id
  if (error.code === '23505' && clientRequestId) {
    const { data: existing, error: fetchErr } = await supabase
      .from(table)
      .select(selectColumns)
      .eq('user_id', userId)
      .eq('client_request_id', clientRequestId as string)
      .maybeSingle()
    if (!fetchErr && existing) return { ok: true, data: existing as T, alreadyExisted: true }
  }

  return { ok: false, error: error.message }
}

/**
 * Filter out source `food_logs` rows that have already been copied onto the
 * same target IST day, so a caller only inserts what's genuinely new.
 *
 * Scoped to `(copied_from_id, target day)`, not `copied_from_id` alone —
 * copy-yesterday's original migration 047 index used a global per-source-row
 * uniqueness, which is correct there (its target is always "today" at call
 * time) but wrong for a feature like copy-meal, where pasting the same saved
 * breakfast onto two different days is a normal, legitimate action. Migration
 * 048 widens the index to match: `(copied_from_id, target IST day)`.
 *
 * 2026-09-05 QA follow-up (P2: copy-meal duplicate-submission).
 */
export async function filterUncopiedToDay<T extends { id: string }>(
  supabase: SupabaseClient,
  userId: string,
  sourceRows: T[],
  loggedAt: string
): Promise<{ ok: true; rows: T[] } | { ok: false; error: string }> {
  if (sourceRows.length === 0) return { ok: true, rows: [] }
  const targetDay = istDateStr(new Date(loggedAt))
  const sourceIds = sourceRows.map((r) => r.id)

  const { data: existing, error } = await supabase
    .from('food_logs')
    .select('copied_from_id, logged_at')
    .eq('user_id', userId)
    .in('copied_from_id', sourceIds)
  if (error) return { ok: false, error: error.message }

  const alreadyCopiedIds = new Set(
    (existing ?? [])
      .filter((r) => istDateStr(new Date(r.logged_at as string)) === targetDay)
      .map((r) => r.copied_from_id as string)
  )

  return { ok: true, rows: sourceRows.filter((r) => !alreadyCopiedIds.has(r.id)) }
}

/**
 * Insert already-filtered source rows as copies onto `loggedAt`, tagging each
 * with `copied_from_id`. Pairs with `filterUncopiedToDay` — call that first,
 * fetch anything else the caller needs in between (e.g. activation context,
 * which must see state from BEFORE this insert), then insert here.
 *
 * A 23505 on the unique index means another request won a genuine race in
 * the gap between the filter and this insert — treated as "already copied",
 * not an error.
 */
export async function insertFoodLogCopies(
  supabase: SupabaseClient,
  sourceRows: Array<Record<string, unknown> & { id: string; logged_at: string }>,
  loggedAt: string
): Promise<{ ok: true; copied: number; alreadyCopied: boolean } | { ok: false; error: string }> {
  if (sourceRows.length === 0) return { ok: true, copied: 0, alreadyCopied: true }

  const rows = sourceRows.map(({ id, logged_at: _at, ...rest }) => ({
    ...rest,
    logged_at: loggedAt,
    copied_from_id: id,
  }))

  const { error } = await supabase.from('food_logs').insert(rows)
  if (error) {
    if (error.code === '23505') return { ok: true, copied: 0, alreadyCopied: true }
    return { ok: false, error: error.message }
  }

  return { ok: true, copied: rows.length, alreadyCopied: false }
}
