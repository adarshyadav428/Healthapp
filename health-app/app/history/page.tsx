import { redirect } from 'next/navigation'
import { createServerClient } from '../../lib/supabase/server'
import { AppHeader } from '../../components/layout/AppHeader'
import { BottomNav } from '../../components/layout/BottomNav'
import { HistoryClient } from '../../components/history/HistoryClient'
import type { Profile } from '../../types/index'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false } }

export default async function HistoryPage() {
  const supabase = createServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) redirect('/auth/sign-in')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) throw new Error(profileError.message)
  if (!profile || profile.height_cm === null) redirect('/onboarding')

  // Check Pro status — free users only see last 7 days
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', user.id)
    .maybeSingle()
  const isPro = Boolean(sub && (sub.status === 'active' || sub.status === 'trialing'))

  // Free → 7 days, Pro → 90 days
  const lookbackDays = isPro ? 90 : 7
  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - lookbackDays)

  const [logsResult, exerciseResult] = await Promise.all([
    supabase
      .from('food_logs')
      .select('logged_at, kcal, protein_g, carbs_g, fat_g, meal')
      .eq('user_id', user.id)
      .gte('logged_at', cutoff.toISOString())
      .order('logged_at', { ascending: true }),
    supabase
      .from('exercise_logs')
      .select('logged_at, activity, duration_min, calories')
      .eq('user_id', user.id)
      .gte('logged_at', cutoff.toISOString())
      .order('logged_at', { ascending: false }),
  ])

  if (logsResult.error) throw new Error(logsResult.error.message)
  // Exercise logs are optional — table may not exist yet
  const exerciseLogs = exerciseResult.error ? [] : (exerciseResult.data ?? [])

  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,_rgba(234,88,12,0.10),_transparent_50%)]" />
      <AppHeader title="History" />
      <main className="mx-auto w-full max-w-md px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-foreground">History</h1>
          <p className="text-sm text-muted mt-0.5">Your nutrition over time</p>
        </div>
        <HistoryClient
          logs={logsResult.data ?? []}
          exerciseLogs={exerciseLogs}
          profile={profile as Profile}
          isPro={isPro}
        />
      </main>
      <BottomNav />
    </div>
  )
}
