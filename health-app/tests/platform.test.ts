import { describe, it, expect } from 'vitest'
import { detectPlatform } from '../lib/platform'

/** A minimal Window stand-in for detectPlatform. */
function fakeWindow(opts: {
  referrer?: string
  standaloneMedia?: boolean
  navigatorStandalone?: boolean
}): Window {
  return {
    document: { referrer: opts.referrer ?? '' },
    matchMedia: (q: string) => ({ matches: q.includes('standalone') ? !!opts.standaloneMedia : false }),
    navigator: { standalone: opts.navigatorStandalone },
  } as unknown as Window
}

describe('detectPlatform', () => {
  it('is "web" when there is no window (SSR)', () => {
    expect(detectPlatform(undefined)).toBe('web')
  })

  it('is "twa" when the referrer is an android-app:// URL', () => {
    expect(detectPlatform(fakeWindow({ referrer: 'android-app://in.co.getinshape.app' }))).toBe('twa')
  })

  it('is "pwa" in standalone display mode', () => {
    expect(detectPlatform(fakeWindow({ standaloneMedia: true }))).toBe('pwa')
  })

  it('is "pwa" when navigator.standalone is true (iOS installed)', () => {
    expect(detectPlatform(fakeWindow({ navigatorStandalone: true }))).toBe('pwa')
  })

  it('is "web" in a normal browser tab', () => {
    expect(detectPlatform(fakeWindow({}))).toBe('web')
  })

  it('prefers twa over pwa when both signals are present', () => {
    expect(
      detectPlatform(fakeWindow({ referrer: 'android-app://x', standaloneMedia: true })),
    ).toBe('twa')
  })
})
