import type { MetadataRoute } from 'next'

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://healthapp-dun.vercel.app'

// Dynamic (was a static public/robots.txt) so the Sitemap line always
// follows NEXT_PUBLIC_APP_URL — a domain change can never leave this
// pointing at a stale/dead host again, unlike the static file it replaces.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/dashboard',
        '/log',
        '/weight',
        '/settings',
        '/recipes',
        '/onboarding',
        '/auth/callback',
        '/auth/forgot-password',
        '/auth/reset-password',
      ],
    },
    sitemap: `${BASE}/sitemap.xml`,
  }
}
