# Google Play Store launch runbook — GetInShape

Package: `in.co.getinshape.app` · Host: `https://www.getinshape.co.in` · Play Console org: **Plum2408** (DUNS + website verified 2026-07-12)

Work through the sections **in order**. Steps marked 🖐 are manual (dashboard/console clicks only you can do).

---

## 1. Pre-flight (before building anything) — mostly ✅ as of 2026-07-24

> **Do not work from this section as a to-do list any more.** Most of it is done; the live state was re-probed 2026-07-24. The current, ordered plan is **`docs/next-steps-2026-07-24.md`** — start there.

- [x] ~~Apply pending migrations~~ — **every migration through `027` is applied live.** `015`/`024`/`025` landed 2026-07-18, `027` after that. `011` is deliberately skipped. Nothing to apply. (`015` was *half*-applied — table and SELECT policy present, INSERT policy missing — so probe policies and indexes, not just tables.)
- [x] ~~Flip `NEXT_PUBLIC_APP_URL`~~ — set to `https://www.getinshape.co.in`; apex 308s to www, sitemap carries zero apex URLs.
- [x] ~~Deploy the current main~~ — `/delete-account` (now documenting **partial** data deletion too) and `/manifest.webmanifest` are live.
- [ ] 🖐 **Rotate the Supabase service-role key** (Supabase → Settings → API → regenerate `service_role`). Update `SUPABASE_SERVICE_ROLE_KEY` in Vercel + local `.env.local`, redeploy. Also delete the old Stripe **test** keys (Stripe is legacy-only). **Still pending.**
- [ ] 🖐 **Razorpay (web billing, parallel track):** once KYC approves — create plans Monthly ₹299 / Annual ₹1,999 (Payments → Subscriptions), add webhook `https://www.getinshape.co.in/api/razorpay/webhook` (events: `subscription.activated/charged/cancelled/completed`), set the 5 env vars (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_MONTHLY_PLAN_ID`, `RAZORPAY_ANNUAL_PLAN_ID`) in Vercel, redeploy. **Still pending — gates web revenue only, not the Play launch.**
- [ ] Confirm Play env vars exist in Vercel (values come from §6–7): `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` (base64), `ANDROID_PACKAGE_NAME=in.co.getinshape.app`, `PLAY_RTDN_SECRET`, `NEXT_PUBLIC_PLAY_PRODUCT_MONTHLY`, `NEXT_PUBLIC_PLAY_PRODUCT_ANNUAL`.
- [ ] 🖐 **Supabase → Auth → Providers → Email → Confirm email OFF.** Migration `027` is already applied, so the ordering rule is satisfied and this is safe to do now. Until it flips, the deferred-signup flow is inert.

## 2. Build the TWA (Bubblewrap) — ✅ DONE 2026-07-19

`app-release-bundle.aab` (2.19 MB) and `app-release-signed.apk` (1.90 MB) are built and sitting at the repo root, git-ignored. Bubblewrap 1.24.1.

**If you ever need to rebuild**, the toolchain is already set up and its config lives at `C:\Users\plump\.bubblewrap\config.json`:

```bash
cd "C:\Users\plump\Downloads\Health App"
bubblewrap update      # re-applies twa-manifest.json to the Android project
bubblewrap build       # prompts for the two keystore passwords
```

### Traps this build actually hit — read before rebuilding on a new machine

- **Bubblewrap's bundled downloader silently produces broken installs.** It fetched the JDK *sources* archive instead of a runnable JDK, and extracted only 6 of 87 files from the Android command-line tools zip — leaving `sdklib.jar` missing, which surfaces as `ClassNotFoundException: SdkManagerCli`. Both downloads were intact; only the extraction failed, and it wrote nothing to its config either time. Install the JDK yourself (`winget install Microsoft.OpenJDK.17`) and unzip the SDK tools manually if `bubblewrap doctor` reports invalid paths.
- **The JDK must live in a path with no spaces.** Bubblewrap builds the `apksigner` command without quoting it, so a JDK under `C:\Program Files\…` fails with `'C:\Program' is not recognized`. It is installed at `C:\Users\plump\jdk17` for this reason.
- **`bubblewrap init` overwrites the committed `twa-manifest.json`.** It reset the light-mode `navigationColor` to `#000000` (black nav bar against the Porcelain canvas), flattened the Onyx darks to pure black, and hardcoded an absolute keystore path containing the username. Always `git diff twa-manifest.json` after `init` and restore the deliberate values.
- **`alphaDependencies: false` is correct now** and should not be "fixed" back to `true`. Bubblewrap 1.24.1 pulls Play Billing from the stable `com.google.androidbrowserhelper:billing:1.1.0`; the committed `true` was for an older CLI. Verify with `grep billing app/build.gradle` after a build.
- `bubblewrap update` bumps `appVersionCode`/`appVersionName` on every run. Play only requires `versionCode` to increase, so this is harmless — but set `appVersionName` deliberately before a release build if you care what users see.

🖐 **The keystore is the one irreplaceable artifact.** `android.keystore` (alias `android`) is git-ignored, so git is *not* a backup. Keep it plus both passwords in a password manager and one offline copy.

## 3. Digital Asset Links (kills the browser URL bar) — ✅ **FULLY DONE** (both keys, verified 2026-07-24)

> **Both fingerprints are live and accepted by Google.** `curl` against the Digital Asset Links API returns **2 statements** for `in.co.getinshape.app`. Upload key `09:5C:9C:…:87:5D`, Play App Signing key `1B:72:36:A5:…:E5:7E`. The "remaining step" below is therefore **already complete** — kept for reference only. That the Play signing key exists at all means the Play Console app is created and enrolled in App Signing.

**Upload-key fingerprint is live and verified** (2026-07-19):

```
09:5C:9C:F7:D7:C4:30:B9:5A:E0:DE:92:B7:6E:37:35:D1:69:01:DB:7D:91:53:45:D4:7F:3A:98:B9:63:87:5D
```

> ⚠️ The fingerprint that sat in this file until today (`41:BD:A6:3D:…`) was a **ghost** — committed in `53bc318`, matching no key that has ever existed here. Shipping it would have left the installed app showing a browser URL bar. If you see that value again, something restored a stale copy.

Verified three ways: read from the signed APK via `apksigner verify --print-certs` (no keystore password needed), confirmed served at `https://www.getinshape.co.in/.well-known/assetlinks.json`, and confirmed accepted by **Google's own Digital Asset Links API** — the same service Android queries:

```bash
curl "https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://www.getinshape.co.in&relation=delegate_permission%2Fcommon.handle_all_urls"
# → 1 statement, package in.co.getinshape.app, cert 09:5C:9C:...
```

On-device confirmation: the sideloaded APK opens **full-screen with no URL bar**, and logcat shows `Verification result: ... --> true` / `Verification 4 complete. Success:true. Failed hosts:.`

### Remaining step — after the first upload

Play App Signing issues a **second, different** certificate. Both fingerprints must be listed: the upload key covers your local/test installs, Google's key covers everything users download from the store.

1. 🖐 Play Console → **Test and release → App integrity → App signing** tab → copy the **App signing key certificate** SHA-256. (There is no "Setup" section — an earlier draft of this runbook said so and it was wrong. The page also lists the **Upload key certificate**, which is the `09:5C:9C:…` one you already have; make sure you copy the other block.)
2. Add it alongside the existing one (do **not** replace it):
   ```json
   "sha256_cert_fingerprints": ["09:5C:9C:...:87:5D", "<play app signing fp>"]
   ```
3. Deploy, re-run the Google API check above — it should return **2** statements.
4. Install from the Play testing track and confirm the URL bar is still gone.

> If a freshly deployed change appears not to have landed, give it a few minutes before concluding anything. Vercel reporting "Ready" precedes edge propagation, and the service worker revalidates on a cycle — a stale render was mistaken for a caching bug during this build. `sw.js` is regenerated per deploy and already calls `skipWaiting()`/`clientsClaim()`; the `pages` cache is NetworkFirst. Updates do reach installed apps.

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
> **Pro (₹299/month or ₹1,999/year, both with a 3-day free trial):** full history, unlimited AI logging, custom foods & family recipes.
>
> Your data stays yours — no ads, no selling data. Delete your account anytime.

**Assets checklist:**
- [x] App icon 512×512 PNG — `store-assets/play-icon-512.png` (white ember flame on the CTA gradient; SVG source at `store-assets/icon-source.svg`)
- [x] Feature graphic 1024×500 — `store-assets/feature-graphic-1024x500.png`
- [x] **6 phone screenshots — `store-assets/screenshots/`**, captured 2026-07-19 from the Android 14 emulator on the `+qa1` fixture. All **1080×1920** (exactly the 9:16 Play wants, so no cropping) and ~230–290 KB each, far under the 8 MB cap:
  | File | Shows |
  |---|---|
  | `01-dashboard.png` | Calorie ring at 1,142/1,600, macro rings, 8-day streak, coaching line |
  | `02-food-search.png` | Indian search placeholder, Scan meal CTA, Shahi paneer + Tandoori Roti |
  | `03-trends-badges.png` | Streak, current weight, badge shelf (4 of 10) |
  | `04-weight-progress.png` | 84.5 kg, 5.5 kg lost, progress bar to the 70 kg goal |
  | `05-weight-trend.png` | BMI scale + trend chart falling 90 → 84.5 |
  | `06-upgrade-pricing.png` | ₹299/mo and ₹1,999/yr, 3-day trial on both |
  Upload order matters — Play shows them left-to-right, so `01` should stay first.
- [ ] Optional: 7"/10" tablet screenshots (skippable for v1)

**Emulator recipe** (for re-shooting later — the AVD already exists):
```bash
SDK=~/.bubblewrap/android_sdk
$SDK/emulator/emulator.exe -avd getinshape        # Pixel 2 profile = 1080x1920 = 9:16
$SDK/platform-tools/adb.exe install -r app-release-signed.apk
$SDK/platform-tools/adb.exe shell screencap -p /sdcard/s.png
$SDK/platform-tools/adb.exe pull /sdcard/s.png ./shot.png
```
Two gotchas: in Git Bash prefix with `MSYS_NO_PATHCONV=1` or `/sdcard/…` gets rewritten into a Windows path; and pull the file rather than redirecting `exec-out` through PowerShell, which corrupts the PNG with a BOM.

## 5. Declarations (App content section)

- [ ] 🖐 **App access — REQUIRED, and a common rejection cause.** Every route except `/`, `/auth/*`, `/api/*`, `/privacy`, `/terms`, `/upgrade`, `/delete-account`, `/studio` and `/foods/*` is behind a login (`middleware.ts`), so Play **requires** reviewer credentials under **App access → All or some functionality is restricted**. Supply the permanent `+qa1` account and its password, plus this note verbatim:
  > AI photo scan and AI chat logging are Pro features. Free accounts get 3 lifetime trial scans, which unlock only after the account's email address is verified. The test account provided is already verified, so the AI features are accessible.

  Without that note a reviewer hits the gate and can file the app's headline feature as broken.

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
  - `pro_monthly` — base plan ₹299/month, auto-renewing, **+ offer: 3-day free trial** (new subscribers).
  - `pro_annual` — base plan ₹1,999/year, auto-renewing, **+ offer: 3-day free trial** (new subscribers).
  - 3 days is Google's **minimum** allowed free-trial length — Play rejects anything shorter.
- [ ] Product IDs must equal the env vars `NEXT_PUBLIC_PLAY_PRODUCT_MONTHLY` / `NEXT_PUBLIC_PLAY_PRODUCT_ANNUAL` (`lib/play/products.ts` reads them).
- [ ] 🖐 Payments profile: uses the **Adarsh Medicals** sole-proprietorship details (same as Razorpay KYC).

## 7. Service account + Real-time Developer Notifications

1. 🖐 Google Cloud Console → create/select a project → enable **Google Play Android Developer API** → create a **service account** → create a JSON key.
2. 🖐 Play Console → Users and permissions → invite the service account email → grant **View financial data** + **Manage orders and subscriptions**.
3. Base64 the JSON key → Vercel env `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`; set `ANDROID_PACKAGE_NAME=in.co.getinshape.app`; pick a random `PLAY_RTDN_SECRET`.
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
