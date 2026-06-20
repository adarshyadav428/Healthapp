'use client'

import Link from 'next/link'
import { useUser } from '../../hooks/useUser'
import { Bell } from 'lucide-react'

export function Navbar() {
  const { user, profile } = useUser()

  const initial = profile?.display_name
    ? profile.display_name[0].toUpperCase()
    : (user?.email?.[0] ?? '?').toUpperCase()

  return (
    <nav className="sticky top-0 z-30 flex w-full items-center justify-between px-4 py-3 bg-white border-b border-[#F0F0F0]">
      {/* Brand */}
      <Link href="/dashboard" className="flex items-center gap-2">
        <span className="text-[22px] leading-none">🥗</span>
        <span className="text-[18px] font-bold text-[#EA580C]">GetInShape</span>
      </Link>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>

        <Link
          href="/settings"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600 hover:bg-gray-200 transition-colors"
          aria-label="Profile settings"
          title={profile?.display_name ?? user?.email ?? 'Settings'}
        >
          {initial}
        </Link>
      </div>
    </nav>
  )
}
