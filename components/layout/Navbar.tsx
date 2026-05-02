'use client'

import Link from 'next/link'
import { Button } from '../ui/button'
import { useUser } from '../../hooks/useUser'
import { getBrowserSupabaseClient } from '../../lib/supabase/client'
import { toast } from '../ui/use-toast'

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

  return (
    <nav className="flex w-full items-center justify-between border-b border-gray-100 bg-white px-4 py-4">
      <Link href="/dashboard" className="text-lg font-semibold text-gray-900">
        CalTrack
      </Link>
      <div className="flex items-center gap-3">
        <div className="hidden text-sm text-gray-600 md:block">
          {profile?.display_name ?? user?.email ?? 'Welcome'}
        </div>
        <Button variant="outline" onClick={handleSignOut}>Sign out</Button>
      </div>
    </nav>
  )
}
