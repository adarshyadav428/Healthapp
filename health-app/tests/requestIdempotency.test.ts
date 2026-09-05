/**
 * lib/requestIdempotency.ts — F3 (2026-09-05 adversarial-audit).
 *
 * insertIdempotent() is the shared mechanism behind weight and exercise
 * logging's duplicate-write fix: a client-generated `client_request_id`,
 * unique per (user_id, client_request_id) via migration 046. These pin the
 * function in isolation; tests/routeWeightAdd.test.ts and
 * tests/routeExerciseAdd.test.ts pin it wired into the actual routes.
 */

import { describe, it, expect } from 'vitest'
import { createSupabaseMock } from './helpers/supabaseMock'
import { insertIdempotent, filterUncopiedToDay, insertFoodLogCopies } from '../lib/requestIdempotency'

const CONFLICT = { message: 'duplicate key value violates unique constraint', code: '23505' }
const OTHER_ERROR = { message: 'connection reset', code: '08006' }

describe('insertIdempotent', () => {
  it('inserts normally and reports alreadyExisted: false on the first attempt', async () => {
    const mock = createSupabaseMock({
      tables: { weight_logs: { insert: { data: { id: 'w1' }, error: null } } },
    })
    const result = await insertIdempotent(
      mock.client,
      'weight_logs',
      'user-1',
      { user_id: 'user-1', weight_kg: 70, client_request_id: 'key-1' },
      '*'
    )
    expect(result).toEqual({ ok: true, data: { id: 'w1' }, alreadyExisted: false })
  })

  it('on a unique-constraint conflict with a client_request_id, fetches and returns the existing row instead of erroring', async () => {
    const mock = createSupabaseMock({
      tables: {
        weight_logs: {
          insert: { data: null, error: CONFLICT },
          select: { data: { id: 'w1', weight_kg: 70 }, error: null },
        },
      },
    })
    const result = await insertIdempotent(
      mock.client,
      'weight_logs',
      'user-1',
      { user_id: 'user-1', weight_kg: 70, client_request_id: 'key-1' },
      '*'
    )
    expect(result).toEqual({ ok: true, data: { id: 'w1', weight_kg: 70 }, alreadyExisted: true })

    // The recovery fetch must be scoped to the same user AND the same key —
    // never just the key alone, which would leak another user's row shape.
    const selectCall = mock.callsTo('weight_logs').find((c) => c.operation === 'select')
    expect(selectCall?.filters).toContainEqual(['eq', 'user_id', 'user-1'])
    expect(selectCall?.filters).toContainEqual(['eq', 'client_request_id', 'key-1'])
  })

  it('returns the original error when a conflict happens with no client_request_id — nothing to recover with', async () => {
    const mock = createSupabaseMock({
      tables: { weight_logs: { insert: { data: null, error: CONFLICT } } },
    })
    const result = await insertIdempotent(
      mock.client,
      'weight_logs',
      'user-1',
      { user_id: 'user-1', weight_kg: 70, client_request_id: null },
      '*'
    )
    expect(result.ok).toBe(false)
  })

  it('returns the error unchanged for a non-conflict failure — never treated as an idempotent replay', async () => {
    const mock = createSupabaseMock({
      tables: { weight_logs: { insert: { data: null, error: OTHER_ERROR } } },
    })
    const result = await insertIdempotent(
      mock.client,
      'weight_logs',
      'user-1',
      { user_id: 'user-1', weight_kg: 70, client_request_id: 'key-1' },
      '*'
    )
    expect(result).toEqual({ ok: false, error: OTHER_ERROR.message })
  })
})

/**
 * P2 (2026-09-05 QA follow-up): /api/logs/copy-meal had zero
 * duplicate-submission protection. These two functions are the shared
 * mechanism behind its fix, scoped to (copied_from_id, target IST day) via
 * migration 048 — not copied_from_id alone (migration 047's original
 * global uniqueness), which would wrongly block pasting the same saved
 * meal onto two different, legitimate days.
 */
describe('filterUncopiedToDay', () => {
  const SOURCE = [
    { id: 'log-1', meal: 'breakfast' },
    { id: 'log-2', meal: 'breakfast' },
  ]

  it('keeps every row when none have been copied to the target day yet', async () => {
    const mock = createSupabaseMock({ tables: { food_logs: { select: { data: [] } } } })
    const result = await filterUncopiedToDay(mock.client, 'user-1', SOURCE, '2026-09-05T08:00:00.000Z')
    expect(result).toEqual({ ok: true, rows: SOURCE })
  })

  it('drops rows already copied to the SAME target day', async () => {
    const mock = createSupabaseMock({
      tables: {
        food_logs: {
          select: { data: [{ copied_from_id: 'log-1', logged_at: '2026-09-05T09:00:00.000Z' }] },
        },
      },
    })
    const result = await filterUncopiedToDay(mock.client, 'user-1', SOURCE, '2026-09-05T08:00:00.000Z')
    expect(result).toEqual({ ok: true, rows: [SOURCE[1]] })
  })

  it('keeps rows whose only prior copy landed on a DIFFERENT day — a new day is a new, legitimate paste', async () => {
    const mock = createSupabaseMock({
      tables: {
        // log-1 was copied once before, but onto 2026-09-03 — pasting it onto
        // 2026-09-05 is a separate action and must not be blocked.
        food_logs: {
          select: { data: [{ copied_from_id: 'log-1', logged_at: '2026-09-03T09:00:00.000Z' }] },
        },
      },
    })
    const result = await filterUncopiedToDay(mock.client, 'user-1', SOURCE, '2026-09-05T08:00:00.000Z')
    expect(result).toEqual({ ok: true, rows: SOURCE })
  })

  it('returns an empty array (not an error) with no source rows', async () => {
    const mock = createSupabaseMock({ tables: {} })
    const result = await filterUncopiedToDay(mock.client, 'user-1', [], '2026-09-05T08:00:00.000Z')
    expect(result).toEqual({ ok: true, rows: [] })
  })

  it('surfaces a real read failure as an error', async () => {
    const mock = createSupabaseMock({
      tables: { food_logs: { select: { data: null, error: OTHER_ERROR } } },
    })
    const result = await filterUncopiedToDay(mock.client, 'user-1', SOURCE, '2026-09-05T08:00:00.000Z')
    expect(result).toEqual({ ok: false, error: OTHER_ERROR.message })
  })
})

describe('insertFoodLogCopies', () => {
  it('inserts every row, tagging each with copied_from_id', async () => {
    const mock = createSupabaseMock({ tables: { food_logs: { insert: { data: null, error: null } } } })
    const rows = [
      { id: 'log-1', logged_at: '2026-09-04T07:00:00.000Z', kcal: 100 },
      { id: 'log-2', logged_at: '2026-09-04T07:00:00.000Z', kcal: 150 },
    ]
    const result = await insertFoodLogCopies(mock.client, rows, '2026-09-05T08:00:00.000Z')
    expect(result).toEqual({ ok: true, copied: 2, alreadyCopied: false })

    const insertCall = mock.callsTo('food_logs').find((c) => c.operation === 'insert')
    const payload = insertCall?.payload as Array<{ copied_from_id: string; logged_at: string }>
    expect(payload.map((r) => r.copied_from_id).sort()).toEqual(['log-1', 'log-2'])
    expect(payload.every((r) => r.logged_at === '2026-09-05T08:00:00.000Z')).toBe(true)
  })

  it('treats a 23505 conflict as a race already won by another request, not an error', async () => {
    const mock = createSupabaseMock({ tables: { food_logs: { insert: { data: null, error: CONFLICT } } } })
    const result = await insertFoodLogCopies(
      mock.client,
      [{ id: 'log-1', logged_at: '2026-09-04T07:00:00.000Z' }],
      '2026-09-05T08:00:00.000Z'
    )
    expect(result).toEqual({ ok: true, copied: 0, alreadyCopied: true })
  })

  it('returns a no-op for an empty row list rather than issuing an insert', async () => {
    const mock = createSupabaseMock({ tables: {} })
    const result = await insertFoodLogCopies(mock.client, [], '2026-09-05T08:00:00.000Z')
    expect(result).toEqual({ ok: true, copied: 0, alreadyCopied: true })
    expect(mock.callsTo('food_logs')).toEqual([])
  })

  it('returns a non-conflict error unchanged', async () => {
    const mock = createSupabaseMock({ tables: { food_logs: { insert: { data: null, error: OTHER_ERROR } } } })
    const result = await insertFoodLogCopies(
      mock.client,
      [{ id: 'log-1', logged_at: '2026-09-04T07:00:00.000Z' }],
      '2026-09-05T08:00:00.000Z'
    )
    expect(result).toEqual({ ok: false, error: OTHER_ERROR.message })
  })
})
