import Link from 'next/link'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-canvas px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6">
          <Link href="/" className="flex items-center gap-2 mb-8">
            <span className="text-2xl">🥗</span>
            <span className="font-display text-xl font-bold text-brand-ink">GetInShape</span>
          </Link>
          <h1 className="font-display text-3xl font-bold text-ink">Terms of Service</h1>
          <p className="text-sm text-ink-2 mt-1">Last updated: July 11, 2026</p>
        </div>

        <div className="space-y-6 rounded-sheet border border-hairline bg-surface p-6 shadow-rest">
          <Section title="1. Acceptance of Terms">
            By creating an account or using GetInShape, you agree to these Terms of Service. If you do not
            agree, please do not use the app.
          </Section>

          <Section title="2. Health Disclaimer">
            GetInShape provides nutrition tracking tools and estimates. It is <strong>not a substitute for
            professional medical or dietary advice</strong>. Always consult a qualified healthcare provider
            before starting a new diet, exercise programme, or making significant changes to your health
            routine. Calorie estimates may not be accurate for all foods and individuals.
          </Section>

          <Section title="3. User Accounts">
            You are responsible for keeping your account credentials secure. You agree to provide accurate
            information during sign-up and onboarding. GetInShape reserves the right to suspend accounts that
            violate these terms.
          </Section>

          <Section title="4. Subscriptions and Billing">
            GetInShape offers a free tier with limited features and a Pro subscription for unlimited access.
            Billing is handled securely by Razorpay (web), Google Play Billing (Android), or Stripe (for
            accounts that subscribed before we switched web billing to Razorpay). You may cancel your
            subscription at any time from Settings. Refunds are handled on a case-by-case basis — contact us
            within 7 days of a charge if you believe you were billed in error.
          </Section>

          <Section title="5. Data and Privacy">
            We collect the minimum data necessary to provide GetInShape&apos;s features. We do not sell your
            personal data. See our <Link href="/privacy" className="text-brand-ink hover:underline">Privacy
            Policy</Link> for full details.
          </Section>

          <Section title="6. Acceptable Use">
            You agree not to misuse the service (e.g., scraping, reverse-engineering, or circumventing rate
            limits). The Indian food database includes data from IFCT 2017 (NIN Hyderabad) and is for
            personal, non-commercial use only.
          </Section>

          <Section title="7. Intellectual Property">
            All content, design, and code within GetInShape are the property of GetInShape. You may not
            copy, redistribute, or create derivative works without permission.
          </Section>

          <Section title="8. Changes to Terms">
            We may update these terms periodically. Continued use of GetInShape after changes constitutes
            acceptance of the new terms.
          </Section>

          <Section title="9. Contact">
            Questions? Reach us at{' '}
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
      <p className="text-sm text-ink-2 leading-relaxed">{children}</p>
    </div>
  )
}
