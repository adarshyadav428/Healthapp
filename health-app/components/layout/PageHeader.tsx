'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

/**
 * Per-page header for secondary (non-tab) screens: a small muted label over
 * a `text-title` Inter Tight title, matching the four core tab screens.
 * `back` adds a chevron since these pages are reached from a tab, not one.
 * The chevron is a bare 44px target, not a floating disc — chrome should not
 * cast shadows; only content does.
 */
export function PageHeader({ label, title, back }: { label: string; title: string; back?: boolean }) {
  const router = useRouter()
  return (
    <div className="pt-2">
      {back && (
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="mb-2 -ml-2 flex h-11 w-11 items-center justify-center rounded-full text-ink tap-scale hover:bg-surface-2"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={1.75} />
        </button>
      )}
      <p className="text-caption font-medium text-ink-3">{label}</p>
      <h1 className="font-display mt-1 text-title font-semibold text-ink">{title}</h1>
    </div>
  )
}
