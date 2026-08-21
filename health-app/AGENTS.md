# AGENTS.md

**`CLAUDE.md` in this directory is the authoritative guide for this codebase** — stack, architecture,
the hard constraints, and the reasoning behind the non-obvious parts of the search, billing and growth
code. Read it before changing anything. This file exists only so agents that look for `AGENTS.md` are
pointed at the right place.

- **Project:** Next.js 14 (App Router), TypeScript strict, Tailwind, Supabase. Package manager: **npm**.
- **Working directory:** run every command from `health-app/`, not the repo root (the root is a
  Bubblewrap Android wrapper — see the root `CLAUDE.md`).

## Verification gates — all five must pass before any change is done

```bash
npm test             # vitest — 67 files / 917 tests
npx tsc --noEmit
npm run lint
npm run check:tokens # no raw hex, no broken Tailwind opacity modifiers
npm run build
```

Run a single test with `npx vitest run tests/<name>.test.ts`, or a single case with `-t "<substring>"`.

`TESTING.md` covers what the automated suite can't reach (anything behind auth, anything needing a real
phone, the IST day boundary).
