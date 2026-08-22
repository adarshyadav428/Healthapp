import Link from "next/link";
import type { Metadata } from "next";
import { Check } from "lucide-react";
import { PRICE_ANNUAL, PRICE_MONTHLY } from "@/lib/pricing";
import {
  ANDROID_PACKAGE_ID,
  LEGAL_NAME,
  SUPPORT_EMAIL,
  TRADE_NAME,
} from "@/lib/merchant";

export const metadata: Metadata = {
  title: "Pricing · GetInShape",
  description:
    "GetInShape Pro pricing in Indian Rupees — what the free plan includes, what Pro costs, what each payment is for and how billing works.",
};

const FREE_FEATURES = [
  "Log food by search from 850+ Indian foods",
  "Daily calorie and macro targets",
  "Weight tracking and streaks",
];

const PRO_FEATURES = [
  "Unlimited food logging, every day",
  "Photo scan and chat logging",
  "Advanced progress charts and weight trend",
  "Coaching insights, plateau detection and adaptive targets",
  "Saved meals and one-tap repeat logging",
];

export default function PricingPage() {
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
          <h1 className="font-display text-3xl font-bold text-ink">Pricing</h1>
          <p className="mt-1 text-sm text-ink-2">
            All prices in Indian Rupees (INR), inclusive of applicable taxes.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-sheet border border-hairline bg-surface p-6 shadow-rest">
            <h2 className="font-display text-lg font-bold text-ink">Free</h2>
            <p className="font-display mt-1 text-3xl font-bold text-ink tabular-nums">
              ₹0
            </p>
            <p className="mt-1 text-xs text-ink-2">
              Free forever · no card required
            </p>
            <ul className="mt-4 space-y-2">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex gap-2 text-sm text-ink-2">
                  <Check
                    className="mt-0.5 h-4 w-4 flex-shrink-0 text-good"
                    strokeWidth={2.5}
                  />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-sheet border border-brand-ring bg-surface p-6 shadow-float">
            <h2 className="font-display text-lg font-bold text-ink">Pro</h2>
            <p className="font-display mt-1 text-3xl font-bold text-ink tabular-nums">
              {PRICE_MONTHLY}
              <span className="text-base font-semibold text-ink-2">/month</span>
            </p>
            <p className="mt-1 text-xs text-ink-2">
              or {PRICE_ANNUAL}/year · cancel anytime
            </p>
            <ul className="mt-4 space-y-2">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex gap-2 text-sm text-ink-2">
                  <Check
                    className="mt-0.5 h-4 w-4 flex-shrink-0 text-good"
                    strokeWidth={2.5}
                  />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/upgrade"
              className="mt-6 block rounded-full bg-brand px-6 py-3 text-center text-sm font-bold text-white shadow-rest transition-opacity hover:opacity-90"
            >
              See plans →
            </Link>
          </div>
        </div>

        <div className="mt-6 space-y-6 rounded-sheet border border-hairline bg-surface p-6 shadow-rest">
          <Section title="What each payment is for">
            A payment on {TRADE_NAME} buys a time-limited subscription to Pro —
            a digital service delivered inside this web app and our Android app.
            Nothing is shipped and there are no delivery charges. A monthly
            payment grants 1 month of Pro access; an annual payment grants 12
            months. Access begins immediately on successful payment.
          </Section>

          <Section title="How billing works">
            Subscriptions renew automatically at the end of each period until
            you cancel, and you are told the amount and date before the first
            charge. Cancel any time from Settings → Manage Subscription; you
            keep Pro until the end of the period you have already paid for. See
            the{" "}
            <Link href="/refunds" className="text-brand-ink hover:underline">
              Refund &amp; Cancellation Policy
            </Link>{" "}
            for refund timelines.
          </Section>

          <Section title="How payments are collected">
            On the web, payments are processed by Razorpay. Inside the Android
            app, they are processed by Google Play Billing. Card, UPI,
            net-banking and wallet details are entered on the payment
            provider&apos;s own secure page — {TRADE_NAME} never sees or stores
            them. Settlements are received by {LEGAL_NAME}.
          </Section>

          <Section title="Where the app runs">
            {TRADE_NAME} runs in any modern browser at{" "}
            <a
              href="https://www.getinshape.co.in"
              className="text-brand-ink hover:underline"
            >
              www.getinshape.co.in
            </a>{" "}
            and installs to your home screen as an app. The Android app is
            published on Google Play under the package id{" "}
            <span className="font-mono text-xs text-ink">
              {ANDROID_PACKAGE_ID}
            </span>
            .
          </Section>

          <Section title="Questions about a charge">
            Email{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-brand-ink hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>{" "}
            or see{" "}
            <Link href="/contact" className="text-brand-ink hover:underline">
              Contact Us
            </Link>{" "}
            for our phone number and support hours.
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
          <Link href="/refunds" className="hover:text-ink">
            Refunds
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
