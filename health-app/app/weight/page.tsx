import { redirect } from 'next/navigation'
import { createServerClient, getAuthedUser } from '../../lib/supabase/server'
import { PageHeader } from '../../components/layout/PageHeader'
import { BottomNav } from '../../components/layout/BottomNav'
import { WeightClient } from '../../components/weight/WeightClient'
import type { WeightLog } from '../../types/index'
import { formatKg } from '../../lib/formatWeight'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false } }

export default async function WeightPage() {
  const supabase = createServerClient()
  const user = await getAuthedUser(supabase)

  // Both queries only need user.id — one parallel round trip, not two sequential
  const [profileResult, logsResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase
      .from('weight_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('measured_at', { ascending: false })
      .limit(60),
  ])

  const { data: profile, error: profileError } = profileResult
  if (profileError) throw new Error(profileError.message)
  if (!profile || profile.height_cm === null) redirect('/onboarding')

  const { data: logs, error: logsError } = logsResult
  if (logsError) throw new Error(logsError.message)

  const weightLogs = (logs ?? []) as WeightLog[]

  return (
    <div className="min-h-screen">
      <main
        className="mx-auto w-full max-w-md px-6"
        style={{ paddingTop: 'calc(20px + env(safe-area-inset-top))', paddingBottom: 'calc(120px + env(safe-area-inset-bottom))' }}
      >
        <PageHeader label={profile.target_weight_kg ? `Toward ${formatKg(profile.target_weight_kg)} kg` : 'Body'} title="Weight" back />
        <div className="mt-5">
          <WeightClient logs={weightLogs} profile={profile} />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
