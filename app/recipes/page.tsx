import { redirect } from 'next/navigation'
import { createServerClient } from '../../lib/supabase/server'
import { Navbar } from '../../components/layout/Navbar'
import { BottomNav } from '../../components/layout/BottomNav'
import { RecipeBuilder } from '../../components/recipes/RecipeBuilder'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false } }

export default async function RecipesPage() {
  const supabase = createServerClient()
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()
  const user = session?.user ?? null

  if (error || !user) redirect('/auth/sign-in')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('height_cm')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) throw new Error(profileError.message)
  if (!profile || profile.height_cm === null) redirect('/onboarding')

  return (
    <div className="min-h-screen bg-[#fff7ed] pb-24 dark:bg-slate-950">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,_rgba(234,88,12,0.10),_transparent_50%)] dark:opacity-40" />
      <Navbar />
      <main className="mx-auto w-full max-w-md px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-foreground">Recipe Builder</h1>
          <p className="text-sm text-muted mt-0.5">Calculate nutrition for any home recipe</p>
        </div>
        <RecipeBuilder />
      </main>
      <BottomNav />
    </div>
  )
}
