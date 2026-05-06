'use client'

import Link from 'next/link'
import { useUser } from '../../hooks/useUser'
import { useTheme } from '../../hooks/useTheme'
import { getBrowserSupabaseClient } from '../../lib/supabase/client'
import { toast } from '../ui/use-toast'
import { LogOut, Moon, Sun } from 'lucide-react'

export function Navbar() {
  const { user, profile } = useUser()
  const { theme, toggle } = useTheme()

  const handleSignOut = async () => {
    try {
      const supabase = getBrowserSupabaseClient()
      const { error } = await supabase.auth.signOut()
      if (error) throw new Error(error.message)
      window.location.href = '/'
    } catch (err) {
      toast({ title: 'Sign out failed', description: (err as Error).message, variant: 'error' })
    }
  }

  const initials = profile?.display_name
    ? profile.display_name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email?.[0] ?? '?').toUpperCase()

  return (
    <nav className="sticky top-0 z-30 flex w-full items-center justify-between border-b border-orange-100/60 bg-[#fff7ed]/80 px-4 py-3 backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-950/80">
      <Link href="/dashboard" className="flex items-center gap-2">
        <span className="text-xl">🥗</span>
        <span className="text-base font-black text-gray-900 tracking-tight dark:text-slate-100">CalTrack</span>
      </Link>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-orange-100 bg-white/80 text-orange-600 hover:bg-orange-50 transition-colors dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <Link
          href="/settings"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700 hover:bg-orange-200 transition-colors dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          title={profile?.display_name ?? user?.email ?? 'Settings'}
        >
          {initials}
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </nav>
  )
}
