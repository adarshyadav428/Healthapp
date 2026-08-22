import type { MetadataRoute } from 'next'
import { createAdminClient } from '../lib/supabase/server'

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://healthapp-dun.vercel.app'

// sitemap.ts runs with no request context (like generateStaticParams), so
// the cookie-bound server client would throw — admin client is safe here
// for the same reason it's safe in app/foods/[slug]/page.tsx: the query is
// hardcoded to source = 'ifct', not driven by any caller input.
async function getFoodPageUrls(): Promise<MetadataRoute.Sitemap> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('foods')
    .select('source_id')
    .eq('source', 'ifct')
    .neq('name', 'Test Food')

  return (data ?? [])
    .filter((f): f is { source_id: string } => !!f.source_id)
    .map((f) => ({
      url: `${BASE}/foods/${f.source_id}`,
      lastModified: new Date(),
      changeFrequency: 'yearly' as const,
      priority: 0.5,
    }))
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const foodUrls = await getFoodPageUrls()

  return [
    {
      url: BASE,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: `${BASE}/auth/sign-in`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: `${BASE}/auth/sign-up`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.7,
    },
    {
      url: `${BASE}/upgrade`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE}/pricing`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE}/contact`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${BASE}/refunds`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    ...foodUrls,
  ]
}
