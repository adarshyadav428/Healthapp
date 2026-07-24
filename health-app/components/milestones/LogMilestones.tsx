'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Crown, X, Share2, Loader2 } from 'lucide-react'
import { Button } from '../ui/button'
import { ConfettiBurst } from '../ui/ConfettiBurst'
import { useMilestoneStore, clearPendingMilestone, clearWeightMilestone, clearStreakMilestone } from '../../store/milestoneStore'
import { getLogMilestoneAction, isShareableStreakMilestone, type MilestoneAction } from '../../lib/logMilestones'
import { paywallPriceLine } from '../../lib/pricing'
import { isPlayBillingAvailable } from '../../lib/play/billing'
import { getBrowserSupabaseClient } from '../../lib/supabase/client'
import { formatKg } from '../../lib/formatWeight'
import { captureEvent } from '../../lib/posthog/client'
import { buildShareCardData, shareProgressCard } from '../../lib/shareCard'
import { toast } from '../ui/use-toast'

const celebrationKey = (uid: string) => `gis.firstLogCelebrated.${uid}`
const paywallKey = (uid: string) => `gis.logPaywallSeen.${uid}`

// localStorage can throw (private mode, storage denied) — fail open to
// "not seen": worst case a one-time surface repeats, never blocks anything.
function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}
function writeFlag(key: string): void {
  try {
    localStorage.setItem(key, '1')
  } catch {
    /* noop */
  }
}

const PRO_FEATURES = [
  ['Full history', ' — beyond the last 7 days'],
  ['Unlimited', ' AI photo & chat logging'],
  ['Custom foods', ' & family recipes'],
] as const

/**
 * The single overlay behind every post-log milestone (mounted once in
 * app/providers.tsx). Log flows call reportLogMilestone() with the
 * `milestone` field from the response; this component decides (pure logic in
 * lib/logMilestones.ts), marks the surface as seen atomically with showing
 * it, and renders either the first-log celebration or the one-time paywall
 * interstitial. Logging itself is never blocked.
 */
export function LogMilestones() {
  const pending = useMilestoneStore((s) => s.pending)
  const pendingWeightKg = useMilestoneStore((s) => s.pendingWeightKg)
  const pendingStreak = useMilestoneStore((s) => s.pendingStreak)
  const [active, setActive] = useState<MilestoneAction>(null)
  const [weightKg, setWeightKg] = useState<number | null>(null)
  const [streakDays, setStreakDays] = useState<number | null>(null)
  const [sharing, setSharing] = useState(false)
  // Whether to show trial copy on the interstitial. Starts false so a slow
  // probe can never flash a trial promise at a web user, where no trial exists.
  const [playAvailable, setPlayAvailable] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!pending) return
    let cancelled = false

    const decide = async () => {
      const {
        data: { session },
      } = await getBrowserSupabaseClient().auth.getSession()
      const uid = session?.user?.id
      if (cancelled) return
      clearPendingMilestone()
      if (!uid) return

      const action = getLogMilestoneAction(pending, {
        celebrationSeen: readFlag(celebrationKey(uid)),
        paywallSeen: readFlag(paywallKey(uid)),
      })
      if (!action) return

      // Mark seen atomically with showing, so a crash/refresh mid-display
      // never replays the surface.
      if (action === 'first_log_celebration') {
        writeFlag(celebrationKey(uid))
        captureEvent('first_log_celebration_shown')
      } else {
        writeFlag(paywallKey(uid))
        // Client-side deliberately: only the client knows the seen-flag, so
        // firing here (same event name + source as the server-side gates)
        // avoids over-counting paywall_viewed.
        captureEvent('paywall_viewed', { source: 'free_logs' })
      }
      setActive(action)
    }

    decide()
    return () => {
      cancelled = true
    }
  }, [pending])

  // The 3-day trial is a Play Console offer, so the interstitial may only
  // promise it inside the installed app. Probed lazily — this component is
  // mounted on every page (app/providers.tsx), and the answer is only ever
  // needed on the one screen that quotes a price.
  useEffect(() => {
    if (active !== 'log_paywall') return
    let cancelled = false
    isPlayBillingAvailable().then((available) => {
      if (!cancelled) setPlayAvailable(available)
    })
    return () => {
      cancelled = true
    }
  }, [active])

  // Weight milestone comes pre-decided by the server (no seen-flags needed —
  // a threshold can only be crossed for the first time once).
  useEffect(() => {
    if (!pendingWeightKg) return
    clearWeightMilestone()
    captureEvent('weight_milestone_shown', { kg: pendingWeightKg })
    setWeightKg(pendingWeightKg)
  }, [pendingWeightKg])

  // Streak milestone comes pre-decided (seen-flag) by the dashboard.
  useEffect(() => {
    if (!pendingStreak) return
    clearStreakMilestone()
    captureEvent('streak_milestone_shown', { days: pendingStreak })
    setStreakDays(pendingStreak)
  }, [pendingStreak])

  // The three big streak rungs offer a share card, which needs more than 2.6s
  // of decision time — those wait for a tap instead of vanishing mid-thought.
  const canShareStreak = streakDays != null && isShareableStreakMilestone(streakDays)

  // Celebrations auto-dismiss; the paywall waits for an explicit choice.
  useEffect(() => {
    if (active !== 'first_log_celebration' && weightKg == null && streakDays == null) return
    if (canShareStreak) return
    const t = setTimeout(() => {
      setActive(null)
      setWeightKg(null)
      setStreakDays(null)
    }, 2600)
    return () => clearTimeout(t)
  }, [active, weightKg, streakDays, canShareStreak])

  const shareStreak = async () => {
    if (sharing || streakDays == null) return
    setSharing(true)
    try {
      const data = buildShareCardData({ streakDays, startWeightKg: null, currentWeightKg: null })
      if (!data) return
      const method = await shareProgressCard(data)
      captureEvent('progress_card_shared', { method, streak: streakDays, source: 'streak_milestone' })
      if (method === 'downloaded') {
        toast({ title: 'Card saved', description: 'Image downloaded — share it anywhere.', duration: 3000 })
      }
      setStreakDays(null)
    } catch (err) {
      toast({ title: 'Could not create the card', description: (err as Error).message, variant: 'error' })
    } finally {
      setSharing(false)
    }
  }

  if (active === 'first_log_celebration' || weightKg != null || streakDays != null) {
    const isWeight = weightKg != null
    const isStreak = streakDays != null
    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center px-8"
        style={{ background: 'var(--scrim)' }}
        onClick={() => {
          setActive(null)
          setWeightKg(null)
          setStreakDays(null)
        }}
        role="status"
      >
        <div className="relative w-full max-w-xs rounded-sheet bg-surface px-6 pb-7 pt-8 text-center shadow-float">
          <ConfettiBurst />
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-[28px]">
            {isStreak ? '🔥' : isWeight ? '⚖️' : '🎉'}
          </div>
          <h2 className="mt-4 font-display text-[22px] font-bold text-ink">
            {isStreak ? `${streakDays}-day streak!` : isWeight ? `${formatKg(weightKg)} kg down!` : 'First meal logged!'}
          </h2>
          <p className="mt-1.5 text-sm text-ink-2">
            {isStreak
              ? `${streakDays} days in a row — this is how the habit sticks. Keep it going.`
              : isWeight
              ? 'A new milestone — that consistency is paying off.'
              : "That's the hardest part done. Log every meal today and your streak begins."}
          </p>

          {canShareStreak && (
            <div className="mt-5 space-y-2" onClick={(e) => e.stopPropagation()}>
              <Button
                type="button"
                onClick={shareStreak}
                disabled={sharing}
                className="w-full gap-2 tap-scale"
              >
                {sharing
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Share2 className="h-4 w-4" strokeWidth={2} />}
                {sharing ? 'Creating…' : 'Share this'}
              </Button>
              <button
                type="button"
                onClick={() => setStreakDays(null)}
                className="w-full py-1.5 text-[13px] font-semibold text-ink-3 tap-scale"
              >
                Not now
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (active === 'log_paywall') {
    return (
      <div className="fixed inset-0 z-[100] overflow-y-auto bg-canvas">
        <div className="relative mx-auto flex min-h-full w-full max-w-md flex-col px-6 pb-8 pt-14">
          <button
            aria-label="Close"
            onClick={() => setActive(null)}
            className="tap-scale absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-ink-2"
          >
            <X size={16} strokeWidth={2.2} />
          </button>

          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand">
            <Crown size={22} strokeWidth={2} />
          </div>

          <div className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-brand-ink">
            GetInShape Pro
          </div>
          <h1 className="mt-1.5 font-display text-[28px] font-bold leading-tight text-ink">
            You&apos;re building
            <br />a real habit.
          </h1>
          <p className="mt-2.5 text-sm text-ink-2">
            Three meals logged — that&apos;s how progress starts. Pro takes the limits off.
          </p>

          <div className="mt-7 space-y-3.5">
            {PRO_FEATURES.map(([bold, rest]) => (
              <div key={bold} className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <Check size={12} strokeWidth={3} />
                </span>
                <span className="text-sm text-ink">
                  <b>{bold}</b>
                  {rest}
                </span>
              </div>
            ))}
          </div>

          <div className="flex-1" />

          <p className="mt-8 text-center text-[13px] text-ink-2">
            {paywallPriceLine(playAvailable)}
          </p>
          <Button
            size="lg"
            className="mt-3 w-full"
            onClick={() => {
              setActive(null)
              router.push('/upgrade?reason=free_logs')
            }}
          >
            See Pro plans
          </Button>
          <Button variant="subtle" className="mt-2 w-full" onClick={() => setActive(null)}>
            Maybe later
          </Button>
        </div>
      </div>
    )
  }

  return null
}
