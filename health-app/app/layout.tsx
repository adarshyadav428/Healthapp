import type { Metadata, Viewport } from 'next'
import { Sora } from 'next/font/google'
import './globals.css'
import Providers from './providers'

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
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
  themeColor: '#ea580c',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`h-full ${sora.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className="min-h-full bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
