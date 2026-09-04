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
      {
        // The OAuth / magic-link callback answers with a 307 redirect. Under the
        // default `pages` NetworkFirst rule the worker caches (and later replays)
        // a `redirected` response, which the browser rejects for a navigation
        // ("a redirected response was used for a request whose redirect mode is
        // not follow") — a blank page that a retry or hard-refresh clears. Same
        // reason next-pwa carves `/api/auth/callback` out of its own API rule.
        // NetworkOnly never caches, so the redirect is handled natively.
        urlPattern: ({ url, sameOrigin }) =>
          sameOrigin && url.pathname.startsWith('/auth/callback'),
        handler: 'NetworkOnly',
      },
    ],
  },
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // `next lint` defaults to app/pages/components/lib/src only. hooks/ and
    // store/ were never linted, which is how a timezone leak sat in
    // useChatLog untouched — the rules that ban it have to reach it.
    dirs: ['app', 'components', 'hooks', 'lib', 'store', 'worker'],
  },
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
