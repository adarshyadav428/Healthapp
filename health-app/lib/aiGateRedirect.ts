import type { AiTrialBlock } from './aiTrial'

/**
 * What the client should do when an AI scan (camera or chat) comes back
 * 403-gated.
 *
 * Standalone surfaces (the Food-tab FAB, the dashboard scan button) send the
 * user to the paywall — that has always been the behaviour and it stays exact.
 *
 * Inside the onboarding wizard, a redirect is wrong: a brand-new account is
 * always email-unverified, so `block` is always `'unverified'`, so *every*
 * new user who taps "photo" or "chat" on step 1 gets ejected onto /upgrade
 * before they have seen the plan they signed up for. The activation-first step
 * can't activate anyone through those paths. So in onboarding we keep the user
 * in the wizard, tell them how to unlock AI, and let the flow advance to a
 * path that works (search on the next screen).
 *
 * The server gate itself is untouched — it still 403s and fails closed. This
 * only decides what the client does with that 403.
 */
export function resolveAiGateAction(args: {
  block: AiTrialBlock | undefined
  scan: 'camera' | 'chat'
  context: 'standalone' | 'onboarding'
}): { kind: 'redirect'; href: string } | { kind: 'stay'; message: string } {
  const { block, scan, context } = args

  if (context === 'onboarding') {
    return {
      kind: 'stay',
      message:
        block === 'unverified'
          ? 'Confirm your email to unlock 3 free AI scans. For now, add your meal by search on the next screen.'
          : "You've used your free AI scans — they're unlimited on Pro. Add your meal by search on the next screen.",
    }
  }

  const reason =
    block === 'unverified'
      ? 'verify_ai'
      : scan === 'camera'
        ? 'camera_scan_pro'
        : 'chat_scan_pro'
  return { kind: 'redirect', href: `/upgrade?reason=${reason}` }
}
