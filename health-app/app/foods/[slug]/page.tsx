import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Flame, ArrowLeft } from 'lucide-react'
import { createAdminClient } from '../../../lib/supabase/server'
import { generateFoodSummary, generateWeightLossVerdict } from '../../../lib/foodPageCopy'
import type { Food, FoodPortion } from '../../../types/index'

// Public, indexable, statically generated — only the curated IFCT subset.
// generateStaticParams/generateMetadata run at build time with no request
// context, so the cookie-bound server client (which calls next/headers
// cookies()) throws "called outside a request scope" — use the admin
// client instead. Safe here: the `source = 'ifct'` scope is enforced by
// this file's own hardcoded query filters, not by RLS, and every value
// interpolated into a query (params.slug) goes through the query builder's
// parameterized .eq(), never raw SQL. dynamicParams=false means any slug
// outside the generated set 404s immediately — no estimate/user-source food
// can ever be reached through this route regardless.
export const dynamicParams = false
export const revalidate = 86400

const FOOD_SELECT =
  'id, source, source_id, name, brand, serving_size_g, serving_description, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, fiber_g_per_100g, common_portions'

async function getFood(slug: string): Promise<Food | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('foods')
    .select(FOOD_SELECT)
    .eq('source', 'ifct')
    .eq('source_id', slug)
    .maybeSingle()
  return data as Food | null
}

export async function generateStaticParams() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('foods')
    .select('source_id')
    .eq('source', 'ifct')
    .neq('name', 'Test Food')

  return (data ?? [])
    .filter((f): f is { source_id: string } => !!f.source_id)
    .map((f) => ({ slug: f.source_id }))
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const food = await getFood(params.slug)
  if (!food) return {}

  const kcal = Math.round(food.kcal_per_100g)
  const title = `Calories in ${food.name} — ${kcal} kcal per 100g | GetInShape`
  const description = `${food.name}: ${kcal} kcal, ${food.protein_g_per_100g}g protein, ${food.carbs_g_per_100g}g carbs, ${food.fat_g_per_100g}g fat per 100g. Portion sizes and weight-loss info, IFCT 2017 data.`

  return {
    title,
    description,
    openGraph: { title, description, type: 'article' },
  }
}

export default async function FoodPage({ params }: { params: { slug: string } }) {
  const food = await getFood(params.slug)
  if (!food) notFound()

  const kcal = Math.round(food.kcal_per_100g)
  const portions: FoodPortion[] =
    food.common_portions && food.common_portions.length > 0
      ? food.common_portions
      : [{ unit: 'serving', grams: food.serving_size_g, label: food.serving_description }]

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-5 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-control bg-brand-soft">
            <Flame className="h-[18px] w-[18px] text-brand" strokeWidth={2.2} />
          </div>
          <span className="font-display text-xl font-bold text-ink tracking-tight">GetInShape</span>
        </Link>
        <Link
          href="/auth/sign-up"
          className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-white hover:opacity-90 transition-opacity shadow-rest"
        >
          Start free
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl px-5 pb-24">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back home
        </Link>

        <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">{food.name}</h1>
        {food.brand && <p className="mt-1 text-sm text-ink-2">{food.brand}</p>}
        <p className="mt-2 text-sm text-ink-2">Calories, macros and portion sizes — IFCT 2017 data.</p>

        {/* Hero macro card */}
        <section className="mt-6 rounded-sheet border border-hairline bg-surface p-6 shadow-rest">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-2">Per 100g</p>
          <p className="mt-1 font-display text-4xl font-bold text-ink tabular-nums">
            {kcal} <span className="text-lg font-semibold text-ink-2">kcal</span>
          </p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-control bg-surface-2 p-3 text-center">
              <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--protein)' }}>{food.protein_g_per_100g}g</p>
              <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-wide">Protein</p>
            </div>
            <div className="rounded-control bg-surface-2 p-3 text-center">
              <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--carbs)' }}>{food.carbs_g_per_100g}g</p>
              <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-wide">Carbs</p>
            </div>
            <div className="rounded-control bg-surface-2 p-3 text-center">
              <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--fat)' }}>{food.fat_g_per_100g}g</p>
              <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-wide">Fat</p>
            </div>
          </div>
          {food.fiber_g_per_100g != null && (
            <p className="mt-3 text-xs text-ink-2">
              Fiber: <span className="font-semibold text-ink">{food.fiber_g_per_100g}g</span> per 100g
            </p>
          )}
        </section>

        <section className="mt-6">
          <p className="text-sm text-ink-2 leading-relaxed">{generateFoodSummary(food)}</p>
        </section>

        {/* Portion guide */}
        <section className="mt-8">
          <h2 className="font-display text-lg font-bold text-ink mb-3">Portion guide</h2>
          <div className="rounded-sheet border border-hairline bg-surface divide-y divide-hairline overflow-hidden">
            {portions.map((p, i) => {
              const portionKcal = Math.round((food.kcal_per_100g * p.grams) / 100)
              return (
                <div key={i} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-ink">{p.label}</span>
                  <span className="text-sm font-bold text-ink tabular-nums">{portionKcal} kcal</span>
                </div>
              )
            })}
          </div>
        </section>

        {/* Weight-loss verdict */}
        <section className="mt-8 rounded-sheet border border-hairline bg-brand-soft p-5">
          <h2 className="font-display text-base font-bold text-ink mb-2">Is {food.name} good for weight loss?</h2>
          <p className="text-sm text-ink-2 leading-relaxed">{generateWeightLossVerdict(food)}</p>
        </section>

        {/* CTA */}
        <section className="mt-10 rounded-sheet border border-hairline bg-surface p-6 text-center shadow-rest">
          <p className="font-display text-lg font-bold text-ink">Track {food.name} in 5 seconds</p>
          <p className="mt-1 text-sm text-ink-2">Snap a photo or type what you ate — GetInShape logs the macros for you.</p>
          <Link
            href="/auth/sign-up"
            className="mt-4 inline-block rounded-full bg-brand px-8 py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity shadow-float"
          >
            Start for free →
          </Link>
        </section>
      </main>

      <footer className="border-t border-hairline bg-surface px-5 py-8 text-center text-xs text-ink-2">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3">
          <span>© 2026 GetInShape · Made with ❤️ for India</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-ink transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-ink transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
