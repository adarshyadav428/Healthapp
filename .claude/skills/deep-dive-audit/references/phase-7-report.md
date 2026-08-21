## Phase 7 — The report

Write it to `health-app/docs/deep-dive-audit-<YYYY-MM-DD>.md` with this structure:

1. **Executive summary** — ≤400 words. Verdict first: is this launch-ready, and if not,
   what is the gap in days of work.
2. **Gate results** — the real numbers from Phase 1.
3. **Findings**, as a table, severity-ordered. Columns: ID · Severity · Finding · Repro ·
   Evidence · `file.ts:line` · Confidence.
   - **P0** — broken, data-loss, security, money, or a false public claim. Blocks launch.
   - **P1** — works but damages trust, retention or conversion.
   - **P2** — polish.
4. **Regression check** — the previous audit's P0s and the five P1s you re-tested, with
   verdicts.
5. **Coverage gaps** — Phase 2's table.
6. **The four product tables** — Phase 6.
7. **Direct answers** — the six questions in Phase 6.
8. **Top 10, ranked** — what to do next, in order, with effort estimates. This is the
   section I will actually work from.
9. **False alarms discarded** — things you suspected and disproved. Include this; a
   previous audit caught two of its own false positives this way and that made the rest
   of it trustworthy.
10. **What you could not test**, and what you'd need from me to test it.

Then give me a ≤30-line summary in chat.
