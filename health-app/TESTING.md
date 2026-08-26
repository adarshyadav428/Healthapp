# TESTING.md — manual test script

Automated coverage lives in `tests/` (`npm test`). This file covers what tests
can't reach: anything behind auth, anything that needs a real phone, and
anything where the automated check passes but the experience is still wrong.

Run the automated gates first — if any fail, stop:

```bash
npm test            # 917 tests
npx tsc --noEmit    # zero type errors
npm run lint
npm run check:tokens
npm run build
```

---

## 0. Analytics (Phase 0)

Open PostHog's live event stream alongside the app.

- [ ] Cold-open the app → exactly **one** `app_opened`. Navigating between tabs
      must NOT fire more.
- [ ] Log a food via **search** → `food_logged` with `method: search` and a
      plausible `seconds_since_open`.
- [ ] Repeat for each surface, checking `method` each time:
      Recent/Favourites row → `log_again` · camera → `photo_scan` ·
      chat → `chat` · Quick add → `quick_add` · saved combo → `meal_template` ·
      Copy yesterday → `copy_yesterday`.
- [ ] On a brand-new account, the first log also fires `first_food_logged`.
- [ ] Save a meal template → `meal_template_saved`. Tap it → both
      `meal_template_logged` and `food_logged{method: meal_template}`.
- [ ] Profile → **Usage analytics** → Opt out → reload → stream goes silent.
      Switch back on → events resume.
- [ ] Hit the free-log interstitial → `paywall_viewed` with **`source`**
      (not `reason`) = `free_logs`.
- [ ] Visit `/upgrade?reason=history` → `paywall_viewed{source: history_limit}`
      fires **once**. Visit `/upgrade?reason=custom_foods` → it must **not**
      fire again there (the gate already counted it).

## 1. Day boundary (highest-risk area)

Best done near midnight IST, or by changing the device clock.

- [ ] At **23:55 IST**, log a meal. It lands on today.
- [ ] At **00:05 IST**, that meal is still on *yesterday*, and a new log lands
      on the new day.
- [ ] The streak does not drop when crossing midnight.
- [ ] The Home week strip and Progress calendar agree on which days have dots.

## 2. Onboarding (Phase 2) — needs a fresh account

- [ ] Wizard is **4 screens**, and the counter reads `1 / 4` … `4 / 4`.
- [ ] Screen 2 asks name + age + sex together.
- [ ] Screen 3 asks height + current weight + target weight + goal together.
- [ ] Back steps correctly through all four; Back is hidden on screen 1.
- [ ] Screen 1 ("Log a meal") can be skipped — "Skip for now" advances.
- [ ] The payoff card states **"protein at 1.6 g per kg of bodyweight"**.
- [ ] Abandon mid-wizard, reopen → resumes where you left off, values intact.
- [ ] **Time from first open to first food logged is under 60 seconds.** Time it.

## 3. Repeat logging (Phase 3)

- [ ] With at least one saved template, the Food tab shows **"Your combos"**
      above "Log again", and the subtitle names the current meal slot.
- [ ] Tapping a combo logs every item to that slot — **two taps total** from
      opening the app. Time it: target is under 10 seconds.
- [ ] "Log again" leads with items previously logged to the *current* slot
      (check in the morning, then again after 19:00 — the order should differ).
- [ ] Meal inference: before 11:00 → Breakfast · 11:00–16:00 → Lunch ·
      **16:00–19:00 → Snack** · after 19:00 → Dinner (including late night).
- [ ] All four meal sections render, each with a real empty state.

## 4. Streak & freezes (Phase 4)

Easiest on the `+qa1` fixture account (30 days of history).

- [ ] At a 7+ day streak, a **freeze count appears beside the flame**, in ink —
      never red.
- [ ] Miss a day with a freeze banked → the streak survives and does **not**
      increase; the freeze count drops by one.
- [ ] Miss enough days to exhaust the bank → the streak breaks. Freezes must not
      make a streak unbreakable.
- [ ] An unlogged *today* never breaks the streak or spends a freeze.
- [ ] Milestone overlays fire at 3, 7, 14, 21, 30, 50, 100.
- [ ] At 7/30/100 the overlay **waits for a tap** and offers "Share this".
      At 3/14/21/50 it auto-dismisses after ~2.6s with no share button.
- [ ] A whole-kg **weight** milestone ("3 kg down!") also waits and offers the
      card — it is the most postable moment in the app and used to vanish.
- [ ] "Share this" → system share sheet on Android with a 1080×1920 card;
      PNG download on desktop. Cancelling the sheet is not an error.
- [ ] Freezes are available to a **free** account. They must never be gated.

## 4b. Share cards — the parts automation cannot reach

The card art itself is reviewable without signing in at **`/studio` → Card**
(every topic × both formats). These need a real phone and a real account:

- [ ] `/progress` → "Share your progress" opens a chooser. Each row's preview is
      the file the share sheet then delivers — pick all three and confirm they
      match.
- [ ] The card leads with what was **picked**, not with the streak. Specifically:
      with a multi-kg loss and a 1–2 day streak, "Weight lost" is preselected.
- [ ] **Status** format posted to WhatsApp status fills the screen — no grey
      bars top and bottom. **Post** format is the square.
- [ ] On a **free** account the chooser offers no month deficit at all. The
      month is withheld server-side, so this is absence, not a padlock.
- [ ] `/wrapped` on an unlocked account: "Share my month" **shares** — it must
      not navigate to `/progress`. Its weight line names the month ("down in
      August"), never "since I started".
- [ ] The exported card is the Kelp green, in both light and dark app themes —
      it is a brand asset and must not follow the viewer's theme.
- [ ] The plate reads as a *plate* against the card's ground, not a pale blob.
      (It was white-on-near-white once; the rim now carries 3.4:1.)

### The day card

- [ ] `/log` and the day drawer on `/progress` both show "Share this day" under
      the meals, and neither shows it on a day with nothing logged.
- [ ] The card's date matches the diary's date — check this across the
      00:00–05:30 IST window, where an IST/UTC slip would show a different day.
- [ ] Meals read in day order (breakfast → snack), never in logging order.
- [ ] A day with many items shows "+N more" rather than silently dropping
      dishes, and the day's total still counts everything.
- [ ] Switching Status → Post reflows the menu and never runs it into the green
      footer band.

## 5. Coach & adaptive targets (Phase 6)

- [ ] Home shows no protein line on a day with nothing logged.
- [ ] After logging, the line names a concrete portion ("a katori of dal").
- [ ] Once the protein target is met, the line turns green and states the
      1.6 g/kg basis.
- [ ] The suggested-target card only appears with **2+ weigh-ins** and **5+
      logged days** in the past week.
- [ ] "Use this target" updates the Home ring and persists after a reload.
- [ ] "Not now" hides it for the rest of the week, and it returns next week.
- [ ] **Nothing ever changes the calorie target without an explicit tap.**

## 6. Entitlements — free tier must never cap logging

On a **free** account. The AI allowance changed on 2026-07-18: it is **3 lifetime
calls shared across camera and chat**, unlocked only once the email is verified —
not the old per-day quotas.

- [ ] Log 20+ foods manually/via search in one day. Never blocked.
- [ ] On an **unverified** account, camera and chat are both locked, and the copy
      asks the user to confirm their email — not to pay.
- [ ] Verify the email, then spend all 3 AI calls. Mix the two surfaces: 2 camera
      scans + 1 chat log must exhaust the pool, because they share it.
- [ ] The 4th call is blocked with an upgrade prompt, on **both** surfaces.
- [ ] The counters actually increment — spend 2, reload, sign out and back in, and
      confirm the 3rd is still the last one. *(This is the exact failure that hid
      the unenforced chat limit; a silent counter looks identical to a working one
      until you cross the boundary. The pool is lifetime, so signing out, clearing
      storage or using a second device must not reset it.)*
- [ ] A **failed** scan (kill the network mid-scan) does not burn a call.
- [ ] History older than 7 days is gated; the last 7 days are not.
- [ ] Custom foods are gated.
- [ ] CSV export is **not** gated — it returns the user's complete history on any
      tier. It's data portability, not a Pro feature.

## 7. Offline / PWA

- [ ] Install to home screen on Android; it opens without browser chrome.
- [ ] Go offline and open the app — it must fail **honestly**. We do not claim
      offline logging anywhere; if any screen implies it works offline, that
      copy is a bug.

## 8. Theming & layout

- [ ] Toggle Light / Dark / System in Profile → Appearance. Every screen from
      the checks above renders correctly in both.
- [ ] The flame + freeze pill does not wrap or overflow at a 3-digit streak.
- [ ] Check on a small phone (≤375px wide): no horizontal scroll anywhere.
