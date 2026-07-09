import type { Metadata, Viewport } from 'next'
import { Instrument_Sans, Bricolage_Grotesque } from 'next/font/google'
import './globals.css'
import Providers from './providers'

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['600', '700', '800'],
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
  themeColor: '#F6F5F1',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`h-full ${instrumentSans.variable} ${bricolage.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className="min-h-full bg-canvas text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
