'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { FoodLog, Profile } from '../../types/index'
import { CalorieHeroCard } from '../home/CalorieHeroCard'
import { GoalProjectionCard } from '../home/GoalProjectionCard'
import type { GoalProjection } from '../../lib/goalProjection'
import { PlateauCard } from '../home/PlateauCard'
import { StreakRestartCard } from '../home/StreakRestartCard'
import { pickDashboardMoment, type DashboardMoment } from '../../lib/dashboardMoments'
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
import { AI_TRIAL_SCANS, aiScansLeftLabel } from '../../lib/aiTrial'
import { nextStreakBadge } from '../../lib/badges'
import { proteinCoachLine } from '../../lib/proteinCoach'
import { cn } from '../../lib/utils'
import { formatIst } from '../../lib/dateUtils'
import { reportStreakMilestone } from '../../store/milestoneStore'
import { Flame, Plus, MessageCircle, Snowflake } from 'lucide-react'

const ChatLogModal = dynamic(() => import('../chat/ChatLogModal').then(m => m.ChatLogModal), { ssr: false })

interface Props {
  profile: Profile
  initialLogs: FoodLog[]
  streakDays: number
  /** Best streak ever reached — the badge shelf awards on this, so the "next
   *  badge" nudge must respect it or it offers rungs already earned. */
  longestStreakDays?: number
  /** Streak freezes available — free for everyone, never a Pro gate. */
  freezesBanked?: number
  loggedDates: string[]
  isPro: boolean
  /** Lifetime free AI scans left (0 for Pro — they're unlimited, never gated). */
  aiTrialRemaining?: number
  weeklyRecap: WeeklyRecap | null
  /** A repairable streak break, Pro only. Null when there's nothing to offer. */
  rescueOffer?: { date: string; streakAfter: number } | null
  /** Projected goal date. `kind: 'none'` renders nothing — see lib/goalProjection. */
  projection?: GoalProjection | null
  /** A stalled scale, and whether the logs explain it. See lib/plateau. */
  plateau?: Plateau | null
}

export function DashboardClient({ profile, initialLogs, streakDays, longestStreakDays = 0, freezesBanked = 0, loggedDates, isPro, aiTrialRemaining = 0, weeklyRecap, rescueOffer = null, projection = null, plateau = null }: Props) {
  const router = useRouter()
  const { user } = useUser()
  const { data: logs = initialLogs } = useFoodLogs(user?.id ?? null, new Date(), initialLogs)
  const [editingLog, setEditingLog] = useState<FoodLog | null>(null)
  const [showChat, setShowChat] = useState(false)

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

  const canUseAi = isPro || aiTrialRemaining > 0

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
  // IST, like every other day boundary here. In the device's zone this header
  // could name a different day than the diary directly beneath it (P1-9).
  const todayDate = formatIst(new Date(), { weekday: 'long', month: 'short', day: 'numeric' }, 'en-US')
  const nextBadge = nextStreakBadge(streakDays, longestStreakDays)

  // Home gets one moment. Each card still owns whether it *could* speak; this
  // decides which one actually does. Without it, a Pro user at a streak of zero
  // saw the rescue offer and the start-over card arguing with each other.
  const moment = useMemo<DashboardMoment | null>(() => {
    const eligible: DashboardMoment[] = []
    if (rescueOffer) eligible.push('streak-rescue')
    if (streakRestart(streakDays, longestStreakDays)) eligible.push('streak-restart')
    if (plateau && profile.id) eligible.push('plateau')
    return pickDashboardMoment(eligible)
  }, [rescueOffer, streakDays, longestStreakDays, plateau, profile.id])

  return (
    <>
      {/* ── Header ── */}
      <div className="flex items-start justify-between pt-2">
        <div>
          <p className="text-[13px] font-medium text-ink-3">{todayDate}</p>
          <h1 className="font-display mt-[3px] text-[24px] font-bold tracking-[-0.02em] text-ink">Today</h1>
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
              <span className="text-[13.5px] font-semibold tabular-nums text-ink">{streakDays}</span>
              {/* The in-app counterpart of the freeze-aware push. Ink, not red —
                  a banked freeze is reassurance, never a warning. */}
              {freezesBanked > 0 && (
                <span className="flex items-center gap-0.5 border-l border-hairline pl-1.5 text-[12px] font-semibold text-ink-3">
                  <Snowflake className="h-[13px] w-[13px]" strokeWidth={2} aria-hidden="true" />
                  <span className="tabular-nums">{freezesBanked}</span>
                  <span className="sr-only">
                    streak freeze{freezesBanked > 1 ? 's' : ''} banked
                  </span>
                </span>
              )}
            </div>
            {/* The badge shelf lives on Trends, which people rarely open — so the
                one rung that's actually within reach gets a whisper here. Ink,
                not ember: on Home ember is reserved for data, and this is a
                prompt. Hidden entirely when the next rung is far away. */}
            {nextBadge && (
              <p className="mt-[7px] pr-1 text-[11.5px] font-medium text-ink-3">
                {nextBadge.daysAway} {nextBadge.daysAway === 1 ? 'day' : 'days'} to {nextBadge.name} {nextBadge.emoji}
              </p>
            )}
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
            'mt-2.5 px-1 text-[13px]',
            proteinLine.tone === 'met' ? 'font-semibold text-good' : 'text-ink-2'
          )}
        >
          {proteinLine.text}
        </p>
      )}

      {/* ── One moment, not three. See lib/dashboardMoments for the order and
           for the contradiction it exists to prevent. ── */}
      {moment === 'streak-rescue' && <StreakRescueCard offer={rescueOffer} />}
      {moment === 'streak-restart' && (
        <StreakRestartCard streakDays={streakDays} longestStreakDays={longestStreakDays} />
      )}

      {/* ── Where today's number is taking them ── */}
      {projection && (
        <div className="mt-4">
          <GoalProjectionCard projection={projection} targetKg={profile.target_weight_kg ?? null} />
        </div>
      )}

      {/* ── The stall, named. Sits above the target suggestion on purpose: this
           explains what is happening over weeks, that offers a lever for it. ── */}
      {moment === 'plateau' && plateau && profile.id && (
        <PlateauCard plateau={plateau} goal={profile.goal} userId={profile.id} />
      )}

      {/* ── Suggested target adjustment (opt-in, never auto-applied) ── */}
      <AdaptiveTargetCard profile={profile} />

      {/* ── Weekly recap (Pro) ── */}


      <WeeklyRecapCard recap={weeklyRecap} isPro={isPro} dailyTarget={target} streakDays={streakDays} />

      {/* ── Recently logged ── */}
      <div className="mb-3 mt-6 flex items-baseline justify-between px-0.5">
        <p className="text-[16px] font-semibold tracking-[-0.01em] text-ink">Recently logged</p>
        {hasLogs && (
          <Link href="/log" className="text-[13px] font-semibold text-brand-ink tap-scale">See all</Link>
        )}
      </div>

      {hasLogs ? (
        <div className="flex flex-col gap-2.5">
          {recent.map((log) => (
            <RecentMealCard key={log.id} log={log} onClick={() => setEditingLog(log)} />
          ))}
          <Link
            href="/log?search=1"
            className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-[16px] border border-dashed border-brand-ring py-[13px] text-[13px] font-semibold text-brand-ink tap-scale"
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

      {/* Floating chat entry — describe a meal in free text instead of searching/scanning */}
      <button
        type="button"
        // Chat logging is entirely AI, so for a blocked user the modal is a
        // dead end — they'd type a meal out and only then be told it's Pro.
        // Send them to the paywall on tap instead. Someone with trial scans
        // left is not blocked, so they get the modal. (The camera FAB
        // deliberately isn't gated this way: that modal also does barcode
        // scanning, which stays free, so its Pro boundary lives at the
        // photo-scan call.)
        onClick={() => canUseAi ? setShowChat(true) : router.push('/upgrade?reason=chat_scan_pro')}
        aria-label={canUseAi ? 'Log a meal by describing it' : 'AI meal logging — a Pro feature'}
        className="fixed right-5 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-surface tap-scale"
        style={{ bottom: 'calc(84px + env(safe-area-inset-bottom))', boxShadow: 'var(--shadow-float)' }}
      >
        <MessageCircle className="h-5 w-5 text-brand" strokeWidth={2} />
      </button>

      {/* Trial countdown beside the AI FAB — only mid-trial (a verified free user
          who has spent at least one scan), so it informs rather than nags. */}
      {!isPro && aiTrialRemaining > 0 && aiTrialRemaining < AI_TRIAL_SCANS && (
        <p
          className="fixed right-5 z-30 whitespace-nowrap rounded-full bg-surface px-2.5 py-1 text-[10.5px] font-semibold text-ink-3 tabular-nums"
          style={{ bottom: 'calc(140px + env(safe-area-inset-bottom))', boxShadow: 'var(--shadow-float)' }}
        >
          {aiScansLeftLabel(aiTrialRemaining)}
        </p>
      )}

      {showChat && <ChatLogModal onClose={() => setShowChat(false)} />}
    </>
  )
}
