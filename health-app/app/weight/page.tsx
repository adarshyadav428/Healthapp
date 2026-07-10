import { redirect } from 'next/navigation'
import { createServerClient } from '../../lib/supabase/server'
import { AppHeader } from '../../components/layout/AppHeader'
import { BottomNav } from '../../components/layout/BottomNav'
import { WeightClient } from '../../components/weight/WeightClient'
import type { WeightLog } from '../../types/index'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false } }

export default async function WeightPage() {
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

  const { data: logs, error: logsError } = await supabase
    .from('weight_logs')
    .select('*')
    .eq('user_id', user.id)
    .order('measured_at', { ascending: false })
    .limit(60)

  if (logsError) throw new Error(logsError.message)

  const weightLogs = (logs ?? []) as WeightLog[]

  return (
    <div className="min-h-screen" style={{ paddingBottom: 'calc(120px + env(safe-area-inset-bottom))' }}>
      <AppHeader title="Weight" />
      <main className="mx-auto w-full max-w-md px-5 pt-4">
        <div className="mb-6">
          <h1 className="font-display text-[23px] font-semibold text-ink leading-tight">Weight</h1>
          <p className="text-sm text-ink-2 mt-0.5">Track your journey to {profile.target_weight_kg} kg</p>
        </div>
        <WeightClient logs={weightLogs} profile={profile} />
      </main>
      <BottomNav />
    </div>
  )
}
