import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy — GetInShape',
  description: 'How GetInShape collects, uses and protects your data.',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-canvas px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6">
          <Link href="/" className="flex items-center gap-2 mb-8">
            <span className="text-2xl">🥗</span>
            <span className="font-display text-xl font-bold text-brand-ink">GetInShape</span>
          </Link>
          <h1 className="font-display text-3xl font-bold text-ink">Privacy Policy</h1>
          <p className="text-sm text-ink-2 mt-1">Last updated: July 11, 2026</p>
        </div>

        <div className="space-y-6 rounded-sheet border border-hairline bg-surface p-6 shadow-rest">
          <Section title="1. What We Collect">
            <ul className="list-disc ml-4 mt-1 space-y-1">
              <li><strong>Account info:</strong> email address and display name</li>
              <li><strong>Profile data:</strong> age, height, weight, activity level, and dietary goal — to calculate your personalised calorie target</li>
              <li><strong>Food logs:</strong> foods you log and their nutritional data, including photos you scan for AI analysis (photos are sent to Google Gemini for analysis and are not stored by us afterward — we only keep the resulting food/nutrition estimate you confirm)</li>
              <li><strong>Weight logs:</strong> your recorded weigh-ins</li>
              <li><strong>Exercise logs:</strong> activities and duration you track</li>
              <li><strong>Saved meals &amp; favourites:</strong> meal templates and foods you save for quick re-logging</li>
              <li><strong>Push notification token:</strong> if you enable meal reminders, your browser&apos;s push subscription endpoint and encryption keys — used only to deliver reminders, never shared or sold</li>
              <li><strong>Subscription data:</strong> plan type and billing status (handled by Razorpay, Stripe, or Google Play — we never see your card, UPI, or bank details)</li>
              <li><strong>Product analytics:</strong> in-app usage events (e.g. which features you use) via PostHog, to help us improve the app</li>
              <li><strong>Diagnostics &amp; error reports:</strong> when something goes wrong, technical details about the failure — the error, the action that triggered it, and basic device and browser information — collected via Sentry so we can find and fix it. Used only to keep the app working, never for advertising or profiling.</li>
            </ul>
          </Section>

          <Section title="2. How We Use Your Data">
            We use your data solely to provide GetInShape&apos;s features: calculating your calorie targets,
            showing your food and weight history, sending reminders you&apos;ve opted into, and managing your
            subscription. We do not use your data for advertising or sell it to third parties.
          </Section>

          <Section title="3. Data Storage">
            Your data is stored securely in Supabase (PostgreSQL) with row-level security — meaning
            only you can access your own records. All connections are encrypted in transit (HTTPS/TLS).
          </Section>

          <Section title="4. Third-Party Services">
            We use the following trusted providers:
            <ul className="list-disc ml-4 mt-1 space-y-1">
              <li><strong>Supabase</strong> — database and authentication</li>
              <li><strong>Razorpay, Stripe, and Google Play Billing</strong> — payment processing (PCI-compliant); which one handles your payment depends on how you signed up</li>
              <li><strong>Vercel</strong> — hosting and edge functions</li>
              <li><strong>IFCT 2017 (NIN Hyderabad) &amp; Open Food Facts</strong> — food nutrition data</li>
              <li><strong>Google Gemini</strong> — AI photo and natural-language meal analysis</li>
              <li><strong>PostHog</strong> — in-app product analytics</li>
              <li><strong>Sentry</strong> — error and diagnostic reporting, so faults get spotted and fixed</li>
            </ul>
            Each provider has their own privacy policy and security practices.
          </Section>

          <Section title="5. Your Rights">
            You have the right to access, correct, or delete your personal data at any time.
            You can delete your account and all associated data from{' '}
            <Link href="/settings" className="text-brand-ink hover:underline">Settings → Delete account</Link>.
            Deletion is permanent and cannot be undone.
          </Section>

          <Section title="6. Cookies">
            GetInShape uses essential cookies for authentication (session management) and
            product-analytics identifiers to understand feature usage. We do not use advertising cookies
            or sell data to advertisers.
          </Section>

          <Section title="7. Children">
            GetInShape is not intended for users under the age of 13. If you believe a child has
            created an account, please contact us to have it removed.
          </Section>

          <Section title="8. Changes">
            If we make significant changes to this policy, we will notify you via email or an
            in-app notice.
          </Section>

          <Section title="9. Contact">
            For privacy-related requests, email us at{' '}
            <a href="mailto:adarshyadavazm123@gmail.com" className="text-brand-ink hover:underline">
              adarshyadavazm123@gmail.com
            </a>
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
