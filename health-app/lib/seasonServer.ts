import type { SupabaseClient } from '@supabase/supabase-js'
import { currentSeason, seasonProgress, type Season, type SeasonProgress } from './seasons'
import { qualifyingDays } from './seasonQualifying'

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

/** ISO instant for the start of an IST day key. */
function istDayStart(dayKey: string): string {
  return new Date(Date.parse(`${dayKey}T00:00:00Z`) - IST_OFFSET_MS).toISOString()
}

/** ISO instant for the END of an IST day key (exclusive). */
function istDayEnd(dayKey: string): string {
  return new Date(Date.parse(`${dayKey}T00:00:00Z`) - IST_OFFSET_MS + 86_400_000).toISOString()
}

export type SeasonState = {
  season: Season
  joined: boolean
  progress: SeasonProgress
  /** Already stamped complete in the DB. */
  completedAt: string | null
}

/**
 * The running season and this user's standing in it, or null between seasons.
 *
 * Progress is recomputed from the logs every time rather than stored, for the
 * same reason the streak is: a counter drifts, and there is nothing to repair
 * when the number is a function of data that's already there.
 */
export async function getSeasonState(
  supabase: SupabaseClient,
  userId: string,
  now = new Date()
): Promise<SeasonState | null> {
  const season = currentSeason(now)
  if (!season) return null

  const from = istDayStart(season.startsOn)
  const to = istDayEnd(season.endsOn)

  const [participation, foodLogs, weighIns, profile] = await Promise.all([
    supabase
      .from('season_participants')
      .select('completed_at')
      .eq('user_id', userId)
      .eq('season_slug', season.slug)
      .maybeSingle(),
    season.focus === 'weigh_in'
      ? Promise.resolve({ data: [] as { logged_at: string; protein_g?: number }[] })
      : supabase
          .from('food_logs')
          .select('logged_at, protein_g')
          .eq('user_id', userId)
          .gte('logged_at', from)
          .lt('logged_at', to),
    season.focus === 'weigh_in'
      ? supabase
          .from('weight_logs')
          .select('measured_at')
          .eq('user_id', userId)
          .gte('measured_at', from)
          .lt('measured_at', to)
      : Promise.resolve({ data: [] as { measured_at: string }[] }),
    season.focus === 'protein'
      ? supabase.from('profiles').select('protein_g_target').eq('id', userId).maybeSingle()
      : Promise.resolve({ data: null as { protein_g_target: number } | null }),
  ])

  const days = qualifyingDays(season.focus, {
    foodLogs: foodLogs.data ?? [],
    weighIns: weighIns.data ?? [],
    proteinTargetG: profile.data?.protein_g_target ?? null,
  })

  return {
    season,
    joined: !!participation.data,
    progress: seasonProgress(season, days, now),
    completedAt: (participation.data?.completed_at as string | null) ?? null,
  }
}
