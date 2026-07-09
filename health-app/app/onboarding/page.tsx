import { redirect } from 'next/navigation'
import { OnboardingForm } from '../../components/onboarding/OnboardingForm'
import { createServerClient } from '../../lib/supabase/server'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false } }

export default async function OnboardingPage() {
  const supabase = createServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/auth/sign-in')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('height_cm')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    redirect('/auth/sign-in')
  }

  if (profile?.height_cm) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-canvas px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="text-3xl">🥗</span>
          <h1 className="font-display mt-2 text-2xl font-bold text-ink">Let&apos;s set up your goals</h1>
          <p className="mt-1 text-sm text-ink-2">Takes less than 2 minutes.</p>
        </div>
        <div className="rounded-sheet border border-hairline bg-surface p-6 shadow-rest">
          <OnboardingForm />
        </div>
      </div>
    </div>
  )
}
