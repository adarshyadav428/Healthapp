import { redirect } from 'next/navigation'
import { FoodSearch } from '../../components/log/FoodSearch'
import { Navbar } from '../../components/layout/Navbar'
import { BottomNav } from '../../components/layout/BottomNav'
import { createServerClient } from '../../lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function LogPage() {
  const supabase = createServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) redirect('/auth/sign-in')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('height_cm')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) throw new Error(profileError.message)
  if (!profile || profile.height_cm === null) redirect('/onboarding')

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navbar />
      <main className="mx-auto w-full max-w-md px-4 py-6">
        <h1 className="text-2xl font-semibold text-gray-900">Log food</h1>
        <p className="text-sm text-gray-500">Search and add foods to today&apos;s log.</p>
        <div className="mt-6">
          <FoodSearch />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
