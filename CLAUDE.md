# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**CalTrack** — a Next.js 14 (App Router) calorie and weight-tracking PWA. Stack: TypeScript, Tailwind CSS, Supabase (auth + Postgres), Stripe (subscriptions), USDA Food Data Central API, Zustand (client state), TanStack Query (server state), Recharts.

## Commands

```bash
npm run dev        # start dev server at http://localhost:3000
npm run build      # production build
npm run lint       # ESLint (next lint)
npm run format     # Prettier write
```

No test suite is present — there are no test commands to run.

### Local webhook forwarding (Stripe)
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Environment variables

Copy `.env.local.example` → `.env.local`. Required keys:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — used only in trusted server routes (webhook)
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_MONTHLY_PRICE_ID` / `STRIPE_ANNUAL_PRICE_ID`
- `USDA_API_KEY`

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
  - `createAdminClient()` — service-role client; only use in trusted server-only routes (e.g., the Stripe webhook).
- **`lib/supabase/client.ts`** — `getBrowserSupabaseClient()` for Client Components.
- **Never** import the server client in a Client Component or the browser client in a Server Component/Route Handler.

### Page pattern (Server Component shell + Client Component)

Protected pages follow a consistent pattern:
1. Server Component (`app/<route>/page.tsx`) fetches data via `createServerClient()`, checks auth/onboarding, and passes data as props.
2. Client Component (`components/<domain>/<Name>Client.tsx`) handles interactivity, optimistic updates, and form state.

Example: `app/dashboard/page.tsx` → `components/dashboard/DashboardClient.tsx`.

### State management

- **Zustand** (`store/userStore.ts`) — holds `user` and `profile` for client-side auth state. Populated by Client Components after server-rendered pages hydrate.
- **TanStack Query** — wraps data-fetching in Client Components for cache/refetch. Provider is set up in `app/providers.tsx`.

### Key domain logic

- **`lib/tdee.ts`** — Mifflin-St Jeor BMR → TDEE → daily macro targets. Called during onboarding and profile updates.
- **`lib/streak.ts`** — calculates consecutive logging days from `food_logs` timestamps.
- **`lib/validations.ts`** — Zod schemas shared between forms (react-hook-form) and API route handlers. Always validate API input against these schemas on the server side.

### Stripe integration

- `app/api/stripe/create-checkout/route.ts` — creates a Checkout Session; passes `user_id` and `plan` in `metadata`.
- `app/api/stripe/portal/route.ts` — creates a Billing Portal session.
- `app/api/stripe/webhook/route.ts` — uses `createAdminClient()` (not the cookie client); handles `checkout.session.completed`, `customer.subscription.updated/deleted`, and `invoice.payment_failed` to upsert the `subscriptions` table.

### Database tables (Supabase Postgres)

`profiles`, `food_logs`, `foods`, `weight_logs`, `subscriptions`. Migration is in `supabase/migrations/001_initial.sql`. Apply it before running locally.

### Types

All shared TypeScript types live in `types/index.ts`: `Profile`, `Food`, `FoodLog`, `WeightLog`, `DailyTotals`, `Subscription`.

### UI components

Primitive components in `components/ui/` follow the shadcn/ui pattern (Radix UI primitives + `clsx`/`tailwind-merge` via `lib/utils.ts`). Domain components live under `components/dashboard/`, `components/log/`, `components/weight/`, `components/settings/`, `components/layout/`.
