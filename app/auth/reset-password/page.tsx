'use client'

import { useEffect, useState } from 'react'
import { getBrowserSupabaseClient } from '../../../lib/supabase/client'
import { Lock } from 'lucide-react'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Supabase sends the token via hash — we need to let the client lib pick it up
  useEffect(() => {
    const supabase = getBrowserSupabaseClient()
    // Listen for SIGNED_IN event triggered by the magic link / recovery link
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
        // The session is now active — nothing to do, user fills in the new password
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
    <div className="min-h-screen bg-[#fff7ed] flex flex-col items-center justify-center px-4 dark:bg-slate-950">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.2),_transparent_50%)]" />

      <div className="w-full max-w-sm">
        <div className="rounded-3xl bg-white/90 border border-orange-100 p-7 shadow-xl dark:border-slate-800 dark:bg-slate-900/90">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100">
              <Lock className="h-6 w-6 text-orange-600" />
            </div>
            <h1 className="text-xl font-black text-foreground">Set new password</h1>
            <p className="text-sm text-muted mt-1">Choose a strong password for your account.</p>
          </div>

          {done ? (
            <div className="text-center py-4">
              <div className="text-5xl mb-3">✅</div>
              <p className="text-sm font-semibold text-foreground">Password updated!</p>
              <p className="text-xs text-muted mt-1">Redirecting you to your dashboard...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
                  New password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  required
                  className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm text-foreground outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all placeholder:text-muted"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
                  Confirm password
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Same as above"
                  required
                  className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm text-foreground outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all placeholder:text-muted"
                />
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-2.5 text-xs text-red-600 dark:bg-red-900/30 dark:border-red-900/50 dark:text-red-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !password || !confirm}
                className="w-full rounded-2xl bg-orange-600 py-3 text-sm font-bold text-white hover:bg-orange-700 active:scale-[.98] transition-all shadow-sm disabled:opacity-60"
              >
                {loading ? 'Updating...' : 'Update password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
