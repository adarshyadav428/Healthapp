import { redirect } from 'next/navigation'
import { OnboardingForm } from '../../components/onboarding/OnboardingForm'
import { createServerClient } from '../../lib/supabase/server'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false } }

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
    <div className="min-h-screen bg-[#fff7ed] px-4 py-10 dark:bg-slate-950">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,_rgba(234,88,12,0.12),_transparent_55%)] dark:opacity-40" />
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="text-3xl">🥗</span>
          <h1 className="mt-2 text-2xl font-black text-foreground">Let&apos;s set up your goals</h1>
          <p className="mt-1 text-sm text-muted">Takes less than 2 minutes.</p>
        </div>
        <div className="rounded-3xl border border-orange-100 bg-white/90 p-6 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/90">
          <OnboardingForm />
        </div>
      </div>
    </div>
  )
}
