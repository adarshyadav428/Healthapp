import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, createAdminClient } from '../../../../lib/supabase/server'
import { PUSH_KINDS } from '../../../../lib/pushBudget'
import { istDateStr } from '../../../../lib/dateUtils'

export const runtime = 'nodejs'

const schema = z.object({ kind: z.enum(PUSH_KINDS) })

/**
 * Stamps `push_sends.opened_at` when a notification is opened.
 *
 * Migration 033 described this column as "stamped by the service worker", but
 * nothing ever wrote it, which quietly broke the half of the push budget that
 * is supposed to protect the user: `sendBudgetedPush` counts consecutive
 * unopened sends and backs off after five, so with `opened_at` permanently
 * NULL the counter only ever grew. Someone who opened every single nudge was
 * on course to be treated exactly like someone who ignored all of them.
 *
 * Writes go through the admin client on purpose: 033 grants users SELECT on
 * their own rows and nothing more, because everything else that touches this
 * table is a service-role cron. Rather than open an UPDATE policy — which would
 * let a client mark any of its own sends opened, i.e. edit its own back-off —
 * the stamp stays server-side and is scoped to the caller's own id here.
 */
export async function POST(req: Request) {
  try {
    const supabase = createServerClient()
    const {
      data: { user },
      error: sessionError,
    } = await supabase.auth.getUser()

    if (sessionError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const json = await req.json().catch(() => null)
    const parsed = schema.safeParse(json)
    if (!parsed.success) return NextResponse.json({ error: 'Unknown notification kind' }, { status: 400 })

    const admin = createAdminClient()

    // The most recent unopened send of this kind, and only from today or
    // yesterday: a notification sitting in the tray for a week that finally
    // gets tapped says nothing useful about the nudge that was sent today, and
    // stamping an old row would understate the back-off.
    const since = istDateStr(new Date(Date.now() - 24 * 60 * 60 * 1000))
    const { data: candidate, error: readError } = await admin
      .from('push_sends')
      .select('id')
      .eq('user_id', user.id)
      .eq('kind', parsed.data.kind)
      .is('opened_at', null)
      .gte('sent_on', since)
      .order('sent_on', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (readError) throw new Error(readError.message)
    // Nothing to stamp is a normal outcome, not a failure: the row may already
    // be marked opened, or the send may predate the window.
    if (!candidate) return NextResponse.json({ ok: true, stamped: false })

    const { error: updateError } = await admin
      .from('push_sends')
      .update({ opened_at: new Date().toISOString() })
      .eq('id', candidate.id)
      .eq('user_id', user.id)

    if (updateError) throw new Error(updateError.message)
    return NextResponse.json({ ok: true, stamped: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
