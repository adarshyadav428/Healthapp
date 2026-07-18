# Deferred email verification

**Status:** code complete on `feat/deferred-signup` (2026-07-18). Inert until the
two manual steps below.

Replaces the abandoned anonymous-auth approach (reverted in `17f6bda`) — the ask
was to remove the *confirmation* wall at signup, not the signup form.

## What changes for the user

Today: enter email + password → "check your inbox" → find the email → click →
*then* the app. Every one of those steps loses people, and the app hasn't done
anything for them yet.

After: enter email + password → straight into onboarding. Three days later, once
they've had time to decide the app is worth keeping, a dismissible card on the
dashboard asks them to confirm the address.

## The two manual steps — order matters

1. **Apply `027_email_verification.sql`** via the Supabase SQL editor.
2. **Then** Supabase → Authentication → Providers → Email → turn **Confirm email**
   OFF.

Reversed, anyone who signs up in between gets marked verified without proving
anything. The migration backfills `email_verified_at` from
`auth.users.email_confirmed_at` for everyone who signed up while confirmation was
still mandatory — they already proved ownership and must not be nagged again —
and that backfill is only correct while the setting is still on.

Verify with:

```sql
-- Expect: one row
select column_name from information_schema.columns
where table_name = 'profiles' and column_name = 'email_verified_at';

-- Expect: 0 (every pre-existing user backfilled)
select count(*) from profiles p
join auth.users u on u.id = p.id
where u.email_confirmed_at is not null and p.email_verified_at is null;
```

## Why we track verification ourselves

The obvious approach — read `auth.users.email_confirmed_at` — does not work.
**With "Confirm email" off, Supabase auto-stamps that column at signup**, so it
says nothing about whether the address is real. Hence `profiles.email_verified_at`
(migration 027), which is only ever set by proof of delivery.

## How proof works

`VerifyEmailCard` sends a magic link via `signInWithOtp({ shouldCreateUser: false })`
to the address on file. Clicking it lands on `/auth/callback`, which stamps
`email_verified_at`.

The stamp is unconditional on any successful callback, which is deliberate — every
path that reaches it is valid proof:

- verification magic link → delivered to that address
- signup confirmation link → same
- Google OAuth → Google has already verified the address

So Google sign-ups are verified for free, and never see the card.

## Why chase verification at all

An unverified address is a typo nobody has caught yet. That costs the user their
password reset, and costs us every streak reminder, weekly recap and payment
receipt we try to send. The card says exactly this — it leads with the password
reset, because that's the part the user cares about.

## Files

| File | Role |
|---|---|
| `supabase/migrations/027_email_verification.sql` | `email_verified_at` + backfill + partial index |
| `lib/emailVerification.ts` | Pure gating: 3-day grace, 7-day dismiss cooldown |
| `tests/emailVerification.test.ts` | 14 tests over the gating and state parsing |
| `components/dashboard/VerifyEmailCard.tsx` | The nudge; sends the magic link |
| `app/auth/callback/route.ts` | Stamps `email_verified_at` on proof |
| `types/index.ts` | `Profile.email_verified_at` |

Tuning knobs are `VERIFY_PROMPT_GRACE_DAYS` (3) and `VERIFY_PROMPT_COOLDOWN_DAYS`
(7) in `lib/emailVerification.ts`.

## Verified, and not

Verified: 254 tests (14 new), typecheck, lint, token check, production build all
green. The landing page and auth pages render correctly after the anonymous-auth
revert, with no console errors.

**Not verified — needs the manual steps plus a real account:** the end-to-end
flow. Nobody has signed up without confirmation, no card has rendered, and no
magic link has been sent or clicked. Walk it through once the toggle is off:

1. Sign up with a fresh address → you should land in onboarding, no inbox trip.
2. Check `profiles` — `email_verified_at` should be NULL for that user.
3. The card should NOT appear for 3 days. To test now, temporarily lower
   `VERIFY_PROMPT_GRACE_DAYS` to 0 rather than waiting.
4. Tap "Send link" → check the inbox → click it.
5. Confirm `email_verified_at` is now set and the card is gone.

## Not built, deliberately

- **No checkout gate.** An unverified user can still subscribe. Blocking revenue
  on email verification is a product call, not a technical one — say the word if
  you want it.
- **A dismissed card comes back after 7 days,** forever. There's no permanent
  "never ask me again", on the grounds that an unverifiable account is a genuine
  support liability. Reconsider if it annoys people.
- **`026_anonymous_users.sql` stays applied.** Its `DROP NOT NULL` on
  `profiles.email` is now unused but harmless; its `on_auth_user_email_changed`
  trigger is independently useful and fixes a real pre-existing desync bug.
