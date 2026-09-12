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
import { TodayMeals } from '../home/TodayMeals'
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
import { formatIst, istHour } from '../../lib/dateUtils'
import { firstNameFrom } from '../../lib/shareCard'
import { reportStreakMilestone } from '../../store/milestoneStore'
import { Flame, MessageCircle, Search, Snowflake, ChevronRight } from 'lucide-react'

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
  /** IST date keys with at least one log — the week strip's dots. */
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
  // IST, like every other day boundary here. In the device's zone this header
  // could name a different day than the diary directly beneath it (P1-9) — and
  // the greeting reads the same clock, or "Good evening" could sit over a day
  // the diary calls tomorrow.
  const todayDate = formatIst(new Date(), { weekday: 'long', month: 'short', day: 'numeric' }, 'en-US')
  const hour = istHour()
  const salutation = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = firstNameFrom(profile.display_name)
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
      {/* Two columns from lg: the day (greeting, ring, search) on the left,
          the diary and feedback on the right. One column below that. */}
      <div className="lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-16">
        <div className="lg:sticky lg:top-6">
          {/* ── Header: date, greeting, and the streak — present, but quiet ── */}
          <header className="pt-2">
            <div className="flex h-9 items-center justify-between gap-4">
              <p className="text-caption font-medium text-ink-3">{todayDate}</p>
            {streakDays > 0 && (
              <div
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 text-caption font-semibold tabular-nums text-ink"
                title={freezesBanked > 0
                  ? `${freezesBanked} streak freeze${freezesBanked > 1 ? 's' : ''} banked — a missed day is covered automatically`
                  : undefined}
              >
                <Flame className="h-4 w-4 text-brand" strokeWidth={2} aria-hidden="true" />
                <span>{streakDays}</span>
                <span className="sr-only">day streak</span>
                {/* The in-app counterpart of the freeze-aware push. Ink, not red —
                    a banked freeze is reassurance, never a warning. */}
                {freezesBanked > 0 && (
                  <span className="flex items-center gap-0.5 border-l border-hairline pl-1.5 text-ink-3">
                    <Snowflake className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                    <span>{freezesBanked}</span>
                    <span className="sr-only">
                      streak freeze{freezesBanked > 1 ? 's' : ''} banked
                    </span>
                  </span>
                )}
              </div>
            )}
            </div>
            <h1 className="mt-1 font-display text-title font-semibold text-ink">
              {firstName ? `${salutation}, ${firstName}` : salutation}
            </h1>
          </header>

          {/* ── Week strip: tap a day → that day's diary ── */}
          <WeekStrip loggedDates={loggedDates} />

          {/* ── Calorie ring + macros: the answer to "how much have I eaten" ── */}
          <div className="mt-6">
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
                'mt-3 px-1 text-caption',
                proteinLine.tone === 'met' ? 'font-semibold text-good' : 'text-ink-2'
              )}
            >
              {proteinLine.text}
            </p>
          )}

          {/* ── The next log: a search field that is really a link. /log?search=1
               opens FoodSearch with its input autofocused, so one tap here lands
               the cursor in the real box. A link and not an input on purpose —
               a field that navigates on focus is a trap for keyboard and
               screen-reader users, and there is nothing to type into here. ── */}
          <div className="relative mt-6">
            <Link
              href="/log?search=1"
              aria-label="Search food to log"
              className="flex h-12 w-full items-center gap-3 rounded-full border border-hairline bg-surface pl-4 pr-14 text-body text-ink-3 shadow-air tap-scale transition-colors hover:bg-surface-2"
            >
              <Search className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <span className="flex-1 truncate text-left">Search food to log</span>
            </Link>
            {/* The same chat entry FoodSearch keeps inside its own box, so the two
                search fields read as one control. Same gating as the bubble below. */}
            <button
              type="button"
              onClick={() => canUseAi ? setShowChat(true) : router.push('/upgrade?reason=chat_scan_pro')}
              aria-label={canUseAi ? 'Log a meal by describing it' : 'AI meal logging — a Pro feature'}
              className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-brand tap-scale hover:bg-surface-2"
            >
              <MessageCircle className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="mt-8 lg:mt-2">
          {/* ── Today's meals — framed, the same weight as the page, so the
               record of the day reads as one object. ── */}
          <section aria-label="Today's meals" className="rounded-card-lg border-2 border-hairline-2 px-4 pb-2 pt-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-title-sm font-semibold text-ink">Today&apos;s meals</h2>
              {hasLogs && (
                <Link href="/log" className="-my-3 inline-flex h-11 items-center text-caption font-semibold text-brand-ink tap-scale">See all</Link>
              )}
            </div>

            <div className="mt-2">
              {hasLogs ? (
                <TodayMeals logs={logs} onEdit={setEditingLog} />
              ) : (
                <p className="pb-2 text-body text-ink-3">
                  Nothing logged yet. Start with breakfast — a couple of idli, a bowl of poha, whatever you&apos;re having.
                </p>
              )}
            </div>
          </section>

          {/* ── Feedback: one moment (never two — see lib/dashboardMoments), the
               goal projection, and the next streak rung. Rows on the canvas,
               not cards; each one is a sentence with somewhere to go. ── */}
          {moment === 'streak-rescue' && <StreakRescueCard offer={rescueOffer} />}
          {moment === 'streak-restart' && (
            <StreakRestartCard streakDays={streakDays} longestStreakDays={longestStreakDays} />
          )}
          {moment === 'plateau' && plateau && profile.id && (
            <PlateauCard plateau={plateau} goal={profile.goal} userId={profile.id} />
          )}

          {(projection || nextBadge) && (
            <div className="mt-8 divide-y divide-hairline border-y border-hairline">
              {projection && (
                <GoalProjectionCard projection={projection} targetKg={profile.target_weight_kg ?? null} />
              )}
              {/* The badge shelf lives on Progress, which people rarely open — so the
                  one rung actually within reach gets a line here. Ink, not ember:
                  on Home ember is reserved for data, and this is a prompt. */}
              {nextBadge && (
                <Link href="/progress" className="flex items-center gap-3 px-1 py-3.5 tap-scale">
                  <span className="min-w-0 flex-1 text-caption text-ink-2">
                    {nextBadge.daysAway} {nextBadge.daysAway === 1 ? 'day' : 'days'} to your {nextBadge.name} badge
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" strokeWidth={1.75} aria-hidden="true" />
                </Link>
              )}
            </div>
          )}

          {/* ── Suggested target adjustment (opt-in, never auto-applied) ── */}
          <AdaptiveTargetCard profile={profile} />

          {/* ── Weekly recap (Pro) ── */}
          <WeeklyRecapCard recap={weeklyRecap} isPro={isPro} dailyTarget={target} streakDays={streakDays} />

      {/* Reminders priming — after the user has logged at least once */}
      {hasLogs && <NotificationPrimeCard />}

      {/* Email ownership ask — deferred from signup, renders after a few days */}
      <VerifyEmailCard />

      {/* Play Store rating ask — renders only inside the installed Play build */}
      <RatePromptCard streakDays={streakDays} />

      {/* A2HS install ask — renders only for mobile-web Chrome users */}
      <InstallPromptCard />
        </div>
      </div>

      {editingLog && (
        <EditFoodLogModal
          log={editingLog}
          onClose={() => setEditingLog(null)}
        />
      )}

      {/* ── AI chat bubble: describe a meal in free text, bottom-right above
          the tab bar. A surface-white bubble with an ember glyph so it reads as
          a second, quieter entry next to the ember camera FAB. Chat logging is
          entirely AI, so for a blocked user the modal is a dead end — they'd
          type a meal out and only then be told it's Pro. Send them to the
          paywall on tap instead. Someone with trial scans left is not blocked,
          so they get the modal; the modal itself says how many scans remain.
          (The camera FAB deliberately isn't gated this way: that modal also
          does barcode scanning, which stays free, so its Pro boundary lives at
          the photo-scan call.) ── */}
      <button
        type="button"
        onClick={() => canUseAi ? setShowChat(true) : router.push('/upgrade?reason=chat_scan_pro')}
        aria-label={canUseAi ? 'Log a meal by describing it' : 'AI meal logging — a Pro feature'}
        title={!isPro && aiTrialRemaining > 0 && aiTrialRemaining < AI_TRIAL_SCANS ? (aiScansLeftLabel(aiTrialRemaining) ?? undefined) : undefined}
        className="fixed right-5 z-30 grid h-16 w-16 place-items-center rounded-full border border-hairline bg-surface text-brand shadow-float tap-scale transition-colors hover:bg-surface-2"
        style={{ bottom: 'calc(var(--tab-bar-h, 72px) + 16px + env(safe-area-inset-bottom, 0px))' }}
      >
        <MessageCircle className="h-10 w-10" strokeWidth={1.75} aria-hidden="true" />
      </button>

      {showChat && <ChatLogModal onClose={() => setShowChat(false)} />}
    </>
  )
}
