/**
 * The write half of the AI trial counter.
 *
 * `aiTrialServer` reads the count; this writes it. Together they are the whole
 * enforcement of the lifetime allowance, and this side has the more expensive
 * history: when migration 015 landed half-applied and the `chat_logs` INSERT
 * policy was missing, every write was silently rejected by RLS. The Supabase
 * client resolves rather than throws, the result was discarded, so the counter
 * never moved and the free limit stopped being enforced entirely — a revenue
 * leak that produced no error anywhere.
 *
 * The behaviour under test is a deliberate asymmetry, and both halves matter:
 * a failed write must NOT fail the request (the user has already paid for the
 * Gemini call and has their result), but it must never again be invisible.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

const captureException = vi.fn()
vi.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => captureException(...args),
}))

const { recordAiUsage } = await import('../lib/usageCounter')

const RLS_REJECTION = {
  message: 'new row violates row-level security policy for table "chat_logs"',
  code: '42501',
}

/** Records what was inserted where, and returns a configurable error. */
function mockSupabase(error: { message: string; code?: string } | null = null) {
  const inserts: { table: string; row: unknown }[] = []
  const client = {
    from(table: string) {
      return {
        insert(row: unknown) {
          inserts.push({ table, row })
          return Promise.resolve({ data: null, error })
        },
      }
    },
  }
  return { client: client as unknown as SupabaseClient, inserts }
}

beforeEach(() => {
  captureException.mockClear()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('recordAiUsage', () => {
  it.each(['chat_logs', 'camera_photo_logs'] as const)(
    'records one row in %s against the user',
    async (table) => {
      const { client, inserts } = mockSupabase()
      expect(await recordAiUsage(client, table, 'user-1')).toBe(true)
      expect(inserts).toEqual([{ table, row: { user_id: 'user-1' } }])
    }
  )

  /**
   * The exact 2026 shape: RLS rejects the insert. It must return false rather
   * than the truthy "no exception was thrown" that hid it last time.
   */
  it('reports false when RLS rejects the write', async () => {
    const { client } = mockSupabase(RLS_REJECTION)
    expect(await recordAiUsage(client, 'chat_logs', 'user-1')).toBe(false)
  })

  it('does not throw on a failed write', async () => {
    // The user has already paid for the Gemini call and has their result;
    // erroring now would burn the cost and the goodwill.
    const { client } = mockSupabase(RLS_REJECTION)
    await expect(recordAiUsage(client, 'chat_logs', 'user-1')).resolves.toBe(false)
  })

  it('reports a failure to Sentry under the entitlements tag', async () => {
    const { client } = mockSupabase(RLS_REJECTION)
    await recordAiUsage(client, 'chat_logs', 'user-1')

    expect(captureException).toHaveBeenCalledTimes(1)
    const [error, context] = captureException.mock.calls[0] as [Error, Record<string, any>]
    // The table has to be in the message: "a counter write failed" is not
    // actionable at 3am, "chat_logs" is.
    expect(error.message).toContain('chat_logs')
    expect(context.tags.area).toBe('entitlements')
    expect(context.extra).toMatchObject({
      table: 'chat_logs',
      userId: 'user-1',
      supabaseError: RLS_REJECTION.message,
      code: RLS_REJECTION.code,
    })
  })

  it('stays silent on success', async () => {
    const { client } = mockSupabase()
    await recordAiUsage(client, 'camera_photo_logs', 'user-1')
    expect(captureException).not.toHaveBeenCalled()
  })

  it('names the failing table so two counters are never confused', async () => {
    const { client } = mockSupabase(RLS_REJECTION)
    await recordAiUsage(client, 'camera_photo_logs', 'user-2')
    expect((captureException.mock.calls[0][0] as Error).message).toContain('camera_photo_logs')
  })
})
