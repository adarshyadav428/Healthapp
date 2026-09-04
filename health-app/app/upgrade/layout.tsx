import type { Metadata } from 'next'

// app/upgrade/page.tsx is a Client Component (it reads useSearchParams for the
// paywall reason), so it can't export `metadata` itself. This wrapper does.
export const metadata: Metadata = {
  title: 'GetInShape Pro — Unlimited AI Logging & Full History',
  description:
    'Pro unlocks unlimited AI photo & chat logging, your full logging history, custom foods, advanced trends and the weekly AI recap. ₹299/month or ₹1,999/year.',
  alternates: { canonical: '/upgrade' },
}

export default function UpgradeLayout({ children }: { children: React.ReactNode }) {
  return children
}
