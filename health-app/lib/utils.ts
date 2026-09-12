import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge only knows Tailwind's default scale names. A custom
 * `text-title-sm` fails its size validators, gets filed as a *colour*, and is
 * then dropped as a "conflict" with `text-ink` sitting next to it — so the
 * size silently vanished from every primitive that combined the two through
 * `cn()`. Found on 2026-09-11 in DialogTitle rendering at 16px; the older
 * `text-caption`/`text-body` steps had the same hole. Every custom name from
 * tailwind.config.ts that shares a prefix with a default group is listed here
 * so merge treats it as what it is. `tests/cnMerge.test.ts` walks the config
 * and fails when a new step is added there but not here.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'micro',
            'caption',
            'body',
            'body-lg',
            'title-sm',
            'title',
            'title-lg',
            'display',
            'hero',
            'hero-lg',
          ],
        },
      ],
      rounded: [{ rounded: ['control', 'card', 'card-lg', 'sheet', 'phone'] }],
      shadow: [{ shadow: ['air', 'rest', 'float', 'cta', 'fab', 'azure'] }],
      tracking: [{ tracking: ['caps'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
