import Link from "next/link";
import type { Metadata } from "next";
import { PRICE_ANNUAL, PRICE_MONTHLY } from "@/lib/pricing";
import { SUPPORT_EMAIL, SUPPORT_PHONE_DISPLAY } from "@/lib/merchant";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy · GetInShape",
  description:
    "How to cancel a GetInShape Pro subscription, when you are eligible for a refund, and how long refunds take to reach you.",
};

export default function RefundsPage() {
  return (
    <div className="min-h-screen bg-canvas px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6">
          <Link href="/" className="mb-8 flex items-center gap-2">
            <span className="text-2xl">🥗</span>
            <span className="font-display text-xl font-bold text-brand-ink">
              GetInShape
            </span>
          </Link>
          <h1 className="font-display text-3xl font-bold text-ink">
            Refund &amp; Cancellation Policy
          </h1>
          <p className="mt-1 text-sm text-ink-2">
            Last updated: August 22, 2026
          </p>
        </div>

        <div className="space-y-6 rounded-sheet border border-hairline bg-surface p-6 shadow-rest">
          <Section title="1. What you are paying for">
            GetInShape Pro is a digital subscription that unlocks unlimited food
            logging, photo and chat logging, advanced progress charts and
            coaching insights. There is no physical product and nothing is
            shipped, so no delivery or shipping charges apply. Pro Monthly is{" "}
            {PRICE_MONTHLY} and Pro Annual is {PRICE_ANNUAL}, both inclusive of
            applicable taxes and billed in Indian Rupees.
          </Section>

          <Section title="2. Cancelling your subscription">
            You can cancel at any time from Settings → Manage Subscription.
            Cancellation stops the next renewal; it does not end your current
            period. You keep Pro access until the last day you have already paid
            for, and are not charged again after that. Subscriptions purchased
            inside the Android app are cancelled through Google Play →
            Subscriptions.
          </Section>

          <Section title="3. Refund eligibility">
            New subscribers can request a full refund of their{" "}
            <strong>first</strong> payment within 30 days of that payment — no
            questions asked. Renewal charges are not refundable, because you can
            cancel any time before a renewal date to avoid the next charge. If a
            renewal was charged after you had already cancelled, or you were
            charged twice for the same period, we refund it in full regardless
            of the 30-day window.
          </Section>

          <Section title="4. How to request a refund">
            Email{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-brand-ink hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>{" "}
            from the address on your account, or call {SUPPORT_PHONE_DISPLAY}.
            Tell us which payment you want refunded. We acknowledge every
            request within 48 hours and approve or explain our decision within 5
            working days.
          </Section>

          <Section title="5. How long a refund takes">
            Approved refunds are issued to the original payment method only — we
            cannot refund to a different card, UPI ID or bank account. Once
            approved, we initiate the refund within 5 working days. Your bank or
            card issuer then takes a further 5 to 7 working days to credit it,
            so allow up to 12 working days in total from approval.
          </Section>

          <Section title="6. Purchases made through Google Play">
            A subscription bought inside the Android app is a transaction with
            Google, not with us directly. Those follow{" "}
            <a
              href="https://support.google.com/googleplay/answer/2479637"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-ink hover:underline"
            >
              Google Play&apos;s refund policy
            </a>
            . Contact us anyway if Google declines and you believe the charge
            was a mistake — we will take it up on your behalf.
          </Section>

          <Section title="7. Failed and duplicate payments">
            If money left your account but Pro was not activated, do not pay
            again. Send us the payment reference and we will either activate Pro
            or confirm the refund. Payments that fail at the gateway are
            auto-reversed by your bank, normally within 5 to 7 working days.
          </Section>
        </div>

        <p className="mt-6 text-center text-xs text-ink-2">
          <Link href="/terms" className="hover:text-ink">
            Terms
          </Link>
          {" · "}
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          {" · "}
          <Link href="/contact" className="hover:text-ink">
            Contact
          </Link>
        </p>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="font-display mb-2 text-base font-bold text-ink">
        {title}
      </h2>
      <p className="text-sm leading-relaxed text-ink-2">{children}</p>
    </div>
  );
}
