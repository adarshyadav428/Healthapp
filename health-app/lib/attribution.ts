/**
 * First-touch attribution.
 *
 * The growth-advice audit's Chapter 1 scored 1/10: nothing in the app could
 * tell where a signup came from. This is the code-side fix. `middleware.ts`
 * stamps a `gis_attr` cookie the first time a visitor arrives with campaign
 * params (or from an external referrer, or on a /foods/* SEO page); the client
 * reads it at `identify` time and sends it to PostHog as a `$set_once` person
 * property, namespaced `initial_*` so it never collides with event-level UTM.
 *
 * First touch only — the cookie is never overwritten, so a later visit through
 * a different campaign does not rewrite where the person originally came from.
 *
 * NOT captured here: the Google Play Install Referrer. That needs the Android
 * Play Install Referrer library inside the Bubblewrap TWA wrapper at the repo
 * root — there is no JS/Next path to it. Play-organic installs currently land
 * with `initial_referrer` ≈ "android-app://com.android.vending", which is a
 * usable "Play organic" bucket in the meantime.
 */

export const FIRST_TOUCH_COOKIE = 'gis_attr'
export const FIRST_TOUCH_MAX_AGE_S = 60 * 60 * 24 * 90 // 90 days

export interface FirstTouch {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  gclid?: string
  fbclid?: string
  referrer?: string
  landing_path?: string
  ts?: string
}

const STRING_KEYS: (keyof FirstTouch)[] = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
  'referrer',
  'landing_path',
  'ts',
]

const MAX_LEN = 200

function clean(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed.slice(0, MAX_LEN)
}

/**
 * Build the first-touch record for a request, or null if there is nothing
 * worth attributing. `referer` is only kept when it points at another origin —
 * an internal navigation is not a "source".
 */
export function buildFirstTouch(args: {
  searchParams: URLSearchParams
  referer: string | null
  pathname: string
  selfHost: string | null
  now?: Date
}): FirstTouch | null {
  const { searchParams, referer, pathname, selfHost } = args
  const p = (k: string) => clean(searchParams.get(k))

  const externalReferrer = (() => {
    const r = clean(referer)
    if (!r) return undefined
    try {
      const host = new URL(r).host
      if (selfHost && host === selfHost) return undefined
      return r
    } catch {
      return undefined
    }
  })()

  const record: FirstTouch = {
    utm_source: p('utm_source'),
    utm_medium: p('utm_medium'),
    utm_campaign: p('utm_campaign'),
    utm_term: p('utm_term'),
    utm_content: p('utm_content'),
    gclid: p('gclid'),
    fbclid: p('fbclid'),
    referrer: externalReferrer,
    landing_path: clean(pathname),
  }

  const hasSignal =
    record.utm_source ||
    record.utm_medium ||
    record.utm_campaign ||
    record.gclid ||
    record.fbclid ||
    record.referrer ||
    pathname.startsWith('/foods/')

  if (!hasSignal) return null

  record.ts = (args.now ?? new Date()).toISOString()

  // Drop undefined keys so the serialized cookie stays small.
  for (const k of STRING_KEYS) if (record[k] === undefined) delete record[k]
  return record
}

export function serializeFirstTouch(ft: FirstTouch): string {
  return JSON.stringify(ft)
}

/**
 * Parse the `gis_attr` cookie. Defensive: any malformed value returns null
 * rather than throwing, because a bad `$set_once` write bakes in wrong data
 * per person with no backfill path.
 */
export function readFirstTouch(cookieString?: string): FirstTouch | null {
  const raw =
    cookieString ?? (typeof document !== 'undefined' ? document.cookie : '')
  if (!raw) return null

  const match = raw
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${FIRST_TOUCH_COOKIE}=`))
  if (!match) return null

  const value = match.slice(FIRST_TOUCH_COOKIE.length + 1)
  if (!value) return null

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const out: FirstTouch = {}
    for (const k of STRING_KEYS) {
      const v = (parsed as Record<string, unknown>)[k]
      if (typeof v === 'string') out[k] = clean(v)
    }
    return Object.keys(out).length > 0 ? out : null
  } catch {
    return null
  }
}

/**
 * Turn a first-touch record into `$set_once` person properties, or undefined
 * if there is nothing to set. Keys are prefixed `initial_` so they read
 * clearly next to any event-level `utm_*` in PostHog.
 */
export function firstTouchPersonProps(
  ft: FirstTouch | null,
): Record<string, string> | undefined {
  if (!ft) return undefined
  const out: Record<string, string> = {}
  for (const k of STRING_KEYS) {
    const v = ft[k]
    if (v) out[`initial_${k === 'ts' ? 'touch_at' : k}`] = v
  }
  return Object.keys(out).length > 0 ? out : undefined
}
