'use client'

import Link from 'next/link'
import { useUser } from '../../hooks/useUser'
import { getBrowserSupabaseClient } from '../../lib/supabase/client'
import { toast } from '../ui/use-toast'
import { LogOut } from 'lucide-react'

export function Navbar() {
  const { user, profile } = useUser()

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
    <nav className="sticky top-0 z-30 flex w-full items-center justify-between border-b border-orange-100/60 bg-[#fff7ed]/80 px-4 py-3 backdrop-blur-md">
      <Link href="/dashboard" className="flex items-center gap-2">
        <span className="text-xl">🥗</span>
        <span className="text-base font-black text-gray-900 tracking-tight">CalTrack</span>
      </Link>

      <div className="flex items-center gap-2">
        <Link
          href="/settings"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700 hover:bg-orange-200 transition-colors"
          title={profile?.display_name ?? user?.email ?? 'Settings'}
        >
          {initials}
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </nav>
  )
}
