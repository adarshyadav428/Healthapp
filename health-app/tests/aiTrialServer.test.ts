/**
 * The DB half of the AI-trial gate.
 *
 * `lib/aiTrial.ts` (the pure rules) is well covered by aiTrial.test.ts. This
 * file covers `lib/aiTrialServer.ts` — the half that actually talks to Postgres
 * and decides what a *failed read* means. That distinction is the whole point:
 * the 2026-07-16 audit's P0-2 was a swallowed count, where `chat_logs` was
 * missing and the error was discarded, so the counter read zero and the paid
 * limit silently stopped being enforced for weeks. Every AI call is a billed
 * Gemini request, so failing open costs real money and failing closed costs a
 * free user one scan.
 *
 * The rule under test is therefore not "does it count correctly" but "does it
 * refuse when it cannot count".
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

const captureException = vi.fn()
vi.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => captureException(...args),
}))

const { checkAiTrial, countAiTrialUsage } = await import('../lib/aiTrialServer')
const { AI_TRIAL_SCANS } = await import('../lib/aiTrial')

interface PostgrestError {
  message: string
  code?: string
}

interface TableResult {
  count?: number | null
  data?: unknown
  error?: PostgrestError | null
}

/** Records what each query filtered on, so the tests can assert scoping. */
interface RecordedQuery {
  table: string
  eq: [string, unknown][]
  head: boolean
}

/**
 * A Supabase test double covering the chains aiTrialServer actually uses:
 *
 *   .from(t).select(cols, { count, head }).eq(col, val)          -> awaited
 *   .from(t).select(cols).eq(col, val).maybeSingle()             -> awaited
 *
 * Chain methods return the same thenable object, so awaiting at any point
 * resolves to the result configured for that table — which is how the real
 * client behaves and what lets a missing `.maybeSingle()` still work.
 */
function mockSupabase(byTable: Record<string, TableResult>) {
  const queries: RecordedQuery[] = []

  const client = {
    from(table: string) {
      const record: RecordedQuery = { table, eq: [], head: false }
      queries.push(record)

      const result = byTable[table]
      if (!result) {
        throw new Error(`Test double has no result configured for table "${table}"`)
      }

      const resolved = {
        count: result.count ?? null,
        data: result.data ?? null,
        error: result.error ?? null,
      }

      const chain = {
        select(_columns: string, options?: { count?: string; head?: boolean }) {
          record.head = options?.head ?? false
          return chain
        },
        eq(column: string, value: unknown) {
          record.eq.push([column, value])
          return chain
        },
        maybeSingle() {
          return Promise.resolve(resolved)
        },
        then(onFulfilled: (v: typeof resolved) => unknown, onRejected?: (e: unknown) => unknown) {
          return Promise.resolve(resolved).then(onFulfilled, onRejected)
        },
      }

      return chain
    },
  }

  return { client: client as unknown as SupabaseClient, queries }
}

const VERIFIED = { data: { email_verified_at: '2026-07-20T10:00:00Z' }, error: null }
const UNVERIFIED = { data: { email_verified_at: null }, error: null }
const DB_DOWN: PostgrestError = { message: 'relation "chat_logs" does not exist', code: '42P01' }

beforeEach(() => {
  captureException.mockClear()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('countAiTrialUsage', () => {
  it('sums the two append-only tables into one shared pool', async () => {
    const { client } = mockSupabase({
      camera_photo_logs: { count: 2 },
      chat_logs: { count: 1 },
    })
    expect(await countAiTrialUsage(client, 'user-1')).toBe(3)
  })

  it('counts by head, scoped to the one user', async () => {
    const { client, queries } = mockSupabase({
      camera_photo_logs: { count: 0 },
      chat_logs: { count: 0 },
    })
    await countAiTrialUsage(client, 'user-1')

    expect(queries.map((q) => q.table).sort()).toEqual(['camera_photo_logs', 'chat_logs'])
    for (const query of queries) {
      expect(query.eq).toEqual([['user_id', 'user-1']])
      // head:true keeps this a COUNT — pulling the rows back would scale with usage.
      expect(query.head).toBe(true)
    }
  })

  it('reads an absent count as zero when the query itself succeeded', async () => {
    const { client } = mockSupabase({
      camera_photo_logs: { count: null },
      chat_logs: { count: null },
    })
    expect(await countAiTrialUsage(client, 'user-1')).toBe(0)
  })

  it.each([
    ['camera', { camera_photo_logs: { error: DB_DOWN }, chat_logs: { count: 0 } }],
    ['chat', { camera_photo_logs: { count: 0 }, chat_logs: { error: DB_DOWN } }],
    ['both', { camera_photo_logs: { error: DB_DOWN }, chat_logs: { error: DB_DOWN } }],
  ])('returns null — never a number — when the %s read fails', async (_label, tables) => {
    const { client } = mockSupabase(tables)
    expect(await countAiTrialUsage(client, 'user-1')).toBeNull()
  })

  it('reports a failed count to Sentry under the entitlements tag', async () => {
    const { client } = mockSupabase({
      camera_photo_logs: { count: 0 },
      chat_logs: { error: DB_DOWN },
    })
    await countAiTrialUsage(client, 'user-1')

    expect(captureException).toHaveBeenCalledTimes(1)
    const [error, context] = captureException.mock.calls[0] as [Error, Record<string, any>]
    expect(error).toBeInstanceOf(Error)
    expect(context.tags.area).toBe('entitlements')
    expect(context.extra.supabaseError).toBe(DB_DOWN.message)
    expect(context.extra.code).toBe(DB_DOWN.code)
    expect(context.extra.userId).toBe('user-1')
  })

  it('stays silent when both counts succeed', async () => {
    const { client } = mockSupabase({
      camera_photo_logs: { count: 1 },
      chat_logs: { count: 0 },
    })
    await countAiTrialUsage(client, 'user-1')
    expect(captureException).not.toHaveBeenCalled()
  })
})

describe('checkAiTrial', () => {
  it('allows a verified user who has calls left', async () => {
    const { client } = mockSupabase({
      profiles: VERIFIED,
      camera_photo_logs: { count: 1 },
      chat_logs: { count: 0 },
    })
    expect(await checkAiTrial(client, 'user-1')).toEqual({
      allowed: true,
      remaining: AI_TRIAL_SCANS - 1,
    })
  })

  it('blocks an unverified user before it blocks an exhausted one', async () => {
    const { client } = mockSupabase({
      profiles: UNVERIFIED,
      camera_photo_logs: { count: 99 },
      chat_logs: { count: 99 },
    })
    // Verifying is the action that could help them, so that is what they're told.
    expect(await checkAiTrial(client, 'user-1')).toEqual({
      allowed: false,
      block: 'unverified',
    })
  })

  it('blocks a verified user who has spent the pool', async () => {
    const { client } = mockSupabase({
      profiles: VERIFIED,
      camera_photo_logs: { count: AI_TRIAL_SCANS },
      chat_logs: { count: 0 },
    })
    expect(await checkAiTrial(client, 'user-1')).toEqual({
      allowed: false,
      block: 'exhausted',
    })
  })

  it('blocks a user already over the limit', async () => {
    const { client } = mockSupabase({
      profiles: VERIFIED,
      camera_photo_logs: { count: AI_TRIAL_SCANS + 5 },
      chat_logs: { count: 0 },
    })
    expect((await checkAiTrial(client, 'user-1')).allowed).toBe(false)
  })

  it('draws camera and chat from ONE pool, not two', async () => {
    const half = Math.floor(AI_TRIAL_SCANS / 2)
    const { client } = mockSupabase({
      profiles: VERIFIED,
      camera_photo_logs: { count: half },
      chat_logs: { count: AI_TRIAL_SCANS - half },
    })
    // Neither table alone reaches the limit; together they exactly do.
    expect(await checkAiTrial(client, 'user-1')).toEqual({
      allowed: false,
      block: 'exhausted',
    })
  })

  it('treats a missing profile row as unverified rather than throwing', async () => {
    const { client } = mockSupabase({
      profiles: { data: null, error: null },
      camera_photo_logs: { count: 0 },
      chat_logs: { count: 0 },
    })
    expect(await checkAiTrial(client, 'user-1')).toEqual({
      allowed: false,
      block: 'unverified',
    })
  })
})

/**
 * The money tests. Each of these is a DB failure that, if it read as zero
 * usage, would hand out unlimited billed Gemini calls to every free account —
 * which is precisely what happened before.
 */
describe('checkAiTrial fails CLOSED', () => {
  it.each([
    [
      'the usage count fails',
      {
        profiles: VERIFIED,
        camera_photo_logs: { count: 0 },
        chat_logs: { error: DB_DOWN },
      },
    ],
    [
      'the profile read fails',
      {
        profiles: { data: null, error: DB_DOWN },
        camera_photo_logs: { count: 0 },
        chat_logs: { count: 0 },
      },
    ],
    [
      'everything fails',
      {
        profiles: { data: null, error: DB_DOWN },
        camera_photo_logs: { error: DB_DOWN },
        chat_logs: { error: DB_DOWN },
      },
    ],
  ])('denies when %s', async (_label, tables) => {
    const { client } = mockSupabase(tables)
    const decision = await checkAiTrial(client, 'user-1')

    expect(decision.allowed).toBe(false)
    // A broken read must never be reported as remaining allowance.
    expect(decision).not.toHaveProperty('remaining')
  })

  it('never reports allowance from a count it could not read', async () => {
    // The exact 2026-07-16 shape: chat_logs missing, user verified, zero camera
    // scans. Swallowing the error here reads as "0 of 3 used" and lets every
    // call through forever.
    const { client } = mockSupabase({
      profiles: VERIFIED,
      camera_photo_logs: { count: 0 },
      chat_logs: { error: { message: 'relation "chat_logs" does not exist', code: '42P01' } },
    })
    expect(await checkAiTrial(client, 'user-1')).toEqual({
      allowed: false,
      block: 'exhausted',
    })
  })
})
