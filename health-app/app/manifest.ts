import type { MetadataRoute } from 'next'

// Canonical web app manifest (served at /manifest.webmanifest — the stale
// public/manifest.json copy was removed). The TWA build (twa-manifest.json at
// the repo root) derives its identity from this file, so keep name/start_url/
// icons in sync with the Play listing.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GetInShape — Indian Calorie Tracker',
    short_name: 'GetInShape',
    description: 'Lose weight the Indian way. Track food, monitor progress, get AI insights.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#F7F6F3',
    theme_color: '#F7F6F3',
    orientation: 'portrait',
    categories: ['health', 'fitness'],
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
