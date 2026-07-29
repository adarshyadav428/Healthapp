import { NextResponse } from 'next/server'
import { createServerClient, createAdminClient, getAuthedUser } from '../../../lib/supabase/server'
import { getSeasonState } from '../../../lib/seasonServer'
import { captureServerEvent } from '../../../lib/posthog/server'

export const runtime = 'nodejs'

/** Current season + this user's standing. Null between seasons. */
export async function GET() {
  const supabase = createServerClient()
  const user = await getAuthedUser(supabase)
  return NextResponse.json({ state: await getSeasonState(supabase, user.id) })
}

/**
 * Join the running season, or claim completion.
 *
 * Completion is stamped here rather than by the client because progress is
 * recomputed from the logs — a client-asserted "I finished" would be a client
 * asserting facts about its own data. Migration 031's RLS lets users insert
 * their own participation but never update it, so the stamp goes through the
 * service-role client.
 */
export async function POST() {
  const supabase = createServerClient()
  const user = await getAuthedUser(supabase)

  const state = await getSeasonState(supabase, user.id)
  if (!state) {
    return NextResponse.json({ error: 'No season is running right now.' }, { status: 409 })
  }

  if (!state.joined) {
    const { error } = await supabase
      .from('season_participants')
      .upsert(
        { user_id: user.id, season_slug: state.season.slug },
        { onConflict: 'user_id,season_slug' }
      )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    captureServerEvent(user.id, 'season_joined', {
      season: state.season.slug,
      focus: state.season.focus,
    })
  }

  // Stamp completion the first time the target is genuinely met.
  if (state.progress.complete && !state.completedAt) {
    const admin = createAdminClient()
    const { error } = await admin
      .from('season_participants')
      .update({ completed_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('season_slug', state.season.slug)
    if (!error) {
      captureServerEvent(user.id, 'season_completed', {
        season: state.season.slug,
        focus: state.season.focus,
        days: state.progress.done,
      })
    }
  }

  return NextResponse.json({ state: await getSeasonState(supabase, user.id) })
}
