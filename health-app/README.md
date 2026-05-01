# CalTrack — Weight Loss & Calorie Tracking MVP

CalTrack is a Next.js 14 app for tracking meals, calories, and weight trends. It integrates Supabase for auth + Postgres, Stripe for subscriptions, and a USDA Food search API.

## Getting started

1. Install dependencies

```bash
npm install
```

2. Set environment variables

Copy [.env.local.example](.env.local.example) to `.env.local` and fill in values.

3. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Key scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Supabase

- Apply the SQL migration in [supabase/migrations/001_initial.sql](supabase/migrations/001_initial.sql).
- Configure Google OAuth in Supabase if you want Google sign-in.

## Stripe

- Set price IDs and webhook secret in `.env.local`.
- Use Stripe CLI to forward webhooks during local development.

## USDA food search

- Provide `USDA_API_KEY` in `.env.local`.

