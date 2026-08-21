## Phase 5 — Adversarial pass

Try to break it on purpose:

- Call the AI routes **directly** as a free user with a valid session cookie, past the
  trial allowance. They must 403. Then try after clearing local storage, after signing
  out and in, and from a second device — the lifetime pool must hold.
- Make an unverified account and try to spend the AI trial. It must be locked.
- Try to read another user's rows through PostgREST with a normal anon key (RLS check).
- Replay a Razorpay webhook. Replay a Play RTDN. Send a Play purchase token that's
  already bound to another account.
- Submit every form with: empty, negative, zero, absurdly large (age 900, weight 5000 kg,
  height 3 cm), non-numeric, emoji, 10,000 characters, SQL-ish and HTML-ish payloads.
- Log 200 foods in one day. Load a day with 100 logs. Load an account with 2 years of
  history.
- Kill the network mid-log. Kill it mid-checkout. Double-tap every submit button.
- Take Open Food Facts, Gemini and Razorpay offline (block the hosts) and confirm each
  failure is honest, fast, and never poisons the shared search cache.
- Back button, browser refresh mid-flow, deep-link into every authenticated page while
  signed out, deep-link into `/onboarding` when already onboarded.
- Screen reader / keyboard-only pass on the four core tab screens and the checkout.
