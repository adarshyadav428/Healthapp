import type { Metadata, Viewport } from 'next'
import { Inter, Inter_Tight } from 'next/font/google'
import './globals.css'
import Providers from './providers'
import { Analytics } from '@vercel/analytics/next'

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

export const metadata: Metadata = {
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
    <html lang="en" suppressHydrationWarning className={`h-full ${inter.variable} ${interTight.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className="min-h-full text-ink">
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  )
}
