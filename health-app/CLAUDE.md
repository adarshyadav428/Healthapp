# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**GetInShape** — a Next.js 14 (App Router) calorie and weight-tracking PWA targeting the Indian market. Stack: TypeScript, Tailwind CSS, Supabase (auth + Postgres), Stripe (web subscriptions), Google Play Billing (Android TWA), Zustand (client state), TanStack Query (server state), Recharts.

## Hard constraints (never violate)

- **No USDA data** — removed permanently. US-centric nutrition data is inaccurate for Indian foods. Food data comes from IFCT 2017 and Open Food Facts only.
- **INR pricing only** — never USD. Prices: Pro Monthly ₹199, Pro Annual ₹699.
- **Free tier** — unlimited food logs + 7 days history. Pro unlocks history beyond 7 days and custom foods.

## Commands

```bash
npm run dev        # start dev server at http://localhost:3000
npm run build      # production build
npm run lint       # ESLint (next lint)
npm run format     # Prettier write
```

No test suite — there are no test commands to run.

### Local webhook forwarding (Stripe)
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Environment variables

Copy `.env.local.example` → `.env.local`. Required keys:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — used only in trusted server routes (webhook, admin)
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_MONTHLY_PRICE_ID` / `STRIPE_ANNUAL_PRICE_ID`
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
  - `createAdminClient()` — service-role client; only use in trusted server-only routes (Stripe webhook, Play RTDN, admin).
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

### Stripe integration (web/PWA)

- `app/api/stripe/create-checkout/route.ts` — creates a Checkout Session; passes `user_id` and `plan` in `metadata`.
- `app/api/stripe/portal/route.ts` — creates a Billing Portal session.
- `app/api/stripe/webhook/route.ts` — uses `createAdminClient()`; handles `checkout.session.completed`, `customer.subscription.updated/deleted`, and `invoice.payment_failed` to upsert the `subscriptions` table.

### Google Play Billing (Android TWA — dual-provider with Stripe)

The Android TWA (`com.getinshape.app`) must sell Pro through Google Play Billing (Play policy forbids Stripe for in-app digital goods). Both providers write to the **same `subscriptions` table** using the same `status` vocabulary (`active`/`trialing`/`past_due`/`canceled`), so every Pro gate is provider-agnostic.

- `lib/play/billing.ts` — client-side. Feature-detects the Digital Goods API (`getDigitalGoodsService('https://play.google.com/billing')`); returns `null` off-Play so callers fall back to Stripe. `purchasePlan()` runs the `PaymentRequest` flow and POSTs the token to `/api/play/verify`.
- `lib/play/google-auth.ts` — mints a service-account access token via `google-auth-library` (JWT), cached until ~1 min before expiry.
- `lib/play/verify.ts` — calls `androidpublisher/v3/.../subscriptionsv2` to verify + acknowledge a purchase token; maps Play states to our status vocab.
- `lib/play/products.ts` — maps plan names to Play product IDs from env vars.
- `app/api/play/verify/route.ts` — verifies a purchase token and upserts the entitlement (`provider: 'google_play'`).
- `app/api/play/rtdn/route.ts` — Pub/Sub push endpoint for Real-time Developer Notifications (the Play analogue of the Stripe webhook). Secret-guarded via `?secret=PLAY_RTDN_SECRET`. Always returns 200 to prevent retry storms.
- `app/upgrade/page.tsx` branches Play vs Stripe at runtime.
- `components/settings/SettingsClient.tsx` sends Play users to the Play subscriptions page instead of the Stripe portal.

### Database tables (Supabase Postgres)

`profiles`, `food_logs`, `foods`, `weight_logs`, `subscriptions`, `water_logs`, `exercise_logs`, `sleep_logs`, `fasting_logs`, `measurements`, `saved_meals`.

Migrations are numbered `001` – `012` in `supabase/migrations/`. Apply **all** in order before running locally. Key ones:
- `001_initial.sql` — core schema
- `007_seed_indian_foods.sql` / `009_seed_indian_foods_v2.sql` / `010_seed_missing_foods.sql` — IFCT food data
- `012_play_billing.sql` — adds `provider`, `play_purchase_token`, `play_product_id` to `subscriptions`

### Types

All shared TypeScript types live in `types/index.ts`: `Profile`, `Food`, `FoodLog`, `WeightLog`, `DailyTotals`, `Subscription`.

The `Subscription` type includes `provider: 'stripe' | 'google_play'` — never assume Stripe-only.

### UI components

Primitive components in `components/ui/` follow the shadcn/ui pattern (Radix UI primitives + `clsx`/`tailwind-merge` via `lib/utils.ts`). Domain components live under `components/dashboard/`, `components/log/`, `components/weight/`, `components/settings/`, `components/layout/`.

### Design system — "Peacock & Marigold"

The interface is calm; the user's data is the color. **Peacock teal (`--brand` `#10514B`)** owns everything interactive — buttons, active nav, links, focus rings. **Marigold (`--energy` `#F2A23A`)** owns everything that is the user's data — the calorie ring, streak flame, progress fills. Marigold is **never** text or a button (use `--energy-ink` for marigold-toned text); peacock is the only action color. Semantic green/red (`--good` / `--bad`) are reserved for state so they never fight the brand.

- **Tokens are the single source of truth.** All colors are CSS variables defined in `app/globals.css` (`:root` = light; `.dark` = staged dark palette, dark-ready but not enabled — nothing applies the class yet). Tailwind (`tailwind.config.ts`) maps token names to these variables. **Never write raw hex in a component** — reference a token (`bg-brand`, `text-ink`, `border-hairline`, `bg-energy`, …). Legacy aliases (`primary`, `accent`, `muted`, `card`, `background`) are remapped onto the new tokens for back-compat.
  - Translucency can't use Tailwind's `/opacity` on `var()` tokens (it silently breaks). Dedicated alpha tokens exist for this: `--scrim`, `--header-bg`, `--brand-ring`.
- **Type:** Bricolage Grotesque (`--font-display`, `font-display` / headings) for display + big numerals; Instrument Sans (`--font-sans`, body). Both via `next/font/google`. Numerals use `tabular-nums`.
- **Radius:** four steps only — `rounded-control` (12px), `rounded-card` (18px), `rounded-sheet` (28px), `rounded-full` (pills).
- **Elevation:** two shadows only — `shadow-rest` (cards) and `shadow-float` (sheets, nav, FAB); everything else is a hairline border.
- **Motion:** spring curve `ease-spring` `cubic-bezier(.32,.72,0,1)`; `tap-scale` on tappables; all gated behind `prefers-reduced-motion`.
- **Chrome:** one header, `components/layout/AppHeader.tsx` (`greeting` mode for home/log, `title` mode for interior pages). `BottomNav` is the tab bar + FAB.
- **Guardrail:** `npm run check:tokens` fails if raw hex appears in guarded dirs (`components/ui`, `components/layout`) and reports remaining hex elsewhere as a migration tracker. Expand `GUARDED` in `scripts/check-tokens.mjs` as each rebrand phase lands.

Dark mode is disabled (the `.dark` block exists and is dark-ready, but no code applies the class). Do not add `dark:` variant classes — they are dead until dark mode is switched on.
