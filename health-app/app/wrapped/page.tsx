import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerClient, getAuthedUser } from '../../lib/supabase/server'
import { isProStatus } from '../../lib/subscription'
import { buildMonthlyWrappedCards } from '../../lib/monthlyWrapped'
import { StorySurface } from '../../components/story/StorySurface'
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
      .select('month_start, stats, message')
      .eq('user_id', user.id)
      .order('month_start', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('subscriptions').select('status').eq('user_id', user.id).maybeSingle(),
  ])

  // No wrap yet — the first one lands on the first Sunday after a month with
  // enough logging in it. Nothing to show, so don't show an empty shell.
  if (!wrapResult.data) redirect('/dashboard')

  const cards = buildMonthlyWrappedCards({
    stats: wrapResult.data.stats as unknown as WrappedStats,
    monthStart: wrapResult.data.month_start as string,
    message: wrapResult.data.message as string,
    isPro: isProStatus(subResult.data?.status),
  })

  const isPro = isProStatus(subResult.data?.status)

  return (
    <StorySurface
      surface="monthly_wrapped"
      cards={cards}
      // A free user's last card is the wall, so the action is the upgrade;
      // a Pro user's is the share card.
      ctaLabel={isPro ? 'Share my month' : 'See the whole story'}
      ctaHref={isPro ? '/progress' : '/upgrade?reason=wrapped'}
      exitHref="/dashboard"
      meta={{ month: wrapResult.data.month_start, is_pro: isPro }}
    />
  )
}
