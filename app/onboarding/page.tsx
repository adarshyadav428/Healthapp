import { redirect } from 'next/navigation'
import { OnboardingForm } from '../../components/onboarding/OnboardingForm'
import { createServerClient } from '../../lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const supabase = createServerClient()
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()
  const user = session?.user ?? null

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
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <OnboardingForm />
      </div>
    </div>
  )
}
