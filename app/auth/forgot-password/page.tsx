'use client'

import { useState } from 'react'
import { getBrowserSupabaseClient } from '../../../lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Mail } from 'lucide-react'

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
    <div className="min-h-screen bg-[#fff7ed] flex flex-col items-center justify-center px-4">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.2),_transparent_50%)]" />

      <div className="w-full max-w-sm">
        <Link href="/auth/sign-in" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>

        <div className="rounded-3xl bg-white/90 border border-orange-100 p-7 shadow-xl">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100">
              <Mail className="h-6 w-6 text-orange-600" />
            </div>
            <h1 className="text-xl font-black text-gray-900">Forgot password?</h1>
            <p className="text-sm text-gray-500 mt-1">Enter your email and we&apos;ll send a reset link.</p>
          </div>

          {sent ? (
            <div className="text-center py-4">
              <div className="text-5xl mb-3">📬</div>
              <p className="text-sm font-semibold text-gray-800">Check your inbox!</p>
              <p className="text-xs text-gray-500 mt-1">We sent a password reset link to <strong>{email}</strong>.</p>
              <p className="text-xs text-gray-400 mt-2">It may take a minute. Check spam if you don&apos;t see it.</p>
              <Link
                href="/auth/sign-in"
                className="mt-5 block w-full rounded-2xl bg-orange-600 py-3 text-sm font-bold text-white text-center hover:bg-orange-700 transition-colors"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
                />
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-2.5 text-xs text-red-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full rounded-2xl bg-orange-600 py-3 text-sm font-bold text-white hover:bg-orange-700 active:scale-[.98] transition-all shadow-sm disabled:opacity-60"
              >
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
