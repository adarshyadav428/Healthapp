# Billing — Razorpay, Google Play, and legacy Stripe

> Extracted verbatim from `CLAUDE.md` so the always-loaded file stays lean. **Read this before
> touching anything under `app/api/razorpay/`, `app/api/play/`, `app/api/stripe/`, `lib/razorpay/`,
> `lib/play/`, `lib/stripe/`, `lib/subscription.ts` or `app/upgrade/`.**

**The invariant that makes all of this tractable:** all three providers write to the **same
`subscriptions` table** using the **same `status` vocabulary** (`active` / `trialing` / `past_due` /
`canceled`), so every Pro gate is provider-agnostic and never branches on the provider. The
`Subscription` type in `types/index.ts` carries `provider: 'stripe' | 'google_play' | 'razorpay'` —
never assume a single provider.

### Razorpay integration (web/PWA — replaced Stripe)

Razorpay is the web checkout path for all **new** subscriptions (Stripe barely supports India-domestic INR recurring billing under RBI mandate rules — see migration `022_razorpay_billing.sql`). Checkout is Razorpay's embedded widget (`checkout.razorpay.com/v1/checkout.js`, loaded via `next/script` on `/upgrade`), not a hosted page.

- `lib/razorpay/client.ts` — lazily constructs the Razorpay server SDK client from `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`.
- `lib/razorpay/plans.ts` — maps `monthly`/`annual` to `RAZORPAY_*_PLAN_ID` env vars; `total_count` approximates "forever" with a 10-year horizon (Razorpay requires a bounded cycle count).
- `app/api/razorpay/create-subscription/route.ts` — creates a Razorpay Subscription (`user_id` and `plan` in `notes`) and returns `subscription_id` + `key_id` for the client widget.
- `app/api/razorpay/verify/route.ts` — called by the client right after the widget completes; validates the payment signature server-side, then optimistically upserts the entitlement (`provider: 'razorpay'`) so the user doesn't wait on webhook latency.
- `app/api/razorpay/webhook/route.ts` — the authoritative, ongoing source of truth; validates `x-razorpay-signature` against `RAZORPAY_WEBHOOK_SECRET` and handles `subscription.activated`/`charged` (→ `active`), `subscription.halted` (→ `past_due`), `subscription.cancelled`/`completed` (→ `canceled`). Returns 500 on DB failure so Razorpay retries (unlike the Play RTDN handler, which always 200s).
- `app/api/razorpay/cancel/route.ts` — Razorpay has no hosted self-serve portal; this is the DIY replacement, called from Settings' "Manage Subscription". Cancels at cycle end (`cancel_at_period_end`, migration `023_billing_hardening.sql`), not immediately.

### Stripe (legacy — pre-Razorpay web subscribers only)

Existing Stripe subscribers were **not** migrated; they keep their subscription until they cancel or it lapses. Only the routes needed to service them remain — there is no Stripe checkout route anymore, so no new Stripe subscriptions can be created.

- `app/api/stripe/webhook/route.ts` — handles `checkout.session.completed`, `customer.subscription.updated/deleted`, and `invoice.payment_failed`.
- `app/api/stripe/portal/route.ts` — Billing Portal session for legacy subscribers' self-serve management.

### Google Play Billing (Android TWA — dual-provider with Razorpay)

The Android TWA (`in.co.getinshape.app`) must sell Pro through Google Play Billing (Play policy forbids third-party checkout for in-app digital goods). All providers (Razorpay, Google Play, legacy Stripe) write to the **same `subscriptions` table** using the same `status` vocabulary (`active`/`trialing`/`past_due`/`canceled`), so every Pro gate is provider-agnostic.

- `lib/play/billing.ts` — client-side. Feature-detects the Digital Goods API (`getDigitalGoodsService('https://play.google.com/billing')`); returns `null` off-Play so callers fall back to Razorpay. `purchasePlan()` runs the `PaymentRequest` flow and POSTs the token to `/api/play/verify`.
- `lib/play/google-auth.ts` — mints a service-account access token via `google-auth-library` (JWT), cached until ~1 min before expiry.
- `lib/play/verify.ts` — calls `androidpublisher/v3/.../subscriptionsv2` to verify + acknowledge a purchase token; maps Play states to our status vocab.
- `lib/play/products.ts` — maps plan names to Play product IDs from env vars.
- `app/api/play/verify/route.ts` — verifies a purchase token and upserts the entitlement (`provider: 'google_play'`).
- `app/api/play/rtdn/route.ts` — Pub/Sub push endpoint for Real-time Developer Notifications (the Play analogue of the Stripe webhook). Secret-guarded via `?secret=PLAY_RTDN_SECRET`. Always returns 200 to prevent retry storms.
- `app/upgrade/page.tsx` branches Play vs Razorpay at runtime (Digital Goods API detection).
- `components/settings/SettingsClient.tsx` branches "Manage Subscription" by `subscription.provider`: Google Play → the Play subscriptions page, Razorpay → `/api/razorpay/cancel` (with confirm dialog), legacy Stripe → the Stripe Billing Portal.

## Pricing

**INR only — never USD.** Pro Monthly ₹299, Pro Annual ₹1,999 (changed 2026-07-19 from ₹199/₹699).
Both plans carry a **3-day** free trial — Play Console offers only (no Razorpay/web trial), so trial
copy renders only inside the TWA.

## Local webhook testing

Razorpay has no CLI forwarder like `stripe listen` — to exercise `/api/razorpay/webhook` locally,
expose the dev server through a tunnel (e.g. `ngrok http 3000`) and point a Dashboard webhook (with
`RAZORPAY_WEBHOOK_SECRET`) at it. For the legacy Stripe webhook (pre-Razorpay subscribers only):

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Migrations that shape the billing schema

- `012_play_billing.sql` — adds `provider`, `play_purchase_token`, `play_product_id` to `subscriptions`
- `022_razorpay_billing.sql` — adds `razorpay_customer_id`, `razorpay_subscription_id`; extends the
  provider check to `'razorpay'`
- `023_billing_hardening.sql` — unique index on `play_purchase_token` (one token, one account) plus
  the `cancel_at_period_end` flag

## Tests that pin this

`tests/subscription.test.ts` (the Pro gate vocabulary), `tests/webhookSignatures.test.ts`,
`tests/playBilling.test.ts`, `tests/routeEntitlements.test.ts`, `tests/pricing.test.ts`,
`tests/checkoutErrors.test.ts`.
