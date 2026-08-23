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
    // Long-press the installed icon (Android) or right-click it (desktop) to
    // land straight on an action. This is the nearest a TWA gets to a home
    // screen quick-log widget, which is worth real time for anyone repeating
    // the same handful of meals — and it costs nothing but manifest entries.
    //
    // `?search=1` and `?scan=1` are both already-honoured deep links
    // (FoodLanding and BottomNav respectively), so no new routing is needed.
    shortcuts: [
      {
        name: 'Log a meal',
        short_name: 'Log',
        description: 'Search and add food to today',
        url: '/log?search=1',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Scan a meal',
        short_name: 'Scan',
        description: 'Open the camera to scan food or a barcode',
        url: '/dashboard?scan=1',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Log weight',
        short_name: 'Weight',
        description: "Record today's weight",
        url: '/weight',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
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
        src: '/icons/icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
