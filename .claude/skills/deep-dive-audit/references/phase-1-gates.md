## Phase 1 — Automated gates (stop and report if any are red)

Run each and record the **actual** numbers. Docs and memory in this repo have understated
the test count before — trust the terminal, not the prose.

```bash
cd health-app && npm test
```
```bash
cd health-app && npx tsc --noEmit
```
```bash
cd health-app && npm run lint
```
```bash
cd health-app && npm run check:tokens
```
```bash
cd health-app && npm run build
```

Notes: `check:tokens` prints `0 violation(s) across 0 file(s)` when it is clean — the
trailing count is *violating* files, not scanned files. That is not a bug; don't
investigate it.

Also report: how long the build takes, how many static pages it emits, and any warning
that appears in the build output (warnings have been ignored for a while — I want them
listed, then triaged).
