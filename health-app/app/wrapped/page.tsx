import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerClient, getAuthedUser } from '../../lib/supabase/server'
import { isProStatus } from '../../lib/subscription'
import { buildMonthlyWrappedCards } from '../../lib/monthlyWrapped'
import { StorySurface } from '../../components/story/StorySurface'
import { buildShareCardOptions } from '../../lib/shareCard'
import { captureServerEvent } from '../../lib/posthog/server'
import type { WrappedStats } from '../../lib/wrappedStats'

export const metadata: Metadata = {
  title: 'Your Wrapped — GetInShape',
  robots: { index: false },
}

export const dynamic = 'force-dynamic'

/**
 * The most recent monthly Wrapped.
 *
 * Renders the snapshot the cron stored rather than recomputing — a Wrapped is a
 * record of a month that has ended, and one that quietly changed because the
 * user edited an old log would be worthless as a keepsake.
 */
export default async function WrappedPage() {
  const supabase = createServerClient()
  const user = await getAuthedUser(supabase)

  const [wrapResult, subResult] = await Promise.all([
    supabase
      .from('monthly_wraps')
      .select('month_start, stats, message, was_pro')
      .eq('user_id', user.id)
      .order('month_start', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('subscriptions').select('status').eq('user_id', user.id).maybeSingle(),
  ])

  // No wrap yet — the first one lands on the first Sunday after a month with
  // enough logging in it. Nothing to show, so don't show an empty shell.
  if (!wrapResult.data) redirect('/dashboard')

  // Downgrade policy: things you EARNED persist, things you HOLD expire. A
  // wrap generated while paying stays fully readable after a cancellation —
  // gating on *current* status would retroactively confiscate a record of the
  // user's own month.
  const isPro = isProStatus(subResult.data?.status)
  const unlocked = isPro || wrapResult.data.was_pro === true

  // A free user's Wrapped ends on the locked card — that's a paywall impression,
  // and `source: 'wrapped'` had been declared with no emit site. Unlike the
  // other walls this one withholds something about the user they can already
  // see exists, which is why it's tracked separately.
  if (!unlocked) {
    captureServerEvent(user.id, 'paywall_viewed', { source: 'wrapped' })
  }

  const stats = wrapResult.data.stats as unknown as WrappedStats
  const monthStart = wrapResult.data.month_start as string

  const cards = buildMonthlyWrappedCards({
    stats,
    monthStart,
    message: wrapResult.data.message as string,
    isPro: unlocked,
  })

  // The card "Share my month" actually shares. Built here, from the frozen
  // snapshot rather than a recomputation, and scoped to the month it describes:
  // `weightDeltaKg` is last − first *inside the window*, so it is a month's
  // loss, not a lifetime one, and the copy has to say so.
  const monthName = new Date(monthStart + 'T00:00:00Z')
    .toLocaleDateString('en-IN', { month: 'long', timeZone: 'UTC' })
  const shareCard = unlocked
    ? buildShareCardOptions({
        streakDays: stats.longestStreakDays,
        kgLost: stats.weightDeltaKg != null ? -stats.weightDeltaKg : null,
        deficit: null,
        sinceLabel: `in ${monthName}`,
      })[0] ?? null
    : null

  return (
    <StorySurface
      surface="monthly_wrapped"
      cards={cards}
      // A free user's last card is the wall, so the action is the upgrade;
      // a Pro user's is the share card — unless the month held nothing worth
      // posting, in which case the CTA goes back to being a link.
      ctaLabel={unlocked ? (shareCard ? 'Share my month' : 'See the whole story') : 'See the whole story'}
      ctaHref={unlocked ? '/progress' : '/upgrade?reason=wrapped'}
      exitHref="/dashboard"
      shareCard={shareCard}
      meta={{ month: monthStart, is_pro: isPro, unlocked }}
    />
  )
}
