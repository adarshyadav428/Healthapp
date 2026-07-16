# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**GetInShape** — a Next.js 14 (App Router) calorie and weight-tracking PWA targeting the Indian market. Stack: TypeScript, Tailwind CSS, Supabase (auth + Postgres), Razorpay (web subscriptions — replaced Stripe, which remains legacy-only), Google Play Billing (Android TWA), Zustand (client state), TanStack Query (server state), Recharts.

## Hard constraints (never violate)

- **No USDA data** — removed permanently. US-centric nutrition data is inaccurate for Indian foods. Food data comes from IFCT 2017 and Open Food Facts only.
- **INR pricing only** — never USD. Prices: Pro Monthly ₹199, Pro Annual ₹699.
- **Free tier** — unlimited manual/search food logs + 7 days history + 5 AI camera scans/day + 10 AI chat logs/day (both server-enforced in `app/api/camera/analyze/route.ts` / `app/api/chat/analyze/route.ts`). Pro unlocks history beyond 7 days, custom foods, and unlimited AI scans.

## Commands

```bash
npm run dev        # start dev server at http://localhost:3000
npm run build      # production build
npm run lint       # ESLint (next lint)
npm run format     # Prettier write
npm test           # vitest run — unit tests in tests/ (streak, date windows, camera nutrition, search filter, barcode, CSV)
```

Tests cover the pure logic in `lib/` (routes stay thin so the logic is testable). Run them plus `npm run check:tokens` before committing.

### Local webhook testing
Razorpay has no CLI forwarder like `stripe listen` — to exercise `/api/razorpay/webhook` locally, expose the dev server through a tunnel (e.g. `ngrok http 3000`) and point a Dashboard webhook (with `RAZORPAY_WEBHOOK_SECRET`) at it. For the legacy Stripe webhook (pre-Razorpay subscribers only):
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Environment variables

Copy `.env.local.example` → `.env.local`. Required keys:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — used only in trusted server routes (webhook, admin)
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET`
- `RAZORPAY_MONTHLY_PLAN_ID` / `RAZORPAY_ANNUAL_PLAN_ID` (Dashboard → Subscriptions → Plans)
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` — legacy only, keeps pre-Razorpay subscribers' webhook + portal working
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` (base64 JSON) / `ANDROID_PACKAGE_NAME` / `PLAY_RTDN_SECRET`
- `NEXT_PUBLIC_PLAY_PRODUCT_MONTHLY` / `NEXT_PUBLIC_PLAY_PRODUCT_ANNUAL`

`USDA_API_KEY` is intentionally absent — USDA integration is permanently removed.

## Architecture

### Routing and auth flow

All routes except `/`, `/auth/*`, `/api/*`, and `/_next/*` require authentication. `middleware.ts` delegates to `lib/supabase/middleware.ts` which:
1. Refreshes the Supabase session cookie on every request.
2. Redirects unauthenticated users to `/auth/sign-in?returnTo=…`.
3. Redirects authenticated users with incomplete profiles (`height_cm IS NULL`) to `/onboarding`.
4. Redirects authenticated users away from `/auth/*` to `/dashboard`.

### Server vs. client Supabase clients

- **`lib/supabase/server.ts`** — two factories:
  - `createServerClient()` — cookie-bound client for Server Components and Route Handlers acting as the current user.
  - `createAdminClient()` — service-role client; only use in trusted server-only routes (Razorpay webhook/verify/cancel, Stripe webhook, Play RTDN, admin).
- **`lib/supabase/client.ts`** — `getBrowserSupabaseClient()` for Client Components.
- **Never** import the server client in a Client Component or the browser client in a Server Component/Route Handler.

### Page pattern (Server Component shell + Client Component)

Protected pages follow a consistent pattern:
1. Server Component (`app/<route>/page.tsx`) fetches data via `createServerClient()`, checks auth/onboarding, and passes data as props.
2. Client Component (`components/<domain>/<Name>Client.tsx`) handles interactivity, optimistic updates, and form state.

Example: `app/dashboard/page.tsx` → `components/dashboard/DashboardClient.tsx`.

### State management

- **Zustand** (`store/userStore.ts`) — holds `user` and `profile` for client-side auth state.
- **TanStack Query** — wraps data-fetching in Client Components for cache/refetch. Provider is in `app/providers.tsx`.

### Key domain logic

- **`lib/tdee.ts`** — Mifflin-St Jeor BMR → TDEE → daily macro targets. Called during onboarding and profile updates.
- **`lib/streak.ts`** — calculates consecutive logging days from `food_logs` timestamps.
- **`lib/validations.ts`** — Zod schemas shared between forms (react-hook-form) and API route handlers. Always validate API input on the server side.
- **`lib/food-synonyms.ts`** — Hindi/regional name synonym expansion for the food search query (e.g. "sambar" → searches "sambar sambhar sambaru …"). Run before every search.
- **`lib/indian-foods-data.ts`** — 225 hand-curated IFCT 2017 entries auto-seeded into the `foods` table on first request.

### Food search pipeline

`app/api/foods/search/route.ts` runs three sources in parallel, ranked by relevance:

1. **Local IFCT DB** — synonym-expanded `ilike %query%` across the `foods` table. Most accurate for Indian home cooking.
2. **Open Food Facts India** — `lib/open-food-facts.ts` → `world.openfoodfacts.org` filtered to `countries_tags:en:india`. Best for packaged/branded Indian products (Amul, Britannia, MTR).
3. **Open Food Facts World** — international packaged goods fallback.

Results are deduplicated by name and returned with a `source` label (`ifct` / `off_india` / `off_world`). USDA is permanently excluded.

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

The Android TWA (`com.getinshape.app`) must sell Pro through Google Play Billing (Play policy forbids third-party checkout for in-app digital goods). All providers (Razorpay, Google Play, legacy Stripe) write to the **same `subscriptions` table** using the same `status` vocabulary (`active`/`trialing`/`past_due`/`canceled`), so every Pro gate is provider-agnostic.

- `lib/play/billing.ts` — client-side. Feature-detects the Digital Goods API (`getDigitalGoodsService('https://play.google.com/billing')`); returns `null` off-Play so callers fall back to Razorpay. `purchasePlan()` runs the `PaymentRequest` flow and POSTs the token to `/api/play/verify`.
- `lib/play/google-auth.ts` — mints a service-account access token via `google-auth-library` (JWT), cached until ~1 min before expiry.
- `lib/play/verify.ts` — calls `androidpublisher/v3/.../subscriptionsv2` to verify + acknowledge a purchase token; maps Play states to our status vocab.
- `lib/play/products.ts` — maps plan names to Play product IDs from env vars.
- `app/api/play/verify/route.ts` — verifies a purchase token and upserts the entitlement (`provider: 'google_play'`).
- `app/api/play/rtdn/route.ts` — Pub/Sub push endpoint for Real-time Developer Notifications (the Play analogue of the Stripe webhook). Secret-guarded via `?secret=PLAY_RTDN_SECRET`. Always returns 200 to prevent retry storms.
- `app/upgrade/page.tsx` branches Play vs Razorpay at runtime (Digital Goods API detection).
- `components/settings/SettingsClient.tsx` branches "Manage Subscription" by `subscription.provider`: Google Play → the Play subscriptions page, Razorpay → `/api/razorpay/cancel` (with confirm dialog), legacy Stripe → the Stripe Billing Portal.

### Database tables (Supabase Postgres)

`profiles`, `food_logs`, `foods`, `weight_logs`, `subscriptions`, `water_logs`, `exercise_logs`, `sleep_logs`, `fasting_logs`, `measurements`, `saved_meals`.

Migrations are numbered `001` – `023` in `supabase/migrations/`. Apply **all** in order before running locally. Key ones:
- `001_initial.sql` — core schema
- `007_seed_indian_foods.sql` / `009_seed_indian_foods_v2.sql` / `010_seed_missing_foods.sql` — IFCT food data
- `012_play_billing.sql` — adds `provider`, `play_purchase_token`, `play_product_id` to `subscriptions`
- `022_razorpay_billing.sql` — adds `razorpay_customer_id`, `razorpay_subscription_id`; extends the provider check to `'razorpay'`
- `023_billing_hardening.sql` — unique index on `play_purchase_token` (one token, one account) + `cancel_at_period_end` flag

### Types

All shared TypeScript types live in `types/index.ts`: `Profile`, `Food`, `FoodLog`, `WeightLog`, `DailyTotals`, `Subscription`.

The `Subscription` type includes `provider: 'stripe' | 'google_play' | 'razorpay'` — never assume a single provider.

### UI components

Primitive components in `components/ui/` follow the shadcn/ui pattern (Radix UI primitives + `clsx`/`tailwind-merge` via `lib/utils.ts`). Domain components live under `components/dashboard/`, `components/log/`, `components/weight/`, `components/settings/`, `components/layout/`.

### Design system — "Ember" (Porcelain light / Onyx dark)

> **"Ember Air" migration in progress (started 2026-07-13).** The four core tab screens — Home (`components/dashboard/DashboardClient.tsx`), Food (`app/log`), Trends (`components/progress/ProgressClient.tsx`), Profile (`components/settings/SettingsClient.tsx`) — have been rebuilt to a calmer, Cal-AI-inspired direction (designer handoff). On these screens the rules below are **amended**: (1) **no `AppHeader`** — each has its own per-page header (small date/label line over a 24px Inter Tight title); (2) accent is **narrowed** — ember is reserved for *data only* (streak flame, calorie ring, over-goal amount, today's chart bar/calendar dot), while the tab-bar active state, the FAB, and the macro rings are **ink**, not ember; (3) the **tab bar** (`BottomNav`) is a full-width frosted bar with a hairline top (not the floating pill), ink active tabs, and an **ink/off-white FAB** that auto-inverts via `var(--ink)`/`var(--canvas)` (still opens the camera scan); (4) cards use `rounded-[20px]`/`rounded-[24px]` + the flatter `--shadow-air` token (not `shadow-rest`). Secondary (non-tab) pages — history, weight, recipes, deficit — use `components/layout/PageHeader.tsx` (a small label over a 24px title, with a back chevron since they're reached from a tab); the old `AppHeader` has been **removed** entirely (theme control now lives only in Profile → Appearance). Their inner cards still use the older `shadow-rest` elevation — a lighter touch than the core screens, not the flat `--shadow-air`. The bespoke funnel pages (`/`, `/auth/*`, `/onboarding`, `/upgrade`) have their own layouts and no tab bar. Dark accent currently stays the Onyx `--brand` (#FF7A45); the mockup specifies flat #F1662E in dark — deferred to an on-device call. The doctrine below still governs everywhere else.

One accent, two themes, no exceptions. **Ember (`--brand`)** — a warm orange-red — is the only accent color in the entire app: every button, active nav state, link, focus ring, the calorie ring, streak flame, progress fills. There is no second brand color (the old "Peacock & Marigold" two-accent system is gone; `--brand` and `--energy` both point at the same ember family for back-compat, not as two accents). Semantic green/red (`--good` / `--bad`) are reserved for state so they never compete with the brand. Macro colors (`--protein` / `--carbs` / `--fat`) are the only other fixed hues, used solely for macro data.

Both themes are live and real: **Porcelain** (`:root`, light — warm off-white canvas, soft depth, a restrained bloom behind the calorie ring) and **Onyx** (`.dark` — near-black canvas, the same ember accent glowing via a blurred duplicate SVG arc). `next-themes` drives it (`attribute="class"`, `defaultTheme="system"`, provider in `app/providers.tsx`); default follows the OS, users can override via the header sun/moon icon or Settings → Appearance's three-way Light/Dark/System control (`components/ui/theme-toggle.tsx`). `/studio` (public, noindex, no user data) is the living reference implementation — its `WORLDS` object in `components/studio/StudioClient.tsx` is the literal source of truth for token values; when in doubt about what a token *should* render as in either theme, look there first.

- **Tokens are the single source of truth.** All colors are CSS variables defined in `app/globals.css` (`:root` = Porcelain, `.dark` = Onyx). Tailwind (`tailwind.config.ts`) maps token names to these variables. **Never write raw hex in a component** — reference a token (`bg-brand`, `text-ink`, `border-hairline`, `bg-brand-soft`, …). Legacy aliases (`primary`, `accent`, `muted`, `card`, `background`, `foreground`) are remapped onto the new tokens for back-compat and are theme-reactive too — using them isn't wrong, just not the preferred spelling for new code.
  - **Opacity modifiers are broken on every token color.** Tailwind's `bg-token/NN` syntax only works when the color is defined as `rgb(var(--x) / <alpha-value>)`; ours are plain `var(--x)` strings, so `/NN` is a silent no-op — Tailwind drops the modifier and renders full-strength. This bit the codebase repeatedly during the Ember rollout. Use a dedicated pre-mixed alpha token instead (`--brand-soft`, `--brand-ring`, `--bad-soft`, `--header-bg`, `--glass-hair`, `--scrim`), or `color-mix(in srgb, var(--token) N%, transparent)` inline if no dedicated token exists yet.
- **Type:** Inter (`--font-sans`, body) + Inter Tight (`--font-display`, headings and big numerals), both via `next/font/google`. Numerals use `tabular-nums`. Keep weights restrained — `font-semibold`/`font-bold` for emphasis, avoid `font-black`.
- **Radius:** three steps — `rounded-control` (12px), `rounded-card` (18px), `rounded-sheet` (28px) — plus `rounded-full` for pills.
- **Elevation:** `shadow-rest` (cards), `shadow-float` (sheets, nav, FAB), `shadow-cta`/`shadow-fab` (the gradient CTA and nav FAB specifically); everything else is a hairline border.
- **The primary CTA is always a gradient**, not a flat fill: `bg-cta-grad` + `shadow-cta` (this is what `<Button variant="default">` renders). Never hand-roll a flat `bg-brand` primary button.
- **Motion:** `cubic-bezier(.22,1,.36,1)` (`ease-out` in the Tailwind config) for most transitions, the springier `cubic-bezier(.32,.72,0,1)` (`ease-spring`) for sheets; `tap-scale` on tappables; all gated behind `prefers-reduced-motion`.
- **Chrome:** there is no shared top header — the four core tab screens have bespoke per-page headers, and secondary pages use `components/layout/PageHeader.tsx` (label + title + back chevron). `BottomNav` is the shared tab bar + FAB on every authenticated page (see the Ember Air note above).
- **Guardrail:** `npm run check:tokens` fails on any raw hex color *or* broken opacity modifier anywhere in `app/` or `components/` (the whole app is guarded now, not just `components/ui`/`layout`). Legitimate exceptions (PWA meta colors, the studio's own reference values, a fixed multi-color brand mark like the Google "G" logo) are allowlisted by filename or a `// token-check-ignore` / `token-check-ignore-start` … `-end` comment — see the script header for the exact mechanism. If you add a new color token, add its name to `TOKEN_NAMES` in `scripts/check-tokens.mjs` too, or the opacity check goes blind to it.
