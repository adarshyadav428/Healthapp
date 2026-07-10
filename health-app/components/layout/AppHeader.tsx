'use client'

import Link from 'next/link'
import { Flame } from 'lucide-react'
import { useUser } from '../../hooks/useUser'
import { ThemeToggle } from '../ui/theme-toggle'

interface AppHeaderProps {
  /** Page title — shown on interior pages (Progress, History, …). Defaults to the wordmark. */
  title?: string
}

/**
 * The single app chrome header: ember flame mark + wordmark (or page title)
 * on the left, theme toggle + avatar → settings on the right. Warm glass.
 * The per-page greeting now lives in the page body, not here.
 */
export function AppHeader({ title }: AppHeaderProps) {
  const { user, profile } = useUser()
  const name = profile?.display_name ?? null
  const initial = (name?.[0] ?? user?.email?.[0] ?? '?').toUpperCase()

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between px-5 py-3"
      style={{
        background: 'var(--header-bg)',
        backdropFilter: 'blur(24px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
        borderBottom: '1px solid var(--glass-hair)',
      }}
    >
      {/* Left: mark + wordmark / title */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-control bg-brand-soft">
          <Flame className="h-[18px] w-[18px] text-brand" strokeWidth={2} />
        </div>
        <p className="font-display text-[17px] font-semibold tracking-tight text-ink">
          {title ?? 'GetInShape'}
        </p>
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
