import { redirect } from 'next/navigation'
import { createServerClient, getAuthedUser } from '../../lib/supabase/server'
import { PageHeader } from '../../components/layout/PageHeader'
import { BottomNav } from '../../components/layout/BottomNav'
import { RecipeBuilder } from '../../components/recipes/RecipeBuilder'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false } }

export default async function RecipesPage() {
  const supabase = createServerClient()
  const user = await getAuthedUser(supabase)

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('height_cm')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) throw new Error(profileError.message)
  if (!profile || profile.height_cm === null) redirect('/onboarding')

  return (
    <div className="min-h-screen">
      <main
        className="mx-auto w-full max-w-md px-6"
        style={{ paddingTop: 'calc(20px + env(safe-area-inset-top))', paddingBottom: 'calc(120px + env(safe-area-inset-bottom))' }}
      >
        <PageHeader label="Nutrition for any home recipe" title="Recipes" back />
        <div className="mt-5">
          <RecipeBuilder />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
