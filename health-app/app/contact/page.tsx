import Link from "next/link";
import type { Metadata } from "next";
import {
  ADDRESS,
  LEGAL_NAME,
  SUPPORT_EMAIL,
  SUPPORT_HOURS,
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_PHONE_E164,
  TRADE_NAME,
  hasAddress,
} from "@/lib/merchant";

export const metadata: Metadata = {
  title: "Contact Us · GetInShape",
  description:
    "Get in touch with the GetInShape team — support email, phone number, operating address and support hours.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-canvas px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6">
          <Link href="/" className="mb-8 flex items-center gap-2">
            <span className="text-title">🥗</span>
            <span className="font-display text-title-sm font-bold text-brand-ink">
              GetInShape
            </span>
          </Link>
          <h1 className="font-display text-title-lg font-bold text-ink">
            Contact Us
          </h1>
          <p className="mt-1 text-body text-ink-2">
            We answer every message ourselves — there is no ticket queue.
          </p>
        </div>

        <div className="space-y-6 rounded-sheet border border-hairline bg-surface p-6 shadow-rest">
          <Section title="Email">
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-brand-ink hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>
            <br />
            For billing questions, include the email address on your account so
            we can find the payment.
          </Section>

          <Section title="Phone">
            <a
              href={`tel:${SUPPORT_PHONE_E164}`}
              className="text-brand-ink hover:underline"
            >
              {SUPPORT_PHONE_DISPLAY}
            </a>
            <br />
            {SUPPORT_HOURS}
          </Section>

          {hasAddress && (
            <Section title="Operating address">
              {LEGAL_NAME}
              {ADDRESS.map((line) => (
                <span key={line}>
                  <br />
                  {line}
                </span>
              ))}
            </Section>
          )}

          <Section title="Business details">
            {TRADE_NAME} is operated by {LEGAL_NAME}. Subscriptions are sold in
            Indian Rupees (INR) to customers in India. Payments on the web are
            processed by Razorpay and, inside the Android app, by Google Play
            Billing — we never see or store your card, UPI or bank details.
          </Section>

          <Section title="Refunds and cancellations">
            Our full policy, including timelines, is on the{" "}
            <Link href="/refunds" className="text-brand-ink hover:underline">
              Refund &amp; Cancellation Policy
            </Link>{" "}
            page. To cancel, open Settings → Manage Subscription in the app; you
            keep Pro access until the end of the period you have already paid
            for.
          </Section>

          <Section title="Grievances">
            If something has not been resolved to your satisfaction, write to{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-brand-ink hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>{" "}
            with &ldquo;Grievance&rdquo; in the subject line. We acknowledge
            within 48 hours and aim to resolve within 15 working days.
          </Section>
        </div>

        <p className="mt-6 text-center text-caption text-ink-2">
          <Link href="/terms" className="hover:text-ink">
            Terms
          </Link>
          {" · "}
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          {" · "}
          <Link href="/pricing" className="hover:text-ink">
            Pricing
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
      <h2 className="font-display mb-2 text-body-lg font-bold text-ink">
        {title}
      </h2>
      <p className="text-body leading-relaxed text-ink-2">{children}</p>
    </div>
  );
}
