import { redirect } from 'next/navigation'
import { createServerClient } from '../../lib/supabase/server'
import { Navbar } from '../../components/layout/Navbar'
import { BottomNav } from '../../components/layout/BottomNav'
import { WeightClient } from '../../components/weight/WeightClient'
import type { WeightLog } from '../../types/index'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false } }

export default async function WeightPage() {
  const supabase = createServerClient()
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()
  const user = session?.user ?? null

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
    <div className="min-h-screen bg-[#fff7ed] pb-24 dark:bg-slate-950">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.15),_transparent_50%)] dark:opacity-40" />
      <Navbar />
      <main className="mx-auto w-full max-w-md px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-foreground">Weight</h1>
          <p className="text-sm text-muted mt-0.5">Track your journey to {profile.target_weight_kg} kg</p>
        </div>
        <WeightClient logs={weightLogs} profile={profile} />
      </main>
      <BottomNav />
    </div>
  )
}
