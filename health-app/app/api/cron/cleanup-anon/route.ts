import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/server'
import {
  selectAbandonedAnonUsers,
  ANON_RETENTION_DAYS,
  type AnonCandidate,
} from '../../../../lib/anonCleanup'

export const runtime = 'nodejs'

/** Cap per run so one sweep can't run away — the rest is picked up tomorrow. */
const MAX_DELETES_PER_RUN = 200

/**
 * Sweeps abandoned anonymous accounts (deferred signup, step 5).
 *
 * Anonymous sign-in creates a real auth.users row for every visitor who taps
 * "Start free", so without this the table grows without bound and the user
 * count stops meaning anything. Only accounts that are anonymous, past the
 * retention window AND empty are removed — the predicate lives in
 * lib/anonCleanup.ts and is covered by tests/anonCleanup.test.ts, because this
 * route deletes accounts and a mistake here can't be undone.
 *
 * Deleting the auth user cascades to profiles (ON DELETE CASCADE) and from
 * there through the rest of the graph.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - ANON_RETENTION_DAYS * 86_400_000).toISOString()

  // Narrow in SQL first (NULL email + old enough) so we don't pull the whole
  // profiles table; selectAbandonedAnonUsers re-checks every condition anyway.
  const { data: rows, error } = await admin
    .from('profiles')
    .select('id, created_at, email')
    .is('email', null)
    .lt('created_at', cutoff)
    .limit(MAX_DELETES_PER_RUN)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!rows?.length) return NextResponse.json({ examined: 0, deleted: 0 })

  const candidates: AnonCandidate[] = []
  for (const row of rows) {
    const { count, error: countError } = await admin
      .from('food_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', row.id as string)

    // If we can't establish the log count, treat the account as having data.
    // Guessing "empty" on a failed read would delete someone's history.
    if (countError) continue

    candidates.push({
      id: row.id as string,
      created_at: row.created_at as string,
      email: (row.email as string | null) ?? null,
      logCount: count ?? 0,
    })
  }

  const doomed = selectAbandonedAnonUsers(candidates)

  let deleted = 0
  const failures: string[] = []
  for (const id of doomed) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(id)
    if (deleteError) failures.push(deleteError.message)
    else deleted++
  }

  return NextResponse.json({
    examined: candidates.length,
    deleted,
    ...(failures.length ? { failures: failures.slice(0, 5) } : {}),
  })
}
