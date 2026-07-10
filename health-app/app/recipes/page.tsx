import { redirect } from 'next/navigation'
import { createServerClient } from '../../lib/supabase/server'
import { AppHeader } from '../../components/layout/AppHeader'
import { BottomNav } from '../../components/layout/BottomNav'
import { RecipeBuilder } from '../../components/recipes/RecipeBuilder'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false } }

export default async function RecipesPage() {
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
    <div className="min-h-screen" style={{ paddingBottom: 'calc(120px + env(safe-area-inset-bottom))' }}>
      <AppHeader title="Recipes" />
      <main className="mx-auto w-full max-w-md px-5 pt-4">
        <div className="mb-6">
          <h1 className="font-display text-[23px] font-semibold text-ink leading-tight">Recipe Builder</h1>
          <p className="text-sm text-ink-2 mt-0.5">Calculate nutrition for any home recipe</p>
        </div>
        <RecipeBuilder />
      </main>
      <BottomNav />
    </div>
  )
}
