'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { FoodLog, Profile } from '../../types/index'
import { CalorieHeroCard } from '../home/CalorieHeroCard'
import { GoalProjectionCard } from '../home/GoalProjectionCard'
import type { GoalProjection } from '../../lib/goalProjection'
import { PlateauCard } from '../home/PlateauCard'
import { StreakRestartCard } from '../home/StreakRestartCard'
import { useHomeSlot } from './HomeSlot'
import { streakRestart } from '../../lib/streakRestart'
import type { Plateau } from '../../lib/plateau'
import { RecentMealCard } from '../home/RecentMealCard'
import { EmptyMeals } from '../home/EmptyMeals'
import { EditFoodLogModal } from '../log/EditFoodLogModal'
import { RatePromptCard } from './RatePromptCard'
import { VerifyEmailCard } from './VerifyEmailCard'
import { WeekStrip } from './WeekStrip'
import { WeeklyRecapCard, type WeeklyRecap } from './WeeklyRecapCard'
import { StreakRescueCard } from './StreakRescueCard'
import { AdaptiveTargetCard } from './AdaptiveTargetCard'
import { NotificationPrimeCard } from './NotificationPrimeCard'
import { InstallPromptCard } from '../pwa/InstallPromptCard'
import { useFoodLogs } from '../../hooks/useFoodLogs'
import { useUser } from '../../hooks/useUser'
import { nextUnseenStreakMilestone } from '../../lib/logMilestones'
import { proteinCoachLine } from '../../lib/proteinCoach'
import { cn } from '../../lib/utils'
import { reportStreakMilestone } from '../../store/milestoneStore'
import { Flame, Plus, Snowflake } from 'lucide-react'


interface Props {
  profile: Profile
  initialLogs: FoodLog[]
  streakDays: number
  /** Best streak ever reached — what the comeback card counts back up to. */
  longestStreakDays?: number
  /** Streak freezes available — free for everyone, never a Pro gate. */
  freezesBanked?: number
  loggedDates: string[]
  isPro: boolean
  weeklyRecap: WeeklyRecap | null
  /** A repairable streak break, Pro only. Null when there's nothing to offer. */
  rescueOffer?: { date: string; streakAfter: number } | null
  /** Projected goal date. `kind: 'none'` renders nothing — see lib/goalProjection. */
  projection?: GoalProjection | null
  /** A stalled scale, and whether the logs explain it. See lib/plateau. */
  plateau?: Plateau | null
}

export function DashboardClient({ profile, initialLogs, streakDays, longestStreakDays = 0, freezesBanked = 0, loggedDates, isPro, weeklyRecap, rescueOffer = null, projection = null, plateau = null }: Props) {
  const { user } = useUser()
  const { data: logs = initialLogs } = useFoodLogs(user?.id ?? null, new Date(), initialLogs)
  const [editingLog, setEditingLog] = useState<FoodLog | null>(null)

  // Celebrate a 7/30/100-day streak once each (localStorage-gated, fail-open).
  useEffect(() => {
    if (!user?.id || streakDays <= 0) return
    const key = `gis.streakMilestones.${user.id}`
    let seen: number[] = []
    try {
      const raw = localStorage.getItem(key)
      if (raw) seen = JSON.parse(raw)
    } catch { /* fail open */ }
    const milestone = nextUnseenStreakMilestone(streakDays, seen)
    if (milestone == null) return
    try { localStorage.setItem(key, JSON.stringify([...seen, milestone])) } catch { /* noop */ }
    reportStreakMilestone(milestone)
  }, [user?.id, streakDays])

  const totals = useMemo(
    () => logs.reduce(
      (acc, l) => {
        acc.kcal      += l.kcal
        acc.protein_g += l.protein_g
        acc.carbs_g   += l.carbs_g
        acc.fat_g     += l.fat_g
        return acc
      },
      { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    ),
    [logs]
  )


  const target = profile.daily_calorie_target
  const hasLogs = logs.length > 0

  // Only once something's been logged — a gap line on an empty day is just the
  // whole target restated, which reads as nagging rather than coaching.
  const proteinLine = useMemo(
    () => (logs.length === 0
      ? null
      : proteinCoachLine(totals.protein_g, profile.protein_g_target ?? 0, profile.current_weight_kg)),
    [logs.length, totals.protein_g, profile.protein_g_target, profile.current_weight_kg]
  )
  const recent = logs.slice(0, 3) // logs arrive newest-first
  const todayDate = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

  // Home gets one attention card. These three know their eligibility from
  // props, so they claim it here; the six that have to probe the browser claim
  // it from inside themselves. Both routes go through the same order in
  // lib/dashboardMoments — see components/dashboard/HomeSlot.tsx for why the
  // probing ones were not lifted up here instead.
  //
  // This replaced a local picker that coordinated only these three, which meant
  // the other five still stacked underneath: a stalled scale, a Pro recap, a
  // verify-email card, a notifications ask and an install ask could all land on
  // one screen and push the calorie ring off the top.
  const showRescue = useHomeSlot('streak-rescue', Boolean(rescueOffer))
  const showRestart = useHomeSlot('streak-restart', Boolean(streakRestart(streakDays, longestStreakDays)))
  const showPlateau = useHomeSlot('plateau', Boolean(plateau && profile.id))

  return (
    <>
      {/* ── Header ── */}
      <div className="flex items-start justify-between pt-2">
        <div>
          <p className="text-caption font-medium text-ink-3">{todayDate}</p>
          <h1 className="font-display mt-[3px] text-title font-bold text-ink">Today</h1>
        </div>
        {streakDays > 0 && (
          <div className="flex flex-col items-end">
            <div
              className="flex items-center gap-1.5 rounded-full bg-surface px-[13px] py-[7px]"
              style={{ boxShadow: 'var(--shadow-air)' }}
              title={freezesBanked > 0
                ? `${freezesBanked} streak freeze${freezesBanked > 1 ? 's' : ''} banked — a missed day is covered automatically`
                : undefined}
            >
              <Flame className="h-[15px] w-[15px] text-brand" strokeWidth={2} />
              <span className="text-body font-semibold tabular-nums text-ink">{streakDays}</span>
              {/* The in-app counterpart of the freeze-aware push. Ink, not red —
                  a banked freeze is reassurance, never a warning. */}
              {freezesBanked > 0 && (
                <span className="flex items-center gap-0.5 border-l border-hairline pl-1.5 text-caption font-semibold text-ink-3">
                  <Snowflake className="h-[13px] w-[13px]" strokeWidth={2} aria-hidden="true" />
                  <span className="tabular-nums">{freezesBanked}</span>
                  <span className="sr-only">
                    streak freeze{freezesBanked > 1 ? 's' : ''} banked
                  </span>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Week strip: tap a day → that day's diary ── */}
      <WeekStrip loggedDates={loggedDates} />

      {/* ── Calorie hero ── */}
      <div className="mt-4">
        <CalorieHeroCard
          eaten={Math.round(totals.kcal)}
          target={target}
          proteinEaten={totals.protein_g}
          carbsEaten={totals.carbs_g}
          fatEaten={totals.fat_g}
          proteinTarget={profile.protein_g_target ?? 0}
          carbsTarget={profile.carbs_g_target ?? 0}
          fatTarget={profile.fat_g_target ?? 0}
        />
      </div>

      {/* ── Protein coach: one concrete next step, free for everyone ── */}
      {proteinLine && (
        <p
          className={cn(
            'mt-2.5 px-1 text-caption',
            proteinLine.tone === 'met' ? 'font-semibold text-good' : 'text-ink-2'
          )}
        >
          {proteinLine.text}
        </p>
      )}

      {/* ── The one attention card. Every candidate below renders nothing unless
           it won the slot, so at most one of these ever appears. The order they
           sit in here is cosmetic — lib/dashboardMoments decides. ── */}
      {showRescue && <StreakRescueCard offer={rescueOffer} />}
      {showRestart && (
        <StreakRestartCard streakDays={streakDays} longestStreakDays={longestStreakDays} />
      )}
      {showPlateau && plateau && profile.id && (
        <PlateauCard plateau={plateau} goal={profile.goal} userId={profile.id} />
      )}
      {/* No wrapper div: `projection` is never actually null (goalProjection
          returns `{ kind: 'none' }`, which is truthy), so a `mt-4` wrapper here
          rendered an empty 16px gap on every screen where the card stayed
          hidden. The card carries its own top margin instead. */}
      {projection && (
        <GoalProjectionCard projection={projection} targetKg={profile.target_weight_kg ?? null} />
      )}

      {/* ── Suggested target adjustment (opt-in, never auto-applied) ── */}
      <AdaptiveTargetCard profile={profile} />

      {/* ── Weekly recap (Pro) ── */}


      <WeeklyRecapCard recap={weeklyRecap} isPro={isPro} dailyTarget={target} streakDays={streakDays} />

      {/* ── Recently logged ── */}
      <div className="mb-3 mt-6 flex items-baseline justify-between px-0.5">
        <p className="text-body-lg font-semibold text-ink">Recently logged</p>
        {hasLogs && (
          <Link href="/log" className="text-caption font-semibold text-ink-2 tap-scale">See all</Link>
        )}
      </div>

      {hasLogs ? (
        <div className="flex flex-col gap-2.5">
          {recent.map((log) => (
            <RecentMealCard key={log.id} log={log} onClick={() => setEditingLog(log)} />
          ))}
          <Link
            href="/log?search=1"
            className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-card border border-dashed border-hairline py-[13px] text-caption font-semibold text-ink-2 tap-scale"
          >
            <Plus className="h-4 w-4" /> Add food manually
          </Link>
        </div>
      ) : (
        <EmptyMeals />
      )}

      {/* Reminders priming — after the user has logged at least once */}
      {hasLogs && <NotificationPrimeCard />}

      {/* Email ownership ask — deferred from signup, renders after a few days */}
      <VerifyEmailCard />

      {/* Play Store rating ask — renders only inside the installed Play build */}
      <RatePromptCard streakDays={streakDays} />

      {/* A2HS install ask — renders only for mobile-web Chrome users */}
      <InstallPromptCard />

      {editingLog && (
        <EditFoodLogModal
          log={editingLog}
          onClose={() => setEditingLog(null)}
        />
      )}

    </>
  )
}
