# Growth mechanics plan — porting proven mechanics into GetInShape

**Written:** 2026-07-29
**Origin:** Adarsh paid ₹299 for Pro and felt nothing change. This document is the deep
answer to that, framed through five "steal a mechanic from another category" ideas
(Duolingo / Spotify Wrapped / MyFitnessPal / Tinder / Fortnite) plus a "Purple Cow"
distinctiveness filter.

**Status:** **APPROVED 2026-07-29 — full scope, Groups A + B (§9).** Adarsh reviewed the
launch-timing risk in §11 (retention features built pre-launch, behaviour-dependent
designs built blind) and chose to build everything before launch anyway. §11 is retained
as recorded context, not as an open objection.

**Build order:** §9 Group A (phases 0–2), then Group B (phases 3–6). §13's operational
constraints become blocking work items rather than future concerns, because Group B now
ships pre-launch — see §13b in particular.

---

## 1. The finding that reframes everything

The instinct is "the app needs gamification." It doesn't. **It already has more
gamification than most apps in the category ship.** Verified in the codebase:

| Mechanic | Where it lives | State |
|---|---|---|
| Daily streak, IST-correct | `lib/streak.ts` | Built |
| Streak freezes (earned every 7 days, max 2, auto-spent) | `lib/streak.ts` | Built, **deliberately free** |
| Streak-save evening push (only at ≥3 days) | `app/api/cron/push-reminders/route.ts` | Built |
| 10 badges, hard-capped by doctrine | `lib/badges.ts`, `components/progress/BadgeShelf.tsx` | Built |
| Streak milestone celebrations (3/7/14/21/30/50/100) | `lib/logMilestones.ts` | Built |
| Whole-kg weight milestones | `lib/weightMilestone.ts` | Built |
| First-log confetti | `components/milestones/LogMilestones.tsx` | Built |
| 1080×1080 share card → WhatsApp/Instagram | `lib/shareCard.ts` | Built |
| Sunday AI weekly recap + push + Pro card | `lib/weeklyRecap.ts`, migration `024`, cron | Built |
| Per-meal coaching sentence | `lib/coaching.ts` | Built |

So why did paying feel like nothing? Two structural reasons, both visible in code:

### 1a. Pro is four things, and three of them are absences

Every `isProStatus` gate in the app:

| Gate | File | What Pro gives |
|---|---|---|
| AI photo scan | `app/api/camera/analyze/route.ts:91` | Removes the 3-scan lifetime cap |
| AI chat log | `app/api/chat/analyze/route.ts:33` | Removes the same cap |
| History > 7 days | `app/api/logs/route.ts:32`, `app/progress/page.tsx:87` | Removes a window |
| Custom foods | `app/api/foods/custom/route.ts:20` | Removes a block |
| Backdated exercise | `app/api/exercise/logs/route.ts:25` | Removes a block |
| Weekly recap card | `components/dashboard/WeeklyRecapCard.tsx:35` | **The only additive thing** |

Five of six Pro benefits are *walls being taken down*. A wall coming down is
invisible by definition — you only feel it the next time you would have hit it,
which may be days later. That is precisely the "I saw as before" experience.

### 1b. The emotional layer and the paid layer are two disconnected systems

The streak, badges, milestones, confetti, and share cards are **entirely free and
entirely unaware that Pro exists**. The paid layer is entirely utilitarian and has
no celebration attached to it. The app has a rich reward system and a paid tier,
and they never touch.

> **The thesis of this document:** don't add more mechanics. Connect the
> mechanics that exist to the money, give Pro at least one *object* and one
> *capability* rather than only absences, and build the one format the app is
> genuinely missing — the **story**.

---

## 2. What is actually missing (gap analysis)

1. **Sequence/story format.** Every celebratory surface is a single static card.
   Nothing in the app reveals information over time. Wrapped's power is format, not data.
2. **The post-purchase moment.** `useCheckout.ts:119` pushes `/dashboard?upgraded=true`
   and **nothing in the repo reads that param**. It is dead code. The entire reward
   for paying is a 2.5s toast.
3. **A Pro-exclusive object.** Nothing you *own* because you paid.
4. **A Pro-exclusive capability.** Nothing you can *do* that a free user cannot, except
   do more of what you could already do.
5. **A time-bound journey.** Streaks and badges are open-ended and infinite. Nothing in
   the app ever *ends*, so nothing ever climaxes — and a subscription decision is made
   at a specific moment (day ~28) that no in-app narrative is aimed at.
6. **Decision support.** The app records what you ate. It never helps you decide what to
   eat — which is the actual daily question, and the one thing users would pay for daily.
7. **Progress visibility on Home.** Badges live on Trends (`ProgressClient.tsx:252`), a tab
   users rarely open. Home shows no "what's next" at all.
8. **Any recap longer than a week.** Weekly exists. Monthly and annual do not — and those
   are the shareable ones.

---

## 3. Mechanic 1 — Duolingo (streaks / XP / levels)

### Verdict: mostly already done. Take one narrow piece. Refuse XP.

**Refuse XP and levels, permanently.** Two independent reasons:

1. `lib/badges.ts` opens with an explicit doctrine — ten badges, "a deliberate cap, not
   a starting point," because "the moment there are forty of them each one stops meaning
   anything." XP/levels is exactly the sprawl that doctrine rejects.
2. Duolingo needs XP because language learning has **no objective daily scoreboard**.
   GetInShape has one: the scale. Adding XP creates a *second* scoreboard that can
   contradict the real one — a user can hit "Level 7" in a week they gained 1.5 kg.
   A reward system that congratulates you during a regression destroys trust in every
   other number the app shows.

**Do take: Streak Rescue (Pro object).**

> ⚠️ Correction to an earlier verbal suggestion: I proposed "streak freeze as a Pro
> perk." That is wrong — freezes already exist and `lib/streak.ts` states they are
> "all free, never paywalled." Moving them behind the paywall would be taking a free
> feature away from users. Don't.

Rescue is a *different* mechanic from freeze:

| | Freeze (exists, free) | Rescue (proposed, Pro) |
|---|---|---|
| Timing | Prevents a break, automatically | Repairs a break, after the fact |
| Earned | Every 7 logged days | 1 per month with Pro |
| Feel | Safety net you didn't notice | Object you chose to spend |

**Architectural note (important):** `calculateStreakState` is beautifully stateless —
it derives everything from log history, so "there is nothing to migrate, drift, or
repair." A rescue requires stored state. **Preserve the purity** by passing rescued
dates *into* the function as a second argument, exactly as logs are passed in now.
The function stays pure and testable; only the caller reads the new table.

- Schema: `streak_rescues (id, user_id, rescued_date, created_at, unique(user_id, rescued_date))`
- Signature: `calculateStreakState(logs, rescuedDates = [])`
- UI: on Home, when a streak broke in the last 3 days and the user is Pro →
  "Your 14-day streak broke on Tuesday. Rescue it?" (1 available this month)
- Effort: **~0.5 day**

**Also take: "next milestone" line on Home.** Badges and milestones are invisible where
people actually are. One line under the streak — "3 days to Fortnight 🏅" — costs
almost nothing and makes the existing badge system do work it currently doesn't.
Effort: **~2 hours**, pure reuse of `lib/badges.ts`.

---

## 4. Mechanic 2 — Spotify Wrapped (shareable personal stats)

### Verdict: the strongest port. Build the engine once, use it four times.

The missing thing is a **story engine**: full-screen cards, one stat each, tap or
auto-advance, big numerals, deliberately loud. Build it as `components/story/`, generic
over a `StoryCard[]`, and it pays for itself immediately across four surfaces:

| Surface | Trigger | Tier |
|---|---|---|
| **Pro welcome** | Right after entitlement is granted | The fix for the stated problem |
| **Weekly recap** | Sunday card → "View your week" | Pro (card already exists) |
| **Monthly Wrapped** | 1st of month, cron + push | Free gets 1 card, Pro gets all |
| **Season wrap** | End of a season (§7) | Both |

### 4a. Richer stat vocabulary — `lib/wrappedStats.ts`

Today's recap is three numbers (`daysLogged`, `avgKcal`, `weightDeltaKg`). That is a
report, not a story. Every stat below is computable from tables that already exist:

| Stat | Source | Why it lands |
|---|---|---|
| Most-logged dish + count | `food_logs` ⋈ `foods` | "Dal Tadka × 27" is funny and specific |
| Total meals logged | `food_logs` | Volume feels earned |
| Longest streak this period | `lib/streak.ts` | Already computed |
| Days you hit protein | `food_logs` vs `lib/tdee.ts` targets | The habit that actually matters |
| Weight change | `weight_logs` | The real scoreboard |
| Best day | max protein / closest to target | A hero moment |
| AI scans used | `camera_photo_logs` + `chat_logs` | Demonstrates Pro value concretely |
| Home vs restaurant split | needs §6 tags | Insight, not just trivia |

The Indian specificity is the entire differentiator. "412 meals" is a number.
"You ate 63 rotis this month" is a screenshot.

### 4b. Redesign the share card as a **thali** (the Purple Cow)

`lib/shareCard.ts` already renders 1080×1080 to canvas and hands off to the Web Share
API with a download fallback — the plumbing is done, and `buildShareCardData` is pure
and tested. Only the *drawing* changes.

A round steel thali, compartments sized by macro, is:
- instantly recognisable to every Indian user
- a **shape**, not a colour — survives light/dark, no token conflict
- unowned in this category — every competitor ships a rectangle with a number
- reusable as the visual signature: share card, season wrap, monthly Wrapped

This is the answer to the "must look unlike anything else on screen" filter.

- Effort: story engine **~1.5 days**, stats **~0.5 day**, thali redesign **~1 day**

### 4c. The Pro welcome sequence (replaces the dead param)

Route `/welcome`, guarded so it only renders for a genuinely-new entitlement.

| # | Card | Mechanic |
|---|---|---|
| 1 | **"You're Pro."** Full-bleed ember, motion | The moment |
| 2 | **Your story so far** — days, meals, top dish, kg | Wrapped |
| 3 | **What unlocked** — the "0 of 3 scans left" counter visibly becoming ∞ | Reverse loss aversion |
| 4 | **Streak Rescue ×1** — an object handed over | §3 |
| 5 | **CTA** → camera scan (or "Start your season" once §7 ships) | Journey |
| 6 | **Share card** (thali) | Distribution |

**Two edge cases that will otherwise ruin it:**

1. **Day-one upgrader has no story.** Card 2 collapses into a sad empty card at the
   single worst moment. Needs a "Day one — here's what's ahead" variant.
2. **Play Billing has a 3-day trial; Razorpay does not.** The trigger must be
   *entitlement granted* (`status` becomes `active` **or** `trialing`), not "payment
   captured" — otherwise TWA trial users never see it. Both `startPlayPurchase` and the
   Razorpay `handler` in `hooks/useCheckout.ts` must route here.

- Effort: **~1 day** on top of the engine

---

## 5. Mechanic 3 — MyFitnessPal (log behaviours, not just food)

### Verdict: no. This decision was already made and shipped.

Migration `019_drop_deprecated_tables.sql` dropped `water_logs`, `sleep_logs`,
`fasting_sessions`, and `measurements_logs`. CLAUDE.md records: "Do not reference the
dropped tables." Re-adding mood/habit tracking would re-bloat the app, re-create four
tables that were consciously deleted, and does nothing for the purchase moment.

**But there is one narrow, defensible version that is not the dropped-tables idea:**

**Meal context tags.** A single optional one-tap attribute on an existing food log —
`home` / `restaurant` / `travel` / `office`. Not a new tracker, not a new screen, not a
new table (one nullable column on `food_logs`). It pays for itself twice:

- **Wrapped:** "68% of your meals were home-cooked" — a genuinely shareable stat
- **Insight:** "Your restaurant days average +480 kcal" — actionable, and the kind of
  observation that justifies a subscription

- Effort: **~1 day** including the Wrapped/insight surfaces

---

## 6. Mechanic 4 — Tinder (swipe decisions)

### Verdict: yes — this is the missing Pro *capability*, and the highest-value new feature.

The app answers "what did I eat?" It has never answered **"what should I eat?"** — which
is the question a user actually has, every single day, usually at 8pm with 600 kcal left.

**Design:** a deck of dishes filtered to the user's *remaining* calories and protein gap,
weighted by meal time and their own logging history.

- Swipe right → log it
- Swipe left → never suggest again
- Swipe up → save to favourites

**What it reuses:** the `foods` table (~870 IFCT + curated rows with full macros),
`useDailyTotals` for the remaining gap, `food_favourites`, `saved_meals`,
`lib/indian-portions.ts` for realistic serving sizes.

**Critical quality guard.** `curated` rows are *category-baseline estimates*, not
measurements (CLAUDE.md, hard constraint). Presenting an estimate as "this fits your
macros precisely" overclaims in a way search never does, because search shows the
📊 Estimated badge and the user chooses. **Reuse `SOURCE_RANK` from `lib/foodMatch.ts`**
so measured IFCT rows dominate the deck, and keep the badge visible on the card.

- New: `lib/mealSuggest.ts` (pure, unit-testable — matches the repo's routes-stay-thin doctrine)
- Schema: `food_dismissals (user_id, food_id, created_at)` — left swipes
- Tier: **3 suggestions/day free, unlimited + macro-gap precision for Pro.** Mirrors the
  AI-trial doctrine that already converts (a taste, then a wall).
- Effort: **~3–4 days**

---

## 7. Mechanic 5 — Fortnite (seasonal progression)

### Verdict: yes — the strongest retention play available, and the only mechanic that creates an ending.

Everything in the app is infinite. Streaks never conclude, badges sit there, weight goals
are months out. **Nothing ever climaxes** — so there is no narrative moment that lands on
the day a monthly subscriber decides whether to keep paying (~day 28).

A **30-day Season** fixes exactly that: defined start, defined end, one focus, a reward,
and a wrap story that fires *right when the renewal decision is being made*.

**Design:**
- One focus per season — e.g. *Protein Month* (hit protein 20 of 30 days),
  *Consistency* (log 25 of 30), *Home Kitchen* (20 home-cooked days — needs §5 tags)
- Progress bar on Home; a season page with the ladder
- Ends with a **season wrap story** (reuses the §4 engine — near-zero marginal cost)
- Earns a **season badge**

> ⚠️ **Season badges must be a separate collection from the 10.** `lib/badges.ts` caps
> the core set at ten permanently and explains why. Season badges are scarce-by-time
> (unavailable after the season ends, kept forever once earned) — a different contract.
> Adding them to `BadgeId` would break the doctrine the file is built on.

**The India angle is a genuine moat.** Seasons mapped to the real calendar — Navratri,
wedding season, New Year, peak summer — are culturally native in a way no US competitor
can copy, only localise badly.

- Schema: `seasons` (global, admin-authored) + `season_participants` (per-user progress)
- Tier: **free to join** (retention should not be paywalled); **Pro gets** the full wrap
  story, season history, and the ability to set a custom focus
- **Content risk:** this creates a treadmill — someone must author a season every month.
  Mitigate by authoring the first 6 upfront in a config file and generating the rest
  deterministically.
- Effort: **~4–5 days**

---

## 8. The tension this plan must not ignore

The "Purple Cow / element of surprise" filter and the Ember Air design direction point in
opposite directions. CLAUDE.md describes a deliberately **calm**, Cal-AI-inspired system:
accent narrowed to *data only*, ink for actions, flat `--shadow-air`, restrained type.
That calm is a competitive asset — it is why the app doesn't look like the shouty
category average.

**Resolution — a rule to apply throughout:**

> **Loud at moments, calm in rooms.**
> Welcome, milestones, wraps, season endings, share cards → deliberately break the
> restraint. Full-bleed ember, motion, big numerals.
> Home, Food, Trends, Profile → unchanged. These are rooms you live in.

A moment is allowed to shout because you see it once. A room that shouts becomes
exhausting by week two. Every item in this plan is a moment, except the swipe deck and
the Home progress line — and both of those must obey the calm rules.

**Second honest caveat.** Celebration is not the deepest retention lever here. Logging is
*work*, and the real churn driver is fatigue, not insufficient excitement. Of everything
in this document, the **swipe deck (§6) is the only item that reduces the work** rather
than decorating it. If only one thing gets built after the welcome screen, that is the
one with the strongest case — even though seasons are the more fashionable answer.

---

## 9. Sequencing — split by what launch status justifies

> **Read §11 before using this table.** The app has not launched. That single fact
> reorders everything below.

### Group A — justified *before* launch (≈5 days)

Cheap, reversible, and improves a first impression you only get once.

| Phase | Scope | Effort | Why it survives the pre-launch filter |
|---|---|---|---|
| **0** | "Next milestone" line on Home + delete the dead `?upgraded=true` param | 2 h | Zero schema, pure reuse of `lib/badges.ts` |
| **1** | Story engine + `wrappedStats` + `/welcome` + thali share card | 3–4 d | Fixes the stated problem; the engine is reused 5× (§11a) |
| **2** | Streak Rescue (Pro object) | 0.5 d | First thing Pro ever *gives*; no behavioural data needed to design it |

### Group B — wait for real users (≈9–11 days)

Expensive, and you will design them **wrong** without seeing what people actually do.

| Phase | Scope | Effort | What it needs first |
|---|---|---|---|
| **3** | Monthly Wrapped | 1 d | Users with a month of history to wrap |
| **4** | Swipe deck (Pro capability) | 3–4 d | Real logging patterns to rank against |
| **5** | Seasons | 4–5 d | Knowing which focus people actually stick to |
| **6** | Meal context tags | 1 d | Do after Wrapped and Seasons exist to consume them |

**Total ≈ 13–16 days**, of which **only ~5 belong before launch**.

**Reorder Group B if:** the priority is *renewal* over *conversion* — then Seasons (5)
moves ahead of the swipe deck (4).

---

## 10. What this plan deliberately refuses

| Idea | Why refused |
|---|---|
| XP / levels | Creates a second scoreboard that can contradict the scale; violates the `badges.ts` anti-sprawl doctrine |
| More badges in the core 10 | The cap is doctrine, and it's correct |
| Paywalling streak freezes | They are free by explicit design; removing a free feature is a regression |
| Mood / sleep / water / habit logging | Already built, already dropped in migration `019` |
| Gamifying the four core tab screens | Ember Air calm is an asset; see §8 |

---

## 11. Launch-timing reality check ⚠️ *the most important section*

**The app has not launched.** The Play Console listing is unfinished, the Razorpay
production webhook is not configured, and the launch plan is still awaiting a go.
**There are approximately zero users.**

This plan proposes 13–16 days of *retention* machinery for users who do not yet exist.
That is the classic trap, and it has two distinct costs:

1. **Opportunity cost.** Every day spent on seasons is a day the app is not earning,
   not being installed, and not generating the feedback that would tell you whether
   seasons are even the right bet.
2. **Design risk.** Seasons and the swipe deck are *behaviour-dependent*. Which season
   focus people stick with, and which dishes they accept from a suggestion deck, are
   empirical questions. Building them blind means building them wrong, then rebuilding.

**But not everything here fails that filter.** Three things are genuinely justified now:

- **The welcome moment.** You get one first impression per user, and it is currently a
  2.5-second toast. Every user who buys before this is fixed has permanently had the bad
  version. This is not reversible after the fact.
- **The thali share card.** It is a *marketing* asset, not a retention asset. You want
  shares from user #1, not user #500.
- **Deleting the dead `?upgraded=true` param.** It is misleading code.

### 11a. The story engine's fifth surface — and the better pre-launch argument

The engine earns its keep even at zero users, because the biggest pre-launch funnel risk
is not conversion, it is **activation** — people who sign up and never log a meal.

A 5th surface: the **end of onboarding**. After `app/api/onboarding/route.ts` computes
TDEE and targets, the same story engine can deliver "Here's your plan" — your daily
calories, your macro split, your projected goal date (`lib/projection.ts` already
computes this, and `/upgrade` already uses it as a conversion teaser).

That turns Phase 1 from "a reward for the few who pay" into "the moment that converts a
signup into a logger." At current scale, that is worth more than everything in Group B
combined.

### 11b. Recommendation

**Build Group A (≈5 days). Launch. Then decide Group B with real data.**

If even 5 days feels like too much delay, see §17 for a 1-day version.

---

## 12. Measurement — and an honest caveat about it

The PostHog vocabulary already in the repo is good and consistent (`snake_case`,
`*_viewed` / `*_shown` / `*_completed`): `upgrade_viewed`, `paywall_viewed`,
`checkout_attempted`, `checkout_failed`, `upgrade_completed`, `first_log_celebration_shown`,
`streak_milestone_shown`, `weight_milestone_shown`, `weekly_recap_viewed`,
`progress_card_shared`, `ai_scan_completed`, `onboarding_completed`.

**Verified — no work needed:** all three providers fire `upgrade_completed` server-side
(`razorpay/verify/route.ts:60`, `play/verify/route.ts:79`, `stripe/webhook/route.ts:56`).
The conversion funnel is not blind. Do not re-investigate this.

**New events to add, matching the existing convention:**

| Event | Where | Properties |
|---|---|---|
| `welcome_story_shown` | `/welcome` mount | `provider`, `plan`, `hasHistory` |
| `welcome_card_viewed` | per card advance | `index`, `cardId` |
| `welcome_story_completed` | last card reached | `cardsViewed` |
| `welcome_cta_clicked` | final CTA | `destination` |
| `welcome_story_abandoned` | unmount before end | `lastIndex` |
| `wrapped_shared` | thali share | `surface` (`welcome`/`monthly`/`season`) |
| `streak_rescue_used` | rescue spent | `streakLength`, `daysSinceBreak` |
| `meal_suggestion_swiped` | swipe deck | `direction`, `source`, `kcalGap` |
| `season_joined` / `season_completed` | seasons | `seasonId`, `focus` |

### ⚠️ The caveat that matters more than the event list

**At launch scale, none of this is statistically measurable for months.** With fewer than
a few hundred users you cannot A/B test anything — the confidence intervals swallow every
effect you care about. Do not build an experimentation apparatus.

**The decision rule instead:** prefer changes that are *cheap and reversible*, and judge
them on qualitative feedback from your first ~50 users. Watch `welcome_story_abandoned`
for a blunt "is this too long" signal, and otherwise talk to people. Instrument now so the
data exists later; do not wait on it to decide.

---

## 13. Operational constraints found in the code

### 13a. Vercel cron limit — a hard blocker on Monthly Wrapped

`vercel.json` declares exactly **two** crons (`push-reminders` daily 15:00 UTC,
`weekly-recap` Sundays 13:30 UTC). The Hobby plan caps cron jobs at two. A third cron for
Monthly Wrapped would force a plan upgrade.

**Cheap fix, no plan change:** fold the monthly run into the **existing** `weekly-recap`
cron, which already runs every Sunday — add an "is this the first Sunday of the month?"
branch. Same schedule, no new entry in `vercel.json`.

### 13b. Cron scaling — an existing issue this plan must not worsen

Both crons loop **per user** with per-user queries inside the loop
(`push-reminders/route.ts` runs two queries per user; `weekly-recap/route.ts` makes a
Gemini call per user). At a few thousand users this exceeds the Vercel function timeout,
and the failure mode is silent — the loop just stops partway and nobody gets a push.

Not caused by this plan, but Monthly Wrapped would land directly on it.
**Before Group B ships:** chunk the work with a cursor and a bounded batch size, and make
the cron resumable rather than all-or-nothing.

### 13c. Gemini cost discipline

Weekly recap already calls `gemini-2.5-flash-lite` once per user per week. Monthly Wrapped
plus season wraps would multiply that against a ₹299 price point.

**Rule: AI-written text for Pro only.** `recapFallbackMessage` in `lib/weeklyRecap.ts`
already exists, is deterministic, tested, and reads warmly — it is the free-tier path and
it is genuinely good enough.

### 13d. Anonymous users

Migration `026_anonymous_users.sql` allows deferred signup: `auth.users` rows with a
**NULL email**. These users can log food but cannot buy (the `/upgrade` page requires email
verification before Razorpay checkout — `upgrade/page.tsx:139`).

Consequences to handle explicitly:
- `/welcome` never fires for them — fine, but the guard must not crash on a null email.
- Monthly Wrapped **will** match them (they have logs). Any cron touching email or
  personalisation must tolerate `email IS NULL` and a missing first name.

---

## 14. Design and platform constraints

- **`prefers-reduced-motion` is doctrine** (CLAUDE.md: "all gated behind
  `prefers-reduced-motion`"). The story engine is the most motion-heavy thing in the app
  and must degrade to instant transitions.
- **No auto-advance.** Tap to advance, always. Auto-advance is an accessibility failure
  and a comprehension failure — reading speed varies, and a stat that vanishes before it
  is read is worse than no stat.
- **Zero image downloads.** Indian users are data-cost sensitive and the app is a PWA.
  The story must be pure CSS + canvas — no Lottie, no video, no additional web fonts
  beyond the two already loaded (Inter / Inter Tight).
- **Server-render the stats.** `/welcome` must not depend on a client fetch that can hang
  on a flaky connection at the emotional peak of the product.
- **The thali palette is fixed, not tokenised.** `lib/shareCard.ts` already pins the
  Porcelain light palette with a written rationale — a share card is a brand asset and
  must render identically for dark-theme users. Keep the thali's colours in `lib/`
  (outside the `check-tokens` scan) for the same reason. Everything rendered *in-app*
  still uses tokens or `npm run check:tokens` fails.

---

## 15. Push budget — protect the notification permission

Currently up to 8 pushes/week (daily evening reminder + Sunday recap). This plan would add
monthly Wrapped and season deadline pushes.

**The risk is not annoyance, it is permission revocation.** An over-pushed Android user
disables notifications wholesale — which kills the *streak-save* push that already works
and is probably the single most effective retention mechanism currently shipping.

**Rules:**
- **Never more than one push per day**, across all sources. `push-reminders` already
  enforces one send per user per run; the new sources must join that budget rather than
  bypass it.
- **Priority when they collide:** streak-save > season deadline > monthly Wrapped >
  weekly recap.
- A user who has ignored *n* consecutive pushes should be backed off, not escalated.

---

## 16. Downgrade policy — decide now, not after the first cancellation

| Thing | On cancel / lapse |
|---|---|
| Season progress | **Persists.** Seasons are free to join; losing progress punishes the wrong behaviour |
| Season badge already earned | **Persists forever.** Earned is earned |
| Unspent Streak Rescue | **Expires** with the subscription. It is held, not earned |
| Past Wrapped stories | **Persist, read-only.** They are snapshots of the user's own history |
| Streak and freezes | Unaffected — free by design (`lib/streak.ts`) |

The rule underneath: **things you earned persist; things you merely hold expire.**

---

## 17. Testing obligations

Repo doctrine: routes stay thin so the logic is testable; 41 test files today; CLAUDE.md
requires `npm test` **and** `npm run check:tokens` before committing.

New pure modules that must ship with tests:

| Module | Must cover |
|---|---|
| `lib/wrappedStats.ts` | Empty history, single-day history, tie-breaking on most-logged dish |
| `lib/mealSuggest.ts` | Macro-gap filtering, `SOURCE_RANK` dominance, dismissal exclusion |
| Season progress calc | Partial progress, completion boundary, timezone edges (IST) |
| `calculateStreakState` | **Extend the existing test** for the new `rescuedDates` argument — including a rescue that does not apply |

The day-one-upgrader empty state (§4c) and `email IS NULL` (§13d) are the two cases most
likely to ship broken. Test them explicitly.

---

## 18. The 1-day version (if launch should come first)

If Group A's ~5 days is too much delay, this is the minimum that closes the original
complaint:

1. Delete the dead `?upgraded=true` param.
2. A **single static** `/welcome` screen — no story engine, no sequence: "You're Pro",
   the unlocked list, one CTA into the camera.
3. Fire it on **entitlement granted** (`active` *or* `trialing`) from both
   `startPlayPurchase` and the Razorpay handler in `hooks/useCheckout.ts`.

**≈1 day, and it captures most of the emotional value.** The story engine, the thali, and
the personalised stats can all be layered onto that same route afterwards without rework —
the route and the trigger are the load-bearing parts, and this version gets both right.

---

## 19. Build record — what actually shipped (2026-07-29)

All 13 work items complete on branch `growth-mechanics-2026-07-29`.
`594 tests` (52 files, +191), `tsc --noEmit` clean, ESLint clean, `check:tokens` clean.

| # | Item | Key files |
|---|---|---|
| 0 | Next-badge nudge on Home; dead `?upgraded=true` removed | `lib/badges.ts`, `components/dashboard/DashboardClient.tsx` |
| 1a | Stat vocabulary | `lib/wrappedStats.ts` |
| 1b | Story engine | `components/story/` |
| 1c | `/welcome` + entitlement trigger | `app/welcome/`, `lib/welcomeCards.ts`, `hooks/useCheckout.ts` |
| 1d | Thali share card | `lib/shareCard.ts` |
| 1e | Onboarding plan story | `app/onboarding/plan/`, `lib/planCards.ts` |
| 2 | Streak Rescue | `lib/streak.ts`, `lib/streakRescue.ts`, migration `028` |
| Ops | Chunked, deadline-aware crons | `lib/cronBatch.ts`, both cron routes |
| 3 | Monthly Wrapped | `lib/monthlyWrapped.ts`, `app/wrapped/`, migration `029` |
| 4 | Meal suggestion deck | `lib/mealSuggest.ts`, `components/log/MealSuggestDeck.tsx`, migration `030` |
| 5 | Seasons | `lib/seasons.ts`, `lib/seasonServer.ts`, migration `031` |
| 6 | Meal context tags | `lib/mealContext.ts`, migration `032` |
| X | Push budget | `lib/pushBudget.ts`, `lib/push/budgetedSend.ts`, migration `033` |

### Migrations to apply (028–033)

Live DB was verified at `027` on 2026-07-19. **Apply 028→033 in order before deploying.**
Nothing here is destructive: five `create table`s, one `alter table add column`.

### Downgrade policy, as implemented

The rule: **things you EARNED persist; things you HOLD expire.**

| Thing | On cancel | Enforced by |
|---|---|---|
| Unspent Streak Rescue | Expires | `app/api/streak/rescue` re-checks `isProStatus` at spend time |
| Season progress + badge | Persists | Seasons are free to join; `completed_at` is never cleared |
| Past monthly Wrapped | **Persists, fully readable** | `monthly_wraps.was_pro` — the wrap unlocks on whether the user was Pro *when it was written*, not now |
| Streak + freezes | Unaffected | Free by design (`lib/streak.ts`) |
| Meal context tags | Persist | Plain log data |

`was_pro` is the non-obvious one. Gating a past Wrapped on *current* status would
retroactively confiscate a record of the user's own month — which is exactly the kind
of thing that turns a cancellation into a grudge.

### Still open

- **Nothing is visually verified against a signed-in account.** Verification was
  type-checks, 594 unit tests, and DOM/computed-style checks on `/studio` (which now
  previews both the story engine and the thali card without an account). The
  authenticated surfaces — `/welcome`, `/wrapped`, `/onboarding/plan`, the deck, the
  season and rescue cards — have not been seen rendering with real data.
- **`vercel.json` still declares two crons**, as intended. Monthly Wrapped rides inside
  the Sunday recap run; do not add a third.
- **Seasons run out after January 2027.** Six are authored; add more before then.
