# GetInShape — Complete Feature Inventory

Part of the 2026-09-13 QA baseline. Compiled from a static, read-only code review across
nine domains (see `docs/qa/EXPLORATORY-QA-REPORT.md` for methodology and the full findings
narrative). **Every row below is CODE-REVIEWED** — verified by reading the cited source,
not by running the app — unless the "Existing tests" column cites a test that actually
exercises it, or the master report's runtime-testing log confirms it OBSERVED.

Legend: **Auth** = must be signed in · **Authz** = extra ownership/entitlement check beyond
"signed in" · **Pro** = gated to paying users · **Net** = needs a network round trip ·
Risk: **P0** = security/data loss/app unusable · **P1** = major journey broken · **P2** =
meaningful functional/UX defect · **P3** = minor/polish.

Total: **~150 discrete features/flows** across 9 domains, 48 API routes, and every page in
`app/`. Domain sections below are lifted directly from the underlying research fragments
(`scratchpad` working files, not committed) with IDs preserved so cross-references in
`USER-JOURNEYS.md`, `RISK-REGISTER.md` and `E2E-TEST-MATRIX.md` resolve consistently.

---

## Auth & Onboarding (AUTH-*, ONB-*)

| ID | Feature | Purpose | Entry point | Route(s) | Component(s) | Hook(s) | API(s) | DB table(s) | External service(s) | Auth req'd | Authz req'd | Pro req'd | Network req'd | Mobile-only | Web-only | Existing tests | Missing tests | Risk |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| AUTH-01 | Email/password sign-up | Create account | "Create account" on landing/sign-in | `app/auth/sign-up/page.tsx` | inline form | `signUpSchema` | Supabase `auth.signUp` | `auth.users` → `profiles` trigger | Supabase Auth | No | No | No | Yes | No | No | none direct | "existing unconfirmed email" enumeration-safe response test | P2 |
| AUTH-02 | Google OAuth sign-up/sign-in | One-tap account creation/entry | "Continue with Google" | sign-in/sign-up pages, `app/auth/callback/route.ts` | inline buttons | none | `signInWithOAuth` → `/auth/callback` → `exchangeCodeForSession` | `auth.users`, `profiles` | Supabase Auth, Google OAuth | No (until callback) | No | No | Yes | No | No | none | route test of `app/auth/callback/route.ts` | **P0 (Finding A)** |
| AUTH-03 | Email/password sign-in | Return to app | "Sign in" | `app/auth/sign-in/page.tsx` | inline form | `signInSchema` | `auth.signInWithPassword` | `auth.users` | Supabase Auth | No | No | No | Yes | No | No | none direct | `?returnTo=` open-redirect guard test, `?error=` handling test | P1 |
| AUTH-04 | Forgot password | Request reset email | "Forgot?" link | `app/auth/forgot-password/page.tsx` | inline form | none | `auth.resetPasswordForEmail` | `auth.users` | Supabase Auth | No | No | No | Yes | No | No | none | none | P2 |
| AUTH-05 | Reset password | Set new password from emailed link | Emailed link → `/auth/reset-password` | `app/auth/reset-password/page.tsx` | inline form | none | `auth.updateUser({password})` | `auth.users` | Supabase Auth | Implicit | No | No | Yes | No | No | none | PKCE code→session resolution test | P1 |
| AUTH-06 | OAuth / magic-link callback | Exchange PKCE code for a session; stamp email verification | Any Supabase-generated link | `app/auth/callback/route.ts` | — | — | itself | `profiles.email_verified_at` | Supabase Auth, PostHog | No (establishes it) | No | No | Yes | No | No | none | entirely untested | **P0 (Finding A)** |
| AUTH-07 | Sign out | End session | Settings → Sign out | `SettingsClient.tsx` | — | none | `POST /api/auth/signout` | — | Supabase Auth | Yes | No | No | Yes | No | No | `tests/render/settingsClient.test.tsx` | cross-device/tab session-lag test | P2 |
| AUTH-08 | Route protection / redirect-to-sign-in | Gate all non-public pages | every navigation | `middleware.ts` | — | — | — | — | Supabase Auth | — | — | — | Yes | No | No | `tests/middleware.test.ts` | query-string-preserving `returnTo` test | P1 |
| AUTH-09 | Auth-route bounce for signed-in users | Keep a logged-in user off `/auth/*` | any authed visit to `/auth/*` | `middleware.ts:131-134` | — | — | — | — | — | — | — | — | — | — | — | `tests/middleware.test.ts` (sign-in/up only) | authenticated `/auth/callback` & `/auth/reset-password` case | **P0 (Finding A)** |
| AUTH-10 | Deferred email verification nudge | Recover a verified address; gates AI trial | Dashboard, 3 days after signup | Dashboard | `VerifyEmailCard.tsx` | `useSendVerificationLink`, `useUser` | `signInWithOtp` → `/auth/callback` | `profiles.email_verified_at` | Supabase Auth, PostHog | Yes | Own row | No | Yes | No | No | `tests/emailVerification.test.ts` (20 tests, pure) | send→click round-trip test — **the round trip is broken**, see Finding A | **P0** |
| AUTH-11 | AI trial gate (email-verification-gated) | Let a free user try AI logging before paying | Camera/chat attempt | `app/api/camera/analyze`, `app/api/chat/analyze` | `useCameraScan`, `useChatLog` | `lib/aiTrial.ts`/`aiTrialServer.ts` | same two routes | `camera_photo_logs`, `chat_logs`, `profiles.email_verified_at` | Gemini | Yes | Own usage | No (this is the free path) | Yes | No | No | `tests/aiTrial.test.ts`, `tests/aiTrialServer.test.ts` | integration test of the 403's `block:'unverified'` field | P2 |
| ONB-01 | Onboarding gate | Force new accounts through setup | any protected page | `app/onboarding/page.tsx` + 9 other pages | — | — | — | `profiles.height_cm` | — | Yes | No | No | Yes | No | No | `tests/architectureInvariants.test.ts` | behavioral redirect test per page | P1 |
| ONB-02 | Wizard step 1 — activation log | Real food log before biometrics | `/onboarding` | `OnboardingForm.tsx` | `useOnboardingDraft` | camera/chat modals | `food_logs` | Gemini (if used) | Yes | Own row | No | conditional | No | No | `tests/render/onboardingForm.test.tsx` (submit-guard only) | barcode hand-off / "Skip" tests | P2 |
| ONB-03 | Wizard step 2 — about you | Name, age, sex | `/onboarding` | same | same | — | — | — | Yes | Own row | No | No | No | No | `tests/routeOnboarding.test.ts` (server) | client validation-boundary test | P3 |
| ONB-04 | Wizard step 3 — body & goal | Body type, height, weight, target, focus | `/onboarding` | same, `BodyTypeImage` | same | — | — | — | Yes | Own row | No | No | No | No | `tests/routeOnboarding.test.ts` (6 cases) | `focusTouchedRef` client test | P2 |
| ONB-05 | Wizard step 4 — lifestyle + TDEE preview | Activity, pace, live calorie/macro preview | `/onboarding` | same, `lib/tdee.ts` | same | — | — | — | Yes | Own row | No | No | No | No | `tests/routeOnboarding.test.ts` | preview-vs-server-compute drift test | P2 |
| ONB-06 | Wizard draft resume | Pick up a mid-wizard abandon | reopening `/onboarding` | `useOnboardingDraft.ts` | same | — | `localStorage` | — | Yes | — | No | No | No | No | none | persist/resume/clear test; **not scoped per user (Finding F)** | P2 |
| ONB-07 | Onboarding submit | Persist profile, derive goal, compute TDEE | Finish button | `app/api/onboarding/route.ts` | — | — | itself | `profiles` | — | Yes | Own row | No | Yes | No | No | `tests/routeOnboarding.test.ts` (12 cases) | 401 case, best-effort-write test | P2 |
| ONB-08 | Plan reveal (`/onboarding/plan`) | Payoff screen after submit | auto-redirect | `app/onboarding/plan/page.tsx` | `StorySurface`, `lib/planCards.ts` | — | — | `profiles` (read) | — | Yes | Own row | No | Yes | No | No | none | redirect-if-incomplete guard test | P2 |
| ONB-09 | Returning-user re-entry to `/onboarding` | Prevent re-running the wizard | manual nav post-completion | `app/onboarding/page.tsx:22-24` | — | — | — | `profiles.height_cm` | — | Yes | Own row | No | Yes | No | No | none | redirect test | P2 |
| ONB-10 | `/welcome` Pro activation story | Celebrate first Pro entitlement | Redirect after checkout | `app/welcome/page.tsx` | `StorySurface`, `lib/welcomeCards.ts` | — | — | `profiles`, `food_logs`, `weight_logs`, subs | — | Yes | Own row | Yes | Yes | No | No | none for the page | gate-ordering test | P2 |

**Headline finding:** AUTH-02/06/09/10 share one P0 root cause (Finding A, see
`SECURITY-QA-REPORT.md` and `EXPLORATORY-QA-REPORT.md`) — middleware bounces *any*
already-signed-in visitor away from all of `/auth/*`, including `/auth/callback`, before
the route handler runs. `VerifyEmailCard`'s entire premise is "click this link while still
signed in," so the deferred-email-verification feature cannot complete for its designed,
common-case user.

---

## Home / Dashboard / Food Logging / Search (HOME-*, LOG-*, SEARCH-*)

| ID | Feature | Purpose | Entry point | Route(s) | Component(s) | Hook(s) | API(s) | DB table(s) | External svc | Auth | Authz | Pro | Net | Mobile-only | Web-only | Existing tests | Missing tests | Risk |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| HOME-01 | Dashboard shell / SSR data load | One parallel round trip: profile, today's logs, streak, sub, recap, rescues, weigh-ins | `/dashboard` | `app/dashboard/page.tsx` | `DashboardClient.tsx` | `useFoodLogs`, `useUser` | server reads only | `profiles`, `food_logs`, `subscriptions`, `weekly_recaps`, `streak_rescues`, `weight_logs` | — | Y | Y | N | Y | N | N | none dedicated | render/integration test for `DashboardClient` | P2 |
| HOME-02 | Calorie hero card + macro ring | Eaten vs. target kcal + P/C/F | dashboard load | — | `CalorieHeroCard` | `useFoodLogs` | — | — | — | Y | Y | N | N | N | N | none in scope | dedicated render test | P2 |
| HOME-03 | Streak flame + freeze badge | Current streak + banked freezes | dashboard load | — | `DashboardClient.tsx:143-165` | — | — | `food_logs`, `streak_rescues` | — | Y | Y | N | N | N | N | `tests/streak.test.ts` | — | P3 |
| HOME-04 | Week strip | Tap a day → that day's diary | dashboard load | `/log?date=` | `WeekStrip.tsx` | — | — | derived | — | Y | Y | N | N | N | N | not read | — | P3 |
| HOME-05 | Dashboard "one moment" picker | Exactly one of streak-rescue/restart/plateau | dashboard load | — | `DashboardClient.tsx:125-131` + 3 cards | — | — | — | — | Y | Y | rescue=Pro | N | N | N | `tests/dashboardMoments.test.ts` (pure) | render test: only one card mounts | P2 |
| HOME-06 | Goal projection card | Projected goal date from trend | dashboard load | — | `GoalProjectionCard` | — | — | `weight_logs` | — | Y | Y | N | N | N | N | `lib/goalProjection.ts` tests | — | P3 |
| HOME-07 | Next streak badge nudge | "N days to your X badge" | dashboard load | `/progress` | `DashboardClient.tsx:269-276` | — | — | derived | — | Y | Y | N | N | N | N | `lib/badges.ts` tests | — | P3 |
| HOME-08 | Adaptive target suggestion | Opt-in target adjustment, never auto-applied | dashboard load | — | `AdaptiveTargetCard` | — | own PATCH route | `profiles` | — | Y | Y | N | Y | N | N | out of scope | — | P3 |
| HOME-09 | Weekly recap card | Pro-only weekly summary | dashboard load | — | `WeeklyRecapCard` | — | — | `weekly_recaps` | Gemini (cron) | Y | Y | **Y** | N | N | N | out of scope | — | P3 |
| HOME-10 | Notification/Rate/Verify/Install prompt cards | Self-gating growth prompts | dashboard load | — | `NotificationPrimeCard`, `RatePromptCard`, `VerifyEmailCard`, `InstallPromptCard` | — | — | — | browser APIs | Y | Y | N | N | Rate=TWA only | Install=mobile-web | out of scope | — | P3 |
| HOME-11 | Home → Food search deep link | One tap lands cursor in the real search box | `/log?search=1` | `app/log/page.tsx`, `FoodLanding.tsx:54-71` | `DashboardClient.tsx:206-214` | — | — | — | — | Y | Y | N | N | N | N | none | autofocus + URL-strip integration test | P3 |
| HOME-12 | AI chat FAB (Home) | Log by free text | dashboard | — | `DashboardClient.tsx:217-224,317-326`, `ChatLogModal` | — | `/api/chat/*` | — | Gemini | Y | Y | Pro OR trial | Y | N | N | out of scope (see CAM/CHAT) | — | P2 |
| HOME-13 | Today's meals list (Home) | Inline today's log, opens edit modal | dashboard | — | `TodayMeals`, `EditFoodLogModal` | `useFoodLogs` | `/api/logs/edit` | `food_logs` | — | Y | Y | N | Y | N | N | see LOG-13 | — | P2 |
| LOG-01 | Food/Log page shell | Day-scoped shell; gates backfill by tier | `/log`, `/log?date=` | `app/log/page.tsx` | `FoodHeader`, `SwipeDayNav`, `FoodLanding`, `TodayFoodLog`, `PasteMealCard`, `ExerciseLogger` | — | — | `profiles`, `subscriptions`, `food_logs` | — | Y | Y | history depth gated | Y | N | N | `tests/routeEntitlements.test.ts` (adjacent) | page-level backfill-gating integration test | P1 |
| LOG-02 | Date navigation | Prev/next + swipe; locks past free window | `/log?date=` | `app/log/page.tsx:35-44,116-138` | `FoodHeader`, `SwipeDayNav` | — | — | — | — | Y | Y | free tier locked | N | N | N | not read | — | P2 |
| LOG-03 | FoodLanding shell | Home-deep-link autofocus + suggestion row | `/log` | `FoodLanding.tsx` | `FoodSearch`, `AddFoodModal` | `useQuery` | `/api/foods/suggest` | — | — | Y | Y | tier-based cap | Y | N | N | none dedicated | — | P2 |
| LOG-04 | FoodSearch (field+shelves+results) | The whole logging surface since 2026-09-11 redesign | `/log` | `FoodSearch.tsx` | `FoodResult`, `shortcuts.tsx`, `SearchField` | `useFoodSearch` | `/api/foods/search` | — | Open Food Facts | Y | Y | custom-food create=Pro | Y | N | N | `tests/render/foodSearch.test.tsx` | — | P1 |
| LOG-05 | Recent shelf | Current-meal-slot rows lead | `/log` | — | `FoodSearch.tsx:108-127` | `useFoodSearch` | — | — | — | Y | Y | N | N | N | N | none dedicated | slot-priority unit/render test | P2 |
| LOG-06 | Often (frequent) shelf | Top-8 by frequency, name-deduped | `/log` | — | `FoodSearch.tsx:118-131` | `useFoodSearch` | — | `food_logs` (200-row snapshot) | — | Y | Y | N | N | N | N | none dedicated | "same dish, two ids" dedup test | P2 |
| LOG-07 | Favourites shelf | User-curated star list | `/log` | — | `FoodSearch.tsx:286-312` | `useFoodFavourites` | `/api/foods/favourites` | `food_favourites` | — | Y | Y | N | Y | N | N | none in pass | optimistic-rollback test (S-7) | P2 |
| LOG-08 | My foods shelf (combos) | Saved meal templates, one-tap log | `/log` | — | `FoodSearch.tsx:315-372` | `useFoodSearch` | `/api/meals/saved`, `/api/meals/log` | `saved_meals`, `saved_meal_items` | — | Y | Y (ownership on log) | N | Y | N | N | `tests/render/foodSearch.test.tsx` (log only) | delete-combo error-path test | P2 |
| LOG-09 | Copy yesterday | Bulk-copies yesterday's IST-day logs onto today | `/log`, today only | — | `shortcuts.tsx` `CopyYesterdayButton` | `useFoodSearch.copyYesterday` | `/api/logs/copy-yesterday` | `food_logs` | — | Y | Y | N | Y | N | N | `tests/routeCopyYesterday.test.ts` (thorough) | — | P1 |
| LOG-10 | Paste meal (cross-day copy) | `localStorage`-referenced cross-day meal copy | `/log`, any editable day ≠ source | — | `PasteMealCard.tsx`, `TodayFoodLog.tsx:71-96` | — | `/api/logs/copy-meal` | `food_logs` | `localStorage` | Y | Y | backfill-gated | Y | N | N | `tests/mealClipboard.test.ts`, `tests/routeCopyMeal.test.ts` (thorough) | — | P1 |
| LOG-11 | Quick-add "+" | One rule for what a bare "+" logs | search results, Recent, Often, Favourites | — | `FoodSearch.tsx:97-106`, `FoodResult.tsx` | `useFoodSearch.quickAdd`, `lib/lastPortions.ts` | `/api/logs/add` | `food_logs` | — | Y | Y | N | Y | N | N | `tests/lastPortions.test.ts`, `tests/render/foodSearch.test.tsx` (sabotage-verified) | — | P1 |
| LOG-12 | AddFoodModal (portion sheet) | Full logging sheet | any result/shelf row tap | — | `AddFoodModal.tsx` | `useDailyTotals` | `/api/logs/add` | `food_logs` | — | Y | Y | N | Y | N | N | none in `tests/render/` | modal render/integration test | P1 |
| LOG-13 | EditFoodLogModal | Edit amount/unit/meal/context | tap any logged row | — | `EditFoodLogModal.tsx` | — | `/api/logs/edit` | `food_logs` | — | Y | Y | N | Y | N | N | none in `tests/render/` | render test; **trust-boundary gap, S-2** | P1 |
| LOG-14 | UnitPicker | Household-measure picker shared by Add/Edit | `/log` | — | `UnitPicker.tsx` | — | — | — | — | Y | Y | N | N | N | N | `tests/portionUnits.test.ts` | picker component render test | P3 |
| LOG-15 | Quick Add calories (no food) | Log kcal/macros with no linked food | empty-search state | — | `QuickAddModal.tsx` | — | `/api/logs/quick-add` | `food_logs` (`food_id: null`) | — | Y | Y | N | Y | N | N | none in `tests/render/` | render + bounds test | P2 |
| LOG-16 | Create custom food | "Create <query>" from no-results | `/log` no-results | — | `CreateFoodModal` | — | `/api/foods/custom` (POST) | `foods` (`source='user'`) | — | Y | Y | **Y** (402 free) | Y | N | N | out of scope | — | P3 |
| LOG-17 | TodayFoodLog (day's log) | Grouped-by-meal list; delete+undo, save-combo, copy-meal source, share | `/log`, Home | — | `TodayFoodLog.tsx` | `useFoodLogs` | `/api/logs/delete`, add/quick-add (undo), `/api/meals/saved` | `food_logs`, `saved_meals` | — | Y | Y | N | Y | N | N | none in `tests/render/` | delete→undo render test; S-4/S-5 | P1 |
| LOG-18 | Save meal as combo | Turns a meal-slot into a `saved_meals` template | TodayFoodLog | — | `TodayFoodLog.tsx:45-67` | — | `/api/meals/saved` (POST) | `saved_meals`, `saved_meal_items` | — | Y | Y (`isFoodReferenceableBy`) | N | Y | N | N | none dedicated | **bounds test — F-1/S-3 still open** | **P1** |
| LOG-19 | Log a saved combo | One tap logs every item | My-foods tab | — | `FoodSearch.tsx:315-343` | `useFoodSearch.logSavedMeal` | `/api/meals/log` | `food_logs`, `saved_meals` | — | Y | Y | N | Y | N | N | `tests/render/foodSearch.test.tsx`, `tests/coachingWiring.test.ts` | — | P1 |
| LOG-20 | Delete a saved combo | Removes a `saved_meals` row | My-foods tab | — | `FoodSearch.tsx:327-336` | `useFoodSearch.deleteSavedMeal` | `/api/meals/saved` (DELETE) | `saved_meals` | — | Y | Y | N | Y | N | N | none dedicated | — | P3 |
| LOG-21 | "Fits what's left" suggestion | One dish suggestion, swipe dismisses forever | `/log`, today only | — | `FoodLanding.tsx:73-154` | `useQuery` | `/api/foods/suggest` | `foods`, `food_dismissals` | — | Y | Y | free daily cap | Y | N | N | `lib/mealSuggest.ts` tests | — | P2 |
| SEARCH-01 | Search pipeline (local + OFF India + OFF World) | Merge three ranked sources | `/log` search field | `app/api/foods/search/route.ts` | — | `useFoodSearch` | `/api/foods/search` (GET) | `foods` | Open Food Facts | Y | Y (exclude other users' custom) | N | Y | N | N | `tests/searchRanking.test.ts` +4 more | route-level integration test | P1 |
| SEARCH-02 | Synonym expansion | Regional/Hindi → canonical group | search | `lib/food-synonyms.ts` | — | — | — | — | — | — | — | — | — | — | — | `tests/foodSynonyms.test.ts` | — | P2 |
| SEARCH-03 | Ranking (typed→synonym→source→length) | Orders merged result set | search | `lib/searchRanking.ts` | — | — | — | — | — | — | — | — | — | — | — | `tests/searchRanking.test.ts` (very thorough) | — | P1 |
| SEARCH-04 | Spelling-variant folding | Normalizes romanisation both sides | search | `lib/spelling-variants.ts` | — | — | — | — | — | — | — | — | — | — | — | `tests/spellingVariants.test.ts` | — | P2 |
| SEARCH-05 | Typo correction | Retries once on empty result | search | `lib/typo-correction.ts` | — | — | — | — | — | — | — | — | — | — | — | `tests/typoCorrection.test.ts` | — | P2 |
| SEARCH-06 | Duplicate collapsing | One row per food, `SOURCE_RANK`-elected | search | `lib/mergeSearchResults.ts`, `lib/foodClusterKey.ts` | — | — | — | — | — | — | — | — | — | — | — | `tests/mergeSearchResults.test.ts`, `tests/foodDataQuality.test.ts` | — | P1 |
| SEARCH-07 | Foreign-OFF suppression | Hides non-India OFF rows when Indian answer exists | search | `lib/mergeSearchResults.ts` | — | — | — | — | — | — | — | — | — | — | — | `tests/mergeSearchResults.test.ts` | — | P2 |
| SEARCH-08 | OFF-dominance cap | Limits packaged-goods crowding | search | `lib/mergeSearchResults.ts` | — | — | — | — | — | — | — | — | — | — | — | `tests/mergeSearchResults.test.ts` | — | P2 |
| SEARCH-09 | Own-food merge (estimate/custom) | Reserves 3 slots for caller's own scanned/custom foods | search | `app/api/foods/search/route.ts:295-345,374-391` | — | — | — | `food_logs`, `foods` | — | Y | Y | N | Y | N | N | indirect only | route-level 3-slot + exclusion test | P1 |
| SEARCH-10 | Result cache (TTL/LRU, degraded TTL) | Shared, query-keyed cache | search | `lib/searchCache.ts` | — | — | — | — | — | — | — | — | — | — | — | `tests/searchCache.test.ts` | — | P2 |
| SEARCH-11 | Rate limiting | 30 req/60s per IP, in-memory | search | `app/api/foods/search/route.ts:28,77-87` | — | — | — | — | — | — | — | — | — | — | — | none | **per-instance, not global — S-8** | P3 |
| SEARCH-12 | Portion-unit engine | Household-measure list + default portion | Add/Edit/quick-add/FoodResult | `lib/portion-units.ts` | multiple | — | — | — | — | — | — | — | — | — | — | `tests/portionUnits.test.ts` (extremely thorough) | — | P1 |

---

## Camera & Chat AI Logging (CAM-*, CHAT-*)

| ID | Feature | Purpose | Existing tests | Missing tests | Risk |
|---|---|---|---|---|---|
| CAM-1 | Photo scan → AI food identification (`POST /api/camera/analyze`, Gemini `gemini-2.5-flash-lite`, 20s timeout) | Photograph a plate/pack, Gemini identifies ≤3 foods with portions | `tests/camera-nutrition.test.ts`, `tests/routeCameraAnalyze.test.ts`, `tests/useCameraScanUnresolved.test.ts`, `tests/render/cameraModal.test.tsx`, `tests/cameraResultFeedback.test.ts` | fetch/error-handling of `analyzePhoto` itself; unmount-mid-scan behavior | P1 |
| CAM-2 | Barcode scan → Open Food Facts lookup (`GET /api/camera/barcode`, not Gemini, not AI-trial-gated) | Scan/type a barcode, resolve via local DB or OFF | none found | malformed barcode, OFF timeout/500, no-nutriments, `offi_`/`off_` selection | P2 |
| CAM-3 | Multi-food "on the plate" logging + per-item correction | Decompose a photo into ≤3 items, edit each, log together via `/api/logs/add-bulk` | `tests/render/cameraModal.test.tsx` | `/api/logs/add-bulk` itself (out of domain) | P2 |
| CHAT-1 | Free-text meal description → AI parse + log (`POST /api/chat/analyze`) | Natural-language meal entry parsed to structured items | `tests/chat-nutrition.test.ts`, `tests/chatLogEval.test.ts`, `tests/chatPrompt.test.ts` | **no route-level test at all** — zero coverage of auth/401, subscription-500, trial-403, Gemini timeout/malformed, partial-failure 500 | **P1** |
| CHAT-2 | Composite-dish decomposition (`is_stated_component` + `rebalanceChatItems`) | Stop named components double-counting on top of a stated total | `tests/chatLogEval.test.ts`, `tests/chat-nutrition.test.ts` | `scaleDown`'s `originalSum<=0` guard isolated test | P1 (nutritional accuracy) |
| CHAT-3 | Piece-counted (`pcs`) chat items with a stepper | Correct "6 pieces" without guessing grams | prompt-string presence only | `updateCount`'s `gramsPerUnit` recompute unit test | P2 |
| CHAT-4 | Shared lifetime AI trial gate (camera+chat) | Meter Gemini spend: 3 lifetime calls shared, unlimited Pro | `tests/aiTrial.test.ts`, `tests/aiTrialServer.test.ts`, `tests/usageCounter.test.ts` | — (very thorough already) | P0 business-risk if broken; currently solid |

**Re-verified and holding:** the P0-1 camera `pcs` zeroed-and-refused fix; plausibility
guardrails before any `foods` catalogue write on both routes; the shared AI-trial pool with
fail-closed reads; a failed scan cannot burn a trial call on either route (all confirmed by
direct code read, see `camera-chat-ai.md` fragment for line citations).

**New findings:** no `AbortController` on either analyze fetch (closing the modal mid-scan
doesn't cancel the request — a late 403 can fire an unrelated `router.push('/upgrade')');
chat's quantity slider is hardcoded 10–600g vs. camera's 10–1500g (a legitimate >600g
chat-parsed item silently clamps down the instant the user touches the slider); chat
conflates malformed-JSON with network/timeout errors (camera doesn't); both routes' multi-item
writes are non-atomic (benign, deterministic keys); no client-side image size cap before
base64 upload.

---

## Progress / Weight / Deficit / Exercise (PROG-*, WT-*, DEF-*, EX-*)

| ID | Feature | Risk | Status highlight |
|---|---|---|---|
| PROG-1 | Progress page shell (streak, deficit card, weight hero, chart, calendar, badges, exercise) | P2 | Onboarding-gated; 90-day/full weight history Pro-gated |
| PROG-2 | Streak banner | P3 | 60-day scan, independent of Pro status |
| PROG-3 | Calorie/macro trend chart (7/14/30-day bars) | P2 | Free chip-locks route to `/upgrade?reason=history` |
| PROG-4 | Day diary drawer | P2 | Free window enforced via server-computed `beyondFreeWindow` |
| PROG-5 | Month calendar | P2 | Cell math is deliberately UTC-`Date.UTC`-built from IST date keys — not a zone bug |
| PROG-6 | Badge shelf | P3 | Free, never Pro-gated |
| PROG-7 | Share progress card | P3 | — |
| WT-1 | Weight page shell | **P1** | See Finding 1 (P0) below |
| WT-2 | Weight stats hero | **P1** | `goal:'maintain'` treated as `'gain'` for direction colour — Finding 4 |
| WT-3 | Weight trend/projection banner ("🎯 On track...") | **P0** | Uses the direction-agnostic projection the codebase itself calls dishonest — Finding 3 |
| WT-4 | Weight chart | P2 | Tooltip risks a long-precision string render — Finding 6 |
| WT-5 | BMI card | P3 | — |
| WT-6 | Log weight (add, backdate, kg/lb) | **P1** | Backdating can silently overwrite live profile targets — Finding 2 |
| WT-7 | Delete weigh-in | P3 | — |
| WT-8 | Weight milestone | P3 | Backdated-entry ordering edge case — Finding 7 |
| WT-9 | Weight trend hero on Progress (`WeightHero`) | **P0** | See Finding 1 below |
| DEF-1 | Deficit page shell | P2 | Pro-gated with a 3-day taste window for post-cutoff free accounts |
| DEF-2 | Weekly deficit summary | P2 | Confirmed: calendar Mon–Sun, never rolling |
| DEF-3 | 4-week deficit history | P3 | — |
| DEF-4 | All-time fat burned | P2 | Confirmed today is excluded |
| DEF-5 | Energy-balance trend card (Progress) | P1 | Confirmed: the one sanctioned rolling-window surface; month is `null` server-side for free |
| EX-1 | Log exercise | P2 | Today-only by design (no date-threading) |
| EX-2 | Today's exercise strip | P3 | — |
| EX-3 | Delete exercise entry | P3 | — |
| EX-4 | Exercise section on Progress | P2 | **Exercise calories never feed the deficit/TDEE math** — Finding 5, needs product confirmation |
| EX-5 | Adaptive-target signal | P3 | — |

**Re-verified and holding:** deficit's one definition (`maintenance − eaten`, never
`daily_calorie_target − eaten`); today always peeled off before deficit maths; `rolling` is
confined to the Progress trend card only; `goal`/`body_focus` derivation matches
`planForFocus`; no UTC/IST chart mis-grouping (the one apparent case — `weightTrend.ts`'s
UTC day-key bucketing — is deliberate, since `weight_logs.measured_at` is always stored at
synthetic UTC-midnight of the chosen IST date).

**Finding 1 — `computeWeightTrend` may silently discard every real weigh-in (P0, needs
runtime confirmation).** `lib/weightTrend.ts:38-44` guards with `Number.isFinite(w.weight_kg)`,
which does **not** coerce strings (`Number.isFinite("74.4")` is `false`). Postgres `numeric`
columns are serialized as JSON strings by PostgREST — `lib/formatWeight.ts`'s own docstring
confirms this is a known fact of this exact column ("Rendering that raw put a wall of zeros
across the Trends stat card"), and `WeightHero.tsx`/`WeightStats.tsx` both explicitly
`Number(...)`-coerce for this reason. `computeWeightTrend`'s three call sites
(`ProgressClient.tsx:86-89`, `app/dashboard/page.tsx:132-133`, `app/api/paywall/projection/route.ts:54-55`)
all pass the raw, uncoerced row. If confirmed, **every real user's smoothed trend line, "kg
a week" sentence, and projected-date sentence never render — only in tests**, whose fixtures
all construct `weight_kg` as a real JS number, never the string PostgREST actually sends.
This is the single highest-priority runtime check in this entire baseline — see
`EXPLORATORY-QA-REPORT.md` and `BLOCKED-MANUAL-TESTS.md`.

**Finding 2 (P1)** — backdating a weigh-in ≥0.5kg different from the current recorded weight
silently overwrites `profiles.current_weight_kg` and recomputes calorie/macro targets from
that historical value, with no check that the backdated date is actually the most recent
entry (`app/api/weight/add/route.ts:60-95`).

**Finding 3 (P1)** — `/weight`'s "🎯 On track" banner (`WeightClient.tsx:142-147`) uses the
naive, direction-agnostic `lib/projection.ts` rather than the honest `lib/goalProjection.ts`
gate that `/dashboard` and `/api/paywall/projection` both use specifically to avoid this exact
false-confidence failure mode — on the one page whose entire job is showing the truth about
real weigh-ins.

**Finding 4 (P2)** — `goal:'maintain'` shares `'gain'`'s progress-bar/delta-colour direction
logic in both `WeightHero.tsx` and `WeightStats.tsx`; a maintain-goal user whose target is
below their current weight sees gaining rendered as "good."

**Finding 5 (P2, confirm intent)** — exercise calories are logged and displayed but never
factor into deficit or TDEE math anywhere in `lib/`. Plausibly deliberate (avoids the
"eat back your exercise calories" trap) but undocumented as such.

## Settings / Profile / Billing / Subscriptions (SET-*, BILL-*)

| ID | Feature | Risk | Status highlight |
|---|---|---|---|
| SET-01–12 | Profile edit+TDEE recompute, quick-kcal edit, body-focus selector, custom targets toggle, appearance, reminders, analytics opt-out, CSV export, delete account, sign out, recipes link, subscription row | P1–P3 | CSV export confirmed correctly free/unwindowed (fixes a prior regression). Delete-account route is the most defensively written route in this domain. |
| BILL-01 | Razorpay subscription creation | P1 | No route test for invalid-plan/missing-env paths |
| BILL-02 | Razorpay payment verify (optimistic) | P1 | Signature verified server-side before any write |
| BILL-03 | Razorpay webhook (authoritative) | P1 | `refund.created` handling is a known-open TODO in the route itself |
| BILL-04 | Razorpay cancel (DIY, no hosted portal) | P1 | — |
| BILL-05 | Google Play purchase (Digital Goods API) | P1 | — |
| BILL-06 | Google Play verify route | P1 | Correctly blocks one token entitling two accounts (409) |
| BILL-07 | Play RTDN (Pub/Sub push) | P1 | — |
| BILL-08 | Manage → Google Play | P2 | — |
| BILL-09 | Manage → Stripe Portal (legacy) | P2 | — |
| BILL-10 | Stripe webhook (legacy, frozen) | P2 | — |
| BILL-11 | `isProStatus` — single provider-agnostic gate | **P0** | **Confirmed solid** — `subscriptions` RLS lockdown (044) holds, no write policy exists |
| BILL-12 | `getIsPro`/`getSubscription` (fail-loud) | P1 | Confirmed throws `SubscriptionReadError` rather than silently deciding "free" |
| BILL-13 | `/upgrade` entitlement-aware paywall | P2 | — |
| BILL-14 | AI-trial email-verification gate on checkout | P2 | Play is correctly exempt (no email requirement) |

**New finding (§3.7 of the settings-billing fragment):** Play's `SUBSCRIPTION_STATE_IN_GRACE_PERIOD`
maps to `{status:'past_due', entitled:true}` at the provider level, but the shared
`isProStatus` gate only allows `active`/`trialing` — so a Play subscriber in grace period
(payment method needs updating, Play hasn't cut them off yet) reads as **not Pro** through
every one of the ~20 surfaces that call `isProStatus`. Needs a product decision, not
asserted as a bug outright.

**Confirmed still open** (both from CLAUDE.md and independently re-verified): F5
(`saved_meal_items` unbounded), F7 (Razorpay SDK has no request timeout), "Founder pricing"
copy with no enforcement mechanism.

## Growth & Retention Mechanics (GROW-*)

| ID | Feature | Risk | Status highlight |
|---|---|---|---|
| GROW-01 | Daily streak + auto-freezes | P1 (core loop) | Freezes confirmed never paywalled |
| GROW-02 | Streak Rescue (Pro) | **P1** | 4 of 5 negative-path branches (403/409×2/500/23505-retry) have **zero route-level test** |
| GROW-03 | Streak Restart card (comeback) | P3 | No dismiss button, by design |
| GROW-04 | Streak analytics events | P2 | — |
| GROW-05 | Badges (10, hard-capped) + next-badge nudge | P3 | Earned on best-ever streak, never current — confirmed |
| GROW-06 | Log Milestones overlay | **P1** | Most interaction-heavy overlay in the app, **zero DOM-level test** |
| GROW-07 | Dashboard Moments picker | P2 | Pure logic correct; wiring itself unpinned |
| GROW-08 | Story engine (shared: welcome/wrapped/onboarding-plan) | **P1** | **Zero automated test coverage of any kind** — the most-reused, most motion-heavy surface in the growth stack |
| GROW-09 | `/welcome` Pro sequence | P2 | 0/NaN/undefined guards all confirmed correct incl. day-one-upgrader path |
| GROW-10 | `/wrapped` Monthly recap | P2 | Redirect-to-dashboard-when-no-wrap is correct, not a bug |
| GROW-11 | `/studio` design room | P3 | Deliberately public, `noindex` |
| GROW-12 | Meal suggestion row | P2 | Ordered-read rule (P2-2 fix) confirmed holding |
| GROW-13 | Share cards (stat + day) | P2 | Cancelled share sheet correctly produces no toast |
| GROW-14 | Push budget | P1 | **Confirmed clean** — no bypass of `sendBudgetedPush` found anywhere |
| GROW-15 | Reminder schedule | P2 | — |
| GROW-16 | Cron batching (both crons) | **P1** | `push-reminders` lacks the route-level test its sibling `weekly-recap` has |
| GROW-17 | `push_sends.opened_at` stamping | **P1** | Confirmed correct wiring, but **zero test** on a mechanism that has already regressed once in production history |

## PWA / Service Worker / Manifest / Analytics / Infra (PWA-*, ANA-*, INFRA-*)

| ID | Feature | Risk | Status highlight |
|---|---|---|---|
| PWA-01 | Web App Manifest | P2 | — |
| PWA-02 | Custom Service Worker (push + click) | **P1** | Hand-verified only, no test |
| PWA-03 | `next-pwa` build wiring + `runtimeCaching` overrides | **P1** | **NEW BUG FOUND (this session, OBSERVED on production)** — see below |
| PWA-04 | A2HS install prompt | P2 | `shouldShowA2hs` correctly guarantees a live native prompt reference |
| PWA-05 | Manifest shortcuts (long-press quick actions) | P2 | — |
| PWA-06 | TWA Android wrapper identity | **P1** | Root `twa-manifest.json` shortcuts are `[]` vs. web manifest's 3 — needs a device check |
| ANA-01 | PostHog client analytics | P1 | opt-out has no regression test |
| ANA-02 | PostHog server analytics (core funnel) | P1 | **~30 call sites use bare string literals instead of `EVENTS.KEY`** — a documented, still-growing violation of a hard rule |
| ANA-03 | Frozen analytics event catalog | P2 | Every declared event has a live emit site — the "declared but never emitted" failure mode does not currently apply |
| INFRA-01 | Sentry runtime error capture | P2 | **No client-side (browser) error capture exists at all** — narrower than CLAUDE.md's phrasing implies |
| INFRA-02 | `robots.ts` | P2 | — |
| INFRA-03 | `sitemap.ts` (build-time food URLs) | **P1** | **`error` dropped on admin-client read — see F-2, security report** |
| INFRA-04 | Public food SEO pages | **P1** | Same F-2 gap in `generateStaticParams` |
| INFRA-05 | Middleware public/protected boundary | P3 | Best-tested surface in the domain — 10-entry `isPublic` list confirmed exact |
| INFRA-06 | Digital Asset Links (`assetlinks.json`) | P1 if it drifts | No CI check that fingerprints match the live signing cert |
| INFRA-07 | Vercel cron budget (2, Hobby cap) | P3 | — |

### NEW — production bug found by hands-on testing this session (not in any prior audit)

**`middleware.ts:144`'s matcher excludes `sw\.js` and `workbox-.*` but not `worker-*.js` or
`swe-worker-*.js`** — the two other generated PWA worker chunks Workbox's own precache
manifest lists. For any **signed-out** visitor (the landing page, before signup — the exact
moment install-prompt eligibility is evaluated), a request for either file is redirected to
`/auth/sign-in`, which returns HTTP 200 `text/html`. The browser then throws
`Uncaught SyntaxError: Unexpected token '<'` trying to evaluate/precache that HTML as
JavaScript. **OBSERVED on production (`https://www.getinshape.co.in`)**, reproduced on
every anonymous page load (landing, sign-up, sign-in, forgot-password, privacy, terms,
refunds, contact, studio — 14 console errors across 6 navigations in one test session).
Confirmed via `fetch()`: `GET /worker-c7757db72d48d643.js` → 200 `text/html`, final URL
`/auth/sign-in?returnTo=%2Fworker-...js`; same for `swe-worker-<hash>.js`. Root cause
isolated to the middleware matcher regex missing these two filename patterns. See
`EXPLORATORY-QA-REPORT.md` for full repro and `RISK-REGISTER.md` for severity reasoning.

## Security / RLS / API Authorization (cross-cutting)

Full route-by-route table (48/48 `app/api/**` routes) and migration table live in
`SECURITY-QA-REPORT.md`. Headline: no route found missing an auth check; no route found
missing a needed ownership check; no route found using the admin client without
justification. All past documented P0s (`foods` cascade-delete RLS, `subscriptions`
self-grant, camera `pcs` fallback, cross-user custom-food visibility, `?start=epoch`
history bypass) re-verified as still fixed. Three new, low-to-medium severity findings
(F-2 through F-4) — see the security report.

## Existing Test Suite (cross-cutting — see `QA-COVERAGE-MAP.md` and `EXPLORATORY-QA-REPORT.md`)

130 spec files, ~1,650 tests, all Vitest — **no browser/E2E automation exists anywhere in
this repo.** Every "proven" claim anywhere in this inventory is bounded by "a mocked-Supabase,
mocked-fetch, no-real-network Vitest run," never a real click in a real browser against a
real database. See the dedicated coverage-by-domain table in `QA-COVERAGE-MAP.md`.
