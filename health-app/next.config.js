const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  disable: process.env.NODE_ENV === 'development',
  // Keep every default runtime-caching rule and prepend our own. Workbox matches
  // in array order, so the entry below wins over the default `apis` rule.
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      {
        // Food search is never served from the service worker cache. The default
        // `apis` rule is NetworkFirst with a 10 s timeout, so on a slow mobile
        // connection it would hand back a *previous* query's results — which is
        // how a food could look missing on a phone while showing up on desktop.
        // A search has no offline value anyway: the answer depends entirely on
        // the query, and stale food data is worse than an honest empty state.
        urlPattern: ({ url, sameOrigin }) =>
          sameOrigin && url.pathname.startsWith('/api/foods/search'),
        handler: 'NetworkOnly',
      },
    ],
  },
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
  },
  async headers() {
    return [
      {
        source: '/.well-known/assetlinks.json',
        headers: [{ key: 'Content-Type', value: 'application/json' }],
      },
      {
        source: '/manifest.webmanifest',
        headers: [{ key: 'Content-Type', value: 'application/manifest+json' }],
      },
    ]
  },
}

module.exports = withPWA(nextConfig)
