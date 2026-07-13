import { redirect } from 'next/navigation'
import { createServerClient } from '../../lib/supabase/server'
import { BottomNav } from '../../components/layout/BottomNav'
import { SettingsClient } from '../../components/settings/SettingsClient'
import pkg from '../../package.json'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false } }

export default async function SettingsPage() {
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

  return (
    <div className="min-h-screen">
      <main
        className="mx-auto w-full max-w-md px-6"
        style={{
          paddingTop: 'calc(20px + env(safe-area-inset-top))',
          paddingBottom: 'calc(120px + env(safe-area-inset-bottom))',
        }}
      >
        <SettingsClient profile={profile} version={pkg.version} email={user.email ?? ''} />
      </main>
      <BottomNav />
    </div>
  )
}
