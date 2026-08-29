import { describe, it, expect } from 'vitest'
import { resolveAiGateAction } from '../lib/aiGateRedirect'

describe('resolveAiGateAction — standalone (unchanged behaviour)', () => {
  it('redirects an unverified camera scan to verify_ai', () => {
    expect(resolveAiGateAction({ block: 'unverified', scan: 'camera', context: 'standalone' })).toEqual({
      kind: 'redirect',
      href: '/upgrade?reason=verify_ai',
    })
  })

  it('redirects an unverified chat scan to verify_ai', () => {
    expect(resolveAiGateAction({ block: 'unverified', scan: 'chat', context: 'standalone' })).toEqual({
      kind: 'redirect',
      href: '/upgrade?reason=verify_ai',
    })
  })

  it('redirects an exhausted camera scan to camera_scan_pro', () => {
    expect(resolveAiGateAction({ block: 'exhausted', scan: 'camera', context: 'standalone' })).toEqual({
      kind: 'redirect',
      href: '/upgrade?reason=camera_scan_pro',
    })
  })

  it('redirects an exhausted chat scan to chat_scan_pro', () => {
    expect(resolveAiGateAction({ block: 'exhausted', scan: 'chat', context: 'standalone' })).toEqual({
      kind: 'redirect',
      href: '/upgrade?reason=chat_scan_pro',
    })
  })

  it('treats an unknown block like exhausted (never verify_ai without the signal)', () => {
    expect(resolveAiGateAction({ block: undefined, scan: 'camera', context: 'standalone' })).toEqual({
      kind: 'redirect',
      href: '/upgrade?reason=camera_scan_pro',
    })
  })
})

describe('resolveAiGateAction — onboarding (stay in the wizard)', () => {
  it('keeps an unverified user in the wizard with a verify-email message', () => {
    const action = resolveAiGateAction({ block: 'unverified', scan: 'camera', context: 'onboarding' })
    expect(action.kind).toBe('stay')
    expect(action).toMatchObject({ kind: 'stay' })
    if (action.kind === 'stay') {
      expect(action.message).toMatch(/confirm your email/i)
      expect(action.message).toMatch(/search/i)
    }
  })

  it('keeps an exhausted user in the wizard with a Pro message', () => {
    const action = resolveAiGateAction({ block: 'exhausted', scan: 'chat', context: 'onboarding' })
    expect(action.kind).toBe('stay')
    if (action.kind === 'stay') expect(action.message).toMatch(/pro/i)
  })

  it('never returns a redirect in onboarding', () => {
    for (const block of ['unverified', 'exhausted', undefined] as const) {
      for (const scan of ['camera', 'chat'] as const) {
        expect(resolveAiGateAction({ block, scan, context: 'onboarding' }).kind).toBe('stay')
      }
    }
  })
})
