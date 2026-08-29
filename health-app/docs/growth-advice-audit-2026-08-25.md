# Growth Advice audit — applying Jake Castillo's playbook to GetInShape

Source: `Growth Advice` (Jake Castillo) — an anthology on building, scaling and monetizing consumer
mobile apps. Its central thesis: software is commoditized, so the only real moats are high-velocity
**distribution** (influencers) and trust-signaling **conversion** (credible design, long personalized
onboarding, hard paywalls). Produced by running `docs/prompts/growth-advice-apply.md` against the book
and this repo.

Deliverable scope: **this document and the prompt only. No code, migration, or component was changed.**
The backlog in §9 is ranked; building any of it is a separate future pass.

---

## 1. Scorecard

| Chapter | Score | One-line verdict |
|---|---|---|
| Ch1 — Distribution / influencers | **1/10** | Zero attribution of any kind. A campaign could run today and there would be no way to know if it worked. |
| Ch2 — Free trials | **5/10** | 3-day Play trial only, at the bottom of the book's own losing bucket — for a defensible reason. No web trial. No trial event exists to measure it with. |
| Ch3 — Design as trust signal | **8/10** | The app's strongest pillar by a wide margin. Real gaps are tap targets, spacing enforcement, and a missing OG image — not the visual language itself. |
| Ch4 — Paywall + onboarding | **3/10** | Paywall is nearly absent from the funnel; three copies of the free-vs-Pro feature list disagree with each other, one of them a regression of a bug closed a month ago. |
| Ch5 — Scaling engine | **2/10** | No A/B or feature-flag capability exists anywhere. No win-back push for a churning user — the notification back-off rule actively protects the wrong channel for them. |

---

## 2. Chapter 1 — Distribution

**Verdict: no attribution capability exists.** A grep across `app/`, `components/`, `lib/`, `hooks/`,
`supabase/`, and `middleware.ts` for `utm_`, `gclid`, `fbclid`, `referrer`, `campaign`, `install_source`
returns zero source hits.

- `middleware.ts` never reads `searchParams` and sets no landing cookie.
- `app/page.tsx` has no `searchParams` prop; every CTA is a plain `<Link href="/auth/sign-up">` with no
  source parameter.
- `app/auth/sign-up/page.tsx` calls `identifyUser(id, { email })` — email is the only person property
  set at signup. The `signup_completed{method}` event's `method` means auth provider, not acquisition
  channel.
- No `profiles` migration adds a source/channel/campaign column — every `ALTER TABLE profiles` in
  `supabase/migrations/` is body metrics, email, or `reminder_hour`.
- The purchase path carries nothing either: `app/api/razorpay/create-subscription/route.ts` sends
  `notes: { user_id, plan }`; the Play verify route emits `{ provider, plan }`. No
  `obfuscatedAccountId`, no Play Install Referrer read anywhere.
- The one organic asset the app has — programmatic `/foods/[slug]` pages (`dynamicParams = false`) —
  carries **no JSON-LD structured data** on exactly the page type Google renders rich results for, and
  its CTA carries no source param back into signup.
- The one share artifact, `lib/shareCard.ts`, puts the domain in the share **text** as unlinked,
  untagged plaintext. `progress_card_shared` measures the outbound half only — there's no way to know if
  a shared card ever brought anyone back.
- No invite or referral mechanic exists.

Frame it the way the book does: the 20-second creator test, flat-rate pricing, and mid-tier arbitrage
are all *operator* tactics that need no code at all. But every one of them is unmeasurable without
attribution (backlog item #12, §9) — so the code-side prerequisite for this whole chapter is not a
creator pipeline, it's the ability to tell where a signup came from.

**Classification: Absent.** Nothing in `CLAUDE.md` argues against attribution; it simply hasn't been
built yet.

---

## 3. Chapter 2 — Free trials

The book's most transferable, best-evidenced finding: trials of 17–32 days convert at 42.5% vs. ≤4 days
at 25.5%, with identical 12-month retention either way. That lands directly on GetInShape's offer — a
3-day trial, at the bottom of the book's losing bucket.

Worth stating honestly: the 3 days is **Google Play's stated minimum for a free trial**
(`lib/pricing.ts`), chosen for that reason — not chosen against this data, because nobody had this data
yet. Web correctly has no trial at all, since Razorpay charges immediately and a trial claim there would
be false.

**The blocking fact:** there is no `trial_started` or `trial_converted` event anywhere in the analytics
event catalog (`lib/posthog/events.ts`). A trial-length change is not just untried, it is currently
**unmeasurable** — the funnel has no instrument on the one variable the book's strongest data point is
about.

**Classification: Absent**, gated on instrumentation (backlog item #8, §9).

---

## 4. Chapter 3 — Design as a trust signal

Lead with what's already right, because it's the majority of the picture:

- Raw hex values are forbidden and mechanically enforced by `scripts/check-tokens.mjs`.
- The type scale has zero violations against its own guard.
- `tabular-nums` is applied to numeric surfaces across the app (calorie counters, macro rows, weight
  entries) so digits don't jitter — exactly the detail the book calls out as a normal summary would miss.
- `prefers-reduced-motion` is honoured.
- No purple-gradient, default-AI-styling tells.
- Colors, spacing, and radii are token-driven, not inline, everywhere the guard reaches.

One deliberate collision worth naming for §7: the book names **Inter** specifically as a "vibe-coded"
tell. GetInShape ships Inter + Inter Tight on purpose, as a documented two-optical-size pairing — this
is *Contradicts*, not *Absent*, and no change is warranted.

Real gaps, all cheap relative to the rest of the backlog:

- **Interactive controls under the book's 44px minimum.** Confirmed in `components/log/TodayFoodLog.tsx`
  (edit/delete/save/cancel/bookmark icon buttons at `h-3.5 w-3.5`, no padding to bring the tap target up
  to size) and `components/log/ExerciseLogger.tsx` (delete icon, same pattern). `components/ui/button.tsx`
  already solves this correctly elsewhere with an `after:-inset-*` hit-area expander — the pattern
  exists in the codebase, it's just not applied to these icon-only row actions.
- **`check-tokens.mjs` has no rule for arbitrary spacing values** (`h-[…]`, `w-[…]`, `px-[…]`, etc.) —
  only color, font, and radius are policed. The book's "4px/8px scale, zero hardcoded values" rule maps
  onto a guard rule that doesn't exist yet.
- **No OG/social image.** `app/layout.tsx`'s `openGraph` block sets `type`, `title`, `description`, and
  `siteName` but no `images`; no `opengraph-image.*` file exists in `app/`. Every shared link — including
  the share cards the app already generates — renders with no preview image.
- `app/page.tsx`, `/privacy`, `/terms`, and `/upgrade` export no page-level `metadata`, so the
  highest-value page in the app inherits the generic root title instead of one written for it.

One claim from the prior draft of this audit did **not** survive verification and is cut per the
prompt's own rule (a claim with no live citation gets cut, not softened): a colour-drift finding between
`app/manifest.ts`/`app/layout.tsx` and `app/globals.css`. Checked directly — all three currently agree
on `#F7F6F3` (light) / `#0F0E0C` (dark). No drift exists today.

**Classification: mostly Confirms, with Absent gaps listed above.**

---

## 5. Chapter 4 — Paywall + onboarding

State the central conflict without resolving it here (resolution is §8): the book prescribes long
onboarding plus a hard paywall for exactly this app category — its own worked example is weight loss.
GetInShape deliberately cut onboarding from 6 steps to 4 and made "Free forever" a public claim on the
landing page. Both positions are reasoned; §8 is the measurement plan for adjudicating between them
honestly.

Findings that stand regardless of which side of that argument is right:

- **`/upgrade` has no social proof or testimonials** — and pre-launch, there is none to show truthfully.
  The honest substitute is *self*-proof: the page already renders a personalized projection ("You're on
  track for {target} kg by ~{date}"). The 3rd-log paywall interstitial (`LOG_PAYWALL_THRESHOLD = 3` in
  `lib/logMilestones.ts`) — the only *proactive* paywall surface in the app — does not carry the same
  projection, though the machinery to compute it is already available.
- **Three free-vs-Pro feature lists disagree with each other, and one disagreement is a regression.**
  `app/page.tsx` says "Full nutrition history (30+ days)"; `app/upgrade/page.tsx`'s feature list says
  "Full history — beyond the last 7 days" (i.e. unlimited); `app/pricing/page.tsx` lists items as Pro
  that are actually free everywhere else in the app. The `app/page.tsx` vs `/upgrade` mismatch was
  logged as **P2-8** in the prior audit (`docs/deep-dive-audit-2026-07-31.md`) and its status line reads
  **"Fixed — Landing now matches `/upgrade`."** It verifiably is not fixed today —
  `app/page.tsx` still reads "Full nutrition history (30+ days)" against `/upgrade`'s "beyond the last 7
  days." This is a regression of a previously-closed finding, not merely an unresolved one, and
  `/pricing`'s mismatch was never in scope of the original P2-8 at all. Given `CLAUDE.md` treats the
  free-tier promise as a public commitment, this is a correctness bug wearing a growth-audit disguise.
- **Two real bugs surfaced while mapping the funnel, both worth flagging to whoever picks up the
  backlog:**
  1. `pace_kg_per_week` is read from the onboarding payload and used to compute macro targets
     (`app/api/onboarding/route.ts`, passed into `calculateTDEE`) but is **never written back to
     `profiles`** — the `.update()` call in the same route omits the field entirely. The column's
     default (`0.5`) is silently what persists regardless of what the user picked, so a user who chose
     0.25 or 1.0 kg/week sees one projected goal date during the wizard and a different one immediately
     after, on `/onboarding/plan`, which reads the (wrong) stored value.
  2. Onboarding's AI-powered logging paths (photo scan, chat) call routes gated by a trial-eligibility
     check. A brand-new account is unverified, so that check 403s and the client redirects to
     `/upgrade?reason=verify_ai` — **ejecting the user out of the onboarding wizard onto the paywall
     mid-flow**, before they've reached the plan they signed up to see. The activation-first step of
     onboarding cannot activate anyone through those two paths (barcode scan is unaffected).
- **The rating ask, and how it actually differs from the book's prescription.** The book wants an
  App-Store-rating request mid-onboarding, after a "wow" moment and before the paywall, to manufacture
  early social proof. GetInShape's rating ask (`lib/ratePrompt.ts`, rendered by
  `components/dashboard/RatePromptCard.tsx`) fires on the dashboard, gated on a 3-day streak, only inside
  the installed Play build, with a 90-day cooldown — and it renders as its own card, **decoupled from**
  the separate `pickDashboardMoment` priority system that arbitrates between streak-rescue, streak-restart
  and plateau cards. So it isn't suppressed by those — it stacks below whichever one is showing. This is
  a genuine **Contradicts**: the book wants the ask early and pre-monetization to front-load trust before
  the sale; the app asks only once someone has already demonstrated three days of real usage. No change
  recommended — asking a brand-new, unproven user for a public rating during onboarding risks a worse
  rating than asking someone with a live streak.

**Classification: mixed — Absent (self-proof on the interstitial), a live correctness bug wearing a
growth-audit disguise (the three-list mismatch), two unrelated real bugs, and one Contradicts (rating
timing) where the app's position is the more defensible one.**

---

## 6. Chapter 5 — Scaling engine

**No A/B or feature-flag capability exists anywhere.** A grep for `getFeatureFlag`, `featureFlag`,
`isFeatureEnabled`, `onFeatureFlags` returns zero hits. This is the chapter that determines whether the
book's central claim (hard paywall over freemium) can even be tested — see §8.

**No lifecycle push exists** for signed-up-never-logged, onboarding-abandoned, paywall-abandoner, or
trial-ending users. The one push aimed at a churning user is actively working against itself:

- `lib/pushBudget.ts` orders notification kinds by importance —
  `streak-save > monthly-wrapped > weekly-recap > daily-reminder` — and after `IGNORED_BEFORE_BACKOFF`
  (5) consecutive unopened pushes, every kind except the single most important one (`streak-save`, index
  0) is cut off.
- `streak-save`'s own eligibility rule requires an active streak (there has to be something to save). A
  user who has actually gone quiet has `streak = 0` and was never eligible for `streak-save` in the
  first place — the backoff rule's exemption protects a channel that structurally cannot reach this
  user, while cutting `daily-reminder`, the one kind that could still reach them, at exactly the point
  they've gone silent enough to need it. **The mechanism designed to prevent losing the notification
  channel entirely is, for a genuinely churning user, the thing that closes it.**
- The hard constraint on any fix: the app is on Vercel's Hobby plan, capped at 2 cron jobs, both already
  in use (`docs/growth-mechanics-plan-2026-07-29.md`). A fix cannot be "add a third cron for win-back
  pushes" — it has to route through the two that exist.

**Classification: Absent** (feature flags, lifecycle push), with the back-off rule specifically flagged
as a design flaw rather than a missing feature — it exists, and it is actively wrong for this case.

---

## 7. Contradicts — argued both ways, not resolved in the book's favour by default

| Topic | Book's position | App's position | Verdict |
|---|---|---|---|
| Onboarding length | Long, personalized flows increase conversion for "high-pain" categories like weight loss, by forcing investment before the ask. | Cut from 6 steps to 4 deliberately — documented reasoning: "each extra screen is a place to drop out" (`hooks/useOnboardingDraft.ts`). | Not adopting the book's position. The app's reasoning is about a different, earlier failure mode (drop-off before signup even completes) than the book's (conversion once someone is already in). Worth testing once traffic exists (§8), not worth reversing today. |
| Inter as a font choice | Named specifically as a "vibe-coded," AI-default tell that signals cheapness. | Ships Inter + Inter Tight deliberately, as a documented two-optical-size pairing, not a default. | No change. The book's rule is a proxy for "did a human make a typography decision" — one was made here, it just happens to land on the same family. |
| Mid-flow rating ask | Ask for a rating during onboarding, after a "wow" moment, before the paywall — manufactures early social proof. | Asks only after a 3-day streak, decoupled from the priority-ordered moment system, never competing with a broken-streak recovery card (see §5). | App's rule preferred. Asking an unproven new user publicly to rate the app risks a worse rating than asking someone with three days of demonstrated value; a growth ask should never outrank a user-facing crisis card, and here it structurally can't (it isn't even in that priority queue). |
| Freemium vs. hard paywall | Hard paywalls generate ~8x revenue per install by day 60 vs. freemium (10.7% vs. 2.1% trial conversion, per RevenueCat aggregate US data). | Freemium, "Free forever" as a public landing-page claim. | Deferred to §8 — this is the one that needs a real answer, not a default. |

---

## 8. The freemium-vs-hard-paywall question, treated as a measurement problem

Per the scope agreed for this audit: don't pick a side using the book's US-market aggregate. Design what
would make the question answerable with GetInShape's own data, and say plainly why it isn't answerable
yet.

### The experiment is not reachable today

Two-proportion z-test, α = .05, power = .80, randomizing at the point the paywall shape would actually
change who becomes a user — i.e. the new-signup moment, not paywall-viewer, since a hard paywall changes
who continues past it at all.

| Scenario | Lift | n needed / arm | Time to reach it at 5 signups/day |
|---|---|---|---|
| Book's claimed lift | 2.1% → 10.7% | ~130 | ~1.7 months |
| Doubling conversion | 3.0% → 6.0% | ~750 | ~10 months |
| Realistic modest lift | 3.0% → 4.5% | ~2,520 | **~33 months** |
| D30 retention guardrail | 25% → 22% | ~3,140 | ~41 months |

**5 signups/day is already an optimistic assumption** for a pre-launch, zero ad-spend, India-only Play
release. Applying the book's own benchmark (5 installs per 1,000 views) backwards, 5 signups/day implies
roughly 1,600 store page views *every single day from day one* — a number the app has no channel capable
of producing yet, per Ch1's score.

The conclusion follows from the table, not from a preference: **the only effect size reachable in a sane
window is one large enough that a randomized test isn't even necessary to see it, and the retention
guardrail is more expensive to measure than the win it's protecting against.** At this scale, conversion
rate is not the binding constraint on revenue — installs are. The correct sequence is traffic →
activation → retention → monetization gate, and the hard-paywall question is fourth in that order, not
first.

### Instrumentation gap list — what has to exist before this (or any) experiment is readable

Ordered so the first group changes what's *askable* at all; later items sharpen an already-askable
question.

| # | Gap | Why it matters |
|---|---|---|
| 5 | `app_opened` currently fires with **zero properties** (`lib/posthog/client.ts`) — no `platform`, `is_authenticated`, `is_pro`, `session_id` | Without a typed denominator, the book's own central benchmark (75%+ open-to-paywall rate) can't be computed at all |
| 6 | No `platform` super-property registered on the client | One line would split the trial-bearing TWA funnel from the no-trial web funnel across every one of the ~48 existing events |
| 8 | No `trial_started` / `trial_converted` / `subscription_cancelled` / `subscription_refunded` events | **The biggest hole.** The funnel today ends at *purchase intent*, not payment — the app can measure someone deciding to pay, never whether they actually stayed paying |
| 11 | No `variant` super-property | Without one, no funnel is splittable by experiment arm regardless of how assignment is implemented |
| 12 | No first-touch UTM / referrer / Play Install Referrer captured as a person property at identify | This is the cohort key. Revenue-per-install by channel is a more answerable, more valuable question than paywall shape at this stage — and it needs the same attribution work as Ch1 |
| 1–4 | Four `PaywallSource` values are declared in the type (`wrapped`, `meal_suggestions`, `camera_scan_anonymous`, `chat_scan_anonymous`, `lib/posthog/events.ts`) with **zero emit sites**, confirmed by direct grep | Four blank regions on the map of which wall a user actually hit — the "looks instrumented, answers nothing" failure `CLAUDE.md` warns about, one level down in the event's own properties |
| 7 | No `days_since_signup` on `upgrade_completed` | This is the axis the book's trial-length claim (17–32 days vs. ≤4) actually lives on |
| 9 | No `paywall_dismissed{source}` event | Turns each paywall from a raw impression counter into an actual two-outcome funnel |
| 10 | No `skipped: boolean` on the step-1 `onboarding_step_completed` event | "Skip for now" currently fires the identical event as a real completion, which means the activation-first onboarding redesign can't measure its own effect |

### Feature-flag design, if this is ever built

Recommend a **middleware-set cookie plus a deterministic hash**, not PostHog's native flags and not a
plain env var:

- Middleware sets a `gis_bkt` cookie the first time a visitor is seen, if not already present.
- Bucket assignment is `sha256(experimentKey + ':' + bucketId) % 100` in a new pure function
  (`lib/experiments.ts`) — deterministic, no network call, no async evaluation.
- `posthog.register()` stamps the assigned variant as a super-property so every subsequent event carries
  it automatically.
- An env var is kept, but only as a global kill switch — not as the assignment mechanism itself, since an
  env var can't vary per-visitor.

**Rejected: PostHog's native feature flags.** Async flag evaluation would flicker on a Server Component
shell — fatal for a paywall, where the flicker itself is the thing a user notices. It would also add a
new third-party dependency to every render and a new SDK surface against an existing, passing test suite.

**Rejected: a plain env var as the sole mechanism.** It's global, not per-visitor — it can turn a feature
on or off for everyone, but it cannot run an A/B test.

**The key must be a cookie, not `user.id`.** A hard paywall's effect is on *whether someone becomes a
user at all* — bucketing has to happen before an account exists, or the experiment can't measure the
thing it's meant to measure. Analyze on an `experiment_exposed` event fired at bucket assignment, not on
account creation. No migration is needed for this design — deliberate, since migrations in this project
are hand-applied with no CLI, and the cookie/event approach avoids needing one.

### The constraint that actually decides scope

`app/page.tsx` states "Free forever · No credit card" as a landing-page claim, and `CLAUDE.md` treats
that as a public commitment. Varying it per experiment bucket means serving two contradictory public
promises by coin flip — grandfathering existing free users doesn't fix this, because the promise is made
at the *page*, to every visitor, not to an account after the fact.

There's a concrete external risk on top of the internal one: a store listing that reads "free forever"
while a randomly-selected half of installs hit a mandatory wall is the exact shape that draws a Play
Store Deceptive Behavior review — on a release that is one step from submission.

**So: build the mechanism if it's built at all, but "Free forever" is a product commitment, not an
experiment parameter.** Vary paywall placement, timing, framing, and price presentation *within* that
commitment — never the commitment itself.

### Reversibility

- **Cheap to reverse:** `LOG_PAYWALL_THRESHOLD`, `/upgrade` copy, `lib/planCards.ts` (cards are data, not
  code), which surfaces gate to Pro, adding anything *to* the free tier.
- **Sticky:** Play pricing changes (existing subscribers must consent; non-consenters get cancelled), the
  trial-length offer itself, store-listing metadata changes (subject to review delay).
- **One-way doors:** revoking free access from users who signed up under "Free forever" — with zero
  reviews live today, the first ~50 ratings set the listing's conversion for months, and a betrayed
  cohort writes specific, quotable one-stars; a promise, once visibly withdrawn, doesn't read as a
  promise again even if reinstated; **repurposing an existing `subscriptions.status` value** — the app's
  `isProStatus` check is exactly `status === 'active' || status === 'trialing'`
  (`lib/subscription.ts`) — adding a new status is cheap, but redefining what an existing one means is
  not, because historical rows carry the old meaning and there's no migration CLI to backfill them; and
  restarting the payment-verification clock mid-launch.

---

## 9. Ranked backlog

Every item names the event (existing or proposed) that would tell you whether it worked. This is a
ranked list to pick from, not a sprint plan.

**Tier 1 — Measurement (nothing after this is readable without it)**
1. `app_opened` properties: `platform`, `is_authenticated`, `is_pro`, `session_id` — §8 #5
2. `platform` super-property registered globally — §8 #6
3. `trial_started` / `trial_converted` / `subscription_cancelled` / `subscription_refunded` — §8 #8
4. `variant` super-property, ready before any experiment is built — §8 #11
5. First-touch UTM / referrer / Play Install Referrer captured at identify — §8 #12, doubles as Ch1's
   attribution fix

**Tier 2 — Correctness bugs found while mapping (not growth work, but found here)**
1. Persist `pace_kg_per_week` in `app/api/onboarding/route.ts`'s `.update()` call — success signal: goal
   date on `/onboarding/plan` matches the wizard's projection for a non-default pace
2. Gate the AI-scan onboarding paths so an unverified new account doesn't get redirected to `/upgrade`
   mid-wizard — success signal: `onboarding_step_completed` rate for the photo/chat paths stops
   correlating with immediate `paywall_viewed`
3. Reconcile `app/page.tsx`, `/upgrade`, and `/pricing`'s free-vs-Pro lists to one source, and add a test
   that pins the three together — success signal: this doesn't need a fourth audit to catch a third time

**Tier 3 — Claim-safe conversion work (doesn't touch the free-tier promise)**
1. Add the self-proof projection ("on track for X by ~date") to the 3rd-log paywall interstitial, tagged
   with its own `PaywallSource` value and a `paywall_dismissed` event — success signal: interstitial
   conversion rate vs. baseline
2. One price-reveal card inserted into `lib/planCards.ts` between the goal-date and go cards — the story
   engine already emits `story_card_viewed`/`story_abandoned` per card, so this measures its own cost for
   free — success signal: `upgrade_completed` rate for sessions that saw the card vs. those that didn't
3. Lengthen the Play trial from 3 to 14 days — pure Play Console config, no deploy — but gate this on
   Tier 1 item 3 existing first, or the change is unmeasurable — success signal: `trial_converted` rate,
   pre/post

**Tier 4 — Ch3 cheap wins**
1. Hit-area expanders on the icon-only row actions in `TodayFoodLog.tsx` / `ExerciseLogger.tsx`
2. A spacing rule added to `scripts/check-tokens.mjs`
3. An `opengraph-image` for `app/layout.tsx`
4. Page-level `metadata` for `app/page.tsx`, `/privacy`, `/terms`, `/upgrade`
5. JSON-LD on `/foods/[slug]`

**Tier 5 — Deferred until traffic exists**
1. Build the `gis_bkt` flag mechanism described in §8, spent only on placement/timing/framing, never on
   the free-tier promise itself
2. Revisit the freemium-vs-hard-paywall question once ~750 signups/arm is reachable within a quarter (see
   §8's table) — not before

---

## 10. What this audit did not do

- No code, migration, or component was changed. Every finding above is a citation, not a diff.
- The Contradicts findings in §7 are recorded, not adjudicated, except where the app's own documented
  reasoning was judged more defensible than the book's aggregate — that judgment is stated, not hidden.
- Chapter 5's "build for the 95%, ignore the 5% power user" prescription was not deeply audited feature
  by feature — the chapter's more urgent, more verifiable finding (zero experimentation capability, the
  push back-off flaw) took priority for this pass.
- The book's Web2App strategy (bypassing app-store cuts by driving installs from a web funnel) is largely
  moot here: GetInShape already has a first-class web product with its own pricing, not a stripped-down
  install funnel, so the tactic doesn't map cleanly onto this architecture.
- One finding from an earlier draft of this document — a colour-token drift between manifest files and
  live CSS — was checked directly against current code, found not to hold, and cut rather than kept with
  a caveat. If a similar drift reappears later, that's a regression to catch fresh, not evidence this
  audit missed it.
