import type { Metadata } from 'next'
import Link from 'next/link'

// Public (unauthenticated) page — listed as the account-deletion URL in the
// Google Play Data safety form, so it must render without a sign-in redirect
// (allowlisted in middleware.ts).
export const metadata: Metadata = {
  title: 'Delete your data or account — GetInShape',
  description:
    'How to delete individual GetInShape data, or permanently delete your account and all associated data.',
}

export default function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-canvas px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6">
          <Link href="/" className="flex items-center gap-2 mb-8">
            <span className="text-title">🥗</span>
            <span className="font-display text-title-sm font-bold text-brand-ink">GetInShape</span>
          </Link>
          <h1 className="font-display text-title-lg font-bold text-ink">Delete your account</h1>
          <p className="text-body text-ink-2 mt-1">
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

          <Section title="Delete some of your data (without deleting your account)">
            You don&apos;t have to delete your account to remove data. Inside the app you can
            delete individual entries at any time, and deletion is immediate and permanent:
            <ul className="list-disc ml-4 mt-1 space-y-1">
              <li>
                <strong>Food logs</strong> — open <strong>Home</strong> or{' '}
                <strong>Progress → a day</strong>, then tap the delete icon on any entry
              </li>
              <li>
                <strong>Weight entries</strong> — open <strong>Profile → Weight</strong> and tap
                the delete icon next to any reading
              </li>
              <li>
                <strong>Exercise logs</strong> — open the <strong>Food</strong> tab and tap the
                delete icon on any exercise entry
              </li>
              <li>
                <strong>Saved meals, favourites, and custom foods</strong> — remove from{' '}
                <strong>Food</strong>
              </li>
              <li>
                <strong>Push notifications</strong> — turn off in{' '}
                <strong>Profile → Settings</strong> to delete your notification subscription
              </li>
            </ul>
            <p className="mt-2">
              Your account, sign-in credentials, and profile (age, height, goals) are kept until
              you delete the account itself using the steps above.
            </p>
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
      <h2 className="font-display text-body-lg font-bold text-ink mb-2">{title}</h2>
      <div className="text-body text-ink-2 leading-relaxed">{children}</div>
    </div>
  )
}
