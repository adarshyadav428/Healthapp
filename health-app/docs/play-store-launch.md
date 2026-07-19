# Google Play Store launch runbook — GetInShape

Package: `com.getinshape.app` · Host: `https://www.getinshape.co.in` · Play Console org: **Plum2408** (DUNS + website verified 2026-07-12)

Work through the sections **in order**. Steps marked 🖐 are manual (dashboard/console clicks only you can do).

---

## 1. Pre-flight (before building anything)

- [ ] 🖐 **Rotate the Supabase service-role key** (Supabase Dashboard → Settings → API → regenerate `service_role`). Update `SUPABASE_SERVICE_ROLE_KEY` in Vercel env + local `.env.local`, redeploy. Also delete the old Stripe **test** keys from the Stripe dashboard (Stripe is legacy-only).
- [ ] 🖐 **Apply the one pending migration** in Supabase Dashboard → SQL editor. Live-DB state was re-probed 2026-07-17: `012`/`022`/`023` (all billing columns incl. `cancel_at_period_end`) are **already applied** — the earlier "apply 012/022/023" list here was wrong. Only this remains:
  - `015_chat_logs.sql` (**until applied, the 10/day AI-chat limit is silently off** — free unlimited Gemini on your bill)
  - `024_weekly_recaps.sql` (added by the weekly-recap feature; until applied the Pro "Your week" card stays empty and the Sunday recap push doesn't store — no crash)
  - `025_start_weight.sql` (immutable start-weight baseline + backfill; until applied "since start" uses the first weigh-in — no crash)
  - Do **not** apply `011_weekly_calorie_view.sql` — the view is referenced nowhere in code (deliberately skipped).
  - Full apply-and-verify SQL: `docs/launch-plan-2026-07-17.md` §4.
- [ ] 🖐 **Flip `NEXT_PUBLIC_APP_URL`** in Vercel env to `https://www.getinshape.co.in` and redeploy — sitemap/robots/canonicals must agree with the TWA host.
- [ ] 🖐 **Razorpay (web billing, parallel track):** once KYC approves — create plans Monthly ₹199 / Annual ₹699 (Payments → Subscriptions), add webhook `https://www.getinshape.co.in/api/razorpay/webhook` (events: `subscription.activated/charged/cancelled/completed`), set the 5 env vars (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_MONTHLY_PLAN_ID`, `RAZORPAY_ANNUAL_PLAN_ID`) in Vercel, redeploy.
- [ ] Confirm Play env vars exist in Vercel (values come from §6–7): `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` (base64), `ANDROID_PACKAGE_NAME=com.getinshape.app`, `PLAY_RTDN_SECRET`, `NEXT_PUBLIC_PLAY_PRODUCT_MONTHLY`, `NEXT_PUBLIC_PLAY_PRODUCT_ANNUAL`.
- [ ] Deploy the current main (new `/delete-account` page + updated `/manifest.webmanifest` must be live **before** running Bubblewrap).

## 2. Build the TWA (Bubblewrap)

`twa-manifest.json` is committed at the repo root (one level above `health-app/`). It has Play Billing enabled (`features.playBilling` + `alphaDependencies`).

```bash
npm i -g @bubblewrap/cli
cd "C:\Users\plump\Downloads\Health App"

# First run: bubblewrap offers to download its own JDK + Android SDK — accept.
# Init from the LIVE manifest, then diff against the committed twa-manifest.json
# (the CLI schema drifts between versions; the committed file is the intent).
bubblewrap init --manifest https://www.getinshape.co.in/manifest.webmanifest

bubblewrap build        # produces app-release-bundle.aab (+ .apk for local install)
```

- When asked to create a signing key, let it generate `android.keystore` (alias `android`).
- 🖐 **Back up `android.keystore` + its passwords somewhere safe (password manager + offline copy).** Losing the upload key is recoverable via Play support; still painful.
- **Never commit the keystore.** Add to `.gitignore`: `android.keystore`, `*.keystore`, and the Bubblewrap output dirs (`app/`, `build/`) if they land in the repo.

## 3. Digital Asset Links (kills the browser URL bar)

`health-app/public/.well-known/assetlinks.json` currently has one fingerprint (the local/upload key). After you upload the first build and enroll in **Play App Signing** (default for new apps):

1. 🖐 Play Console → your app → **Test and release → Setup → App signing** (previously "App integrity") → copy the **App signing key certificate** SHA-256.
2. Append it as a second fingerprint in `assetlinks.json` (keep the upload-key one for local installs):
   ```json
   "sha256_cert_fingerprints": ["<existing upload fp>", "<play app signing fp>"]
   ```
3. Deploy, then verify with Google's statement list tester:
   `https://developers.google.com/digital-asset-links/tools/generator` (site `https://www.getinshape.co.in`, package `com.getinshape.app`).
4. Install the app from the Play testing track — the URL bar must be **gone**. If it shows, the fingerprints don't match.

## 4. Play Console — create app + store listing

- [ ] 🖐 Create app: name **GetInShape**, default language English (India if offered), **App**, **Free**. Declarations: contains in-app purchases.
- [ ] Category: **Health & Fitness**. Contact email: `adarshyadavazm123@gmail.com`. Privacy policy URL: `https://www.getinshape.co.in/privacy`.

### Drafted listing copy

**App name (≤30 chars):** `GetInShape: Calorie Tracker` *(27)*

**Short description (≤80 chars):**
`Indian calorie counter with AI photo scans, desi foods & weight tracking.` *(74)*

**Full description (draft — edit freely):**

> **Lose weight the Indian way.** GetInShape is a calorie and weight tracker built for Indian food — dal, roti, sabzi, biryani, dosa, and 400+ foods from IFCT 2017 (India's official nutrition database), plus packaged brands via Open Food Facts.
>
> 📸 **Log meals with AI** — snap a photo and get calories & macros with Indian portion sizes (katori, roti, plate), or just type "2 roti aur dal" and let AI do the rest.
>
> 🔍 **Search that understands India** — Hindi and regional food names, home-cooked dishes, street food, thalis, and regional cuisines from every state.
>
> 🎯 **Personal daily targets** — science-based calorie and protein/carb/fat goals (Mifflin-St Jeor) tuned to your pace: 0.25–1 kg per week.
>
> 🔥 **Stay consistent** — daily streaks, weekly deficit tracker, weight trends, and meal reminders.
>
> **Free forever:** unlimited food logging, 7-day history, exercise & weight tracking, barcode scanning — plus 3 free AI scans once you confirm your email.
> **Pro (₹199/mo or ₹699/yr, 7-day free trial):** full history, unlimited AI logging, custom foods & family recipes.
>
> Your data stays yours — no ads, no selling data. Delete your account anytime.

**Assets checklist:**
- [x] App icon 512×512 PNG — `store-assets/play-icon-512.png` (white ember flame on the CTA gradient; SVG source at `store-assets/icon-source.svg`)
- [x] Feature graphic 1024×500 — `store-assets/feature-graphic-1024x500.png`
- [ ] 4–8 phone screenshots (9:16, ≥1080px) — take from a real device/emulator once the internal-testing build is installed: dashboard ring, AI photo scan result, food search (Indian foods visible), trends/weight chart, streak, upgrade screen
- [ ] Optional: 7"/10" tablet screenshots (skippable for v1)

## 5. Declarations (App content section)

- [ ] 🖐 **Data safety form** — answers derived from the privacy policy (§1):

| Question | Answer |
|---|---|
| Collects data? | Yes |
| Encrypted in transit? | Yes |
| Deletion mechanism? | Yes — in-app (Settings → Delete account) + `https://www.getinshape.co.in/delete-account` |
| **Personal info** | Email address, Name — app functionality / account management. Collected, not shared. |
| **Health & fitness** | Health info (food/calorie logs, weight, exercise) — app functionality. Collected, not shared. |
| **Photos** | Photos (meal scans) — processed ephemerally (sent to Google Gemini for analysis, **not stored**); mark as collected, processed ephemerally, not shared. |
| **Financial info** | NOT collected by the app (handled entirely by Google Play / Razorpay). |
| **App activity / identifiers** | App interactions + user IDs via PostHog analytics — analytics purpose. Collected, not shared. |
| Data sold? | No. |

- [ ] 🖐 **Health apps declaration** — declare as a health & fitness app (calorie/weight tracking). Not a medical device; no medical advice given (the Terms page already disclaims this).
- [ ] 🖐 **Account deletion URL:** `https://www.getinshape.co.in/delete-account`
- [ ] 🖐 **Content rating questionnaire (IARC):** utility/health app, no violence/sex/gambling/UGC → expect "Everyone"/3+.
- [ ] 🖐 **Target audience:** 18+ (avoids the child-safety policy track; the privacy policy already says not for under-13s).
- [ ] 🖐 **Ads declaration:** No ads.

## 6. Play Billing — subscription products

- [ ] 🖐 Play Console → Monetize → Products → **Subscriptions**:
  - `pro_monthly` — base plan ₹199/month, auto-renewing.
  - `pro_annual` — base plan ₹699/year, auto-renewing, **+ offer: 7-day free trial** (new subscribers).
- [ ] Product IDs must equal the env vars `NEXT_PUBLIC_PLAY_PRODUCT_MONTHLY` / `NEXT_PUBLIC_PLAY_PRODUCT_ANNUAL` (`lib/play/products.ts` reads them).
- [ ] 🖐 Payments profile: uses the **Adarsh Medicals** sole-proprietorship details (same as Razorpay KYC).

## 7. Service account + Real-time Developer Notifications

1. 🖐 Google Cloud Console → create/select a project → enable **Google Play Android Developer API** → create a **service account** → create a JSON key.
2. 🖐 Play Console → Users and permissions → invite the service account email → grant **View financial data** + **Manage orders and subscriptions**.
3. Base64 the JSON key → Vercel env `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`; set `ANDROID_PACKAGE_NAME=com.getinshape.app`; pick a random `PLAY_RTDN_SECRET`.
4. 🖐 Cloud Pub/Sub: create topic `play-rtdn` → add a **push subscription** to `https://www.getinshape.co.in/api/play/rtdn?secret=<PLAY_RTDN_SECRET>` → grant `google-play-developer-notifications@system.gserviceaccount.com` the **Pub/Sub Publisher** role on the topic.
5. 🖐 Play Console → Monetize → Monetization setup → enter the topic name → **Send test notification** → confirm a 200 in Vercel logs for `/api/play/rtdn`.

## 8. Rollout

1. 🖐 **Internal testing** track → upload `app-release-bundle.aab` → add your Google account as tester → install via the opt-in link.
2. Verify on-device:
   - [ ] No URL bar (asset links OK — see §3)
   - [ ] `/upgrade` shows **Google Play** branding (Digital Goods API detected)
   - [ ] Full purchase flow with a [license-tester account](https://play.google.com/console) (test purchases aren't charged) → `subscriptions` row upserted, Pro gates open
   - [ ] Cancel from Play → RTDN flips status (may take a minute)
   - [ ] Rating card appears on the dashboard with a 3+ day streak
   - [ ] Push notifications, camera scan, and the paywall interstitial after the 3rd log
3. 🖐 Complete all "App content" items until the dashboard shows no errors → **Production** release. First-app review can take up to ~7 days.
4. Post-launch: link the listing from the web app footer. (Padded maskable icons already ship at `/icons/icon-maskable-{192,512}.png`.)

---

*Committed code that supports this launch: `/delete-account` page (Data safety URL), canonical `/manifest.webmanifest` (name/start_url/icons), `twa-manifest.json` (Bubblewrap config with Play Billing), rating prompt (TWA-only, streak ≥ 3), one-time paywall interstitial after the 3rd log, first-log + onboarding celebrations.*
