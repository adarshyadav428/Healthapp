'use client'

import { useState } from 'react'
import { getBrowserSupabaseClient } from '../../../lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Mail, Flame } from 'lucide-react'
import { Input } from '../../../components/ui/input'
import { Button } from '../../../components/ui/button'

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
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/auth/sign-in" className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>

        {/* Logo */}
        <Link href="/" className="mb-8 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-control bg-brand-soft">
            <Flame className="h-[18px] w-[18px] text-brand" strokeWidth={2.2} />
          </div>
          <span className="font-display text-xl font-bold tracking-tight text-ink">GetInShape</span>
        </Link>

        <h1 className="font-display text-2xl font-bold text-ink mb-1">Forgot password?</h1>
        <p className="text-sm text-ink-2 mb-7">Enter your email and we&apos;ll send a reset link.</p>

        {sent ? (
          <div className="text-center py-8">
            <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-brand-soft mb-4">
              <Mail className="h-6 w-6 text-brand" strokeWidth={2} />
            </div>
            <p className="text-base font-bold text-ink">Check your inbox!</p>
            <p className="text-sm text-ink-2 mt-2">
              We sent a password reset link to <strong>{email}</strong>.
            </p>
            <p className="text-xs text-ink-2 mt-1">It may take a minute. Check spam if you don&apos;t see it.</p>
            <Link href="/auth/sign-in">
              <Button size="lg" className="mt-7 tap-scale">Back to sign in</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-ink-2 mb-1.5">
                Email address
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>

            {error && (
              <div className="rounded-control bg-danger-soft border border-hairline px-4 py-2.5 text-xs text-danger">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" disabled={loading || !email.trim()} className="w-full mt-2 tap-scale">
              {loading ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
