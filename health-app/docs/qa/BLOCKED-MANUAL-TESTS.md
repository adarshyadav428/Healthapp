# GetInShape — Blocked / Manual Test Register

Part of the 2026-09-13 QA baseline, updated after an authenticated pass against production
with account `+qa2` (Priya QA, Free tier) via the user's own already-signed-in Chrome
session. **Tier 0 is now fully resolved** — both P0s were tested and their sections below
are kept only as a record of what was done. Tiers 1–3 are updated to reflect what's now
actually PASS/FAIL vs. what remains genuinely blocked.

## Tier 0 — RESOLVED this session

### BT-0.1 — Weight-trend string bug (R1) — **RESOLVED: REFUTED, PASS**
Created 14 real backdated weigh-ins (one via the actual "Log weight" UI, 13 via the app's
own `/api/weight/add` endpoint under the same session) spanning Aug 31–Sep 13. Confirmed via
`GET /api/weight/logs` that `weight_kg` arrives as a genuine JSON number for all 14 rows, and
confirmed the trend line, rate, and projected date all render correctly on both `/weight`
("~5w at 1.02 kg/week") and `/progress` ("Down 0.64 kg a week on a 4-week average. On track
for 65.0 kg around 8 Nov 2026"). **No further action needed on this item.**

### BT-0.2 — Deferred email verification (R2) — **RESOLVED: CONFIRMED FAIL**
`fetch('/auth/callback?code=fake&next=/dashboard')` while authenticated as `+qa2` returned
`redirected:true, finalUrl:.../dashboard` — the callback route handler never ran. Identical
result for `/auth/reset-password?code=fake`. This proves the redirect fires on authentication
state alone, independent of code validity, so a real verification link would behave
identically. **Still open** (a code decision, not yet made — see `RISK-REGISTER.md` R2).
One sub-part remains genuinely untested: whether `+qa2`'s own verification card is currently
eligible to show (it wasn't visible during this session, plausibly because the account is
past its dismissal-cooldown window or already verified) — this doesn't affect the confirmed
finding above, since the redirect reproduction didn't depend on the card being visible.

### BT-0.3 — PWA console error in a non-automation browser — **RESOLVED (superseded)**
The underlying bug (R3) is now fixed in the working tree and verified against a real
production build (`next start` + `curl` against the actual generated worker filenames — see
`RISK-REGISTER.md` and `SECURITY-QA-REPORT.md`). This specific manual check is no longer
needed; what's left is deploying the fix (see Tier 1 below — "ship the middleware fix").

## Tier 1 — needs Adarsh's authenticated session — UPDATED status

Now that authenticated testing happened, this table reflects what's actually PASS/FAIL vs.
still blocked, rather than a blanket "needs sign-in."

| Area | Status | Notes |
|---|---|---|
| Home load, calorie ring, macros, today's meals, add/edit/delete | **PASS** (tested live) | See `RISK-REGISTER.md` and `USER-JOURNEYS.md` |
| Food search, quick-add, quantity editor (incl. zero-quantity edge case) | **PASS** (tested live) | — |
| Food edit — normal path | **PASS** (tested live) | Trust-boundary exploit also confirmed (R7, a defect, not a "fail" of the normal path) |
| AI chat logging (`CHAT-1`) | **PASS** (tested live, real Gemini call) | Found a new AI-matching quality issue (NEW-2, "curd" → "Curd Rice") |
| Camera photo scan | **BLOCKED — no camera hardware in this environment.** The viewfinder opened correctly (permission prompt/black feed consistent with no camera device present), but no image could be captured. **Gallery-upload fallback was not exercised either** — this remote browser has no practical way to inject a file into a native `<input type=file>` picker. | Needs a real device with a camera, or a way to script a file-input upload (neither available this session) |
| Barcode scan | **NOT TESTED** — manual entry path wasn't tried either; deprioritized in favor of higher-value checks given the session's time budget | — |
| Custom food creation (Pro gate) | **PASS** (tested live) | Correctly 402s for Free |
| `/deficit` access on a Free account | **PASS, with a caveat** — the page loaded fully for this Free account. CODE-REVIEWED explanation (`lib/deficitAccess.ts`) confirms this is either a pre-cutoff grandfathered account or within the 3-day taste window — **not independently confirmed which**, since `+qa2`'s exact signup date wasn't queried. Not a bug either way. | Low-value to chase further — the gating *logic* was read and is correct; only the specific reason for *this* account wasn't pinned down |
| Progress charts, weight trend, deficit card | **PASS** (tested live) | Found NEW-3 (deficit "ahead of schedule" from partial data) along the way |
| Settings — Appearance toggle | **PASS** (tested live, persists across reload) | — |
| Settings — Reminders, Usage analytics toggle, Export data | **NOT TESTED** — time budget went to higher-value targets | — |
| Settings — Sign out | **NOT TESTED, deliberately** — would have ended the only authenticated session available this run | Test in a follow-up session, ideally last |
| Settings — Delete account | **BLOCKED, deliberately not attempted** — `+qa2` is a shared, reusable QA fixture; delete-account is irreversible. Needs a disposable throwaway account created with explicit go-ahead. | Do not run against qa1/qa2 ever |
| Onboarding wizard walkthrough | **NOT TESTED** — `+qa2` is already onboarded (has a profile, weight history); a true first-run walkthrough needs a fresh account | Needs a new throwaway account, or a way to reset `+qa2`'s onboarding state (not attempted — would be destructive to existing fixture data) |
| Streak build/break/freeze/rescue | **NOT TESTED** — `+qa2`'s streak was 0–1 days for most of this session (a fresh-ish account); meaningfully exercising freeze/rescue needs either real elapsed weeks or direct data manipulation, neither done this pass | qa1 (documented ~30 days of history) would be the practical fixture for this, if accessible in a future session |
| Milestones/badges live-triggering | **NOT TESTED** | Same constraint as above |
| `/welcome`, `/wrapped` | **NOT TESTED** — needs a fresh Pro-grant event or an existing month-end wrap row, neither present for this Free account | Cannot be walked live without an actual purchase or an existing wrap row |
| Subscription/Pro-tier UI and gates beyond custom-foods | **PARTIALLY TESTED** — only the Free-tier side was exercised (this session had no access to a Pro account); every Pro-gate *reachable from a Free account* (paywall copy, 402 responses) was confirmed correctly gated, but the *Pro-side* experience (what a paying user actually sees) was not independently re-verified live | Would need a Pro account (qa1 is documented as Pro) in a future session |
| Concurrency — duplicate add on simultaneous requests | **FAIL, confirmed** (R8) | — |
| Concurrency — edit-while-pending, delete-while-pending, navigate-during-mutation | **NOT TESTED** — only the simultaneous-duplicate-add scenario was run given time constraints | — |
| IST day-boundary exact-timestamp race (23:55/00:05) | **BLOCKED, architecturally** — `/api/logs/add` and friends only ever accept a *date*, resolved server-side to either `now()` or noon IST of a backfilled day; there is no client-controllable exact timestamp to race against midnight through the legitimate API. Correct day-labeling during normal hours was implicitly confirmed throughout this session's testing (every log/weigh-in landed on the expected day). | The only way to genuinely test the exact boundary would be to either wait for a real midnight IST during a live session, or to mock the server's clock (not available against production) |
| Chrome DevTools timezone spoofing (non-IST browser) | **NOT TESTED** | The app's day logic is entirely server-side (`istDateStr()` on the server's clock), so client timezone spoofing would not exercise anything the server doesn't already control — lower priority than originally assumed |

## Tier 2 — needs a real Android device / TWA / Play Console (unchanged — still genuinely blocked)

| Test | Why blocked | Risk if skipped |
|---|---|---|
| A2HS install → standalone launch, no browser chrome | Needs a real Android Chrome or the installed TWA | Cannot verify the manifest/service-worker actually produce a chrome-free launch |
| TWA long-press manifest shortcuts (Log/Scan/Weight) | Needs an installed APK on a device | **R27 — root `twa-manifest.json`'s `shortcuts: []` vs. the web manifest's 3 real shortcuts cannot be resolved from source alone.** Still the most concrete "go check this" item for Adarsh |
| Google Play Billing purchase flow (BILL-05/06/07) | Needs a real Play sandbox/test purchase | `lib/play/verify.ts`/`google-auth.ts` have **zero automated test coverage** (R19) — the least-verified payment path in the app |
| Play grace-period entitlement behavior (R20) | Needs a real subscription to enter grace state | Cannot be simulated without a live Play subscription in that exact state |
| Push notification permission priming, real OS-level delivery, tap → `/api/push/opened` | Needs a real device with push permission granted | The one route that has already regressed once in production has zero regression test |
| Camera permission-denied / previously-denied OS dialogs | Needs real OS permission dialogs | Code path exists (`camError` + gallery fallback), but this session confirmed only that the viewfinder degrades gracefully with no camera present — not the actual OS permission-prompt interaction |
| iOS Safari/PWA behavior, `--kb-inset` on a real iPhone | No iOS device available | Documented as still-open P1-3 in the 2026-09-04 audit |
| Real barcode scan via `BarcodeDetector` | Needs a real camera and a real barcode | Not exercised this session at all (neither live-scan nor manual-entry path) |
| WhatsApp/Instagram share-sheet delivery of a generated share card | Needs a real Android share sheet | Code confirmed correct (`AbortError` handling); OS share sheet interaction unverified |
| Actual service-worker registration against the production build | Attempted this session against a local production build; failed with "An unknown error occurred when fetching the script" — but this reproduces through this sandbox's localhost-tunneling proxy specifically, and a real, successful registration (`active: sw.js`) was independently confirmed against the actual production domain at the start of this session, before any fix was even needed for that check. **Not attributable to the R3 fix.** | Re-verify once the fix is deployed, by checking `navigator.serviceWorker.getRegistrations()` on the real domain (same check already done successfully once this session) |

## Tier 3 — production-only / external-service-only (unchanged)

| Test | Why blocked | Notes |
|---|---|---|
| A real Razorpay checkout completion | Explicitly prohibited (no real financial transaction) | Signature verification and webhook handling confirmed correct by code review; live checkout widget not exercised |
| A real Google Play purchase | Same prohibition | See Tier 2 — `lib/play/verify.ts` gap |
| Monthly Wrapped's actual cron firing | Time-dependent; not forced via `CRON_SECRET` to stay read-only against production | `tests/routeWeeklyRecap.test.ts` covers the logic |
| BillDesk merchant verification status | Out of scope, unrelated to code | Do not recommend submitting to Play until this clears |
| Play Console / Data safety / App content declarations | Requires access this session doesn't have | — |
| Real multi-device sign-out lag (R2/Finding D — the JWT-TTL one, distinct from the auth-callback R2) | Needs two real devices/browsers signed into the same account simultaneously | Confirmed by code; actual lag not timed |
| Search under real network throttling | No real mobile network available | See `PERFORMANCE-REPORT.md` |

## Deploying the fix (new — not a test, but the natural next step for R3)

The middleware fix is complete and production-build-verified but **not committed, merged, or
deployed**, per explicit instruction this session ("do NOT commit anything yet"). Once
Adarsh approves: commit → PR → merge → Vercel auto-deploys → re-run the same `curl` checks
against `https://www.getinshape.co.in` to confirm the fix is live, and re-check
`navigator.serviceWorker.getRegistrations()` there too.

## What to do with this list now

Tier 0 is done. **The highest-value remaining work is Tier 1's "NOT TESTED" rows** — sign-out,
settings toggles beyond Appearance, onboarding on a fresh account, and streak/milestone
live-triggering (best done with `qa1`'s longer history if accessible). Tier 2's single most
valuable item remains the Play Billing verification-logic gap (R19), since it has essentially
no automated safety net and this session could not reach a real Android device. Tier 3 is
genuinely out of any local session's reach.
