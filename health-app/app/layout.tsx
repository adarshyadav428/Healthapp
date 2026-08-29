import type { Metadata, Viewport } from 'next'
import { Inter, Inter_Tight, Instrument_Serif } from 'next/font/google'
import './globals.css'
import Providers from './providers'

// Ember type system: Inter for UI, Inter Tight for display & hero numerals —
// the doctrine's Apple-crisp pairing, promoted app-wide after the studio pick.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const interTight = Inter_Tight({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

/**
 * The share card's hero numeral — and NOTHING else in the app.
 *
 * The growth doctrine bans extra web fonts because these users are on metered
 * connections. This is the one sanctioned exception, and it only holds because
 * of `preload: false` plus the fact that no DOM node ever uses this family:
 * nothing requests the file until `lib/shareCard.ts` explicitly calls
 * `document.fonts.load()` when a share sheet opens. A user who never shares
 * pays zero bytes for it.
 *
 * Do not reference `--font-numeral` from a component or a stylesheet. The
 * moment something in the DOM uses it, it becomes a render-blocking download
 * on every page and the exception stops being an exception.
 */
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-numeral',
  display: 'swap',
  preload: false,
})

export const metadata: Metadata = {
  // Mirrors robots.ts / sitemap.ts so relative OG/canonical URLs resolve to the
  // real host in prod and the preview host otherwise.
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://healthapp-dun.vercel.app'),
  title: 'GetInShape — Weight Loss & Calorie Tracker',
  description: 'Lose weight the Indian way. Track food, monitor progress, get AI insights.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'GetInShape',
  },
  icons: {
    apple: '/icons/icon-192x192.png',
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    title: 'GetInShape — Weight Loss & Calorie Tracker',
    description: 'Lose weight the Indian way. Track food, monitor progress, get AI insights.',
    siteName: 'GetInShape',
  },
  // The opengraph-image (app/opengraph-image.tsx) is auto-associated with both
  // og:image and twitter:image; this just sets the card type.
  twitter: {
    card: 'summary_large_image',
    title: 'GetInShape — Weight Loss & Calorie Tracker',
    description: 'Lose weight the Indian way. Track food, monitor progress, get AI insights.',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F7F6F3' },
    { media: '(prefers-color-scheme: dark)', color: '#0F0E0C' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // suppressHydrationWarning: next-themes stamps the theme class on <html>
  // before hydration, which React would otherwise flag as a mismatch.
  return (
    <html lang="en" suppressHydrationWarning className={`h-full ${inter.variable} ${interTight.variable} ${instrumentSerif.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className="min-h-full text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
