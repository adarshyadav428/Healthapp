# GetInShape — E2E Test Matrix

Part of the 2026-09-13 QA baseline. Columns: ID · Area · Feature · Scenario · Preconditions ·
Steps · Expected result · Actual result · Result · Severity · Automation status · Manual
requirement · Evidence · Notes.

Result legend: **PASS** (observed working) · **FAIL** (defect confirmed) · **BLOCKED**
(cannot test without something unavailable this pass) · **NOT TESTED** · **PARTIAL**.

## Public / Landing

| ID | Feature | Scenario | Preconditions | Steps | Expected | Actual | Result | Sev | Automation | Manual req'd? | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E-001 | Landing page | Cold load | None | Navigate to `getinshape.co.in` | Loads, hero + app-screen mockups visible | Loaded correctly, content matches | **PASS** | — | None exists | No | Screenshot + accessibility tree read |
| E-002 | Landing page | 390px responsive | None | Resize to 390×844, screenshot | No horizontal overflow | `docWidth===winWidth`, screenshot clean | **PASS** | — | None | No | JS measurement + screenshot |
| E-003 | Landing page | Console errors | None | Load page, read console | No unexpected errors | `Uncaught SyntaxError: Unexpected token '<'` present | **FAIL** | P1 | None | No | Console log capture, repeated 6/6 page loads |
| E-004 | Sign-up | Empty submit | On `/auth/sign-up` | Click "Create account" with no input | Friendly validation on both fields | Email: "Invalid email" (good). Password: raw Zod string "String must contain at least 8 character(s)" | **FAIL** | P2 | None | No | Screenshot of rendered error text |
| E-005 | Forgot-password | Invalid email format | On `/auth/forgot-password` | Type `not-an-email`, submit | Blocked before any request | Native HTML5 validation blocked submission, no network request fired | **PASS** | — | None | No | Network log confirms zero requests |
| E-006 | Food SEO page | Valid slug | None | Navigate to `/foods/ifct-rice-raw` | Correct nutrition content, IFCT-sourced | "Raw Rice (Chawal), 345 kcal per 100g..." rendered correctly | **PASS** | — | None | No | Page text extraction |
| E-007 | Food SEO page | Invalid slug | None | Navigate to a nonexistent slug | Friendly 404, not a crash | "404 — Page not found... Go to Dashboard / Log Food" | **PASS** | — | None | No | Page text extraction |
| E-008 | PWA manifest | Fetch directly | None | `fetch('/manifest.webmanifest')` | Valid JSON, correct name/icons/start_url | 200, valid JSON, `start_url:"/dashboard"` | **PASS** | — | None | No | Direct fetch |
| E-009 | Service worker | Precache manifest integrity | None | Inspect `/sw.js`'s precache list, fetch each listed file anonymously | Every listed file returns its real content type | `/worker-<hash>.js` and `/swe-worker-<hash>.js` return `text/html` (redirected to sign-in) | **FAIL** | P1 | None | No | `fetch()` chain with `redirect:'manual'`/`'follow'`, confirmed final URL |
| E-010 | Landing links | No broken links | None | Enumerate all `<a href>` | Every href resolves to a real route | All 11 unique hrefs map to confirmed-existing routes | **PASS** | — | None | No | JS `querySelectorAll` enumeration |

## Authentication (unauthenticated-testable subset)

| ID | Feature | Scenario | Preconditions | Steps | Expected | Actual | Result | Sev | Automation | Manual req'd? | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E-011 | Sign-in | Password field placeholder | On `/auth/sign-in` | Inspect password input | No real value pre-filled | Confirmed `value:""`, placeholder is literal `"••••••••"` | **PASS** | — | None | No | JS DOM inspection (ruled out an autofill false alarm) |
| E-012 | Auth callback | Signed-in user opens `/auth/callback` | Authenticated session | Trigger "Send link" on VerifyEmailCard, open link in same browser | Callback runs, `email_verified_at` stamped | **CODE-REVIEWED: will redirect to `/dashboard` before the route handler runs — the callback never executes** | **FAIL (high-confidence, code-reviewed)** | **P0** | `tests/middleware.test.ts` covers sign-in/up only, not `/auth/callback` in the authenticated branch | **Yes — needs qa1/qa2 sign-in to observe live** | `middleware.ts:62,131-134` traced end-to-end |
| E-013 | Auth: returnTo | Deep link with query string while signed out | None | Sign out, navigate to `/dashboard?scan=1` | Sign-in, then redirect to `/dashboard?scan=1` | `returnTo` carries only `/dashboard`, `scan=1` is dropped | **FAIL (code-reviewed)** | P1 | `tests/middleware.test.ts` tests a path with no query string, cannot catch this | Yes — needs sign-in to observe live | `middleware.ts:16,127` |
| E-014 | Sign-in | Invalid credentials | Any account exists | Wrong password | Generic "Invalid login credentials" | Confirmed by code: verbatim Supabase message, no enumeration | **PASS (code-reviewed)** | — | None | No | `app/auth/sign-in/page.tsx:26-36` |

## Onboarding (all BLOCKED — needs a fresh account)

| ID | Feature | Scenario | Result | Sev | Manual req'd? |
|---|---|---|---|---|---|
| E-015 | Wizard | 4-screen walk, back/forward | BLOCKED | — | Yes — qa2 or throwaway account |
| E-016 | Wizard | Abandon + resume | BLOCKED | — | Yes |
| E-017 | Wizard | Time-to-first-log <60s (TESTING.md target) | BLOCKED | — | Yes |
| E-018 | Wizard | Draft not scoped per account | **FAIL (code-reviewed)** | P2 | Yes, to observe cross-account bleed on a shared device |

## Home / Food / Camera / Chat / Progress / Settings / Billing (all BLOCKED — needs authenticated session)

Every scenario in the original 20-phase brief for these domains (Home load/empty/error,
search success/no-results/slow/error, quantity editor edge cases, camera permission
denied/capture/retake, chat free-text parsing, AI timeout/malformed, progress chart ranges,
weight add/backdate, deficit windows, settings rows, billing entitlement states) is
**BLOCKED for live observation** pending Adarsh's sign-in, and **CODE-VERIFIED** via the
nine research fragments underlying `FEATURE-INVENTORY.md`. Rather than duplicate ~120 rows
of "BLOCKED / CODE-VERIFIED / see fragment X" here, this matrix records only the scenarios
where the code review itself surfaced a **specific, named defect** worth a dedicated matrix
row (every other CODE-VERIFIED scenario is enumerated in `FEATURE-INVENTORY.md` and
`USER-JOURNEYS.md`):

| ID | Area | Feature | Scenario | Expected | Actual (code-reviewed) | Result | Sev | Manual req'd to confirm? |
|---|---|---|---|---|---|---|---|---|
| E-019 | Progress | Weight trend line | 14+ days of real weigh-ins | Smoothed trend, rate, projected date render | `Number.isFinite(w.weight_kg)` likely rejects every real row (string from PostgREST) — trend silently empty | **FAIL (high-confidence, code-reviewed)** | **P0** | **Yes — single most important live check in this baseline** |
| E-020 | Weight | Backdate a weigh-in | Weigh-in ≥0.5kg different from current, dated in the past | Only affects historical record | Silently overwrites live `current_weight_kg` and recomputed macro targets, no recency check | **FAIL (code-reviewed)** | P1 | Yes |
| E-021 | Weight | "On track" banner | Any real weigh-in history | Reflects actual measured trend direction | Uses direction-agnostic projection; can claim "on track" while moving the wrong way | **FAIL (code-reviewed)** | P1 | Yes |
| E-022 | Food logging | Edit a log's macros | Edit an existing entry | Server recomputes from `food_id`+`grams` | Trusts client-computed values verbatim, bounded only by a raw ceiling | **FAIL (code-reviewed, bounded/self-scoped)** | P1 | Yes |
| E-023 | Food logging | Network retry after timeout on Add | Slow network, submit, request times out, retry | No duplicate log | No server-side idempotency on this path — a genuine retry can duplicate | **FAIL (code-reviewed, documented scope gap)** | P1 | Yes |
| E-024 | Saved combos | Create with huge grams value | Any account | POST grams:1e9 | Rejected or capped | Accepted (`z.number().positive()`, no `.max()`); flows into `food_logs` unbounded | **FAIL (code-reviewed)** | **P1** | Yes — can be tested via authenticated API call, no UI needed |
| E-025 | Camera | Modal closed mid-scan | Scan in progress | Request cancelled, no side effects | Fetch continues; a late 403 can fire `router.push('/upgrade')` on the new screen | **FAIL (code-reviewed, rare trigger)** | P2 | Yes |
| E-026 | Chat | Portion slider on a >600g item | Chat parses "1kg chicken curry" | Slider allows the real value | Slider hardcoded 10-600g, silently clamps on first touch | **FAIL (code-reviewed, easily reproduced)** | P2 | Yes |
| E-027 | Billing | Play grace-period entitlement | Play subscription in grace period | User retains Pro access until Play cuts them off | `isProStatus` only allows `active`/`trialing` — grace-period user reads as free | **FAIL (code-reviewed, needs product decision)** | P1 | Yes — needs a real Play subscription in that state |
| E-028 | Milestones | Overlay render/dismiss | Any milestone-qualifying log | Correct tap-vs-auto-dismiss variant renders | Logic confirmed correct by code; **zero DOM-level test exists** to regression-guard it | NOT TESTED (no defect found, but no safety net) | P1 (coverage gap) | Yes |
| E-029 | Streak Rescue | Second rescue attempt same month | Already used this month's rescue | 409 "already used" | Confirmed correct by code; **route-level negative paths have no test** | NOT TESTED (no defect found, but no safety net) | P1 (coverage gap) | Yes |

## PWA (partially testable without authentication)

| ID | Feature | Scenario | Preconditions | Steps | Expected | Actual | Result | Sev | Manual req'd? |
|---|---|---|---|---|---|---|---|---|---|
| E-030 | Service worker | Registration on anonymous visit | None | Load landing page, check `navigator.serviceWorker.getRegistrations()` | SW registers and activates cleanly | SW registers (`active: sw.js`) but its own precache manifest references files that 404-via-redirect (see E-009) | **PARTIAL / FAIL** | P1 | No — observed directly |
| E-031 | A2HS install prompt | Real install | Chrome on Android, or desktop Chrome | Trigger `beforeinstallprompt`, tap install | App installs, launches standalone | **BLOCKED** | — | **Yes — real device** |
| E-032 | TWA shortcuts | Long-press app icon | Installed TWA on Android | Long-press icon | 3 shortcuts appear (Log/Scan/Weight) | **BLOCKED** — root `twa-manifest.json` shows `shortcuts:[]`, web manifest shows 3; cannot resolve from source | **BLOCKED / SUSPECT FAIL** | P1 | **Yes — real device** |

## Automated gates (run this session)

| ID | Feature | Scenario | Expected | Actual | Result | Evidence |
|---|---|---|---|---|---|---|
| E-033 | Test suite | `npm test` | All pass | 131 files, 1650 tests, all passed | **PASS** | Full log captured |
| E-034 | Typecheck | `npx tsc --noEmit` | 0 errors | 0 errors | **PASS** | Exit code 0 |
| E-035 | Lint | `npm run lint` | 0 warnings/errors | "No ESLint warnings or errors" | **PASS** | Full log captured |
| E-036 | Design tokens | `npm run check:tokens` | 0 violations | "0 violation(s) across 0 file(s)... PASS — token-clean" | **PASS** | Full log captured |
| E-037 | Build | `npm run build` | Succeeds | Succeeded, full route manifest produced | **PASS** | Bundle sizes extracted into `PERFORMANCE-REPORT.md` |

## Summary counts (this matrix only — see `EXPLORATORY-QA-REPORT.md` for the full baseline tally)

- **PASS:** 11 (E-001, E-002, E-005, E-006, E-007, E-008, E-010, E-011, E-014, E-030 partial, E-033–E-037)
- **FAIL:** 12 (E-003, E-004, E-009, E-012, E-013, E-018–E-027, E-030 partial)
- **BLOCKED:** 4 (E-015–E-017, E-031, E-032)
- **NOT TESTED (coverage gap, no defect found):** 2 (E-028, E-029)

This matrix intentionally does not attempt to enumerate all ~150 features from
`FEATURE-INVENTORY.md` as individual rows — most of them have no live-testable status yet
(BLOCKED, pending an authenticated session) and are already tracked with their own risk
level there. This matrix's purpose is to record the **specific scenarios that were actually
run**, and the **specific scenarios where code review already surfaced a named, concrete
defect** worth a dedicated repro record.
