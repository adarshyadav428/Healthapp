import { describe, it, expect } from 'vitest'
import {
  FIRST_TOUCH_COOKIE,
  buildFirstTouch,
  serializeFirstTouch,
  readFirstTouch,
  firstTouchPersonProps,
} from '../lib/attribution'

const NOW = new Date('2026-08-29T10:00:00.000Z')

function build(url: string, referer: string | null = null, selfHost: string | null = 'getinshape.co.in') {
  const u = new URL(url, 'https://getinshape.co.in')
  return buildFirstTouch({
    searchParams: u.searchParams,
    referer,
    pathname: u.pathname,
    selfHost,
    now: NOW,
  })
}

describe('buildFirstTouch', () => {
  it('captures utm params on a campaign landing', () => {
    const ft = build('/?utm_source=insta&utm_medium=bio&utm_campaign=launch')
    expect(ft).toMatchObject({
      utm_source: 'insta',
      utm_medium: 'bio',
      utm_campaign: 'launch',
      landing_path: '/',
      ts: NOW.toISOString(),
    })
  })

  it('captures a click id', () => {
    expect(build('/?gclid=abc123')?.gclid).toBe('abc123')
  })

  it('returns null for a bare internal visit with no signal', () => {
    expect(build('/')).toBeNull()
    expect(build('/dashboard')).toBeNull()
  })

  it('keeps an external referrer but drops a same-host one', () => {
    expect(build('/', 'https://www.google.com/search?q=x')?.referrer).toBe(
      'https://www.google.com/search?q=x',
    )
    expect(build('/dashboard', 'https://getinshape.co.in/log')).toBeNull()
  })

  it('always attributes a /foods/* SEO landing even with no params', () => {
    const ft = build('/foods/poha')
    expect(ft?.landing_path).toBe('/foods/poha')
  })

  it('caps overlong values', () => {
    const ft = build(`/?utm_campaign=${'x'.repeat(500)}`)
    expect(ft?.utm_campaign?.length).toBe(200)
  })
})

describe('readFirstTouch', () => {
  it('round-trips a serialized record', () => {
    const ft = build('/?utm_source=insta&utm_campaign=launch')!
    const cookie = `${FIRST_TOUCH_COOKIE}=${encodeURIComponent(serializeFirstTouch(ft))}`
    expect(readFirstTouch(cookie)).toMatchObject({ utm_source: 'insta', utm_campaign: 'launch' })
  })

  it('finds the cookie among others', () => {
    const ft = build('/?utm_source=x')!
    const cookie = `foo=1; ${FIRST_TOUCH_COOKIE}=${encodeURIComponent(serializeFirstTouch(ft))}; bar=2`
    expect(readFirstTouch(cookie)?.utm_source).toBe('x')
  })

  it('returns null on garbage, a missing cookie, or an empty string', () => {
    expect(readFirstTouch('')).toBeNull()
    expect(readFirstTouch('other=1')).toBeNull()
    expect(readFirstTouch(`${FIRST_TOUCH_COOKIE}=not-json`)).toBeNull()
    expect(readFirstTouch(`${FIRST_TOUCH_COOKIE}=${encodeURIComponent('"a string"')}`)).toBeNull()
    expect(readFirstTouch(`${FIRST_TOUCH_COOKIE}=${encodeURIComponent('{}')}`)).toBeNull()
  })
})

describe('firstTouchPersonProps', () => {
  it('namespaces keys with initial_ and maps ts to initial_touch_at', () => {
    const ft = build('/?utm_source=insta')!
    expect(firstTouchPersonProps(ft)).toEqual({
      initial_utm_source: 'insta',
      initial_landing_path: '/',
      initial_touch_at: NOW.toISOString(),
    })
  })

  it('is undefined for null input', () => {
    expect(firstTouchPersonProps(null)).toBeUndefined()
  })
})
