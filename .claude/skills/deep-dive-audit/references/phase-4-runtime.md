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
