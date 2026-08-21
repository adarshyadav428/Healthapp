## Phase 2 — Test-suite quality review (not just "does it pass")

A green suite is not evidence of coverage. For every file in `health-app/lib/`, answer:

- Is there a test file for it? Is the *behaviour that matters* pinned, or only the happy
  path?
- Which of these would survive a deliberate sabotage? Pick **five** load-bearing pure
  functions (candidates: `lib/searchRanking.ts`, `lib/streak.ts`, `lib/dateUtils.ts`,
  `lib/aiTrial.ts`, `lib/pushBudget.ts`, `lib/tdee.ts`), mutate the logic in a scratch
  copy, and confirm the suite actually goes red. Report any that stay green — that's a
  test that isn't testing.
- Which `lib/` modules have **no** test file at all? List them and say which of those
  gaps actually matter.
- What is completely untested? Specifically: API route handlers, RLS policies,
  middleware redirects, webhook signature verification, the service worker.

Deliverable: a coverage-gap table ranked by risk, and a concrete list of the tests you'd
write first (do not write them yet).
