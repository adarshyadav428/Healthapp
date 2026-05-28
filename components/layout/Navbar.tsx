'use client'

import Link from 'next/link'
import { useUser } from '../../hooks/useUser'
import { useTheme } from '../../hooks/useTheme'
import { Moon, Sun } from 'lucide-react'

export function Navbar() {
  const { user, profile } = useUser()
  const { theme, toggle } = useTheme()

  const initials = profile?.display_name
    ? profile.display_name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email?.[0] ?? '?').toUpperCase()

  return (
    <nav className="sticky top-0 z-30 flex w-full items-center justify-between px-5 py-4 backdrop-blur-xl bg-background/80 border-b border-gray-100/60 dark:border-slate-800/60">
      {/* Brand */}
      <Link href="/dashboard" className="flex items-center gap-2">
        <span className="text-[22px] leading-none">🥗</span>
        <span className="text-[17px] font-black tracking-tight text-foreground">
          CalTrack
        </span>
      </Link>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Dark-mode toggle */}
        <button
          type="button"
          onClick={toggle}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
        >
          {theme === 'dark'
            ? <Sun className="h-4 w-4" />
            : <Moon className="h-4 w-4" />}
        </button>

        {/* Avatar → Settings */}
        <Link
          href="/settings"
          aria-label="Settings"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 dark:bg-slate-800 text-xs font-black text-indigo-700 dark:text-slate-200 hover:bg-indigo-200 dark:hover:bg-slate-700 transition-colors"
          title={profile?.display_name ?? user?.email ?? 'Settings'}
        >
          {initials}
        </Link>
      </div>
    </nav>
  )
}
