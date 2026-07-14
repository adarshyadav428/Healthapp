'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

/**
 * Ember Air per-page header for secondary (non-tab) screens: a small muted
 * label over a 24px Inter Tight title, matching the four core tab screens.
 * `back` adds a chevron since these pages are reached from a tab, not one.
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
          className="mb-2.5 -ml-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-surface tap-scale"
          style={{ boxShadow: 'var(--shadow-air)' }}
        >
          <ChevronLeft className="h-[18px] w-[18px] text-ink" strokeWidth={2} />
        </button>
      )}
      <p className="text-[13px] font-medium text-ink-3">{label}</p>
      <h1 className="font-display mt-[3px] text-[24px] font-bold tracking-[-0.02em] text-ink">{title}</h1>
    </div>
  )
}
