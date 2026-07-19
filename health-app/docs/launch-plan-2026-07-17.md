# GetInShape — Launch Plan

**Created:** 2026-07-17 · **Owner:** Adarsh (business/console) + Claude (code/tests/docs)
**Basis:** `docs/qa-audit-2026-07-16.md`, re-verified at HEAD `132cb00` + live DB/site probes on 2026-07-17.
**This file is the single source of truth.** Every item has a `Status` — one of `todo · doing · done · blocked-on-Adarsh · wont-fix`. Future sessions update statuses here as items land. Execution begins only after Adarsh replies **"go"**.

---

## 0. Assumptions & decisions

Adopted from Adarsh's brief:

| # | Decision |
|---|---|
| 1 | **Razorpay KYC status unknown** → treated as an open critical-path dependency, owner Adarsh, started day 0. Slip math in §3. |
| 2 | **"AI Weekly Insights": BUILD** as the weekly recap — Pro-gated "Your week" card + free Sunday push (C6). |
| 3 | **Day definition: plain IST everywhere.** No 4 AM rollover in v1 (C2). |
| 4 | **Canonicalize on `www`** (live 308 already goes there). TWA host → www. Assetlinks direct-200 on both hosts where Vercel allows; www-only is acceptable since the TWA points at www (A4/C11). |
| 5 | **QA accounts:** keep `+qa1` (30-day fixture) permanently; delete `+qa2` at launch (§4 step 6). |
| 6 | **Availability blank** → assumed ~4 focused h/day, target ASAP. Schedule is in go-relative days so it survives a different reality. |

Made on Adarsh's behalf this session (all reversible — veto by editing this table):

| ID | Decision | Rationale |
|---|---|---|
| D-A | **Build** streak milestones 7/30/100 (existing confetti system) instead of deleting the landing claim | ~half-day; makes the claim true AND adds a retention hook |
| D-B | Exercise offset: **soften landing claim now**, build net-calories week 1, restore claim | Can't be made true by launch without risking the calorie-math core |
| D-C | Offline: **soften claim now** ("Installs as an app; works best online"), build fallback+queue weeks 3–4 | No write queue exists; "sync when you reconnect" is false today |
| D-D | "600+ foods" → **"500+ Indian foods"** | Live DB: 576 curated Indian entries (448 IFCT + 61 branded + 67 restaurant). Alt: seed 24 more IFCT entries to make 600 true — Adarsh's call, copy fix is the default |
| D-E | Refunds: align on **30-day money-back (first payment)** written into `/terms` | Upgrade footer already promises it publicly; matches the honest-pricing moat. Veto → soften the footer instead |
| D-F | **Skip migration 011** (`weekly_calorie_view`) | View referenced nowhere in code; keep prod schema clean; annotated in §4 |
| D-G | Trial copy shown **only inside the Play TWA** (Play annual gets a real 7-day offer per runbook §6); no Razorpay trial in v1 | Web currently promises a trial that doesn't exist (P1-7c) |
| D-H | Add "founder pricing" line to the paywall (₹699/yr presented as launch pricing, honest, no countdown) | Honest urgency; supports the price moat |
| D-I | Post-scan coaching line = **stretch-gate** (C19): do if the schedule holds, else week 1 | Hours of effort, big perceived-AI-quality win (HealthifyMe Snap's differentiator) |

---

## 1. Findings ledger (audit re-verified at HEAD `132cb00`, 2026-07-17)

**Counts: P0 4/4 still-open · P1 18 still-open + 1 partially-wrong · P2 13 still-open + 1 nuanced · 9 new findings.**
Only one commit (`132cb00`, viewed-day cache keys) landed since the audit; live state (DB, Vercel, DNS) was re-probed directly.

### P0

| ID | Status at HEAD | Evidence |
|---|---|---|
| P0-1 | still-open (presumed) | Zero `RAZORPAY_*` in `.env.local`; Vercel env not readable from here. Live site still shows raw config error on checkout per audit. |
| P0-2 | **still-open — verified live** | REST probe: `chat_logs` → 404 (table missing). Route still swallows: `(count ?? 0) >= 10`. Free chat is unlimited on your Gemini bill right now. |
| P0-3 | still-open | `app/upgrade/page.tsx:70` "AI Weekly Insights"; `lib/logMilestones.ts` has no streak milestones; landing `app/page.tsx:127` claims 7/30/100 celebrations. |
| P0-4 | still-open | `components/progress/ProgressClient.tsx:329` still `parse(selectedDate,'yyyy-MM-dd',new Date())` (local-IST midnight) → `DayDiary` UTC ranges. `132cb00` fixed cache keys only. |

### P1

| ID | Status | Evidence (one line) |
|---|---|---|
| P1-1 | still-open | UI all UTC (`DayDiary`, `useFoodLogs`, `TodayFoodLog:213`, `EditFoodLogModal:114`, `AddFoodModal:120`, `log/page.tsx:64`, `dashboard/page.tsx:22`, `api/exercise/today:14`); business logic all IST |
| P1-2 | still-open | `app/log/page.tsx:209` `{isToday && <FoodLanding/>}` (ExerciseLogger too, :226) |
| P1-3 | still-open | `DashboardClient.tsx:60` `{streakDays > 0 && …}`; no milestones, no repair |
| P1-4 | still-open | `chat/analyze:102-105` + `camera/analyze:186`: `ilike %name%` + alphabetical source order ('branded' < 'ifct'); camera comment wrongly claims "ifct before off" |
| P1-5 | still-open, **worse** | No plausibility filter AND search doesn't exclude `source='estimate'` → 670 shared AI-estimate rows surface in every user's search (N-4) |
| P1-6 | still-open | `lib/food-synonyms.ts:40` roti list lacks "chapathi" (`portion-units.ts:42` matches it, ironically) |
| P1-7 | still-open | (a) `api/meals/saved` POST has no Pro gate; (b) export free 90d; (c) `LogMilestones.tsx:187` web trial promise; (d) upgrade omits "Unlimited AI". Plus N-3 below |
| P1-8 | still-open | `api/account/delete/route.ts` = `deleteUser` only; zero provider-cancel code |
| P1-9 | **partially report-was-wrong** | `WeightLogModal.tsx:23-27` defaults to `profile.current_weight_kg ?? 70` — observed 70 likely a store-hydration gap; re-verify live (C16). Start-weight overwrite (9b) still claimed |
| P1-10 | still-open | `CalorieHeroCard` has no exercise input; landing claim intact (:124) and the hero mock literally says "Net calories" |
| P1-11 | still-open | `ProgressClient:111` deficit = `target − eaten`; `/deficit` = maintenance-based |
| P1-12 | still-open | Aggregates include the in-progress day |
| P1-13 | still-open | Zero links to `/deficit` and `/recipes`; `/weight` only via `SettingsClient:411` |
| P1-14 | still-open | `lib/tdee.ts:51` protein 2 g/kg; landing FAQ (:243) documents it publicly |
| P1-15 | still-open, **cheaper than reported** | Sign-up already handles the session-present path (`sign-up:32-42` → straight to /onboarding). Disabling confirmation in Supabase (A3) is most of the fix |
| P1-16 | still-open | No projection/reach/weeks text anywhere in `OnboardingForm` |
| P1-17 | still-open | Toggle only in Settings; `lib/push/client.ts:18,32` awaits `serviceWorker.ready` with no timeout |
| P1-18 | still-open, **sharpened** | Live apex **308** → www (www canonical); `assetlinks.json` 200 **only on www** (apex 308s it; DAL fetchers don't follow redirects); `twa-manifest.json` is all-apex; runbook + `NEXT_PUBLIC_APP_URL` use apex |
| P1-19 | still-open | No `fallbacks` in next.config; landing "Works offline" + FAQ "sync when you reconnect" (no write queue) |

### P2 (spot-checked in bulk)

Verified still-open: P2-1 (raw error toasts), P2-4 (CSV UTC), P2-6 (countUp from 0), P2-7 (`api/camera/test` ships), P2-8 (oz), P2-9 (robots disallows nonexistent `/history`). Assumed still-open (files untouched since audit): P2-2, P2-3, P2-10, P2-12, P2-13. P2-11 = accepted gap. P2-14 = monitor post-launch.
**P2-5 nuanced:** live foods = 1,901 total; curated Indian = **576** (448 ifct + 61 branded + 67 restaurant) + 647 OFF-cached + 670 estimates. "600+" isn't defensible as curated; the Play draft's "400+" is true.

### New findings (this session)

| ID | Finding |
|---|---|
| N-1 | Migration `011_weekly_calorie_view` never applied — and the view is referenced **nowhere** in code. Skip deliberately (D-F) |
| N-2 | **Runbook §1 and safety contract are wrong:** 012/022/023 columns are ALL live (incl. `cancel_at_period_end`, verified by REST probe). Only **015** is missing. Index halves of 012/023 need SQL verification (§4) |
| N-3 | Upgrade footer "30-day money back" (`upgrade:288`) contradicts terms "case-by-case refunds" (`terms:39`) → D-E |
| N-4 | 670 `source='estimate'` foods (AI-generated during chat/camera logging) are in the **shared** foods table and surface in every user's search → C5 |
| N-5 | Working-tree `sw.js` diff is pure build-ID churn from the audit's local build → `git restore` (C1) |
| N-6 | `GetInShape-Roadmap.pdf` untracked at repo root → don't commit binaries; move/gitignore (C1) |
| N-7 | Analytics: manual `$pageview` works (`providers.tsx` PostHogPageView); **missing** `upgrade_viewed`, `checkout_attempted`, `checkout_failed` (success is covered by `subscription_started`) → C15 |
| N-8 | **Zero error monitoring** — no Sentry (or similar) anywhere → C14 |
| N-9 | Tests: **151 pass at HEAD** (safety contract says 128 — stale) → C17. Also: migrations have duplicate numbers (002×2, 004×2, 005×2, 009×2; no 021) → §4 uses exact filenames. Service-role key rotation (runbook §1) still pending → A7 |

---

## 2. Launch-gate checklist

### 2a. Adarsh-owned (start day 0 — external lead times are the critical path)

| ID | Item | Finding(s) | Effort | Depends on | Proof of done | Status |
|---|---|---|---|---|---|---|
| A1 | **Razorpay live**: KYC → plans ₹199 monthly / ₹699 annual → webhook `https://www.getinshape.co.in/api/razorpay/webhook` → 5 env vars in Vercel → redeploy | P0-1 | KYC = external; setup ~1 h | KYC approval | Test payment completes E2E on the live site; `subscriptions` row `provider='razorpay', status='active'` | todo |
| A2 | **Apply migration 015** + run §4 verification SQL | P0-2, N-2 | 15 min | §4 playbook (ready) | `select count(*) from chat_logs` = 0; 11th chat from `+qa2` → 429 | **done** 2026-07-18 (015 was half-applied — table + SELECT policy existed, INSERT policy did not, so RLS silently rejected every counter write; 015 rewritten idempotent and re-run). ⚠️ The acceptance test above is now obsolete: the 10/day chat cap no longer exists — AI is Pro-only with 3 lifetime trial scans (`lib/aiTrial.ts`). Every migration through 027 verified live 2026-07-19. |
| A3 | **Supabase Auth → disable email confirmation** | P1-15 | 5 min | — | Fresh sign-up lands signed-in at `/onboarding`, no inbox step | todo |
| A4 | **Vercel domains**: `NEXT_PUBLIC_APP_URL=https://www.getinshape.co.in`; both domains on the project; assetlinks reachable | P1-18 | 30 min | C11 deployed | `curl -I https://www.getinshape.co.in/.well-known/assetlinks.json` → 200; sitemap URLs are www | **done** 2026-07-18 (verified live: apex 308→www; www 200; assetlinks 200 on www / 308 on apex as expected; sitemap 0 apex URLs; manifest standalone+`/dashboard`. Note: `NEXT_PUBLIC_APP_URL` was briefly set to the **apex**, which put apex URLs in the sitemap while the TWA used www — fixed to `https://www.getinshape.co.in`. It's a `NEXT_PUBLIC_` var so it inlines at build time: changing it requires a redeploy **with build cache disabled**, otherwise the old host survives) |
| A5 | **Gemini budget alert** in Google Cloud (suggest ₹2,000/mo to start) | P0-2 fallout | 15 min | — | Alert email configured; screenshot | todo |
| A6 | **Play Console**: create app → listing → data-safety → content declarations → Billing products (`pro_monthly`, `pro_annual` + 7-day trial offer on annual) → service account + RTDN | runbook §4–7 | 3–4 h spread | C10 done **before** Data-safety form (deletion answer must be true) | Runbook §4–7 checkboxes; test RTDN shows 200 in Vercel logs | todo |
| A7 | **Rotate Supabase service-role key** (pending since runbook was written) | security | 15 min | — | New key in Vercel + `.env.local`; old key revoked; app healthy | todo |
| A8 | **Live PostHog funnel verification** (joint with Claude): run a fresh test account through landing → sign-up → wizard → first log → paywall → checkout-attempt; watch events arrive | Phase D-2, N-7 | 30 min | C15 deployed | Every funnel event visible in PostHog activity for the test user | todo |

### 2b. Claude-owned (dependency order; one workstream per commit; `npm test` + `npm run check:tokens` green before every commit)

| ID | Item | Finding(s) | Effort | Depends on | Proof of done | Status |
|---|---|---|---|---|---|---|
| C1 | **Tree hygiene**: commit audit report; `git restore health-app/public/sw.js`; gitignore/move roadmap PDF | N-5, N-6 | 15 min | go | `git status` clean | **done** (commit `d3b28ec`, branch `launch-prep-2026-07-17`) |
| C2 | **IST-day unification**: swap `getUtcDayRange` call sites → `getIstDayRange`; fix `ProgressClient:329` date construction; `parseDateParam` + isToday in `log/page.tsx` → IST; CSV timestamps → IST (P2-4) | P0-4, P1-1, P2-4 | ~half-day | C1 | New midnight-crossing tests (log at 00:30 IST files under same IST day in UI, streak, trends); manual: tap a Trends day → diary shows that day's meals | **done** (155 tests; new `istDateStr`/`dateStrToUtcMidnight` helpers; browser-driving the diary still pending qa1 login) |
| C3 | **Backfill + streak repair**: lift `isToday` gate for past days inside the free 7-day window; backdated log restores a just-broken streak (≤24 h grace) | P1-2, P1-3 | ~1 day | C2 | Streak test: gap day + backfilled log → streak restored; manual: `/log?date=yesterday` shows FoodLanding and accepts a log | **done** (streak recomputes from log timestamps → repair is automatic once a missed day is backfilled; `lib/backfill.ts` gates the free 7-day window on add/quick-add/add-bulk; 159 tests; authed UI drive pending qa1 login) |
| C4 | **Claims-honesty pass** (see §5 inventory): upgrade features list (templates+CSV → free column, add "Unlimited AI", founder-pricing line D-H); landing (offset claim softened D-B, offline softened D-C, "500+" D-D, hero mock label); trial line TWA-only D-G; terms ↔ footer refund alignment D-E; FAQ protein line synced with C13 | P0-3(copy), P1-7, P1-10/19 claims, P2-5, N-3 | ~half-day | decisions D-A..H | §5 table all rows ✅; grep "Weekly Insights" appears only in the built feature; no trial copy renders on web | **done** (landing/upgrade/terms/interstitial + FoodSearch copy fixed; verified rendered via curl: 500+/Installs-like-app/MET-estimates/Weekly-recap/30-day-refund; FAQ protein deferred to C13) |
| C5 | **AI matching + search quality**: exact > prefix > substring; source priority ifct > branded > off; add chapathi/chappathi/chapatti synonyms; exclude `source='estimate'` from search; minimal plausibility filter (kcal>0 unless genuinely zero-cal, macros ≤ physical limits) | P1-4, P1-5(min), P1-6, N-4 | ~half-day | C1 | Chat "2 roti and 1 katori dal" → IFCT Roti + plain Dal; search "chapathi" returns roti; no estimate rows in search results | **done** (`lib/foodMatch.ts` pickBestFoodMatch + isPlausibleFood; both AI routes rank in JS; search excludes estimate + filters impossible macros; chapathi expansion verified at runtime; 166 tests) |
| C6 | **Weekly recap** ("Your week"): Sunday 7 PM IST cron (same infra as push cron) — avg kcal, days logged, weight delta, one Gemini sentence; Pro-gated dashboard card + free push | Decision 2, P0-3(build) | 1–2 days | C2 (IST weeks) | Cron dry-run returns recap payload; card renders for Pro; push lands on a subscribed device | **done** (migration `024_weekly_recaps`; `lib/weeklyRecap.ts` pure stats + Gemini-with-fallback; Sunday 13:30-UTC cron in vercel.json; Pro `WeeklyRecapCard`; also fixed the dashboard week-strip's UTC-slice day bug → IST; 173 tests. Needs A2b: apply migration 024) |
| C7 | **Streak milestones 7/30/100** via existing confetti system | D-A, P0-3(build) | ~half-day | C3 | `logMilestones` tests: 7/30/100 fire once each; landing claim now true | **done** (`nextUnseenStreakMilestone` + dashboard localStorage gate → reuses the weight/first-log confetti overlay; 177 tests) |
| C8 | **Projection moment ×3**: "You'll reach **X kg by ~date**" at onboarding 6/6, `/weight`, paywall | P1-16 | ~half-day | — | Projection math unit test; 6/6 renders the line for a lose-goal profile | **done** (`lib/projection.ts`; line at onboarding 6/6, a `/weight` card, and a `/upgrade` teaser; 186 tests) |
| C9 | **Onboarding cleanup**: drop confirm-password (show/hide toggle); remove "then sign in" copy path; wizard progress persisted in localStorage | P1-15 | ~half-day | A3 | Fresh sign-up → wizard with no confirm field; abandon at 3/6 → return resumes at 3/6 | **done** (confirm-password dropped + show/hide toggle, verified rendered; signUp emailRedirectTo→/auth/callback so a confirmation link lands signed-in even if A3 slips; wizard step+values persisted in localStorage, cleared on submit) |
| C10 | **Billing lifecycle**: delete-account cancels Razorpay sub before `deleteUser` (+ Play: link-out guidance since server-side cancel isn't possible; legacy Stripe: cancel via API); map raw provider errors to friendly copy | P1-8, P2-1 | ~half-day | — | Test-mode: delete account with active Razorpay sub → subscription cancelled at Razorpay; no internal strings in any toast | **done** (delete cancels Razorpay immediately + legacy Stripe before deleteUser; Play → 409 link-out guidance; cancel-failure → 502 with 'cancel first' guidance so no silent charge; create-subscription now returns a friendly 503 instead of leaking 'Missing RAZORPAY_KEY_ID') |
| C11 | **TWA/domain alignment → www**: `twa-manifest.json` (host, iconUrl, webManifestUrl, fullScopeUrl), sitemap/robots follow env, runbook text | P1-18 | ~2 h | decision 4 | Manifest all-www; deployed sitemap shows www; runbook §1/§3 updated | **done** (twa-manifest host/iconUrl/maskableIconUrl/webManifestUrl/fullScopeUrl → www, verified 0 apex left; live www manifest 200; sitemap/robots already follow NEXT_PUBLIC_APP_URL → set by A4; runbook host done in C17. Display strings in shareCard/delete-account left as apex — they 301 to www) |
| C12 | **Notification priming**: post-first-log benefit-framed card → permission → subscribe; SW-ready timeout with graceful copy | P1-17 | ~1 day | C3 | Card appears after first log on a fresh account; toggle shows explanation instead of hanging when SW is unavailable | **done** (`NotificationPrimeCard` on the dashboard once hasLogs, one-time/dismissible/skips-if-already-on; `serviceWorkerReady()` races a 5s timeout so the toggle can't spin forever) |
| C13 | **Macro realism**: cap protein 1.6 g/kg, carbs recomputed; FAQ updated | P1-14 | 2–3 h | — | `tdee` tests updated (85 kg → 136 g protein, carbs rise); macros still sum to target | **done** (protein 2→1.6 g/kg in `lib/tdee.ts`; test now 70 kg→112 g; FAQ copy verified rendered as 1.6g/kg; editable macro overrides already exist in profileUpdateSchema) |
| C14 | **Sentry** (`@sentry/nextjs`, errors only, prod DSN) | N-8 | 2–3 h | Adarsh creates the (free-tier) Sentry project | Forced test error from prod visible in Sentry | **done** (v10.66 wired via runtime init only — no `withSentryConfig`/webpack plugin, so zero build risk; server+edge via `instrumentation.ts` + `onRequestError`, client via `SentryInit` in providers; inert until SENTRY_DSN/NEXT_PUBLIC_SENTRY_DSN set + prod. `npm run build` green. **Adarsh: create Sentry project → set both DSN envs in Vercel**) |
| C15 | **Checkout funnel events**: `upgrade_viewed`, `checkout_attempted`, `checkout_failed` | N-7 | ~1 h | — | Events visible in PostHog (verified in A8) | **done** (`upgrade_viewed` on mount, `checkout_attempted` {plan,provider} on CTA, `checkout_failed` {plan,provider,error} on non-cancel failure; success already covered by `subscription_started`) |
| C16 | **Weight-dialog re-verify + start-weight baseline**: reproduce the 70 kg default on prod (hydration?); keep onboarding weight as immutable "start" | P1-9 | ~2 h | — | On `+qa1`: dialog prefills last weight; after logging 84.5, START still shows 85 | **done** (modal takes `defaultWeightKg` from WeightClient so the 70 fallback can't fire on a hydration gap; immutable `start_weight_kg` via migration 025 + best-effort onboarding write + WeightStats fallback chain — degrades gracefully pre-migration) |
| C17 | **Docs-truth**: safety contract 128→151 + stale "023 pending" note; CLAUDE.md table list matches live DB; runbook migration list → "015 only; 011 skipped (unused); 012/022/023 already applied"; runbook host → www | N-2, N-9 | ~1 h | — | Docs match §1/§4 of this file | **done** |
| C18 | **Small batch**: delete `api/camera/test`; robots drop `/history`; hide oz for IFCT foods; DialogTitles (a11y); minimal links — Settings row → `/recipes`, Trends deficit stat → `/deficit` (listing/paywall mention them; deeper nav polish stays in week 1) | P2-7, P2-9, P2-8, P2-2, P1-13(min) | ~half-day | — | `/api/camera/test` 404s; console clean of Radix warnings; both pages reachable | **done** (debug endpoint deleted; robots `/history` removed; oz dropped from buildUnits + test updated; SheetContent gained a `title` prop → the 4 title-less modals now name themselves; `/recipes` Settings row + `/deficit` link from the Trends deficit card) |
| C19 | *(stretch)* **Post-scan coaching line** in camera/chat results | D-I | hours | C5 | Scan result shows one context-aware sentence | **done** (`lib/coaching.ts` pure line from meal totals + targets, no extra AI call; shown in the chat confirm view and the camera result; 191 tests) |

---

## 3. Day-by-day schedule

Day 0 = the day Adarsh says "go". Dates in parentheses assume go = Jul 18.

| Day | Adarsh | Claude |
|---|---|---|
| 0 (Jul 18) | A1 start (KYC/keys), A2 (migration 015 + verify), A3, A5, A7 | C1, C17, C2 |
| 1 (Jul 19) | A6 start (create app + listing draft) | C3, C5 |
| 2 (Jul 20) | — | C4, C7, C8, C13 |
| 3 (Jul 21) | — | C6, C9, C16 |
| 4 (Jul 22) | A6 finish (Billing products + trial offer, service acct, RTDN) — needs C10 done first for Data-safety | C6 finish, C10, C12 |
| 5 (Jul 23) | A4 (domains/env) after C11 deploys | C11, C14, C15, C18 (+C19 if on schedule) → **Bubblewrap build**, upload to internal track |
| 6 (Jul 24) | Install from internal track | On-device verification (runbook §8), **Play-signing assetlinks fingerprint** (runbook §3), E2E test payment (Play license tester + Razorpay test mode if A1 live), A8 funnel check, pre-launch report review |
| 7–8 (Jul 25–26) | Screenshots from device; closed track opt-in | Buffer for anything red; fix pre-launch-report findings |
| 9 (Jul 27) | **Production submission**, staged rollout 20% | Go/no-go checklist below |
| +1–7 | Play review (new app: 1–7 days) → **live ~Jul 28–Aug 3** | Week-1 live-ops (§6) |

**Razorpay KYC slip math:** KYC does **not** move the Play date — Play Billing carries the TWA independently. If keys aren't live by day 5: Claude hides the web upgrade CTAs behind "Pro is coming to web — join from the Android app" (1 h), launch proceeds, web payments follow whenever KYC lands. The only thing KYC delays is **web** revenue. Note: the live site's broken pay button is damaging trust **today** — if KYC is >2 days out, do the CTA-hide immediately, not on day 5.

### Go/no-go checklist (launch morning)

- [ ] Every §2 item `done` (or explicitly accepted with a note here)
- [ ] `npm test` + `npm run check:tokens` + `npm run build` green at the release commit
- [ ] Play license-tester purchase E2E ✓; Razorpay test payment ✓ (or web CTAs hidden per contingency)
- [ ] 11th free chat 429s live; Gemini budget alert armed
- [ ] Sentry receiving prod events; PostHog funnel verified (A8)
- [ ] assetlinks contains the **Play-signing** fingerprint; installed build shows no URL bar
- [ ] Data-safety form matches reality (deletion now cancels billing — C10)
- [ ] `+qa2` deleted; `+qa1` sanity pass (streak 9+, diary date == tapped date, trends correct)
- [ ] Staged rollout at 20%; Vercel previous deployment identified for instant rollback

---

## 4. Migration playbook (prod — Adarsh, ~15 min)

> The runbook's old pending list (012/022/023) is **wrong** — those are applied. Only 015 is missing. 011 is skipped deliberately (D-F). Migration filenames have duplicate numbers — always use exact filenames.

1. **Backup first.** Supabase Dashboard → Database → Backups → confirm a backup from today exists (or trigger one).
2. **Apply `supabase/migrations/015_chat_logs.sql`** — paste the file's contents into the SQL editor and run.
2b. **Apply `supabase/migrations/024_weekly_recaps.sql`** — added by C6 (the weekly-recap feature). Until applied, the recap cron's upsert no-ops and the Pro dashboard card stays empty (handled gracefully; no crash).
2c. **Apply `supabase/migrations/025_start_weight.sql`** — added by C16 (immutable start-weight baseline; backfills existing users). Until applied, "since start" falls back to the first weigh-in (old behaviour); onboarding writes the baseline best-effort so it's set the moment 025 lands. No crash either way.
3. **Verify:**
   ```sql
   select count(*) from chat_logs;                                        -- 0, no error
   select count(*) from weekly_recaps;                                    -- 0, no error (migration 024)
   select relrowsecurity from pg_class where relname = 'chat_logs';       -- true (RLS on)
   select indexname from pg_indexes where tablename in ('subscriptions','chat_logs') order by 1;
   -- expect: chat_logs (user_id, created_at) index;
   --         unique play_purchase_token index (012/023); unique razorpay_subscription_id index (022)
   select column_name from information_schema.columns
     where table_name = 'subscriptions' order by 1;
   -- expect: provider, play_purchase_token, play_product_id,
   --         razorpay_customer_id, razorpay_subscription_id, cancel_at_period_end (+ core cols)
   ```
4. **Full table diff** (assert the whole schema in one query):
   ```sql
   select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE' order by 1;
   -- expect exactly: camera_photo_logs, chat_logs, exercise_logs, food_favourites, food_logs,
   --                 foods, profiles, push_subscriptions, saved_meal_items, saved_meals,
   --                 subscriptions, weight_logs
   -- absent by design: water_logs, sleep_logs, fasting_sessions, measurements_logs (dropped by 019);
   --                   weekly_calorie_view (011 skipped — view is referenced nowhere in code)
   ```
5. **Behavior check:** as `+qa2` (free), send 11 chat logs → the 11th returns **429**; `select count(*) from chat_logs` = 10.
6. **At launch:** delete `+qa2` (Dashboard → Authentication → delete user; rows cascade). Keep `+qa1` forever as the day-30 fixture.

---

## 5. Claims inventory (every public claim → true / fixed / deleted)

| Claim | Where | Reality | Resolution |
|---|---|---|---|
| "600+ desi foods / 600+ Indian foods" (×4) | landing hero, feature card, founder story, FAQ, free column | 576 curated Indian (448 IFCT + 61 branded + 67 restaurant) | **Fix copy** → "500+" (D-D) — or Adarsh seeds 24 IFCT entries |
| "Works offline" + "sync when you reconnect" | landing hero microcopy, FAQ | No offline fallback, no write queue | **Soften** (D-C); build weeks 3–4, then restore |
| "Burned calories offset your daily goal automatically" | landing feature card (+ hero mock "Net calories") | No offset anywhere | **Soften** (D-B); build week 1, then restore |
| "Hit 7, 30, 100 days — with milestone celebrations" | landing | Not built | **Build** (C7 / D-A) |
| "AI Weekly Insights — every Sunday" | /upgrade features + reason banner | Not built | **Build** (C6) |
| "Saved meal templates" as Pro | /upgrade | Free (no gate on `meals/saved`) | **Move to free column** (C4) |
| "Export your data to CSV" as Pro | /upgrade | Free (90 days) | **Move to free column** (C4); export-as-right stance kept |
| "7-day free trial on annual" | interstitial (web) | No Razorpay trial | **TWA-only copy** (D-G); Play offer created in A6 |
| "30-day money back" | /upgrade footer | Terms say case-by-case | **Align terms to 30-day first-payment** (D-E) |
| "Priority support" | /upgrade + landing Pro column | mailto only | Soften to "Email support (24 h)" in C4; SLA in §6 |
| "Unlimited AI photo & chat logging" (Pro) | landing | True **only after** 015 applied (chat currently unlimited for everyone) | A2 makes it true |
| "Custom food & recipe builder" (Pro) | landing, /upgrade | Built but `/recipes` unreachable | Minimal link in C18; nav polish week 1 |
| "weekly deficit tracker" | Play listing draft | Built but `/deficit` unreachable | Minimal link in C18 |
| "400+ foods from IFCT 2017" | Play listing draft | 448 IFCT | ✅ true |
| "Protein is set at 2g/kg" | landing FAQ | Changing in C13 | Update FAQ in C4/C13 |
| "Delete your account anytime" | listing draft, /delete-account | Deletes rows but keeps charging Razorpay | **C10 makes it true — must land before Data-safety form (A6)** |
| "Log in 5 seconds", IFCT accuracy, "Save 71%", "No ads", encryption, cancel-anytime | various | Verified true in audit | ✅ keep |
| "5 AI photo scans/day free" | Play listing draft (was) | **False since 2026-07-18** — AI is Pro-only with 3 *lifetime* trial scans gated on email verification (`lib/aiTrial.ts`) | ✅ fixed 2026-07-19 in `play-store-launch.md` §listing copy; `app/page.tsx` was already correct |

---

## 6. Week-1 live-ops runbook

**Daily (~15 min, morning IST):**
1. **Sentry**: new issues → triage; anything in payments/logging paths = hotfix today.
2. **PostHog**: funnel (landing → sign-up → wizard → first log), D1 return, `paywall_viewed` → `checkout_attempted` → `upgrade_completed` (renamed from `subscription_started` in the v2 Phase 0 taxonomy). Watch for step cliffs, not absolute numbers.
3. **Gemini spend** (Cloud console) vs budget alert — P0-2's history means watch this personally for the first week.
4. **Razorpay dashboard**: webhook delivery failures (retry queue), payment failures.
5. **Play Console**: crashes/ANRs (vitals), new reviews — **respond within 24 h**, lead with a fix or a timeline.
6. **Supabase**: DB size / auth anomalies (glance).

**Hotfix path:** branch → fix → `npm test` + `check:tokens` → deploy to Vercel (TWA wraps the web app, so most fixes ship instantly with **no Play release**). Only manifest/packaging changes need a new AAB.
**Rollback:** Vercel → previous deployment → promote (instant). Play: halt staged rollout; fix forward (no binary rollback on Play).
**Staged rollout:** 20% → (48 h clean) → 50% → (48 h) → 100%.
**Perf (P2-14):** measure real-device 4G TTFB in week 1; act only if > ~3 s.

---

## 7. Post-launch 30-day roadmap

| Week | Item | Why |
|---|---|---|
| 1 | Exercise offset (net calories) + restore landing claim | D-B debt; the hero mock already promises it |
| 1 | Deficit unification (maintenance-based) + exclude in-progress day | P1-11/12 — same word, same math everywhere; stops morning "fake achievement" numbers |
| 1 | Orphan nav polish: dashboard → `/weight` tile; search sheet → recipes entry | P1-13 — weight is a core loop; paying users must find what they bought |
| 1 | Undo-delete snackbar (P2-3); coaching line if C19 slipped | Cheap trust wins |
| 2 | Food DB dedupe + full plausibility sweep (P1-5) | Protects the food-data moat; C5 was the minimal cut |
| 2 | Start-weight provenance hardening if C16 found more (P1-9b); copy-yesterday idempotency (P2-10) | Data-correctness debt |
| 2 | iOS A2HS instruction card (P2-12); custom-food gate shown upfront (P2-13); countUp init fix (P2-6) | Polish batch |
| 3–4 | RLS 7-day SELECT policy (P2-11) | Close the raw-PostgREST gap at the data plane |
| 3–4 | Offline: fallback page + queued writes → restore claim (D-C debt) | Makes the PWA story honest and real |
| 3–4 | Editable macros UI (P1-14 phase 2); HealthConnect read-only steps exploration | Retention + Play-listing story |
| — | **Deliberate skips** (won't-fix v1, revisit on review demand): water tracker, deep wearable integration, IF tracking, community/challenges | Audit's competitive analysis: not launch-critical; WhatsApp share card is the growth wedge instead |

---

## 8. Pre-mortem — top 5 ways this launch dies in week 1

| # | Death scenario | Mitigation (where) |
|---|---|---|
| 1 | **Razorpay KYC slips** → web pay button stays broken, trust bleeds | Decoupled: Play launches on Play Billing regardless (§3); web CTAs hidden immediately if KYC >2 days out. Residual risk: web revenue delayed — accepted |
| 2 | **IST refactor regression** silently corrupts streaks/diaries for late-night loggers | C2 midnight-crossing tests; `+qa1` fixture verification pre-launch; staged rollout catches the rest. Residual: none identified |
| 3 | **Unmetered Gemini bill** (limit off until 015; no alert today) | A2 + A5 on **day 0**, not launch day; daily spend check in §6 |
| 4 | **Play review rejection** (Data-safety says deletion works while Razorpay keeps charging; claims vs reality; assetlinks mismatch) | C10 lands **before** the Data-safety form (A6 ordering); §5 claims pass; runbook §3 fingerprint step; pre-launch report on day 6 |
| 5 | **First cohort churns on the habit loop** (streak dies silently day 3–7, no reminders, no repair) | C3 + C7 + C12 pulled into the gate precisely for this; §6 watches D1/D3 daily. Residual: recap (C6) lands by day 4 — if it slips, it slips to week 1, not the launch |
| † | *Bonus:* launching blind (no error monitoring) | C14 gated; not optional |

---

## 9. Finding → disposition index (nothing silently dropped)

| Finding | Disposition |
|---|---|
| P0-1 | Gate A1 (+ §3 contingency) |
| P0-2 | Gate A2 + A5 |
| P0-3 | Gate C4 (copy) + C6/C7 (build) |
| P0-4 | Gate C2 |
| P1-1 | Gate C2 · P1-2/3 → Gate C3 · P1-4 → Gate C5 · P1-5 → C5 minimal, week 2 full · P1-6 → Gate C5 · P1-7 → Gate C4 · P1-8 → Gate C10 · P1-9 → Gate C16 (re-verify; 9b week 2 if deeper) · P1-10 → C4 soften, week 1 build · P1-11/12 → week 1 · P1-13 → C18 minimal, week 1 polish · P1-14 → Gate C13 (cap), week 3–4 (edit UI) · P1-15 → Gate A3+C9 · P1-16 → Gate C8 · P1-17 → Gate C12 · P1-18 → Gate A4+C11 · P1-19 → C4 soften, weeks 3–4 build |
| P2-1 → Gate C10 · P2-2 → Gate C18 · P2-3 → week 1 · P2-4 → Gate C2 · P2-5 → Gate C4 · P2-6 → week 2 · P2-7/8/9 → Gate C18 · P2-10 → week 2 · P2-11 → weeks 3–4 (accepted until then) · P2-12/13 → week 2 · P2-14 → §6 monitor |
| N-1 → won't-fix (D-F, unused view) · N-2 → Gate C17 · N-3 → Gate C4 (D-E) · N-4 → Gate C5 · N-5/6 → Gate C1 · N-7 → Gate C15 · N-8 → Gate C14 · N-9 → Gate C17 |

---

*Maintained by Claude sessions. Update the Status columns in §2 as items land; add dated notes below this line rather than rewriting history.*
