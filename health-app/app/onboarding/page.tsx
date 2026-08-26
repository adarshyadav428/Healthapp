import { redirect } from 'next/navigation'
import { OnboardingForm } from '../../components/onboarding/OnboardingForm'
import { createServerClient, getAuthedUser } from '../../lib/supabase/server'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false } }

export default async function OnboardingPage() {
  const supabase = createServerClient()
  const user = await getAuthedUser(supabase)

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
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="text-title-lg">🥗</span>
          <h1 className="font-display mt-2 text-title font-bold text-ink">Welcome to GetInShape</h1>
          <p className="mt-1 text-body text-ink-2">Let&apos;s get you started — takes about 2 minutes.</p>
        </div>
        <div className="rounded-sheet border border-hairline bg-surface p-6 shadow-rest">
          <OnboardingForm />
        </div>
      </div>
    </div>
  )
}
