import type { Metadata } from 'next'
import Link from 'next/link'

// Public (unauthenticated) page — listed as the account-deletion URL in the
// Google Play Data safety form, so it must render without a sign-in redirect
// (allowlisted in middleware.ts).
export const metadata: Metadata = {
  title: 'Delete your account — GetInShape',
  description: 'How to permanently delete your GetInShape account and all associated data.',
}

export default function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-canvas px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6">
          <Link href="/" className="flex items-center gap-2 mb-8">
            <span className="text-2xl">🥗</span>
            <span className="font-display text-xl font-bold text-brand-ink">GetInShape</span>
          </Link>
          <h1 className="font-display text-3xl font-bold text-ink">Delete your account</h1>
          <p className="text-sm text-ink-2 mt-1">
            You can permanently delete your GetInShape account and all associated data at any time.
          </p>
        </div>

        <div className="space-y-6 rounded-sheet border border-hairline bg-surface p-6 shadow-rest">
          <Section title="Delete from within the app">
            <ol className="list-decimal ml-4 mt-1 space-y-1">
              <li>Open GetInShape and sign in</li>
              <li>
                Go to <strong>Profile → Settings</strong> (or open{' '}
                <Link href="/settings" className="text-brand-ink hover:underline">
                  getinshape.co.in/settings
                </Link>
                )
              </li>
              <li>
                Scroll to the bottom and tap <strong>Delete account</strong>
              </li>
              <li>Confirm the deletion</li>
            </ol>
          </Section>

          <Section title="What gets deleted">
            Deletion is immediate and permanent. It removes:
            <ul className="list-disc ml-4 mt-1 space-y-1">
              <li>Your account and sign-in credentials</li>
              <li>Your profile (age, height, weight, goals, calorie targets)</li>
              <li>All food, weight, and exercise logs</li>
              <li>Saved meals, favourites, and custom foods</li>
              <li>Push notification subscriptions</li>
              <li>Your subscription record (any active subscription should be cancelled first — via the app&apos;s Settings, or Google Play → Subscriptions if you subscribed on Android)</li>
            </ul>
            Deleted data cannot be recovered.
          </Section>

          <Section title="Can't access the app?">
            Email us from your registered address at{' '}
            <a href="mailto:adarshyadavazm123@gmail.com" className="text-brand-ink hover:underline">
              adarshyadavazm123@gmail.com
            </a>{' '}
            with the subject &quot;Delete my account&quot; and we&apos;ll process the deletion for you.
          </Section>

          <Section title="More information">
            See our{' '}
            <Link href="/privacy" className="text-brand-ink hover:underline">
              Privacy Policy
            </Link>{' '}
            for details on what we collect and how it&apos;s used.
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-base font-bold text-ink mb-2">{title}</h2>
      <div className="text-sm text-ink-2 leading-relaxed">{children}</div>
    </div>
  )
}
