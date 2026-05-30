import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-10 dark:bg-slate-950">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6">
          <Link href="/" className="flex items-center gap-2 mb-8">
            <span className="text-2xl">🥗</span>
            <span className="text-xl font-black text-indigo-600">GetInShape</span>
          </Link>
          <h1 className="text-3xl font-black text-foreground">Privacy Policy</h1>
          <p className="text-sm text-muted mt-1">Last updated: May 1, 2026</p>
        </div>

        <div className="space-y-6 rounded-3xl border border-border bg-card p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
          <Section title="1. What We Collect">
            <ul className="list-disc ml-4 mt-1 space-y-1">
              <li><strong>Account info:</strong> email address and display name</li>
              <li><strong>Profile data:</strong> age, height, weight, activity level, and dietary goal — to calculate your personalised calorie target</li>
              <li><strong>Food logs:</strong> foods you log and their nutritional data</li>
              <li><strong>Weight logs:</strong> your recorded weigh-ins</li>
              <li><strong>Exercise logs:</strong> activities and duration you track</li>
              <li><strong>Subscription data:</strong> plan type and billing status (handled by Stripe — we never see your card details)</li>
              <li><strong>Water tracking:</strong> stored locally in your browser, never sent to our servers</li>
            </ul>
          </Section>

          <Section title="2. How We Use Your Data">
            We use your data solely to provide GetInShape&apos;s features: calculating your calorie targets,
            showing your food and weight history, and managing your subscription. We do not use your data
            for advertising or sell it to third parties.
          </Section>

          <Section title="3. Data Storage">
            Your data is stored securely in Supabase (PostgreSQL) with row-level security — meaning
            only you can access your own records. All connections are encrypted in transit (HTTPS/TLS).
          </Section>

          <Section title="4. Third-Party Services">
            We use the following trusted providers:
            <ul className="list-disc ml-4 mt-1 space-y-1">
              <li><strong>Supabase</strong> — database and authentication</li>
              <li><strong>Stripe</strong> — payment processing (PCI-compliant)</li>
              <li><strong>Vercel</strong> — hosting and edge functions</li>
              <li><strong>USDA FoodData Central</strong> — food nutrition data</li>
            </ul>
            Each provider has their own privacy policy and security practices.
          </Section>

          <Section title="5. Your Rights">
            You have the right to access, correct, or delete your personal data at any time.
            You can delete your account and all associated data from{' '}
            <Link href="/settings" className="text-indigo-600 hover:underline dark:text-indigo-400">Settings → Delete account</Link>.
            Deletion is permanent and cannot be undone.
          </Section>

          <Section title="6. Cookies">
            GetInShape uses essential cookies for authentication (session management). We do not use
            tracking or advertising cookies.
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
            <a href="mailto:privacy@caltrack.app" className="text-indigo-600 hover:underline dark:text-indigo-400">
              privacy@caltrack.app
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
      <h2 className="text-base font-bold text-foreground mb-2">{title}</h2>
      <div className="text-sm text-muted leading-relaxed">{children}</div>
    </div>
  )
}
