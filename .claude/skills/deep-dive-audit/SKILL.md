---
name: deep-dive-audit
description: Run the full GetInShape deep-dive audit - an eight-phase, evidence-based review of every screen, API route and feature across the web app, the installed PWA and the Android TWA, ending in a severity-ranked report written to health-app/docs/deep-dive-audit-<YYYY-MM-DD>.md. Use whenever Adarsh asks for a deep dive, a full audit, a comprehensive or end-to-end review, a QA pass, a pre-release or pre-launch check, or asks you to "test every feature" of the app.
---

# GetInShape deep-dive audit

You are running a **complete deep-dive audit of GetInShape** - every screen, every API route,
every feature, on the web app, the installed PWA and the Android TWA. Four lenses in one pass:
**QA engineer**, **security & reliability reviewer**, **product manager for the Indian
weight-loss market**, and **a first-time user who has never seen this app**.

This is an **audit, not a fix-up.** Do not change product code unless Adarsh explicitly says
"fix it". You may write new test files and you may write your report. Everything else you
find, you report.

Work through the phases in order. **Do not skip a phase because an earlier one looked clean.**

## Phases - read the reference file at the start of each phase, not before

| Phase | Read this file first |
|---|---|
| 0 - Orient | `references/phase-0-orient.md` |
| 1 - Automated gates | `references/phase-1-gates.md` |
| 2 - Test-suite quality | `references/phase-2-test-quality.md` |
| 3 - Static review, route by route | `references/phase-3-static-review.md` |
| 4 - Runtime testing, every surface | `references/phase-4-runtime.md` |
| 5 - Adversarial pass | `references/phase-5-adversarial.md` |
| 6 - Product review | `references/phase-6-product.md` |
| 7 - The report | `references/phase-7-report.md` |

Load each phase file when you reach that phase. Do not load them all up front - that is the
whole point of this being a skill.

## Rules of evidence - these decide whether the report is worth anything

- **Every finding needs a reproduction and a `file.ts:line`**, or a network/DB/console
  observation. No finding from vibes.
- Mark each finding **OBSERVED** (you saw it happen) or **CODE-REVIEWED** (you reasoned it
  from source). Never blur the two.
- **Before you report anything, try to refute it.** Read the surrounding code, check
  `health-app/CLAUDE.md` for a documented rationale, and re-run the repro. A previous audit
  killed two P0s this way - a "0 kcal" hero number and "dead" paywall buttons were both
  timing artifacts of the audit tooling, not app bugs.
- If your tooling cannot observe something (animation feel, real device behaviour, a real
  payment), **say so** rather than inferring.
- Do not report anything `CLAUDE.md` documents as deliberate without engaging with its reason.

## Known and deliberate - do NOT report these as bugs

- **No USDA data**, permanently. Indian-market accuracy decision.
- **`curated` foods are estimates, not measurements** - badged with a chart emoji and ranked
  below every measured source on purpose.
- **INR only**, Rs299 / Rs1,999. The 3-day trial is a **Play Console** offer, so trial copy
  renders only inside the TWA.
- **No offline logging** - never claimed anywhere. Failing honestly offline is correct.
- **Only two Vercel crons** - Hobby plan cap; Monthly Wrapped deliberately rides inside the
  Sunday recap.
- **`/wrapped` redirecting to `/dashboard`** when the month did not earn a wrap is correct.
- **No Razorpay fallback inside the TWA** - Play policy forbids third-party checkout for
  digital goods.
- **Play submission is blocked on BillDesk merchant verification**, not on code. Do not
  recommend submitting.
- **Water / sleep / fasting / measurements tables were dropped** by migration `019` on
  purpose. Only `exercise_logs` remains of the extended trackers.
- **Migration `026_anonymous_users`** is obsolete but deliberately left applied.
- Duplicate migration numbers and the missing `021` are known - cite exact filenames.

## Safety rules - apply for the whole session

- **Never delete rows from `foods`.** `food_logs.food_id`, `food_favourites.food_id` and
  `saved_meal_items.food_id` are all `ON DELETE CASCADE` - deleting a food silently deletes
  every user's diary entries for it, with no error. This nearly destroyed 87 real entries once.
- **Never rewrite a migration that has already been applied.** Add a new numbered file.
- **Never print, paste or commit a secret** from `.env.local` or Vercel. Refer to keys by
  variable name only.
- Treat the production database as **read-only** outside the `+qa1` / `+qa2` accounts.
- Do not complete a real payment, do not refund anything, do not touch Play Console, Razorpay,
  Supabase, Vercel or GCP dashboard settings. If a check needs one of those, write exact
  click-by-click steps instead and let Adarsh do it.
- Do not commit or push anything. Leave the working tree clean apart from the report.
- **Ask before creating any new user account.**

## Working style

- Show progress as you go. Do not disappear for an hour and return with a wall of text.
- If something is genuinely ambiguous, do everything that does not depend on the answer
  first, then ask.
- **Use parallel subagents for the read-heavy phases** - Phase 3's route-by-route review and
  Phase 4's per-page sweep. This is standing authorisation; you do not need to ask.
  **Verify their findings yourself before putting anything in the report** - subagents report
  false positives.

Start with Phase 0.
