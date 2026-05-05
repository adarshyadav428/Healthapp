import type { Metadata, Viewport } from 'next'
import './globals.css'
import Providers from './providers'

export const metadata: Metadata = {
  title: 'CalTrack — Indian Calorie & Macro Tracker',
  description: 'Log Indian & global foods, track macros, water, exercise and weight. Built for desi diets.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'CalTrack',
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    title: 'CalTrack — Indian Calorie & Macro Tracker',
    description: 'Track calories the Indian way. 600+ desi foods, exercise logging, weight trends.',
    siteName: 'CalTrack',
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
    <html lang="en" className="h-full">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="min-h-full bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
