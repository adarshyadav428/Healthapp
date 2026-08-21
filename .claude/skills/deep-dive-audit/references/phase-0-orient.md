## Phase 0 — Orient (do this before touching anything)

1. Confirm you are in the right copy of the repo:
   ```bash
   git rev-parse --show-toplevel && git log --oneline -5 && git status --short
   ```
   Duplicate copies of this repo have appeared on this machine before. The app lives in
   the `health-app/` subdirectory. If the toplevel is anything other than
   `C:/Users/plump/Downloads/Health App`, stop and tell me.

2. Read these in full before forming any opinion:
   - `health-app/CLAUDE.md` — **authoritative**. The "Hard constraints" section is not
     negotiable and several long paragraphs record *why* a piece of logic looks the way
     it does. If you are about to call something a bug, check it isn't documented here
     as deliberate.
   - `health-app/TESTING.md` — the existing manual test script.
   - `health-app/docs/qa-audit-2026-07-16.md` — the previous full audit. **Do not
     re-report anything in it that has since been fixed.** Instead, pick its four P0s
     and a sample of five P1s and *verify the fixes still hold* — regressions are more
     valuable than rediscoveries.
   - `health-app/docs/launch-plan-2026-07-17.md`, `docs/next-steps-2026-07-24.md`,
     `docs/growth-mechanics-plan-2026-07-29.md`, `docs/play-store-launch.md`,
     `docs/deferred-email-verification.md`, `docs/refactor-safety-contract.md`.
   - `git log --oneline -40` — the last month of work is growth mechanics, search
     ranking and Play billing honesty. Those are the newest and least-verified code.

3. Tell me in ≤10 lines what you understood the product to be and what you plan to do.
   Then start Phase 1 without waiting for me.
