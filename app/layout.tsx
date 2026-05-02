import type { Metadata } from 'next'
import './globals.css'
import Providers from './providers'

export const metadata: Metadata = {
  title: 'Cal Track — Weight Loss & Calorie Tracker',
  description: 'Track calories, log meals, and build habits with streaks.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
