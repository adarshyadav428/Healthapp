# GetInShape — full deep-dive audit prompt

> Paste everything below the line into a **fresh Claude Code session** opened at
> `C:\Users\plump\Downloads\Health App`. Reusable — re-run it any time a big batch of
> work lands.

---

You are running a **complete deep-dive audit of GetInShape** — every screen, every API
route, every feature, on the web app, the installed PWA and the Android TWA. Four
lenses in one pass: **QA engineer**, **security & reliability reviewer**, **product
manager for the Indian weight-loss market**, and **a first-time user who has never seen
this app**.

This is an **audit, not a fix-up**. Do not change product code unless I explicitly say
"fix it". You may write new test files and you may write your report. Everything else
you find, you report.

Work through the phases in order. Do not skip a phase because an earlier one looked
clean.

---

## Phase 0 — Orient (do this before touching anything)

1. Confirm you are in the right copy of the repo:
   ```bash
   git rev-parse --show-toplevel && git log --oneline -5 && git status --short
   ```
   Duplicate copies of this repo have appeared on this machine before. The app lives in
   the `health-app/` subdirectory. If the toplevel is anything other than
   `C:/Users/plump/Downloads/Health App`, stop and tell me.

2. Read these in full before forming any opinion:
   - `health-app/CLAUDE.md` — **authoritative**. The "Hard constraints" section is not
     negotiable and several long paragraphs record *why* a piece of logic looks the way
     it does. If you are about to call something a bug, check it isn't documented here
     as deliberate.
   - `health-app/TESTING.md` — the existing manual test script.
   - `health-app/docs/qa-audit-2026-07-16.md` — the previous full audit. **Do not
     re-report anything in it that has since been fixed.** Instead, pick its four P0s
     and a sample of five P1s and *verify the fixes still hold* — regressions are more
     valuable than rediscoveries.
   - `health-app/docs/launch-plan-2026-07-17.md`, `docs/next-steps-2026-07-24.md`,
     `docs/growth-mechanics-plan-2026-07-29.md`, `docs/play-store-launch.md`,
     `docs/deferred-email-verification.md`, `docs/refactor-safety-contract.md`.
   - `git log --oneline -40` — the last month of work is growth mechanics, search
     ranking and Play billing honesty. Those are the newest and least-verified code.

3. Tell me in ≤10 lines what you understood the product to be and what you plan to do.
   Then start Phase 1 without waiting for me.

---

## Phase 1 — Automated gates (stop and report if any are red)

Run each and record the **actual** numbers. Docs and memory in this repo have understated
the test count before — trust the terminal, not the prose.

```bash
cd health-app && npm test
```
```bash
cd health-app && npx tsc --noEmit
```
```bash
cd health-app && npm run lint
```
```bash
cd health-app && npm run check:tokens
```
```bash
cd health-app && npm run build
```

Notes: `check:tokens` prints `0 violation(s) across 0 file(s)` when it is clean — the
trailing count is *violating* files, not scanned files. That is not a bug; don't
investigate it.

Also report: how long the build takes, how many static pages it emits, and any warning
that appears in the build output (warnings have been ignored for a while — I want them
listed, then triaged).

---

## Phase 2 — Test-suite quality review (not just "does it pass")

A green suite is not evidence of coverage. For every file in `health-app/lib/`, answer:

- Is there a test file for it? Is the *behaviour that matters* pinned, or only the happy
  path?
- Which of these would survive a deliberate sabotage? Pick **five** load-bearing pure
  functions (candidates: `lib/searchRanking.ts`, `lib/streak.ts`, `lib/dateUtils.ts`,
  `lib/aiTrial.ts`, `lib/pushBudget.ts`, `lib/tdee.ts`), mutate the logic in a scratch
  copy, and confirm the suite actually goes red. Report any that stay green — that's a
  test that isn't testing.
- Which `lib/` modules have **no** test file at all? List them and say which of those
  gaps actually matter.
- What is completely untested? Specifically: API route handlers, RLS policies,
  middleware redirects, webhook signature verification, the service worker.

Deliverable: a coverage-gap table ranked by risk, and a concrete list of the tests you'd
write first (do not write them yet).

---

## Phase 3 — Static deep review, route by route

Read every file. Do not sample. Group findings by dimension:

**A. Correctness** — off-by-one, timezone handling, null/undefined paths, floating-point
money and macro math, async races, optimistic-update rollback.

**B. Security & data isolation**
- Every route in `app/api/**` — is auth checked? Is input validated with a Zod schema
  from `lib/validations.ts` on the *server*? Can a parameter reach a query unvalidated?
- Which routes use `createAdminClient()` (service role, bypasses RLS)? For each, prove
  the user can only ever touch their own rows.
- Webhook routes (`/api/razorpay/webhook`, `/api/stripe/webhook`, `/api/play/rtdn`) —
  signature/secret verification, replay protection, idempotency, and what happens on a
  duplicate or out-of-order event.
- `/api/admin/*` — who can call these? `run-migrations` and `seed-indian-foods` are the
  two most dangerous routes in the codebase. Establish exactly what guards them.
- `/api/cron/*` — is `CRON_SECRET` enforced? What happens if someone hits them
  unauthenticated?
- `/api/export` — historically **not** Pro-gated. Verify current state.
- Any place a secret could reach the client bundle (`NEXT_PUBLIC_*` misuse).

**C. Entitlements** — the free/Pro boundary must be enforced **server-side**, never by
the UI. From `CLAUDE.md`: free tier = unlimited manual/search logging, barcode, exercise,
weight, 7 days of history. Pro = AI camera scan + AI chat logging, history beyond 7 days,
custom foods, streak rescue, unlimited meal suggestions. The AI trial is **3 lifetime
calls, shared across camera and chat, unlocked only once the email is verified**, and
both counters must **fail closed**. Trace each gate to the line that enforces it and say
whether a crafted request bypasses it.

**D. Reliability** — every external call (Supabase, Open Food Facts, Gemini, Razorpay,
Google Play, web-push, PostHog, Sentry). For each: is there a timeout? What does the user
see when it fails? Is a failure ever cached or written to shared state? Does any failure
get silently swallowed? (A swallowed count error is exactly how the free AI-chat limit
was silently off for weeks — look for that class of bug specifically.)

**E. Performance & cost** — N+1 queries, unbounded `select *`, missing indexes for the
queries actually issued, client bundle size, images, the 200-deep food fetch, and
**every path that spends money** (Gemini calls, OFF writes into `foods`, push sends).

**F. Data model** — read all of `supabase/migrations/`. Note that numbers are duplicated
(`002`/`004`/`005`/`009` appear twice, there is no `021`) so always cite exact filenames.
Check: does the schema in the migrations match what the code assumes? Are there columns
the code writes that no migration creates, or vice versa? Are there tables with no RLS?

**G. Dead code & drift** — components, routes, env vars, feature flags and docs that
describe something that no longer exists. Anything in the docs that makes a **public
claim** which the code no longer honours is a P0-class finding, not a nit (this app has
shipped a paywall selling a feature that didn't exist before).

---

## Phase 4 — Runtime testing, every surface

Start the dev server with the **preview tooling**, not a bash background process:
`preview_start` with `{name: "health-app-dev"}` (defined in `.claude/launch.json`,
port 3000). Also test against production: **https://www.getinshape.co.in**.

Test at **375×812** (phone) and desktop, in **light and dark**, and with
`prefers-reduced-motion` on. Use the accessibility tree and console/network readers as
primary evidence — screenshots for anything visual.

### Every page (all of these exist; visit each one)
`/` · `/auth/sign-in` · `/auth/sign-up` · `/auth/forgot-password` · `/auth/reset-password`
· `/onboarding` · `/onboarding/plan` · `/welcome` · `/dashboard` · `/log` · `/progress` ·
`/weight` · `/deficit` · `/recipes` · `/settings` · `/upgrade` · `/wrapped` ·
`/foods/[slug]` (pick 5 — one IFCT, one curated, one OFF, one with a very long Hindi
name, one that doesn't exist) · `/studio` · `/privacy` · `/terms` · `/delete-account`

For each page record: does it load, what does it look like empty vs full, does it work on
a fresh account, does it work offline (it should fail **honestly** — we never claim
offline logging), any console error, any failed request, any layout break at 375px.

### Every flow, end to end
1. **Sign-up → onboarding → first log.** Time it. Target from `TESTING.md` is under 60
   seconds to first food logged. Report the real number.
2. **Onboarding resumability** — abandon mid-wizard, close the tab, come back.
3. **Email verification nudge** — the deferred-verification flow has, per the docs,
   **never been exercised end to end**. Exercise it.
4. **Food search** — this is the heart of the app and the most-tuned code in it. Test at
   minimum: `rice`, `dal`, `roti`, `chicken biryani`, `biryani chicken`, `bhutta`,
   `anjeer`, `milk`, `chai`, `poha`, `bhindi`, `maggi`, `amul butter`, a brand name, a
   misspelling, a 1-character query, an empty query, a query with `%` and `,` and `(` in
   it, and a 200-character query. For each: is the top result *the food the user meant*?
   Is the 📊 Estimated badge on every `curated` row? Do measured IFCT rows beat estimates
   on a name collision? Does any `source = 'estimate'` row leak into results (it must
   not)? Is any nutrition value physically impossible (>100 g macros per 100 g, 0 kcal
   with non-zero macros, 700+ kcal for a vegetable)?
5. **Logging, every method** — search, barcode scan, camera photo scan, AI chat, quick
   add, custom food, saved meal/combo, "log again", copy-yesterday, backfill onto a past
   day. Then edit a log, change its portion and unit, change its meal slot, delete it.
   Verify the dashboard totals, the ring, macros and the week strip all agree after each.
6. **Day boundary** — the single highest-risk area, and the source of a previously
   shipped wrong-data bug. Log at 23:55 IST and at 00:05 IST (spoof the clock/timezone).
   Confirm the dashboard, `/log`, the week strip, the Trends calendar, the day diary, the
   streak and copy-yesterday **all agree on which day a log belongs to**. Then repeat
   with the browser in a non-IST timezone (America/New_York, Asia/Tokyo) — a user
   travelling must not lose their streak.
7. **Streaks** — build one, break one, use a freeze, exhaust the freezes, use the Pro
   Streak Rescue, try to use a second rescue in the same month, try to rescue a date that
   isn't yesterday. Confirm freezes are **never** paywalled.
8. **Milestones & celebrations** — 3, 7, 14, 21, 30, 50, 100-day overlays; first-log
   confetti; weight milestone crossing; badge shelf; the next-badge line on Home.
9. **Growth surfaces (newest code, least verified).** `/welcome` cards 1–5 — watch for
   `0`, `NaN`, `undefined`, or overflow in the stat cards. `/onboarding/plan` on a fresh
   account. `/wrapped` (note: redirecting to `/dashboard` when the month didn't qualify
   is **correct**, not a bug). Seasons: join, progress, deadline, wrap. Meal suggestion
   deck: swipe, dismiss, confirm dismissals persist and the deck learns. Meal context
   tags. Story engine: keyboard nav, tap zones at both ends, reduced motion, no
   auto-advance, no image downloads.
10. **Share card (the thali)** — generate on Android (share sheet) and desktop (PNG
    download). Confirm 1080×1080, that a cancelled share sheet is not an error, and that
    the card renders correctly with a 3-digit streak and a long name.
11. **Weight** — add, edit, delete, backdate, the chart, BMI, trend line, projection,
    kg/lb units, a weight gain goal as well as loss.
12. **Exercise** — add, delete, its effect on the deficit and on `/deficit`.
13. **Paywall & billing.** On the **web**: `/upgrade` → Razorpay widget. Do **not**
    complete a live payment. Verify the CTA reaches Razorpay with the right plan and
    amount, that ₹299/₹1,999 is what's shown, that a dismissed checkout produces friendly
    copy (not `PaymentRequest` jargon), and that a failed checkout never shows an
    internal error string to the user. In the **TWA**: confirm the paywall disables
    itself and explains why when Play Billing can't sell. Then verify **every bullet on
    `/upgrade` and every free-tier claim on `/` maps to a feature that actually exists
    and is actually on the tier claimed.** This is a Play-policy and refund risk, and
    this app has failed this check before.
14. **Subscription management** — Settings → Manage Subscription for each of the three
    providers (`razorpay`, `google_play`, `stripe` legacy). Cancel-at-cycle-end. What a
    downgraded user keeps (earned things persist: badges, past wraps) versus loses (held
    things expire: unused rescues).
15. **Push notifications** — permission priming, subscribe, unsubscribe, revoke at OS
    level, and the **one-push-per-day budget across all sources** with its priority order
    (`streak-save > season-deadline > monthly-wrapped > weekly-recap > daily-reminder`)
    and back-off after 5 ignored. Verify nothing bypasses `sendBudgetedPush`.
16. **Crons** — `/api/cron/push-reminders` and `/api/cron/weekly-recap`. Are they
    batched, deadline-aware and resumable? What happens on a partial run? Monthly Wrapped
    rides inside the Sunday recap — verify it actually fires.
17. **Settings, all of it** — profile edit (and that it recalculates TDEE), units,
    appearance (light/dark/system), analytics opt-out (verify the PostHog stream actually
    goes silent), CSV export, delete account.
18. **Delete account** — the highest-consequence path in the app. Verify it cancels the
    subscription, removes the data, and that the user genuinely cannot sign back in to
    the old data. Use a throwaway account.
19. **PWA install** — A2HS prompt, install, launch without browser chrome, service worker
    update on a new deploy, and confirm `/api/foods/search` is never served from cache.
20. **Analytics** — walk the funnel in `TESTING.md` §0 and confirm each event fires
    exactly once with the right properties.

### Test accounts
- `adarshyadavazm123+qa1@gmail.com` — permanent fixture, ~30 days of history. Use this
  for anything needing history.
- `adarshyadavazm123+qa2@gmail.com` — fresh/skip-path account.
- **Ask me before creating any new account** or before writing anything to the production
  database outside these two.

---

## Phase 5 — Adversarial pass

Try to break it on purpose:

- Call the AI routes **directly** as a free user with a valid session cookie, past the
  trial allowance. They must 403. Then try after clearing local storage, after signing
  out and in, and from a second device — the lifetime pool must hold.
- Make an unverified account and try to spend the AI trial. It must be locked.
- Try to read another user's rows through PostgREST with a normal anon key (RLS check).
- Replay a Razorpay webhook. Replay a Play RTDN. Send a Play purchase token that's
  already bound to another account.
- Submit every form with: empty, negative, zero, absurdly large (age 900, weight 5000 kg,
  height 3 cm), non-numeric, emoji, 10,000 characters, SQL-ish and HTML-ish payloads.
- Log 200 foods in one day. Load a day with 100 logs. Load an account with 2 years of
  history.
- Kill the network mid-log. Kill it mid-checkout. Double-tap every submit button.
- Take Open Food Facts, Gemini and Razorpay offline (block the hosts) and confirm each
  failure is honest, fast, and never poisons the shared search cache.
- Back button, browser refresh mid-flow, deep-link into every authenticated page while
  signed out, deep-link into `/onboarding` when already onboarded.
- Screen reader / keyboard-only pass on the four core tab screens and the checkout.

---

## Phase 6 — The product review (this is the half I care most about)

Set the bug list aside and answer as a product manager. Judge against the actual market:
Indian users, ₹299/month, competing with HealthifyMe, MyFitnessPal, Cal AI, Fitelo and
"just using a notebook". Be blunt — I would rather cut a feature than ship a bloated app.

Produce **four tables**:

1. **Necessary and working** — the features that justify the app existing. For each: why
   it's core, and how good it actually is on a 1–5 scale versus the best competitor.
2. **Necessary but weak** — right feature, wrong execution. What specifically is wrong
   and what "good" would look like.
3. **Not necessary — cut, hide or merge.** Every feature that adds surface area without
   earning it. Name the maintenance cost it's imposing. Be willing to name growth
   mechanics here if they don't earn their keep.
4. **Missing.** Split into: (a) **table stakes** — a user will bounce or refund without
   it, (b) **retention** — things that would move week-4 retention, (c) **differentiation**
   — things no competitor in India has. For each: rough effort (S/M/L), what it depends
   on, and whether it's a free-tier or Pro feature.

Then answer these directly:

- **Is Pro worth ₹299/month today?** List exactly what a paying user gets and argue both
  sides. If the answer is no, say what the cheapest change is that makes it yes.
- **What is the single biggest reason a new user will not come back on day 2?** Day 7?
  Week 4?
- **What is the one feature that, if built next, would matter most?** One answer, defended.
- **What would you cut entirely** if the goal were to make the app feel simpler?
- **Where does the app lie to the user** — any copy, badge, number or claim that is
  optimistic, stale or unearned.
- **First-run experience**: walk it as a 32-year-old in Pune who has never used a calorie
  tracker. Where do they get confused? Where do they quit?

I am open to suggestions and to being told the plan is wrong. Do not soften a
recommendation because it contradicts something already built.

---

## Phase 7 — The report

Write it to `health-app/docs/deep-dive-audit-<YYYY-MM-DD>.md` with this structure:

1. **Executive summary** — ≤400 words. Verdict first: is this launch-ready, and if not,
   what is the gap in days of work.
2. **Gate results** — the real numbers from Phase 1.
3. **Findings**, as a table, severity-ordered. Columns: ID · Severity · Finding · Repro ·
   Evidence · `file.ts:line` · Confidence.
   - **P0** — broken, data-loss, security, money, or a false public claim. Blocks launch.
   - **P1** — works but damages trust, retention or conversion.
   - **P2** — polish.
4. **Regression check** — the previous audit's P0s and the five P1s you re-tested, with
   verdicts.
5. **Coverage gaps** — Phase 2's table.
6. **The four product tables** — Phase 6.
7. **Direct answers** — the six questions in Phase 6.
8. **Top 10, ranked** — what to do next, in order, with effort estimates. This is the
   section I will actually work from.
9. **False alarms discarded** — things you suspected and disproved. Include this; a
   previous audit caught two of its own false positives this way and that made the rest
   of it trustworthy.
10. **What you could not test**, and what you'd need from me to test it.

Then give me a ≤30-line summary in chat.

---

## Rules of evidence (these decide whether the report is worth anything)

- **Every finding needs a reproduction and a `file.ts:line`, or a network/DB/console
  observation.** No finding from vibes.
- Mark each finding **OBSERVED** (you saw it happen) or **CODE-REVIEWED** (you reasoned
  it from source). Never blur the two.
- **Before you report anything, try to refute it.** Read the surrounding code, check
  `CLAUDE.md` for a documented rationale, and re-run the repro. A previous audit killed
  two P0s this way (a "0 kcal" hero number and "dead" paywall buttons were both timing
  artifacts of the audit tooling, not app bugs).
- If your tooling can't observe something (animation feel, real device behaviour, a real
  payment), **say so** rather than inferring.
- Do not report anything `CLAUDE.md` documents as a deliberate decision without engaging
  with its stated reason.

---

## Known and deliberate — do NOT report these as bugs

- **No USDA data**, permanently. Indian-market accuracy decision.
- **`curated` foods are estimates, not measurements** — badged 📊 and ranked below every
  measured source on purpose.
- **INR only**, ₹299 / ₹1,999, 3-day trial is **Play Console only** so trial copy renders
  only inside the TWA.
- **No offline logging** — never claimed anywhere. Failing honestly offline is correct.
- **Only two Vercel crons** — Hobby plan cap; Monthly Wrapped deliberately rides inside
  the Sunday recap.
- **`/wrapped` → `/dashboard`** when the month didn't earn a wrap is correct behaviour.
- **No Razorpay fallback inside the TWA** — Play policy forbids third-party checkout for
  digital goods.
- **Play submission is blocked on BillDesk merchant verification**, not on code. Don't
  recommend submitting.
- **Water / sleep / fasting / measurements tables were dropped** by migration `019` on
  purpose. Only `exercise_logs` remains of the extended trackers.
- **Migration `026_anonymous_users`** is obsolete but deliberately left applied.
- Duplicate migration numbers and the missing `021` are known — cite exact filenames.

---

## Safety rules for this session

- **Never delete rows from `foods`.** `food_logs.food_id`, `food_favourites.food_id` and
  `saved_meal_items.food_id` are all `ON DELETE CASCADE` — deleting a food silently
  deletes every user's diary entries for it, with no error. This nearly destroyed 87 real
  entries once.
- **Never rewrite a migration that has already been applied.** Add a new numbered file.
- **Never print, paste or commit a secret** from `.env.local` or Vercel. Refer to keys by
  variable name only.
- Treat the production database as **read-only** outside the `+qa1` / `+qa2` accounts.
- Do not complete a real payment, do not refund anything, do not touch Play Console,
  Razorpay, Supabase, Vercel or GCP dashboard settings. If a check needs one of those,
  write me exact click-by-click steps instead and I'll do it.
- Do not commit or push anything. Leave the working tree clean apart from your report.
- Ask me before creating any new user account.

---

## Working style

- I am new to release and infra tooling. When you tell me to do something outside the
  code, give **exact, step-by-step instructions** — the literal menu path, the literal
  button, and how I verify it worked.
- Show your progress as you go; don't disappear for an hour and return with a wall of
  text.
- If you hit something genuinely ambiguous, do everything that doesn't depend on the
  answer first, then ask.
- Use parallel subagents for the read-heavy phases (Phase 3's route-by-route review and
  Phase 4's per-page sweep) — I am explicitly authorising that here. Verify their
  findings yourself before putting anything in the report; subagents report false
  positives.

Start with Phase 0.
