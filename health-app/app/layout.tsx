import type { Metadata } from 'next'
import { Space_Grotesk, Fraunces } from 'next/font/google'
import './globals.css'
import Providers from './providers'

const spaceGrotesk = Space_Grotesk({
  variable: '--font-sans',
  subsets: ['latin'],
})

const fraunces = Fraunces({
  variable: '--font-display',
  subsets: ['latin'],
})

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
    <html lang="en" className={`${spaceGrotesk.variable} ${fraunces.variable} h-full`}>
      <body className="min-h-full bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
