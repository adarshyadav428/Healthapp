# GetInShape — what to do next (written 2026-07-24)

**Read this first, then `play-store-launch.md` for the deep detail on each Play step.**
Everything below is ordered. Do the steps in sequence — later ones depend on earlier ones.

---

## Where you actually are

Verified today, not assumed:

| Thing | State |
|---|---|
| Code | ✅ **Done.** All C1–C19 launch gates merged to `main` (`c345477`). 386 tests / 39 files green, `tsc` clean, token guard clean, build green. |
| Database | ✅ **Done.** Every migration through `027` applied live. Nothing to apply. |
| Domain / hosting | ✅ **Done.** `www` canonical, apex 308s to it, sitemap clean, site returns 200. |
| Android build | ✅ **Done.** `app-release-bundle.aab` (2.19 MB) at the repo root, signed, `versionCode=2`. |
| Digital Asset Links | ✅ **Done — both keys.** Google's API returns 2 statements. The installed app will have no URL bar. |
| Play Console app | ⚠️ **Partly done.** The Play App Signing key exists, so the app is created and enrolled. How far the listing/declarations got is the one thing this doc can't see — **Step 0 establishes it.** |
| Everything else | ❌ Pending — the seven steps below. |

**The single most important fact:** there is no code work left blocking launch. Every remaining item is a dashboard or console task.

---

## Step 0 — Take stock of Play Console (10 min, do this first)

You can't plan the rest until you know what's already filled in.

1. Go to <https://play.google.com/console> → select **GetInShape**.
2. In the left sidebar, open **Dashboard**. Google shows a checklist there ("Set up your app" / "Release your app").
3. Write down which of these show a ✅, which show a ⚠️, and which are untouched:
   - App access
   - Ads
   - Content rating
   - Target audience and content
   - Data safety
   - Government apps / Health apps declaration
   - Store listing (name, descriptions, graphics)
   - Store settings (category, contact details)
   - Subscriptions (under **Monetize → Products**)
   - Monetization setup (RTDN topic)

**Tell me the result and I'll trim the rest of this plan to only what's genuinely left.** If you'd rather just push through, do every step below — re-doing a completed one is harmless.

---

## Step 1 — The three 15-minute wins (45 min total, do them in one sitting)

These are independent of Play and each other. Getting them out of the way means the Play work isn't interrupted.

### 1a. Sentry — you are currently launching blind

Sentry is wired into the code but completely silent until a DSN exists. If something breaks for a real user on day one, right now you will not find out.

1. Sign up / log in at <https://sentry.io> (free tier is plenty).
2. **Create Project** → platform **Next.js** → name it `getinshape`.
3. Sentry shows you a **DSN** — a URL like `https://abc123@o456.ingest.sentry.io/789`. Copy it.
4. Vercel → your project → **Settings → Environment Variables**. Add **two** variables, both with that same DSN value, both scoped to **Production**:
   - `SENTRY_DSN`
   - `NEXT_PUBLIC_SENTRY_DSN`
   > Two names, one value. The first catches server errors, the second catches errors in the user's browser. Missing either leaves half the app unmonitored.
5. Vercel → **Deployments** → the top deployment → **⋯ → Redeploy**.
6. **Verify:** after the redeploy finishes, open <https://www.getinshape.co.in> and visit a URL that doesn't exist, e.g. `https://www.getinshape.co.in/thisdoesnotexist`. Then check Sentry → **Issues**. A 404 alone may not register — the real proof comes when a genuine error occurs, so treat "DSN set and deploy green" as done here and watch Issues during testing.

### 1b. Gemini budget alert — you have been burned by this before

Every AI scan is a paid Google API call. There is currently no ceiling and no alarm.

1. <https://console.cloud.google.com> → select the project holding your Gemini API key.
2. Search **Billing** in the top bar → **Budgets & alerts** → **Create budget**.
3. Name: `Gemini API`. Scope: this project.
4. **Target amount:** ₹2,000/month to start.
5. **Set alert thresholds** at 50%, 90%, 100% — tick **Email alerts to billing admins**.
6. **Finish.**
7. **Verify:** the budget appears in the list with your email under recipients. Screenshot it for your records.

> This is an *alert*, not a *cap* — it emails you, it does not stop spending. That is deliberate: a hard cap would break the app for paying users mid-month. Watch the email.

### 1c. Rotate the Supabase service-role key

Pending since the security audit. This key can read and write **every user's data**, bypassing all row-level security.

⚠️ **Do this when you have 10 uninterrupted minutes.** Between regenerating and redeploying, server features (webhooks, admin routes, AI usage counters) will fail.

1. Supabase Dashboard → your project → **Settings → API**.
2. Find **`service_role`** (the secret one, *not* `anon`). Click **Generate new key** / **Reveal → Regenerate**.
3. Copy the new key immediately.
4. Vercel → **Settings → Environment Variables** → edit `SUPABASE_SERVICE_ROLE_KEY` → paste the new value → **Save**.
5. Update your local file too, so local dev keeps working:
   ```bash
   code "C:/Users/plump/Downloads/Health App/health-app/.env.local"
   ```
   Replace the `SUPABASE_SERVICE_ROLE_KEY=` line with the new value.
6. Vercel → **Deployments** → top one → **⋯ → Redeploy**.
7. **Verify the app is healthy** once the deploy is green:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" https://www.getinshape.co.in/
   ```
   Expect `200`. Then sign in and log a food item — if that works, the key is good.
8. While you're in Stripe: delete the old Stripe **test** keys (Stripe is legacy-only now).

**If the site breaks:** you almost certainly pasted the key with a trailing space or newline, or edited the `anon` key by mistake. Re-copy carefully and redeploy.

---

## Step 2 — Supabase: turn off email confirmation (5 min)

Right now, a new user signs up and is told to go check their inbox before they can do anything. You explicitly asked for that wall to come down, the code shipped, and it is **inert** until you flip this switch.

1. Supabase Dashboard → **Authentication → Providers → Email**.
2. Turn **Confirm email** **OFF**. Save.
3. **Verify with a real signup** — use an email you control that has never signed up before:
   - Open <https://www.getinshape.co.in/auth/sign-up> in a **private/incognito** window.
   - Sign up.
   - You should land **straight in the onboarding wizard**, with no "check your inbox" step.
4. Complete onboarding and log one food, so you have a fresh free account to test with later.

**Safety note (already satisfied, but worth understanding):** migration `027` had to be applied *before* this switch flipped. It was. With confirmation off, Supabase auto-stamps `email_confirmed_at` at signup, so that column can no longer tell you who really owns their inbox — which is exactly why the app tracks its own `profiles.email_verified_at`, stamped only by real proof (a magic link or Google sign-in).

**Consequence to expect:** brand-new accounts now have **0 AI scans** until they verify their email, by design. The 3 free lifetime scans unlock on verification. That is the anti-abuse mechanism — an unverified account costs nothing to create, so it gets no paid Gemini calls.

---

## Step 3 — Razorpay (start now, it waits on other people)

This has **external lead time**, so kick it off before the Play work rather than after. It gates **web** payments only — the Play launch does not depend on it.

1. <https://dashboard.razorpay.com> → check **KYC / Account Activation** status.
   - **Not started or incomplete?** Finish it today. Use the **Adarsh Medicals** sole-proprietorship details — the same entity as the Play payments profile.
   - **Under review?** Nothing to do but wait. Continue to Step 4.
2. **Once KYC is approved**, and only then:
   - **Subscriptions → Plans → Create Plan**:
     - Plan 1: **₹299**, billing cycle **Monthly**
     - Plan 2: **₹1,999**, billing cycle **Yearly**
     - Do **not** add a free trial here. The 3-day trial is Play-only, deliberately — the web copy already reflects this.
   - Copy each **Plan ID** (looks like `plan_XXXXXXXXXXXX`).
   - **Settings → Webhooks → Add New Webhook**:
     - URL: `https://www.getinshape.co.in/api/razorpay/webhook`
     - Secret: invent a long random string and **save it somewhere** — you need it in a moment.
     - Events: `subscription.activated`, `subscription.charged`, `subscription.cancelled`, `subscription.completed`
   - Vercel → **Settings → Environment Variables** → add all five (Production scope):
     | Variable | Value |
     |---|---|
     | `RAZORPAY_KEY_ID` | from Razorpay → Settings → API Keys |
     | `RAZORPAY_KEY_SECRET` | from the same place |
     | `RAZORPAY_WEBHOOK_SECRET` | the string you invented above |
     | `RAZORPAY_MONTHLY_PLAN_ID` | `plan_…` for ₹299 |
     | `RAZORPAY_ANNUAL_PLAN_ID` | `plan_…` for ₹1,999 |
   - **Redeploy.**
3. **Verify:** sign in on the live site → `/upgrade` → click the monthly plan. The Razorpay widget should open. Before this is done it fails with a friendly "temporarily unavailable" message (not a raw error — that was fixed).

> **If KYC will take more than ~2 days:** tell me, and I'll hide the web upgrade CTAs behind "Pro is coming to web — get it in the Android app" (about an hour of work). A visibly broken pay button costs trust every day it's up.

---

## Step 4 — Play Console: finish the app (the big one, 3–4 h)

Work top to bottom. Full detail for each is in `play-store-launch.md` §4–7. **Do App access and Data safety before anything else** — they're the two most common rejection causes.

### 4a. App access ⚠️ highest rejection risk

Your app is behind a login. A reviewer who can't get in will reject it — or worse, file your headline AI feature as broken.

1. **App content → App access** → choose **All or some functionality is restricted**.
2. Add an instruction entry:
   - Name: `Test account`
   - Username: `adarshyadavazm123+qa1@gmail.com`
   - Password: *(the +qa1 password)*
   - Instructions — **paste this verbatim**:
     > AI photo scan and AI chat logging are Pro features. Free accounts get 3 lifetime trial scans, which unlock only after the account's email address is verified. The test account provided is already verified, so the AI features are accessible.
3. **Before you save, confirm the credentials actually work** — sign in with them in an incognito window.

### 4b. Data safety

Answers are in `play-store-launch.md` §5 as a table — copy them exactly. Key ones:

- Collects data: **Yes**. Encrypted in transit: **Yes**. Data sold: **No**.
- Deletion: **Yes**, both in-app and via `https://www.getinshape.co.in/delete-account`.
- When asked whether users can request deletion of **some** of their data without deleting the account: **Yes** — the deletion page now documents exactly how, per data type. *(This is why that page was updated today; the answer would have been unsupported before.)*
- Photos: collected, **processed ephemerally, not stored** (meal scans go to Gemini and are not retained).
- Financial info: **not collected** — Google Play and Razorpay handle it.

### 4c. The remaining declarations

- **Health apps declaration** — health & fitness (calorie/weight tracking). Not a medical device, gives no medical advice.
- **Account deletion URL:** `https://www.getinshape.co.in/delete-account`
- **Content rating (IARC questionnaire)** — utility/health app; no violence, sex, gambling, or user-generated content. Expect Everyone / 3+.
- **Target audience:** **18+** — this deliberately avoids the much stricter child-safety policy track.
- **Ads:** **No ads.**
- **Privacy policy URL:** `https://www.getinshape.co.in/privacy`

### 4d. Store listing

Drafted copy is in `play-store-launch.md` §4 — it's current and honest (checked against what the app actually does today). Paste it as-is.

- App name: `GetInShape: Calorie Tracker`
- Upload the icon, feature graphic, and the **6 screenshots** from `health-app/store-assets/screenshots/`.
- **Keep them in filename order** — `01-dashboard.png` first. Play displays them left to right and the first one does most of the persuading.

### 4e. Subscriptions ⚠️ this one can make your app lie

**Monetize → Products → Subscriptions.** Create two:

| Product ID | Base plan | Price | Offer |
|---|---|---|---|
| `pro_monthly` | auto-renewing, monthly | ₹299 | **3-day free trial, new subscribers** |
| `pro_annual` | auto-renewing, yearly | ₹1,999 | **3-day free trial, new subscribers** |

Then activate each product (they're created inactive).

> **Do not skip the trial offers, and put one on *both* products.** The app shows "3-day free trial" copy inside the Android build. If the offers don't exist, that copy becomes a false claim in a shipped store app. 3 days is Google's minimum — it will reject anything shorter.

The product IDs must match these Vercel env vars exactly:
- `NEXT_PUBLIC_PLAY_PRODUCT_MONTHLY=pro_monthly`
- `NEXT_PUBLIC_PLAY_PRODUCT_ANNUAL=pro_annual`

Set them in Vercel now if they aren't there, plus `ANDROID_PACKAGE_NAME=in.co.getinshape.app`. **These are `NEXT_PUBLIC_` variables, which get baked in at build time — after adding them you must redeploy, and if the change doesn't take, redeploy with build cache disabled.**

### 4f. Service account + Real-time Developer Notifications

This is what tells your server when someone cancels or their payment fails.

1. <https://console.cloud.google.com> → same project → **APIs & Services** → enable **Google Play Android Developer API**.
2. **IAM & Admin → Service Accounts → Create** → name `play-billing` → **Create key → JSON** → download it.
3. Play Console → **Users and permissions → Invite new user** → paste the service account email → grant **View financial data** and **Manage orders and subscriptions**.
4. Convert the JSON key to base64 and put it in Vercel as `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`:
   ```bash
   base64 -w 0 "C:/Users/plump/Downloads/play-billing-key.json" > "C:/Users/plump/Downloads/play-key-base64.txt"
   ```
   Open that `.txt`, copy the whole single line, paste as the env var value. **Delete both files afterwards** — that key grants access to your Play billing data.
5. **Pub/Sub** (still in Cloud Console) → **Topics → Create topic** → id `play-rtdn`.
6. Invent a random secret string — this is `PLAY_RTDN_SECRET`. Add it to Vercel.
7. On the topic → **Create subscription**:
   - Type: **Push**
   - Endpoint: `https://www.getinshape.co.in/api/play/rtdn?secret=<the secret you just invented>`
8. On the topic → **Permissions → Add principal** → `google-play-developer-notifications@system.gserviceaccount.com` → role **Pub/Sub Publisher**.
9. Play Console → **Monetize → Monetization setup** → paste the full topic name → **Send test notification**.
10. **Verify:** Vercel → your project → **Logs**, filter for `/api/play/rtdn`. You want a **200**.

**Redeploy after all these env vars are set.**

---

## Step 5 — Internal testing on a real phone (1–2 h)

Never submit to production without installing the actual artifact first.

1. Play Console → **Test and release → Testing → Internal testing → Create new release**.
2. Upload `app-release-bundle.aab` from `C:/Users/plump/Downloads/Health App/`.
3. Add yourself as a tester (**Testers** tab → create a list with your Google account).
4. **Save → Review release → Start rollout to internal testing.**
5. Copy the **opt-in URL**, open it on your Android phone, accept, then install from Play.
6. Set up a **license tester** so purchases aren't charged: Play Console → **Settings → License testing** → add your Google account. Do this *before* testing payment.

**Then check every one of these on the phone:**

- [ ] App opens **full screen with no browser URL bar** (asset links — already verified, this confirms it)
- [ ] `/upgrade` shows **Google Play** branding, not Razorpay (proves the Digital Goods API was detected)
- [ ] `/upgrade` shows the **3-day trial** copy (proves 4e worked)
- [ ] Complete a purchase as a license tester → you become Pro → Pro features unlock
- [ ] Cancel from **Play Store → Subscriptions** → within a minute your status changes (proves RTDN works)
- [ ] Camera meal scan works
- [ ] Push notification toggle works in Profile → Settings
- [ ] Log 3 foods → the one-time paywall interstitial appears
- [ ] Sign up a brand-new account on the phone → no email wall (proves Step 2)

**If the URL bar appears:** the asset links are fine (verified against Google's API today), so it's almost certainly that you installed the sideloaded APK rather than the Play build. Uninstall completely and reinstall from the Play link.

---

## Step 6 — PostHog funnel check (30 min, do it with me)

Confirms your analytics actually fire before you have real users to lose.

Run one fresh account all the way through — landing → sign up → onboarding → first food log → paywall → checkout attempt — while watching **PostHog → Activity**. We're looking for: `$pageview`, `food_logged`, `paywall_viewed`, `upgrade_viewed`, `checkout_attempted`, and `subscription_started`.

Ping me when you're ready and we'll do it together.

---

## Step 7 — Production submission

Only when Steps 4 and 5 are fully green.

1. Play Console → **Dashboard** → confirm **zero** outstanding errors in "App content".
2. **Test and release → Production → Create new release** → upload the same AAB → write release notes.
3. **Set staged rollout to 20%.** Not 100%. If something's wrong, it reaches a fifth of your users, not all of them.
4. Submit. **First-app review takes 1–7 days.**
5. While waiting, read the **pre-launch report** (Play Console generates one automatically from real device runs) and fix anything it flags.

### On launch day

- [ ] Delete the `+qa2` test account (Supabase → Authentication → delete user). **Keep `+qa1` forever** — it's your 30-day history fixture and the reviewer login.
- [ ] Sanity-pass `+qa1`: streak shows, diary date matches the day you tapped, trends look right.
- [ ] Note the current Vercel deployment — that's your instant rollback target.

### Rollout ladder

20% → 48 hours clean → 50% → 48 hours → 100%.

> **Remember what you can and can't roll back.** The TWA is a wrapper around your website, so almost every fix ships instantly through Vercel with **no Play release at all**. Only packaging or manifest changes need a new AAB. Play itself has no binary rollback — you halt the staged rollout and fix forward.

---

## Week 1 after launch — daily 15 minutes, every morning

1. **Sentry** — new issues. Anything in payments or logging paths is a same-day hotfix.
2. **PostHog** — the signup → onboarding → first-log funnel. Watch for *cliffs between steps*, not absolute numbers.
3. **Google Cloud billing** — Gemini spend against the ₹2,000 budget. Check this personally the first week.
4. **Razorpay** — failed payments and webhook delivery failures.
5. **Play Console** — crashes/ANRs under Vitals, and **reply to every review within 24 hours**.
6. **Supabase** — a glance at DB size and auth anomalies.

The full week-1 runbook, the pre-mortem (top 5 ways this dies), and the 30-day roadmap are in `launch-plan-2026-07-17.md` §6–8. They're still accurate.

---

## Quick reference

| What | Where |
|---|---|
| Play deep detail | `docs/play-store-launch.md` |
| Launch tracker / history | `docs/launch-plan-2026-07-17.md` |
| AAB to upload | `C:/Users/plump/Downloads/Health App/app-release-bundle.aab` |
| Screenshots | `health-app/store-assets/screenshots/` |
| Reviewer account | `adarshyadavazm123+qa1@gmail.com` |
| Package name | `in.co.getinshape.app` |
| Live site | `https://www.getinshape.co.in` |

⚠️ **The keystore is irreplaceable.** `android.keystore` at the repo root is git-ignored — **git is not a backup**. If you lose it you can never update the app under the same listing. Put it and both passwords in a password manager and one offline copy. Do this today.
