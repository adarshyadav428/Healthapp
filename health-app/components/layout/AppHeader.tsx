'use client'

import Link from 'next/link'
import { Flame } from 'lucide-react'
import { useUser } from '../../hooks/useUser'
import { ThemeToggle } from '../ui/theme-toggle'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

interface AppHeaderProps {
  /** Page title — shown on interior pages (Progress, History, …). */
  title?: string
  /** Home mode: show a time-of-day greeting instead of a title. */
  greeting?: boolean
  /** SSR-provided name so the greeting/avatar render without a client fetch. */
  displayName?: string | null
}

/**
 * The single app chrome header. Two modes:
 *  - greeting (home / log): "Good evening, Adarsh"
 *  - title (interior pages): the page name
 * Always: peacock flame mark on the left, avatar → settings on the right.
 */
export function AppHeader({ title, greeting: isGreeting, displayName }: AppHeaderProps) {
  const { user, profile } = useUser()
  const name = displayName ?? profile?.display_name ?? null
  const firstName = name?.split(' ')[0] ?? 'there'
  const initial = (name?.[0] ?? user?.email?.[0] ?? '?').toUpperCase()

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-hairline bg-header-bg px-[18px] py-3 backdrop-blur-md">
      {/* Left: mark + context */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-control bg-brand-soft">
          <Flame className="h-[18px] w-[18px] text-brand" strokeWidth={2.2} />
        </div>
        {isGreeting ? (
          <div>
            <p className="font-display text-[14px] font-bold leading-none text-ink">GetInShape</p>
            <p className="mt-[3px] text-[12px] font-medium text-ink-2">
              {greeting()}, {firstName}
            </p>
          </div>
        ) : (
          <p className="font-display text-[18px] font-bold tracking-tight text-ink">
            {title ?? 'GetInShape'}
          </p>
        )}
      </div>

      {/* Right: theme toggle + avatar → settings */}
      <div className="flex items-center gap-2.5">
        <ThemeToggle />
        <Link
          href="/settings"
          aria-label="Profile and settings"
          title={name ?? user?.email ?? 'Settings'}
          className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full bg-ava-grad text-[14px] font-semibold text-white tap-scale"
          style={{ boxShadow: '0 0 0 2px var(--canvas), 0 0 0 3.5px var(--ava-halo)' }}
        >
          {initial}
        </Link>
      </div>
    </header>
  )
}
