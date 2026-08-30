'use client'

import { useState } from 'react'
import type { BodyType } from '../../lib/bodyType'
import type { Profile } from '../../types/index'

/**
 * The body-type illustration for one build.
 *
 * These are real artwork files under `public/body-types/`, not drawings — see
 * that folder's README for the filenames and the constraints the art has to
 * satisfy. Four hand-drawn SVG versions were tried first (filled silhouette
 * and line art) and none read as a body: width alone cannot express body
 * composition, and the interior detail that can is beyond what parametric
 * paths produce convincingly.
 *
 * A plain `<img>`, deliberately, not `next/image`. Vercel Hobby meters image
 * optimisation, the Hobby limits are load-bearing here, and these are small
 * fixed-size assets with nothing to gain from a transform.
 */

/** Where the artwork lives, relative to `public/`. */
export const BODY_TYPE_ASSET_DIR = '/body-types'

/**
 * The one place the file extension is decided. Change it here — and nowhere
 * else — if the artwork is ever replaced with `webp` or `svg`.
 */
export const BODY_TYPE_ASSET_EXT = 'png'

/**
 * The artwork to try, best first.
 *
 * Only the `male-*` set exists today, so a female user falls through to it
 * rather than seeing five empty tiles: wrong-sex art is a poor outcome, but an
 * empty picker is a broken one. Drop the `female-*` files in and this starts
 * preferring them with no code change. `sex: 'other'` uses the male set by
 * design — a third full set of drawings is not worth commissioning.
 */
export function bodyTypeAssetCandidates(type: BodyType, sex: Profile['sex']): string[] {
  const file = (set: 'male' | 'female') =>
    `${BODY_TYPE_ASSET_DIR}/${set}-${type}.${BODY_TYPE_ASSET_EXT}`
  return sex === 'female' ? [file('female'), file('male')] : [file('male')]
}

export function BodyTypeImage({
  type,
  sex,
  className,
  selected = false,
}: {
  type: BodyType
  sex: Profile['sex']
  className?: string
  selected?: boolean
}) {
  // Tracked by URL rather than by index, so that changing `sex` on the
  // previous step re-evaluates the candidates without resurrecting a file
  // already known to 404.
  const [failed, setFailed] = useState<string[]>([])
  const src = bodyTypeAssetCandidates(type, sex).find((c) => !failed.includes(c))

  // Same-height neutral block, so a missing asset can never render a broken
  // image icon and the tile never changes height under the label.
  if (!src) {
    return <span aria-hidden="true" className={`block rounded-control bg-surface-2 ${className ?? ''}`} />
  }

  return (
    // Decorative: the tile carries the label and the pressed state, so alt
    // text here would only be announced twice.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      onError={() => setFailed((prev) => (prev.includes(src) ? prev : [...prev, src]))}
      className={`object-contain transition-opacity ${selected ? 'opacity-100' : 'opacity-60'} ${className ?? ''}`}
    />
  )
}
