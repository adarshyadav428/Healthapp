import { redirect } from 'next/navigation'
import { createServerClient, getAuthedUser } from '../../lib/supabase/server'
import { isProStatus } from '../../lib/subscription'
import { PageHeader } from '../../components/layout/PageHeader'
import { BottomNav } from '../../components/layout/BottomNav'
import { RecipeBuilder } from '../../components/recipes/RecipeBuilder'
import { ProLockCard } from '../../components/ui/ProLock'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false } }

export default async function RecipesPage() {
  const supabase = createServerClient()
  const user = await getAuthedUser(supabase)

  const [profileResult, subResult] = await Promise.all([
    supabase.from('profiles').select('height_cm').eq('id', user.id).maybeSingle(),
    supabase.from('subscriptions').select('status').eq('user_id', user.id).maybeSingle(),
  ])

  const { data: profile, error: profileError } = profileResult
  if (profileError) throw new Error(profileError.message)
  if (!profile || profile.height_cm === null) redirect('/onboarding')

  const isPro = isProStatus(subResult.data?.status)

  return (
    <div className="min-h-screen">
      <main
        className="mx-auto w-full max-w-md px-6"
        style={{ paddingTop: 'calc(20px + env(safe-area-inset-top))', paddingBottom: 'calc(120px + env(safe-area-inset-bottom))' }}
      >
        <PageHeader label="Nutrition for any home recipe" title="Recipes" back />
        {!isPro && (
          <ProLockCard
            className="mt-5"
            reason="custom_foods"
            track="custom_foods"
            title="Saving recipes is a Pro feature"
            body="Build a recipe and see its per-serving macros for free. Saving it as a food you can log in one tap is part of Pro."
            cta="See what Pro adds"
          />
        )}
        <div className="mt-5">
          <RecipeBuilder />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
