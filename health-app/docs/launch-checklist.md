# GetInShape — launch checklist

**Prepared:** 2026-09-05. This is a deployment-readiness checklist, not an audit — it assumes the
2026-09-03/04 deep-dive audit and the 2026-09-05 adversarial pass (`docs/adversarial-audit-2026-09-05.md`)
already ran and their P0/P1 findings are fixed on this branch. It does not re-litigate that work.

---

## 1. Before deployment

### Code / branch

- [ ] Current branch is `fix/custom-food-ownership-p0-2-followup`, 2 commits ahead of local `main`
      (`b6875ba` custom-food ownership fix, `5909818` camera regression coverage) — **neither is
      merged yet**.
- [ ] **The working tree also has a large amount of uncommitted work that is not yet in any commit**
      (see `git status`): the F1-F4 fixes from `docs/adversarial-audit-2026-09-05.md` (account
      deletion billing safety, subscription entitlement reliability, weight/exercise idempotency,
      copy-yesterday idempotency) plus the copy-meal idempotency fix and three new migrations
      (`046`, `047`, `048`). **This must be committed and PR'd before it can ship** — right now it
      only exists in the local working tree.
- [ ] Decide the PR shape before opening one: this is a lot of unrelated-looking surface area
      (billing, subscriptions, three logging surfaces) but it is all one coherent theme — the
      2026-09-05 audit's fix set — so one PR titled around "duplicate-submission + entitlement
      reliability fixes" is reasonable. Splitting it is also fine; just don't let it merge silently
      alongside unrelated work.
- [ ] Look at the PR's Vercel preview before merging.
- [ ] Confirm the PR *number and title* before clicking merge if more than one PR is open — `main`
      has no branch protection (see below), so a wrong click ships immediately.

### Environment variables (production, Vercel project settings)

Verified present in **local** `.env.local`: Supabase (URL/anon/service-role), Stripe (legacy),
Razorpay (key/secret/webhook secret/both plan IDs), Gemini, PostHog (key/host), VAPID (public/
private/subject), `CRON_SECRET`. These are dev-only confirmations — **verify the production values
independently in the Vercel dashboard**, this session's Vercel CLI was not authenticated and could
not read them directly.

- [ ] `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` — **not set in local `.env.local`**. Sentry capture
      is inert without a DSN (by design — see `instrumentation.ts`). If these are also unset on
      Vercel, production errors are currently going uncaptured. Confirm in the Vercel dashboard;
      set them before or immediately after this deploy if missing.
- [ ] `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `ANDROID_PACKAGE_NAME`, `PLAY_RTDN_SECRET`,
      `NEXT_PUBLIC_PLAY_PRODUCT_MONTHLY`, `NEXT_PUBLIC_PLAY_PRODUCT_ANNUAL` — not set locally
      (expected; Play billing isn't needed for web dev). Per prior setup work these should already
      be on Vercel (Play RTDN was verified live 2026-08-03) — confirm they're still present, this
      deploy doesn't touch Play billing code.
- [ ] `SEED_SECRET` — intentionally unset everywhere outside an active seeding session (fails
      closed). No action needed.
- [ ] `NEXT_PUBLIC_APP_URL` on Vercel must be the production domain (`https://www.getinshape.co.in`
      or equivalent), not `localhost`.

### Supabase migrations

- [ ] **`046_weight_exercise_idempotency.sql`** — adds `client_request_id` to `weight_logs` and
      `exercise_logs` + unique partial indexes. **Confirmed applied to production** (schema probe:
      both columns present).
- [ ] **`047_food_logs_copy_idempotency.sql`** — adds `food_logs.copied_from_id`. **Confirmed
      applied to production** (schema probe: column present). Its original unique index
      (`idx_food_logs_copied_from_id`) is superseded by `048`, below.
- [ ] **`048_copy_meal_idempotency.sql`** — replaces `047`'s global unique index with a composite
      `(copied_from_id, target IST day)` index. **Confirmed applied to production** — verified
      behaviorally this session: a same-IST-day duplicate insert correctly rejects with `23505` on
      `idx_food_logs_copied_from_id_target_day`, and the old global index no longer exists (a
      second, different-day copy of the same source row succeeds).
- [ ] No other pending migrations — `048` is the current head.

### Stripe / Razorpay

- [ ] Razorpay Dashboard webhook endpoint points at
      `https://<production-domain>/api/razorpay/webhook` with the signing secret matching
      `RAZORPAY_WEBHOOK_SECRET` on Vercel.
- [ ] Stripe (legacy) webhook endpoint, if still configured for existing pre-Razorpay subscribers,
      points at `https://<production-domain>/api/stripe/webhook`.
- [ ] Neither webhook needs reconfiguration for this deploy — no billing route URLs changed. This
      is a pre-existing-config confirmation, not a new step.

### Webhooks (Play RTDN)

- [ ] Play Console's Real-time Developer Notifications topic still pushes to
      `https://<production-domain>/api/play/rtdn?secret=<PLAY_RTDN_SECRET>`. Not touched by this
      deploy; confirm only if it's been a while since it was last checked.

### Cron / background jobs

- [ ] `vercel.json` crons unchanged: `push-reminders` daily 15:00 UTC (20:30 IST catch-all),
      `weekly-recap` Sundays 13:30 UTC. Vercel Hobby caps at two crons — both slots are used;
      **do not add a third**.
- [ ] `.github/workflows/reminder-tick.yml` (hourly, GitHub Actions) needs repo secrets
      `CRON_SECRET` and `APP_URL` set and matching the Vercel `CRON_SECRET`. Not required for the
      app to work — it only makes per-user chosen reminder hours honored; the 20:30 IST catch-all
      covers everyone regardless.

### Analytics

- [ ] `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` present (confirmed locally; verify on
      Vercel). No new events were added in this change set — `lib/posthog/events.ts`'s frozen
      catalog is unchanged.

### Error monitoring

- [ ] Sentry DSNs set on Vercel (see env var section above — this is the one open item found this
      pass). `instrumentation.ts` is runtime-capture-only and silently no-ops without a DSN, so a
      missing DSN fails silently, not loudly — worth confirming explicitly rather than assuming.

### PWA / production configuration

- [ ] `public/sw.js` and the other Workbox output files are gitignored and generated fresh by
      `npm run build` on every deploy — nothing to commit here, and nothing should appear in the PR
      diff for them.
- [ ] `next.config.js`'s `NetworkOnly` rules for `/api/foods/search` and `/auth/callback` are
      unchanged — no PWA caching behavior changed in this release.
- [ ] `public/.well-known/assetlinks.json` still matches the TWA's signing certificate (last
      verified 2026-07-19) — unaffected by this deploy, no action needed unless the Android app is
      also being rebuilt.

---

## 2. Deployment order

1. **Commit and open a PR** for the currently-uncommitted work (see "Code / branch" above). Do not
   skip this — there is nothing to deploy until it's a commit.
2. **Apply migrations before merging the PR that depends on them.** `046`, `047`, and `048` are
   already applied to production (confirmed this session), so this step is already satisfied for
   the current change set — but keep the rule for future releases: a route that assumes a column
   exists must never reach production before the migration that adds it.
3. **Look at the Vercel preview deployment** for the PR (automatic on every PR push) — confirm it
   builds and the pages you touched render.
4. **Merge the PR from the GitHub UI**, after confirming its number/title match what you intend to
   ship. `main` has no branch protection, so this merge ships to production **immediately** — there
   is no staging gate after this point.
5. **Watch the Vercel deployment finish** (Vercel dashboard → Deployments) rather than assuming the
   merge alone means it's live.
6. **Run the smoke tests below against production**, not the preview URL.
7. If Sentry DSNs were found missing in step 1's checklist, set them now (or before step 4) —
   either order is fine since it's an env var, not code, but do it before you need it.

---

## 3. Immediately after deployment — smoke tests

Run these against the live production domain. Each should take under a minute; the point is
coverage of the highest-value journeys, not exhaustive testing (that's what the audits are for).

1. **Sign up** with a throwaway email → lands on onboarding, no console errors.
2. **Sign in** with an existing account → lands on `/dashboard`.
3. **Onboarding**: complete height/weight/goal steps → profile saved, redirected to dashboard with
   correct calorie/macro targets shown.
4. **Food search**: search a common Indian dish (e.g. "dal") → results appear, ranked sensibly, no
   duplicate cards for the same dish.
5. **Food logging**: log a searched food → dashboard total updates immediately, entry appears in
   the diary for today.
6. **Dashboard/totals**: totals shown match the sum of today's logged entries (spot-check the math).
7. **Weight logging**: log a weight entry → appears in the weight history, chart updates.
8. **Exercise logging**: log an exercise entry → appears in the exercise log.
9. **Copy-yesterday**: with at least one log yesterday, tap "Copy yesterday" → all of yesterday's
   items appear on today, exactly once (this is the exact idempotency fix — a double-tap here must
   not duplicate).
10. **Copy-meal**: copy a specific meal (e.g. breakfast) from one day to another → items appear
    exactly once on the target day; repeating the same copy is a no-op, not a duplicate.
11. **Pro/paywall**: as a free account, hit a Pro-gated surface (month deficit view, or the 4th
    suggestion) → paywall/upgrade prompt shown, not an error and not silently granted.
12. **Subscription**: if a test Pro purchase is feasible in production (Razorpay test mode or a
    real low-value transaction), confirm `subscriptions.status` flips to `active` and the paywall
    clears. If not feasible immediately post-deploy, at minimum confirm an existing Pro account
    (qa1) still reads as Pro everywhere (no F2 regression).
13. **Logout/session**: sign out → redirected to sign-in; hitting a protected URL directly
    afterward redirects to sign-in rather than showing stale data.
14. **Camera/barcode** (if testing on a device with camera access): scan a packaged product barcode
    → correct product identified, nutrition shown, log succeeds.
15. **Account deletion path (read-only check, don't actually delete a real account)**: confirm the
    delete-account page loads and the confirmation flow is intact — this pass hardened the
    subscription-check-before-delete logic (F1), so the code path is worth glancing at even without
    completing a real deletion.

---

## 4. Rollback

Roll back if, within the first 30–60 minutes after deploy:

- Any smoke test above fails on production (not preview).
- Error rate in Sentry (or Vercel's function logs, if Sentry DSNs turn out to still be unset)
  spikes visibly above baseline.
- Any duplicate-row report surfaces for weight, exercise, copy-yesterday, or copy-meal — that would
  mean this release's core fix regressed, which is worse than shipping nothing.
- A billing webhook (Razorpay/Stripe/Play RTDN) starts failing signature verification or 500s
  repeatedly in logs.
- Any 500 spike on `/api/account/delete`, `/api/logs/*`, `/api/weight/*`, or `/api/exercise/*`.

**How to roll back:** Vercel Dashboard → Deployments → find the last known-good deployment →
**Promote to Production**. Never delete the bad deployment (deleting does not fall back to the
previous build and permanently 404s the domain until a promote fixes it — see `CLAUDE.md`'s
Deploying section). A promote does not touch the database, so no migration rollback is implied or
needed for this release (`046`/`047`/`048` are additive: new columns and indexes, no destructive
changes, and `048`'s index change is a safe widening of `047`'s).

---

*Companion document: `docs/release-notes.md` summarizes what shipped and the accepted residual risk.*
