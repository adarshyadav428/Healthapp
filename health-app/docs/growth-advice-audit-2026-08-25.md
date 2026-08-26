# Growth Advice — book audit applied to GetInShape

**Written:** 2026-08-25
**Source:** `D:\Growth Advice - Book Analysis.docx` — an analytical reconstruction of Jake
Castillo's *Growth Advice*, an anthology of tactical playbooks on building, scaling and
monetizing consumer mobile apps.
**Method:** `docs/prompts/growth-advice-apply.md`. Three Explore agents mapped the app;
every claim below carries a `file:line`.
**Scope:** analysis only. **No code was changed.** The last section is a ranked backlog.

**The book's thesis:** AI has commoditized building software, so the only moats left are
**high-velocity distribution** (renting pre-established trust from influencers) and
**trust-signaling conversion** (credible design, long personalized onboarding, hard
paywalls). Software is the fulfilment mechanism for the marketing.

**The one-line answer for GetInShape:** the book is largely right about what to *do* and
almost entirely unactionable here, because GetInShape can measure *intent to pay* but not
*payment*, and *signups* but not *arrivals*. Fix those two and most of this document
becomes a set of experiments instead of a set of opinions.

---

## 1. Scorecard

| Chapter | Score | Verdict |
|---|---|---|
| **Ch1** — Build & scale consumer apps (distribution) | **1/10** | Zero attribution of any kind. You cannot run a single influencer campaign and know whether it worked. |
| **Ch2** — High-converting free trials | **5/10** | A 3-day Play trial, sitting at the bottom of the book's losing bucket. No web trial. **No trial event exists anywhere.** |
| **Ch3** — The $1M app design playbook | **8/10** | The app's strongest pillar by a distance. Real gaps are tap targets, unpoliced spacing, a missing OG image and colour drift. |
| **Ch4** — Paywall & onboarding | **3/10** | The paywall is absent from the funnel; `/upgrade` has no social proof; three contradictory free-vs-Pro lists ship simultaneously. |
| **Ch5** — Core scaling engine | **2/10** | No A/B capability anywhere. No win-back push — and the back-off rule *guarantees* a churning user goes permanently silent. |

Scores measure what the app **does**, not what it intends. Several low scores are
deliberate decisions defended in `CLAUDE.md`; those appear in §7 (*Contradicts*) and are
not treated as defects.

---

## 2. Chapter 1 — Distribution

> *"When scaling a consumer app to any level, distribution is the #1 bottleneck you'll
> encounter"* — and influencers are the channel, because you are buying trust. Key
> mechanics: the 20-Second Test (average views, comment conversations, personality —
> ignore follower counts), flat-rate pricing over CPM to capture viral upside, mid-tier
> creator arbitrage, the 3-to-5 niche test, minimal briefs.

### Verdict: no attribution capability exists

A scoped grep across `app/ components/ lib/ hooks/ supabase/ middleware.ts` for `utm_`,
`gclid`, `fbclid`, `referrer`, `campaign`, `install_source` and `acquisition` returns
**zero source hits**. The only matches in the repo are inside generated bundles
(`public/sw.js`, `public/workbox-*.js`) and `package-lock.json` integrity hashes.

| Surface | Finding |
|---|---|
| `middleware.ts:9-115` | Reads `pathname` only. Never touches `request.nextUrl.searchParams`. No cookie persists a landing parameter. |
| `app/page.tsx` | No `searchParams` prop, no `useSearchParams`. CTAs are plain `<Link href="/auth/sign-up">` — nothing is threaded through. |
| `app/auth/sign-up/page.tsx:24-51` | `identifyUser(id, { email })` — email is the **sole** person property. `signup_completed{method}` means auth provider, not channel. |
| `supabase/migrations/*` | `profiles` has **no** source, channel, referrer or campaign column. Every `ALTER TABLE profiles` since `001_initial.sql` is body metrics, `email`, `email_verified_at` or `reminder_hour`. |
| `app/api/razorpay/create-subscription/route.ts:34` | `notes: { user_id, plan }` is the entire metadata payload. |
| `app/api/play/verify/route.ts:79` | `upgrade_completed` fires with `{ provider, plan }`. No `obfuscatedAccountId`, no `developerPayload`, no Play Install Referrer read anywhere — the TWA wrapper at the repo root is not wired for it. |

`lib/posthog/client.ts:29-33` sets `person_profiles: 'identified_only'` with manual
pageviews. posthog-js still stamps `$referrer` and `$initial_utm_*` on captured events,
but nothing in this codebase reads or persists them, the anonymous→identified session is
never aliased, and they are not joinable against your own `subscriptions` table.

**Consequence:** you can see *that* someone paid and *which provider* took the money. You
cannot tell whether they arrived from Play organic search, a WhatsApp forward, a
`/foods/*` SEO page or a paid creator. This is the single largest gap in the document.

### The organic asset that exists, and what it's missing

`app/foods/[slug]/page.tsx` is genuine programmatic SEO and the only organic acquisition
asset in the app: `dynamicParams = false` (`:20`), `revalidate = 86400` (`:21`),
`generateStaticParams` (`:36-47`) enumerating every `source = 'ifct'` row. **Ceiling is
~400–450 pages** — note that `data/indian-foods.json`'s 643 rows are `source: 'curated'`
and generate **nothing**.

Two gaps on it:
- **No JSON-LD anywhere in `app/`.** No `application/ld+json`, no `schema.org`, no
  `NutritionInformation` block — on precisely the page type Google renders rich results
  for.
- Its "Start free" CTA (`:84-89`) carries **no source parameter**, so even the traffic it
  does convert is indistinguishable from direct.

### Sharing is not a growth loop

`lib/shareCard.ts` renders a 1080×1080 PNG, shared from two surfaces
(`components/progress/ShareProgressButton.tsx:37` and the streak-milestone celebration at
`components/milestones/LogMilestones.tsx:159`). The share text is
`'Tracking my food and weight with GetInShape 🔥 getinshape.co.in'` (`lib/shareCard.ts:452`)
and the image bakes a footer band reading the same domain (`:417`).

Both are **unlinked, untagged plaintext**. No `url` in the share payload, so on most
Android targets there is nothing clickable; no tracking parameter, so an arriving click
is indistinguishable from direct — and per the above, even a parameter would not be read.
`progress_card_shared` measures the outbound half only.

**There is no invite or referral mechanic.** A grep for `invite|referral|refer a friend`
across `app/ components/ lib/ supabase/` returns one file, matching on the substring
inside "reference".

### What this means for the book's tactics

The 20-Second Test, flat rates, mid-tier arbitrage and the 3-to-5 niche test are all
**operator** tactics that need no code — Adarsh can run them tomorrow. But every one of
them is a *measurement* claim underneath ("kill the bad channels faster than competitors
can"), and none is measurable here. **The code-side prerequisite for Chapter 1 is
attribution, not a creator pipeline.** Running flat-rate deals with five creators and no
way to tell which one worked is the expensive version of not doing it.

---

## 3. Chapter 2 — Free trials

> Trials of 17–32 days convert at **42.5%**; ≤4 days at **25.5%**; 12-month retention is
> identical. But long trials create an **attribution tax** — you cannot tell which
> campaign paid for the sale, so you cannot kill bad campaigns or recycle cash. The
> **Magic Moment Formula**: trial length = time to first proof + one repeat cycle + a
> small decision window.

**GetInShape runs a 3-day trial** — the bottom of the losing bucket. State the mitigating
fact honestly: 3 days is *Google's minimum allowed free-trial length*, chosen for that
reason and documented as such in `lib/pricing.ts`, not chosen against the data.

**It exists on one platform only.** The trial is a Play Console offer on both products;
Razorpay charges immediately, and `lib/pricing.ts` plus `app/upgrade/page.tsx:47-50`
correctly forbid promising a web trial because it would be a false claim. This is right
and must stay. But it means the two platforms are commercially different products, and
**no event distinguishes them** — there is no `platform` property on any event.

### The blocking fact

There is **no `trial_started`, `trial_converted`, `subscription_cancelled` or
`subscription_refunded` event in the 48-constant catalog.** `upgrade_completed` fires at
*purchase*, carrying only `{ provider, plan }`.

So: the app cannot compute trial→paid conversion, cannot compute revenue-per-install, and
**cannot measure the effect of changing trial length** — which is the entire content of
this chapter. Applying the book's best-evidenced finding is blocked on instrumentation,
not on a Play Console setting.

Applying the Magic Moment Formula to a calorie tracker gives: first proof = the first
successful log (minutes), one repeat cycle = one day, decision window = a day or two. The
formula argues for something in the 3–7 day range, which sits *against* the 17–32 day
data point. That tension is real and is exactly why it needs local measurement rather
than adopting one of the book's two numbers.

---

## 4. Chapter 3 — Design as a trust signal

> Users judge in ~50ms. "Vibe-coded" apps — AI defaults, purple gradients, Inter —
> instantly signal cheapness and destroy the trust needed to enter a card. Enforce tokens
> via a `design.md`: 1 font, 4px/8px spacing, ~8 semantic colours, zero hardcoded hex,
> 44pt tap targets, continuous border curves, tabular numerals on counters.

**This chapter describes work GetInShape has already done, and in several places done
better than prescribed.** Lead with that.

| Book rule | GetInShape | Status |
|---|---|---|
| Zero hardcoded hex | Guard-enforced; `scripts/check-tokens.mjs` fails the build | ✅ Exceeds — machine-held, not convention-held |
| Enforce a `design.md` | `docs/design-system.md` + `/studio` living reference | ✅ |
| Type scale discipline | Ten named steps, each owning its line-height and tracking; **0 violations** | ✅ Exceeds |
| Continuous border curves | `corner-shape: squircle` inside `@supports`, four radius steps | ✅ |
| Tabular numerals on counters | Present on all 8 major numeric surfaces (calorie hero, macros, streak, weight, BMI) | ✅ |
| No purple gradients | Kelp teal `--brand: #0E7C66`; no purple anywhere | ✅ |
| ~8 semantic colours | **28 colour tokens** (10 surface/ink, 11 accent, 3 semantic, 3 macro, 1 ring) | ⚠️ See §7 |
| 1 font | Inter + Inter Tight | ⚠️ See §7 |

### Real gaps, all cheap

**1. Twenty-two interactive controls under 44px.** The book's 44pt rule is violated most
severely by `p-1` + `h-3.5` row actions at **22px**:
`components/chat/ChatLogModal.tsx:97`, `components/log/ExerciseLogger.tsx:106`,
`components/log/TodayFoodLog.tsx:104`, `components/progress/DayDiary.tsx:159`. Modal
closes sit at 28–32px; the bottom-nav tab is ~40px
(`components/layout/BottomNav.tsx:31-34` — `w-[60px]`, icon `h-[23px]`, `gap-[3px]`, no
height class; the nav's own padding sits on the `<nav>`, not the `<Link>`).

The fix already exists in the codebase and is simply unused elsewhere:
`components/ui/button.tsx:23-28` solves this correctly with `after:-inset-y-1` and
`after:-inset-0.5` expanders, bringing every variant to a true 44px. It is the only
hit-area pattern in the repo.

**2. 116 arbitrary spacing values, unpoliced.** `h-[` ×47, `w-[` ×44, `px-[` ×13, `py-[`
×6, `p-[` ×4, `gap-[` ×2 across `app/` and `components/`. Worst offender
`components/settings/SettingsClient.tsx` (32 hits), then `ProgressClient.tsx` (11),
`FoodLanding.tsx` (10), `BottomNav.tsx` (9). Most-repeated values are `18px` ×46 and
`19px` ×18 — neither on any 4px or 8px grid.

The cause is structural: `scripts/check-tokens.mjs:76-116` has exactly **six** rules —
`hex`, `opacity`, `type-arbitrary`, `type-legacy`, `radius-arbitrary`, `tracking` —
and **none of them polices spacing**. `text-[` is at zero precisely because the guard
catches it; spacing is at 116 precisely because it doesn't. The book's rule maps onto a
seventh guard rule almost exactly.

**3. No OG or social image anywhere.** `app/layout.tsx:33-38` declares `openGraph` with
`type`, `title`, `description` and `siteName` but **no `images`**;
`app/foods/[slug]/page.tsx:60` likewise. No `opengraph-image.*` or `twitter-image.*` file
exists, no `og:image` string appears in the repo, and there is no `twitter` metadata
block. Every link shared to WhatsApp — the dominant sharing channel in this market —
renders as a blank card. On a chapter about 50ms judgments, this is the highest-leverage
item in the section.

**4. Colour drift in the identity files.** `app/manifest.ts:14-15`, `app/layout.tsx:46-49`
and the root `twa-manifest.json` all still carry Ember's `#F7F6F3` / `#0F0E0C`, while the
live `--canvas` is Kelp's `#F2F5F4` / `#0A0F0E`. All three files are whole-file
allowlisted in `scripts/check-tokens.mjs:44-48`, so nothing catches the divergence. The
splash screen and Android status bar are a different colour from the app they open.

**5. The highest-value page has no metadata.** `app/page.tsx`, `/privacy`, `/terms` and
`/upgrade` export none at all, inheriting the root layout's generic
`'GetInShape — Weight Loss & Calorie Tracker'` (`app/layout.tsx:21`). Exactly one file in
the app has `generateMetadata`: `app/foods/[slug]/page.tsx:49`.

---

## 5. Chapter 4 — Paywall & onboarding

> Friction is bad when someone is trying to **use** a product and an asset when they are
> deciding whether to **buy** it. Long, personalized onboarding forces investment and
> agitates the pain before the ask. Hard paywalls convert at **10.7%** vs freemium's
> **2.1%**. Build in funnel order: Paywall → Onboarding → Features → polish. Ask for the
> App Store rating mid-flow, after a wow moment but before the paywall.

**GetInShape does the opposite, deliberately, and documented why.** That conflict is the
subject of §7 and §8 and is not resolved here. What follows are the gaps that stand
regardless of which side is right.

### Where the paywall actually sits

Freemium, with the paywall **absent from the onboarding funnel entirely**. The chain is
sign-up → 4-step wizard → `/onboarding/plan` story → `/log`. `/upgrade` is never linked
from `app/onboarding/*`.

The only *proactive* paywall in the product is a one-time interstitial at the user's third
lifetime log — `LOG_PAYWALL_THRESHOLD = 3` (`lib/logMilestones.ts:26`), with the intent
stated at `:7-9`: it never blocks logging, it only guarantees every free user sees the
paywall once. Everything else is reactive: hit a gate, get redirected to
`/upgrade?reason=…`. There are 13 such entry points.

### Gaps that stand either way

**1. `/upgrade` has no social proof and no testimonials.** Structure is eyebrow →
headline `"Upgrade to Pro"` → sub `"Log freely. Get deeper insights when you're ready."`
→ soft scarcity (`"Founder pricing — lock in ₹1,999/year while we're new."`) → feature
list → two plan cards with a `Save 44%` badge on annual → CTA. No user count, no ratings,
no logos, no quotes.

**Pre-launch there is none to show, and it must not be invented.** The honest substitute
is *self*-proof, and the page already does it: `app/upgrade/page.tsx:229` renders
*"You're on track for {target} kg by ~{date} — see your full curve with Pro."* The 3rd-log
interstitial — the one deliberate ask in the whole product — does **not**, though the same
projection machinery is available there.

**2. Three contradictory free-vs-Pro lists ship simultaneously.** This is a correctness
bug, not a growth nicety, because CLAUDE.md makes the free-tier list a public claim:

| Surface | Says |
|---|---|
| `app/page.tsx:206-222` | Pro gets *"Full nutrition history (30+ days)"* |
| `app/upgrade/page.tsx:80-88` | Pro gets *"Full history — beyond the last 7 days"* (i.e. unlimited) |
| `app/pricing/page.tsx:23-30` | Pro gets *"Unlimited food logging, every day"* and *"Saved meals and one-tap repeat logging"* |

The first understates the real entitlement. **The third is actively false** — unlimited
logging and saved meals are free everywhere else in the code, and "unlimited food logging"
as a *Pro* feature directly contradicts the landing page's own "Free forever".

**Worse: this was reported and marked fixed, and it is not fixed.**
`docs/deep-dive-audit-2026-07-31.md:194` raised the landing-vs-`/upgrade` mismatch as
P2-8, and `:94` records it as **"Fixed — Landing now matches `/upgrade`."** As of today
`app/page.tsx:214` still reads *"Full nutrition history (30+ days)"* against
`app/upgrade/page.tsx:83`'s *"Full history — beyond the last 7 days"*. Either the fix
regressed or it was closed without landing. `/pricing` was never in scope of P2-8 at all
and is the worse of the two mismatches. **Nothing in the test suite pins these three lists
to each other**, which is why a closed finding could quietly come back.

**3. Two real bugs in the activation path**, found while mapping. Both belong to whoever
picks up this backlog:

- **`pace_kg_per_week` is never persisted.** `app/api/onboarding/route.ts:31` uses it to
  compute macros but the profile update at `:34-50` does not write it. The column defaults
  to `0.5` (`supabase/migrations/005_pace_and_extras.sql:6`), and `/onboarding/plan` reads
  it from the profile. So a user who picks 0.25 or 1.0 sees **one projected goal date in
  the wizard and a different one on the very next screen**.
- **Onboarding step 1 ejects new users onto the paywall.** Step 1 is the activation
  moment — "What did you eat recently?" with *Take a photo* and *Describe it*. Both call
  the AI routes. A brand-new account has `email_verified_at IS NULL`, so `checkAiTrial`
  returns `block: 'unverified'` and the client does
  `router.push('/upgrade?reason=verify_ai')` (`hooks/useCameraScan.ts:235`,
  `hooks/useChatLog.ts:97`) — **throwing the user out of the wizard onto the upgrade page
  mid-onboarding.** The activation-first step cannot activate anyone. (Barcode is
  unaffected; it resolves via `onFoodFound` without Gemini.)
- Related instrumentation flaw: **"Skip for now" fires the same
  `onboarding_step_completed{step:1}` as a real log** (`OnboardingForm.tsx:445-452`), so
  the activation-first design cannot report its own activation rate. The decision most
  worth defending is the one least measured.

**4. The mid-flow review ask.** The book wants a rating request during onboarding, after a
wow moment. GetInShape asks only at a 3-day streak, only inside the TWA, only on Home, and
`'rate'` is **9th of 10** in `DASHBOARD_MOMENTS` (`lib/dashboardMoments.ts:67`) — so it is
suppressed on any day a rescue, restart, plateau, adaptive-target, goal-projection,
weekly-recap, verify-email or notification-prime card is eligible. See §7: the app's rule
here is the better one.

---

## 6. Chapter 5 — Scaling engine

> Build for the 95% basic user, ignore the 5% power user (Planet Fitness is 90%
> treadmills). Run high-volume ad tests to buy data. Taste is not a moat; implementation
> speed is — you win by testing, killing and scaling channels faster than competitors.

**There is no A/B or feature-flag capability of any kind.** Greps for `getFeatureFlag`,
`featureFlag`, `isFeatureEnabled` and `onFeatureFlags` return **zero hits**.
`posthog.init` (`lib/posthog/client.ts:29-33`) passes no `bootstrap` and registers no
callback. There is no flag table, no env-driven variant switch, no server-side assignment.
**Every user sees identical copy, pricing and gating.** The chapter's entire operating
model — buy data, kill fast — has no mechanism here.

**No lifecycle push covers any monetization or win-back moment.**
`lib/pushBudget.ts:18-29` has four rungs — `streak-save` > `monthly-wrapped` >
`weekly-recap` > `daily-reminder` — one push per user per day (`:39`), backing off after
5 ignored (`:46`). Nothing exists for signed-up-never-logged, onboarding-abandoned,
paywall-abandoner or trial-ending.

Churn is worse than uncovered — it is **actively suppressed**. A 7-day-absent user has
`streak = 0`, so they fail the `streak >= 3` test for `streak-save` and can only ever
receive `daily-reminder`; after 5 unopened pushes `IGNORED_BEFORE_BACKOFF` cuts that rung
too. **The back-off guarantees a churning user goes permanently silent.** Note the hard
constraint on any fix: a third Vercel cron is forbidden, so a win-back rung must ride
inside an existing run.

On "build for the 95%": worth a future look, but not a finding today. The app has ten
dashboard moments, badges, Wrapped, stories, deficit, plateau and adaptive targets — and
`DASHBOARD_MOMENTS` exists precisely to stop them all firing at once, which is the book's
concern already answered structurally.

---

## 7. Contradicts — where the app disagrees on purpose

**These are not defects. Each is a documented decision, and each is presented with both
arguments at strength. The call is Adarsh's.**

### 7.1 Onboarding length — the head-on collision

- **Book:** long, personalized onboarding for high-pain apps. Its canonical example of a
  high-pain app is *literally weight loss*. Adding steps forces investment and agitates
  the pain before the ask.
- **App:** cut 6 steps → 4 on purpose. `hooks/useOnboardingDraft.ts:5-7`: *"Was six — each
  extra screen is a place to drop out, and 'What should we call you?' alone did not earn
  one."*
- **In the app's favour:** it already delivers what the book says long onboarding is *for*
  — three separate personalization payoffs (a live TDEE card in step 4, a 900ms "Building
  your plan…" transition, then a 5-card `/onboarding/plan` story ending on *"Start with
  one meal."*). The book's mechanism is *perceived personalized value*, not *step count*,
  and GetInShape buys the mechanism without paying the drop-off.
- **In the book's favour:** the 6→4 cut was made on reasoning, not on measured drop-off —
  and per §5 the one step it added instead (the activation log) currently cannot report
  its own success rate, and 403s for every genuinely new user.
- **What would settle it:** step-level drop-off from
  `onboarding_step_completed{step,label}`, once `skipped` is added to step 1.

### 7.2 Freemium vs hard paywall

- **Book:** 10.7% vs 2.1%, roughly 8× revenue per install by day 60.
- **App:** *"Free forever · No credit card"* is stated three times on the landing page
  (`app/page.tsx:57,177,179`) and CLAUDE.md makes it a public claim with a synchronization
  rule.
- **Population mismatch:** the 10.7% is a US consumer-app aggregate. GetInShape is
  India-only at ₹299/mo with no brand and zero reviews.
- **This one is answered as a measurement problem in §8, not decided here.**

### 7.3 Inter is a "vibe-coded" tell

- **Book:** names Inter — alongside purple gradients — as the instant signal of an
  AI-default app.
- **App:** ships Inter (body) + Inter Tight (display) as a deliberate two-optical-size
  choice, documented in `docs/design-system.md`, with restrained weights and a considered
  ten-step scale.
- **Assessment:** the book is identifying *defaults*, not the typeface. Inter chosen and
  paired at two optical sizes is the opposite of Inter left switched on. **No change
  recommended.** Worth noting the book would also count the 28 colour tokens against the
  "~8 semantic colours" rule — but those 28 are structured (10 surface/ink, 11 accent, 3
  semantic, 3 macro, 1 ring) and guard-enforced, which is the outcome the rule of 8 is a
  proxy for.

### 7.4 The mid-flow rating ask

- **Book:** ask during onboarding, after a wow moment, before the paywall — it
  artificially boosts social proof.
- **App:** `lib/dashboardMoments.ts:31-35` — *"1. things that repair or explain the user's
  own data; 2. things that unlock a capability they already have; 3. things that only ask.
  A pure growth ask never outranks a broken streak."*
- **Assessment:** the app's rule is better and should stay. It is also worth naming
  plainly that the book's framing here — *artificially* boosting social proof by timing
  the ask to catch users before they have formed a real opinion — is a manipulation of a
  public rating signal, not just a growth tactic. **Not adopted.** There is a legitimate
  narrower version: `'rate'` currently never fires for web or iOS-PWA users at all
  (`isPlayBillingAvailable()` gate), which is a coverage question worth separating from
  the timing question.

---

## 8. The hard-paywall question, answered as measurement

The stance taken here: **do not pick a side from the book's US numbers. Establish what it
would take to answer this with GetInShape's own data.**

### The experiment is not reachable today

Two-proportion z-test, α = 0.05, power = 0.80, randomizing on the **new user**, not the
paywall viewer — a hard paywall changes *who becomes a user at all*, so conditioning the
denominator on "reached the paywall" bakes the treatment into the denominator.

| Scenario | Lift | n / arm | @5 signups/day | @20/day |
|---|---|---|---|---|
| A. The book's claim | 2.1% → 10.7% | ~130 | ~1.7 months | ~2 weeks |
| B. Doubling | 3.0% → 6.0% | ~750 | ~10 months | ~2.5 months |
| C. Realistic modest lift | 3.0% → 4.5% | ~2,520 | **~33 months** | ~8.5 months |
| D. D30 retention **guardrail** | 25% → 22% | ~3,140 | ~41 months | ~10 months |

**The assumed rate, stated openly:** 5 completed signups/day. That is already optimistic
for an unlaunched, zero-budget, India-only Play release — run through the book's *own*
benchmark of 5 downloads per 1,000 listing views, it implies roughly **1,600 store-listing
views every day, from day one**. There are zero today.

Three things the table understates: `upgrade_completed` fires at purchase, not realized
revenue, so add ~30 days after the last enrolled user before the primary metric is
trustworthy; **row D is the punchline** — you can show money went up long before you can
show the funnel wasn't damaged, so running row A and declaring victory means accepting the
book's retention claim on faith, which is exactly the claim a 260-user test cannot check;
and a solo owner peeking at a PostHog funnel daily with no sequential correction has a
false-positive rate well north of 30%.

**Verdict.** The only effect reachable in a sane window (row A) is so large that if it
were real you would see it without a randomized test. The effect actually worth planning
around (row C) is ~3 years of traffic away. Most decisively: **at this scale conversion is
not the binding constraint — installs are.** 10.7% of ~0 is ~0. The sequence is **traffic
→ activation → retention → monetization gate**, and the paywall question is fourth.

### Instrumentation gaps — the first group changes what is *askable*

| # | Gap | Where | Why |
|---|---|---|---|
| 1 | **Props on `app_opened`** — `platform`, `is_authenticated`, `is_pro`, `session_id`. It currently fires with **none** | `lib/posthog/client.ts:83` | Without a typed denominator the book's central 75% open-to-paywall benchmark is not computable at all |
| 2 | **`platform` as a `posthog.register()` super-property** | on init | Splits the trial-bearing TWA funnel from the no-trial web funnel across all 48 events with one line. Best effort-to-insight ratio on the list |
| 3 | **`trial_started` / `trial_converted` / `subscription_cancelled` / `subscription_refunded`** | Play RTDN + Razorpay webhooks | **The biggest hole.** The funnel ends at *purchase*. Revenue-per-install, LTV and any read of trial length all need these |
| 4 | **`variant` super-property** | see below | Without it no funnel is splittable, so no experiment is readable regardless of assignment mechanism |
| 5 | **First-touch UTM / referrer / Play Install Referrer** as person properties at identify | `middleware.ts` + `identifyUser()` | The cohort key. Revenue-per-install by channel is a better question at this stage than paywall shape |
| 6 | The four declared-but-never-emitted `PaywallSource` values — `wrapped`, `meal_suggestions`, `camera_scan_anonymous`, `chat_scan_anonymous` | `lib/posthog/events.ts:127-147` | Four blank regions on the map of which wall people hit. Exactly the "looks instrumented, answers nothing" failure CLAUDE.md warns about, one level down in the props |
| 7 | `days_since_signup` on `upgrade_completed` | the three verify routes | The axis the book's trial-length claim lives on |
| 8 | `paywall_dismissed{source}` | the interstitial and every gate | Turns each paywall from an impression counter into a two-outcome funnel |
| 9 | `skipped: boolean` on step-1 `onboarding_step_completed` | `hooks/useOnboardingDraft.ts:78` | Makes the activation-first design's effect visible instead of assumed |

Credit where due: the funnel **from `signup_completed` onward is genuinely well
instrumented** — 48 constants, every one with a live emit site, step-level onboarding
events, `first_food_logged{days_since_signup}`, and a clean
`paywall_viewed → upgrade_viewed → checkout_attempted → upgrade_completed` chain. The app
is blind *before* signup and *after* purchase, and sighted in between.

### Feature-flag design — one recommendation

**Middleware-set `gis_bkt` cookie + deterministic hash + PostHog super-property + env kill
switch.**

Middleware sets a first-party `gis_bkt` cookie (random UUID, ~1 year, `SameSite=Lax`,
readable by the client) on the first request that lacks one. A pure
`assignVariant(bucketId, experimentKey)` in a new `lib/experiments.ts` takes
`sha256(experimentKey + ':' + bucketId) % 100` against a declared split — salting by
experiment key keeps a second experiment independently randomized. The Server Component
reads the cookie synchronously and passes the resolved variant down as a prop; the client
never recomputes it. `posthog.register({ exp_… })` in `Providers` stamps it onto every
subsequent client event, making the **entire existing 48-event catalog splittable with one
line**; `captureServerEvent` must read the cookie and add it explicitly, since
super-properties are a client-SDK concept. Analyze on an `experiment_exposed` event, not
on assignment — at n in the hundreds, diluting with users who never reached the treated
screen can hide a real effect on its own.

**The key must be a cookie, not `user.id`** — a hard paywall acts on people *before they
are users*, so a `hash(user.id)` design cannot run this experiment at all.

**Rejected:** PostHog feature flags — async evaluation flickers on a Server-Component
shell, which is fatal for a paywall (seeing free content then having it swapped is worse
than either arm); avoiding flicker needs server-side bootstrap, adding third-party latency
to every render and a new SDK surface against 1,042 tests. **Rejected as assignment:** a
plain env var is a global switch, not a per-user split — but keep it as the **kill
switch**, so a bad arm dies in one Vercel env edit rather than a deploy. **No migration
needed**, deliberately: migrations here are hand-applied in the SQL editor, and a
mechanism requiring one is a mechanism that gets applied inconsistently.

**Trade-off, plainly:** the hash gives up runtime control — no reweighting, no targeting,
no killing one arm without a deploy, and analysis is hand-built PostHog funnels rather
than a ready-made dashboard. For a solo owner running at most one experiment at a time who
deploys in minutes, that cost is near zero; the flicker and third-party-latency costs of
flags are paid by every user on every render.

### The constraint that decides what the flag may be spent on

`app/page.tsx:57` says *"Free forever · No credit card"*, and CLAUDE.md makes it a public
claim. A hard-paywall arm violates that claim for the users inside it.

Varying the landing copy per bucket makes it worse — two contradictory public promises
live simultaneously, served by coin flip, with no way for a user to know which they got —
and drags `app/page.tsx` into the experiment. Grandfathering existing users doesn't help
either: the promise is made at the **page**, not the account, so the new user reading it is
still being promised free forever.

There is also a concrete external risk. Play requires store-listing monetization accuracy,
and a listing plus landing page reading "free forever" while half of installs hit a
mandatory wall is the shape of thing that draws a Deceptive Behavior review — on a release
that is **one click from production submission and already blocked on payment-provider
verification**. That is an unforced, self-inflicted launch delay.

**So: build the mechanism — it unblocks a dozen useful experiments — but "free forever" is
a product commitment, not an experiment parameter.** A commitment you A/B test was never a
commitment. Vary paywall **placement, timing, framing and price presentation** within it.

### Reversibility

- **Cheap** — `LOG_PAYWALL_THRESHOLD`; `/upgrade` copy, `REASON_COPY`, `FEATURES`, plan
  order and highlight; the `lib/planCards.ts` card set (cards are data); where reactive
  gates redirect; **adding** capability to Pro, which never revokes anything.
- **Sticky** — Play Console pricing (decreases propagate easily; increases need notice and
  often affirmative consent, and non-consenting subscribers are *cancelled*); the trial
  offer (anyone already inside one keeps it); store-listing metadata (review delay).
- **One-way doors** — **revoking free access from users who signed up under "Free
  forever"**: with zero reviews today, the first ~50 ratings set the listing's conversion
  for months, and a betrayed early cohort writes specific, credible, quotable 1-stars that
  no revert removes. **The claim itself**: remove "Free forever" and put it back and it no
  longer reads as a promise to anyone who noticed. **Redefining an existing `subscriptions`
  status** — `isProStatus` is exactly `'active' | 'trialing'`
  (`lib/subscription.ts:9-11`); *adding* a value is cheap, *repurposing* one is not,
  because historical rows already carry the old meaning and there is no CLI to backfill
  them safely. Note `trialing` already grants full Pro entitlement, so a hard-paywall arm
  collides with live entitlement logic rather than sitting beside it. **Restarting the
  payment-verification clock** mid-launch — the most concrete near-term cost, and the
  easiest to forget.

**Everything about *where and how* you ask for money is cheap and reversible. Everything
about *whether the free tier exists* is not.** The book's recommendation sits entirely on
the expensive side of that line; every worthwhile intervention below sits entirely on the
cheap side.

---

## 9. Ranked backlog

Ordered by what unblocks what. Every item names the signal that would tell you it worked.

### Tier 1 — Measurement. Nothing below is readable without it.

| # | Item | Success signal |
|---|---|---|
| 1.1 | Props on `app_opened` + `platform` as a super-property (gaps 1–2) | Open-to-paywall rate becomes computable at all; TWA vs web splits on every event |
| 1.2 | `trial_started` / `trial_converted` / `subscription_cancelled` / `subscription_refunded` (gap 3) | `trial_converted / trial_started` exists as a number for the first time |
| 1.3 | First-touch attribution: UTM capture in middleware, a `profiles` source column, Play Install Referrer, tagged share links (gap 5) | `upgrade_completed` breaks down by channel; revenue-per-install by cohort |
| 1.4 | Emit the four dead `PaywallSource` values; add `paywall_dismissed{source}`; add `skipped` to step 1 (gaps 6, 8, 9) | Each paywall becomes a two-outcome funnel; step 1 reports its own activation rate |

### Tier 2 — Correctness, not growth. These are wrong today.

| # | Item | Success signal |
|---|---|---|
| 2.1 | Persist `pace_kg_per_week` in `app/api/onboarding/route.ts` | Wizard and `/onboarding/plan` show the same goal date |
| 2.2 | Fix step 1 ejecting unverified users to `/upgrade?reason=verify_ai` | `first_food_logged` within the onboarding session stops being ~0 for AI paths |
| 2.3 | Reconcile the three free-vs-Pro lists — `app/page.tsx`, `/pricing`, `/upgrade` — **and add a test pinning them to each other.** P2-8 was closed as fixed and is live again; without a test it will come back a third time | `npm test` fails if the three lists diverge |

### Tier 3 — Claim-safe conversion work. Captures most of the book's upside without touching the free tier.

| # | Item | Success signal |
|---|---|---|
| 3.1 | Give the 3rd-log interstitial *self*-proof (the user's own streak, logs, projected date — the machinery at `app/upgrade/page.tsx:229` already exists) and its own `PaywallSource`, separate from the overloaded `free_logs` | `paywall_viewed{source:'log_milestone'}` → `upgrade_viewed` CTR vs the current baseline; dismissal rate as guardrail |
| 3.2 | One price-reveal card in `lib/planCards.ts`, between `plan-goal-date` and `plan-go`. Nothing gated; CTA still goes to logging. **This measures its own cost for free** — the story engine already emits per-card `story_card_viewed` and `story_abandoned`. And it respects the onboarding doctrine: a story card is a swipe, not a wizard screen | `story_completed{surface:'onboarding_plan'}` flat **and** 24h `first_food_logged` flat **and** 7-day `upgrade_viewed` up. All three, or it didn't work |
| 3.3 | Lengthen the Play trial 3 → 14 days — **Play Console config, no deploy, no code, no store review**; keep `FREE_TRIAL_DAYS` and the `playNote` strings in sync. **Blocked on 1.2** — without trial events the effect is invisible | `trial_converted / trial_started` for the 14-day cohort vs 3-day; `subscription_cancelled` within 30 days as guardrail |
| 3.4 | Say the trial asymmetry out loud on web: *"Install the Android app and get the free trial."* Honest, and converts a hidden disadvantage into an install driver | Web → `a2hs_accepted` / Play install rate |

### Tier 4 — Ch3 cheap wins. Small, bounded, high trust-per-hour.

| # | Item | Success signal |
|---|---|---|
| 4.1 | An OG image + `app/page.tsx` metadata | Manual: a shared WhatsApp link renders a card |
| 4.2 | Apply the existing `after:-inset-*` hit-area pattern to the 22 sub-44px controls | Manual: 44px minimum on a real device |
| 4.3 | A seventh `check-tokens.mjs` rule for arbitrary spacing, then burn down the 116 | `npm run check:tokens` green with the rule on |
| 4.4 | Re-sync `app/manifest.ts`, `app/layout.tsx` and `twa-manifest.json` to the live Kelp canvas | Manual: splash and status bar match the app |
| 4.5 | JSON-LD `NutritionInformation` on `app/foods/[slug]` | Search Console rich-result impressions |

### Tier 5 — Deferred until the traffic exists

| # | Item |
|---|---|
| 5.1 | The flag mechanism from §8 — built, then spent on paywall **placement and framing**, never on the free tier |
| 5.2 | A win-back push rung for churned users, riding inside an existing cron run (a third is forbidden). Today the back-off guarantees permanent silence |
| 5.3 | Revisit the hard-paywall question **only** when ~750/arm is reachable within a quarter (row B), and only with the retention guardrail measurable locally rather than borrowed from a US aggregate |

---

## 10. What this audit did not do

- **No code was changed.** Not one file outside `docs/`.
- **The Contradicts findings in §7 are not decided.** Onboarding length, freemium, the
  Inter choice and the rating-ask priority are Adarsh's calls; both sides are written at
  strength.
- **Ch5's "build for the 95%"** was noted but not audited — a surface-count review of the
  ten dashboard moments and ten badges is a separate pass, and `DASHBOARD_MOMENTS` already
  answers the book's specific concern structurally.
- **The influencer operating tactics** (20-Second Test, flat rates, mid-tier arbitrage,
  3-to-5 niche test, minimal briefs) are recorded as-is and need no code. They are simply
  unmeasurable until Tier 1.3 lands.
- **Web2App** (the book's route around Apple's 30%) is largely moot here: the app already
  has both a web and a Play funnel, and Play takes 15% on the first $1M. The live
  asymmetry is the *trial*, not the cut — see 3.3 and 3.4.
