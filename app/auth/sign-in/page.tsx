'use client'

import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { signInSchema, type SignInData } from '../../../lib/validations'
import { getBrowserSupabaseClient } from '../../../lib/supabase/client'
import { toast } from '../../../components/ui/use-toast'

const inputClass =
  'w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900'

export default function SignInPage() {
  const form = useForm<SignInData>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async (data: SignInData) => {
    try {
      const supabase = getBrowserSupabaseClient()
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })
      if (error) throw new Error(error.message)

      const params = new URLSearchParams(window.location.search)
      const raw = params.get('returnTo') ?? ''
      const destination =
        raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard'

      window.location.href = destination
    } catch (err) {
      toast({ title: 'Sign in failed', description: (err as Error).message, variant: 'error' })
    }
  }

  const handleGoogle = async () => {
    try {
      const supabase = getBrowserSupabaseClient()
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${appUrl}/dashboard` },
      })
      if (error) throw new Error(error.message)
    } catch (err) {
      toast({ title: 'Google sign in failed', description: (err as Error).message, variant: 'error' })
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12 dark:bg-slate-950">
      {/* Logo */}
      <Link href="/" className="mb-10 flex items-center gap-2.5">
        <span className="text-[26px] leading-none">🥗</span>
        <span className="text-xl font-black tracking-tight text-foreground">GetInShape</span>
      </Link>

      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-black text-foreground mb-1">Welcome back</h1>
        <p className="text-sm text-muted mb-7">Sign in to continue your journey.</p>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wide text-muted mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              {...form.register('email')}
              className={inputClass}
              placeholder="you@example.com"
            />
            {form.formState.errors.email && (
              <p className="mt-1.5 text-xs text-red-500">{form.formState.errors.email.message}</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="password" className="text-xs font-bold uppercase tracking-wide text-muted">
                Password
              </label>
              <Link href="/auth/forgot-password" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                Forgot?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              {...form.register('password')}
              className={inputClass}
              placeholder="••••••••"
            />
            {form.formState.errors.password && (
              <p className="mt-1.5 text-xs text-red-500">{form.formState.errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="w-full rounded-2xl bg-orange-500 py-3.5 text-sm font-black text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600 active:scale-[.98] transition-all disabled:opacity-50 mt-2"
          >
            {form.formState.isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-background px-3 text-xs text-muted dark:bg-slate-950">or</span>
          </div>
        </div>

        {/* Google */}
        <button
          type="button"
          onClick={handleGoogle}
          className="w-full rounded-2xl border border-border bg-card py-3.5 text-sm font-semibold text-foreground hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[.98] transition-all flex items-center justify-center gap-2.5"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <p className="mt-7 text-center text-sm text-muted">
          New to GetInShape?{' '}
          <Link href="/auth/sign-up" className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
            Create account
          </Link>
        </p>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}
