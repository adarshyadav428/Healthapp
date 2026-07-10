import { redirect } from 'next/navigation'
import { createServerClient } from '../../lib/supabase/server'
import { AppHeader } from '../../components/layout/AppHeader'
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
    <div className="min-h-screen" style={{ paddingBottom: 'calc(120px + env(safe-area-inset-bottom))' }}>
      <AppHeader title="Settings" />
      <main className="mx-auto w-full max-w-md px-5 pt-4">
        <h1 className="font-display text-[23px] font-semibold text-ink leading-tight">Settings</h1>
        <p className="text-sm text-ink-2 mt-0.5">Profile, goals &amp; subscription</p>
        <div className="mt-6">
          <SettingsClient profile={profile} version={pkg.version} />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
