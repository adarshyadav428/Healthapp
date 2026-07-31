# GetInShape — Indian calorie & weight tracker

A Next.js 14 (App Router) PWA for tracking meals, calories and weight, built for the
Indian market. TypeScript, Tailwind, Supabase (auth + Postgres), Razorpay and Google Play
Billing for subscriptions, Zustand, TanStack Query, Recharts.

> **`CLAUDE.md` is the authoritative document for this codebase** — architecture, the
> hard constraints, and the reasoning behind the non-obvious parts of the search,
> billing and growth code. Read it before changing anything. This README only covers
> getting the thing running.

## Getting started

1. Install dependencies

```bash
npm install
```

2. Set environment variables

Copy [.env.local.example](.env.local.example) to `.env.local` and fill in the values.

3. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Key scripts

```bash
npm run dev           # dev server
npm run build         # production build
npm run start         # serve the production build
npm run lint          # ESLint
npm run format        # Prettier write
npm test              # vitest run — the unit suite over lib/
npm run check:tokens  # design-token guard (no raw hex, no broken opacity modifiers)
```

Run `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run check:tokens` and
`npm run build` before committing.

## Supabase

Apply **every** file in [supabase/migrations/](supabase/migrations/) in order, then
configure Google OAuth in the Supabase dashboard if you want Google sign-in.

Note that migration numbers are **not** unique — `002`, `004`, `005` and `009` each
appear twice and there is no `021`. Always refer to a migration by its exact filename.

## Billing

Two live providers write to the same `subscriptions` table with the same status
vocabulary, so every Pro gate is provider-agnostic:

- **Razorpay** — the web/PWA checkout for all new subscriptions. Needs
  `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` and the two plan
  ids. Razorpay has no CLI forwarder, so to exercise the webhook locally expose the dev
  server through a tunnel (e.g. `ngrok http 3000`) and point a Dashboard webhook at it.
- **Google Play Billing** — required inside the Android TWA, because Play policy forbids
  third-party checkout for in-app digital goods.

**Stripe is legacy only.** Pre-Razorpay subscribers were not migrated and keep their
subscription until it lapses; only the webhook and billing-portal routes remain. There
is no Stripe checkout route, so no new Stripe subscriptions can be created.

Pricing is **INR only**: ₹299/month, ₹1,999/year. The 3-day free trial is a Play Console
offer, so trial copy renders only inside the TWA.

## Food data

Three sources, and the distinction between them matters:

- **IFCT 2017** (`lib/indian-foods-data.ts`) — ~225 hand-curated entries. **Measured.**
- **Curated** (`lib/curated-foods-data.ts` ← `data/indian-foods.json`) — ~645 generated
  category-baseline **estimates** covering the long tail IFCT doesn't reach. Badged
  "📊 Estimated" in search and ranked below every measured source. Never hand-edit
  `data/indian-foods.json` — fix `scripts/generate-indian-foods-estimate.ts` and re-run
  it, and keep `tests/curatedFoods.test.ts` green.
- **Open Food Facts** — packaged and branded products, fetched live and persisted into
  `foods` on first sighting.

Both local sets are auto-seeded into the `foods` table on first request.

**There is no USDA integration.** It was removed permanently — US-centric nutrition data
is inaccurate for Indian food — and `USDA_API_KEY` is intentionally absent. Do not
re-add it; this is a hard constraint in `CLAUDE.md`.

## Safety note

`food_logs.food_id`, `food_favourites.food_id`, `saved_meal_items.food_id` and
`food_dismissals.food_id` all reference `foods(id)` **`ON DELETE CASCADE`**. Deleting a
row from `foods` silently deletes every user's diary entries for that food, with no
error. Never delete from `foods`.
