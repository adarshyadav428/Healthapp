import type { SupabaseClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'

/**
 * Records one unit of AI usage against a free-tier daily limit.
 *
 * These inserts used to be fire-and-forget (`await supabase.from(t).insert(...)`
 * with the result discarded). The Supabase client resolves rather than throws on
 * failure, so when migration 015 landed half-applied and the chat_logs INSERT
 * policy was missing, every write was silently rejected by RLS: the counter
 * never moved and the free daily limit stopped being enforced entirely. A
 * revenue leak that produced no error anywhere.
 *
 * We deliberately do NOT fail the request when the counter write fails — the
 * user has already paid the Gemini call and has their result; erroring now
 * would burn the cost and the goodwill. But it must never be invisible again,
 * so a failure is reported and surfaced to the caller.
 *
 * @returns true if the usage was recorded; false if it was not (limit unenforced).
 */
export async function recordAiUsage(
  supabase: SupabaseClient,
  table: 'chat_logs' | 'camera_photo_logs',
  userId: string
): Promise<boolean> {
  const { error } = await supabase.from(table).insert({ user_id: userId })
  if (!error) return true

  Sentry.captureException(new Error(`Usage counter write failed: ${table}`), {
    extra: { table, userId, supabaseError: error.message, code: error.code },
    tags: { area: 'entitlements' },
  })
  console.error(`[usage] failed to record ${table} for ${userId}: ${error.message}`)
  return false
}
