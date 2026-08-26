import Link from 'next/link'
import { Utensils } from 'lucide-react'

export function EmptyMeals() {
  return (
    <div className="flex flex-col items-center rounded-card bg-surface px-6 py-10 text-center shadow-air">
      <div className="mb-4 flex h-[60px] w-[60px] items-center justify-center rounded-card bg-brand-soft">
        <Utensils className="h-6 w-6 text-brand" strokeWidth={1.75} />
      </div>
      <p className="text-body-lg font-semibold text-ink">Nothing logged yet</p>
      <p className="mt-1.5 max-w-[240px] text-caption leading-snug text-ink-2">
        Start with breakfast — a couple of idli, a bowl of poha, whatever you&apos;re having.
      </p>
      <Link
        href="/log"
        // text-on-accent, never text-white: the dark-mode accent is bright and
        // white on it measures 2.09:1. The token carries the right label colour
        // for whichever theme is live. See scripts/check-contrast.mjs.
        className="mt-5 inline-block rounded-full bg-brand px-[22px] py-[13px] text-body font-semibold text-on-accent shadow-cta tap-scale"
      >
        Log your first meal
      </Link>
    </div>
  )
}
