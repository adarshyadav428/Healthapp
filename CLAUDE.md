# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Two projects share this repository:

1. **`health-app/`** — the real application. **GetInShape**, a Next.js 14 (App Router) calorie and
   weight-tracking PWA for the Indian market. This is where essentially all work happens.
2. **The repo root** — a [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap)-generated
   Android **TWA wrapper** that ships the same website to Google Play as `in.co.getinshape.app`. It
   contains no application logic; it is a thin native shell pointed at `www.getinshape.co.in`.

**`health-app/CLAUDE.md` is authoritative for all application work.** Read it before changing anything
under `health-app/`. This file covers only the root-level Android wrapper and the boundary between the two.

## Directory map (root only)

- **`twa-manifest.json`** — the **source of truth** for the Android build: package id
  (`in.co.getinshape.app`), host (`www.getinshape.co.in`), start URL (`/dashboard`), theme colors,
  `appVersionCode`/`appVersionName`/`appVersion`, and the Play Billing feature flag (`playBilling.enabled`).
  Keep `appVersionCode`, `appVersionName` and `appVersion` in sync (all `3` today).
- **`.claude/skills/`** — checked in on purpose (the `!.claude/skills/` negation in `.gitignore`);
  the rest of `.claude/` is ignored. Shared skills such as the deep-dive audit live here and apply
  to `health-app/` work.
- **`package-lock.json`** (root) — a 15-byte stub with no accompanying `package.json`. It is not a
  real Node project; see the Hard rule below.
- **`GetInShape-Roadmap.pdf`, `.vercel/`** — personal planning artifact and Vercel link data,
  both gitignored.
- **`app/`, `gradle/`, `.gradle/`, `build.gradle`, `settings.gradle`, `gradle.properties`, `gradlew*`,
  `manifest-checksum.txt`, `store_icon.png`** — **generated output**, regenerated from
  `twa-manifest.json`. All gitignored. Note the root `.gitignore` anchors these paths with a leading
  slash on purpose: a bare `app/` would also swallow `health-app/app/`, which is the Next.js source.
- **`android.keystore`, `app-release-*.aab/.apk/.idsig`** — signing key and build artifacts. Gitignored.
- **`.github/workflows/reminder-tick.yml`** — hourly ping to the app's reminder endpoint. It lives at
  the root because that's where GitHub Actions looks, but it belongs to the app: see
  `health-app/lib/reminderSchedule.ts`.

## Commands

Every npm command belongs to `health-app/`, not the root. Either `cd health-app` first, or use `--prefix`:

```bash
cd health-app && npm run dev       # dev server at http://localhost:3000
npm --prefix health-app test       # run the test suite without changing directory
```

The full command set (dev, build, test, single test, typecheck, lint, token guard, the five gates)
is in `health-app/CLAUDE.md`.

Rebuilding the Android wrapper (rarely needed — only for a new Play release):

```bash
bubblewrap update && bubblewrap build
```

`bubblewrap` is a **global CLI** (`@bubblewrap/cli`), not a dependency of either project — it is not
in any `package.json`. It needs a JDK and the Android SDK; its own config lives in `~/.bubblewrap/`.
`bubblewrap build` writes the `.aab`/`.apk` to the repo root and signs with `android.keystore`.

## Hard rules — never violate

- **Never hand-edit the generated Android project** (`app/`, `gradle/`, `build.gradle`, …). Change
  `twa-manifest.json` and regenerate; a hand edit is silently discarded on the next `bubblewrap update`.
- **Never commit `android.keystore`, `.aab`, `.apk` or `.idsig` files.** Losing or leaking the keystore
  means the app can never be updated on Play under the same identity.
- **Bump `appVersionCode` in `twa-manifest.json`** for every Play upload — Play rejects a duplicate.
- **Don't run npm commands from the repo root.** There is no meaningful `package.json` here; a
  root-level `npm install` does nothing useful.
- **Changing the host, start URL or package id breaks Digital Asset Links.**
  `health-app/public/.well-known/assetlinks.json` is served by the web app and must keep matching the
  signing certificate, or the TWA falls back to a browser tab with visible Chrome UI — and Play Billing
  stops working.
