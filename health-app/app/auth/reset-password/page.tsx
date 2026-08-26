'use client'

import { useEffect, useState } from 'react'
import { getBrowserSupabaseClient } from '../../../lib/supabase/client'
import Link from 'next/link'
import { Check, Flame } from 'lucide-react'
import { Input } from '../../../components/ui/input'
import { Button } from '../../../components/ui/button'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const supabase = getBrowserSupabaseClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
        // Session is now active — user can set new password
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const supabase = getBrowserSupabaseClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw new Error(updateError.message)
      setDone(true)
      setTimeout(() => {
        window.location.href = '/dashboard'
      }, 2000)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <Link href="/" className="mb-10 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-control bg-brand-soft">
          <Flame className="h-[18px] w-[18px] text-brand" strokeWidth={2.2} />
        </div>
        <span className="font-display text-title-sm font-bold text-ink">GetInShape</span>
      </Link>

      <div className="w-full max-w-sm">
        <h1 className="font-display text-title font-bold text-ink mb-1">Set new password</h1>
        <p className="text-body text-ink-2 mb-7">Choose a strong password for your account.</p>

        {done ? (
          <div className="text-center py-8">
            <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-brand-soft mb-4">
              <Check className="h-6 w-6 text-brand" strokeWidth={2.5} />
            </div>
            <p className="text-body-lg font-bold text-ink">Password updated!</p>
            <p className="text-body text-ink-2 mt-2">Redirecting you to your dashboard…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-caption font-bold uppercase tracking-caps text-ink-2 mb-1.5">
                New password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="min. 8 characters"
                autoComplete="new-password"
                required
              />
            </div>
            <div>
              <label className="block text-caption font-bold uppercase tracking-caps text-ink-2 mb-1.5">
                Confirm password
              </label>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
            </div>

            {error && (
              <div className="rounded-control bg-danger-soft border border-hairline px-4 py-2.5 text-caption text-danger">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" disabled={loading || !password || !confirm} className="w-full mt-2 tap-scale">
              {loading ? 'Updating…' : 'Update password'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
