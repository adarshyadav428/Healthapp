import { redirect } from 'next/navigation'
import { createServerClient, getAuthedUser } from '../../lib/supabase/server'
import { BottomNav } from '../../components/layout/BottomNav'
import { SettingsClient } from '../../components/settings/SettingsClient'
import pkg from '../../package.json'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false } }

export default async function SettingsPage() {
  const supabase = createServerClient()
  const user = await getAuthedUser(supabase)

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
        className="mx-auto w-full max-w-md px-3 lg:max-w-5xl lg:px-6"
        style={{
          paddingTop: 'calc(12px + env(safe-area-inset-top))',
          paddingBottom: 'calc(var(--tab-bar-h, 72px) + 40px + env(safe-area-inset-bottom))',
        }}
      >
        {/* The same single frame as the other tab screens. */}
        <div className="rounded-sheet border-2 border-hairline-2 px-3 pb-6 pt-3 lg:px-8 lg:pb-8 lg:pt-6">
          <SettingsClient profile={profile} version={pkg.version} email={user.email ?? ''} />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
