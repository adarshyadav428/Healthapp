import { redirect } from 'next/navigation'
import { createServerClient } from '../../lib/supabase/server'
import { Navbar } from '../../components/layout/Navbar'
import { BottomNav } from '../../components/layout/BottomNav'
import { WeightClient } from '../../components/weight/WeightClient'
import type { WeightLog } from '../../types/index'

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
    .limit(30)

  if (logsError) throw new Error(logsError.message)

  const weightLogs = (logs ?? []) as WeightLog[]

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navbar />
      <main className="mx-auto w-full max-w-md space-y-6 px-4 py-6">
        <h1 className="text-2xl font-semibold text-gray-900">Weight</h1>
        <WeightClient logs={weightLogs} profile={profile} />
      </main>
      <BottomNav />
    </div>
  )
}
