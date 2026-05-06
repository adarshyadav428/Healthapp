'use client'

import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { signInSchema, type SignInData } from '../../../lib/validations'
import { getBrowserSupabaseClient } from '../../../lib/supabase/client'
import { toast } from '../../../components/ui/use-toast'

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
      const rawReturnTo = params.get('returnTo') ?? ''
      const destination =
        rawReturnTo.startsWith('/') && !rawReturnTo.startsWith('//')
          ? rawReturnTo
          : '/dashboard'

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
    <div className="min-h-screen bg-[#fff7ed] flex flex-col items-center justify-center px-4 py-10 dark:bg-slate-950">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,_rgba(234,88,12,0.12),_transparent_55%)]" />

      {/* Logo */}
      <Link href="/" className="mb-8 flex items-center gap-2">
        <span className="text-2xl">🥗</span>
        <span className="text-xl font-black text-orange-600">CalTrack</span>
      </Link>

      <div className="w-full max-w-sm rounded-3xl border border-orange-100 bg-white/90 p-7 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/90">
        <h1 className="text-2xl font-black text-foreground">Welcome back</h1>
        <p className="mt-1 text-sm text-muted">Sign in to continue your journey.</p>

        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-foreground mb-1">Email</label>
            <input
              id="email"
              type="email"
              {...form.register('email')}
              className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm text-foreground outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all placeholder:text-muted"
              placeholder="you@example.com"
            />
            {form.formState.errors.email && (
              <p className="mt-1 text-xs text-red-500">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="password" className="block text-sm font-semibold text-foreground">Password</label>
              <Link href="/auth/forgot-password" className="text-xs text-orange-600 hover:text-orange-700 font-medium">
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              {...form.register('password')}
              className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm text-foreground outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all placeholder:text-muted"
              placeholder="••••••••"
            />
            {form.formState.errors.password && (
              <p className="mt-1 text-xs text-red-500">{form.formState.errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="w-full rounded-2xl bg-orange-600 py-3 text-sm font-bold text-white hover:bg-orange-700 active:scale-[.98] transition-all shadow-md disabled:opacity-60"
          >
            {form.formState.isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-3 text-xs text-muted dark:bg-slate-900">or</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          className="w-full rounded-2xl border border-border bg-card py-3 text-sm font-semibold text-foreground hover:bg-muted/20 active:scale-[.98] transition-all flex items-center justify-center gap-2"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <p className="mt-6 text-center text-sm text-muted">
          New to CalTrack?{' '}
          <Link href="/auth/sign-up" className="font-semibold text-orange-600 hover:text-orange-700">
            Create account
          </Link>
        </p>
      </div>
    </div>
  )
}
