import { redirect } from 'next/navigation'
import { createServerClient } from '../../lib/supabase/server'
import { Navbar } from '../../components/layout/Navbar'
import { BottomNav } from '../../components/layout/BottomNav'
import { SettingsClient } from '../../components/settings/SettingsClient'
import pkg from '../../package.json'

export const dynamic = 'force-dynamic'

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
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navbar />
      <main className="mx-auto w-full max-w-md px-4 py-6">
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">Manage your profile and subscription.</p>
        <div className="mt-6">
          <SettingsClient profile={profile} version={pkg.version} />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
