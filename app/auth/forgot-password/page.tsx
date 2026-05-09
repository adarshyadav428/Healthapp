'use client'

import { useState } from 'react'
import { getBrowserSupabaseClient } from '../../../lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Mail } from 'lucide-react'

const inputClass =
  'w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm text-foreground outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 transition-all placeholder:text-muted'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    try {
      const supabase = getBrowserSupabaseClient()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (resetError) throw new Error(resetError.message)
      setSent(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <Link href="/auth/sign-in" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>

        {/* Logo */}
        <Link href="/" className="mb-8 flex items-center gap-2.5">
          <span className="text-[26px] leading-none">🥗</span>
          <span className="text-xl font-black tracking-tight text-foreground">CalTrack</span>
        </Link>

        <h1 className="text-2xl font-black text-foreground mb-1">Forgot password?</h1>
        <p className="text-sm text-muted mb-7">Enter your email and we&apos;ll send a reset link.</p>

        {sent ? (
          <div className="text-center py-8">
            <div className="text-5xl mb-4">📬</div>
            <p className="text-base font-bold text-foreground">Check your inbox!</p>
            <p className="text-sm text-muted mt-2">
              We sent a password reset link to <strong>{email}</strong>.
            </p>
            <p className="text-xs text-muted mt-1">It may take a minute. Check spam if you don&apos;t see it.</p>
            <Link
              href="/auth/sign-in"
              className="mt-7 inline-flex items-center rounded-2xl bg-orange-500 px-7 py-3.5 text-sm font-black text-white hover:bg-orange-600 transition-all"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-muted mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                className={inputClass}
              />
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-2.5 text-xs text-red-600 dark:bg-red-900/30 dark:border-red-900/50 dark:text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full rounded-2xl bg-orange-500 py-3.5 text-sm font-black text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600 active:scale-[.98] transition-all disabled:opacity-50 mt-2"
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
