'use client'

import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { signInSchema, type SignInData } from '../../../lib/validations'
import { getBrowserSupabaseClient } from '../../../lib/supabase/client'
import { toast } from '../../../components/ui/use-toast'
import { Input } from '../../../components/ui/input'
import { Button } from '../../../components/ui/button'
import { Flame } from 'lucide-react'

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
      // Use window.location.origin so this works on any deployment URL.
      // PKCE flow: Supabase will redirect to /auth/callback?code=... after
      // Google authenticates, where we exchange the code for a session.
      const redirectTo = `${window.location.origin}/auth/callback`
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      })
      if (error) throw new Error(error.message)
    } catch (err) {
      toast({ title: 'Google sign in failed', description: (err as Error).message, variant: 'error' })
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <Link href="/" className="mb-10 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-control bg-brand-soft">
          <Flame className="h-[18px] w-[18px] text-brand" strokeWidth={2.2} />
        </div>
        <span className="font-display text-xl font-bold tracking-tight text-ink">GetInShape</span>
      </Link>

      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl font-bold text-ink mb-1">Welcome back</h1>
        <p className="text-sm text-ink-2 mb-7">Sign in to continue your journey.</p>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wide text-ink-2 mb-1.5">
              Email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              {...form.register('email')}
              placeholder="you@example.com"
            />
            {form.formState.errors.email && (
              <p className="mt-1.5 text-xs text-danger">{form.formState.errors.email.message}</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="password" className="text-xs font-bold uppercase tracking-wide text-ink-2">
                Password
              </label>
              <Link href="/auth/forgot-password" className="text-xs font-semibold text-brand-ink hover:underline">
                Forgot?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...form.register('password')}
              placeholder="••••••••"
            />
            {form.formState.errors.password && (
              <p className="mt-1.5 text-xs text-danger">{form.formState.errors.password.message}</p>
            )}
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={form.formState.isSubmitting}
            className="w-full mt-2 tap-scale"
          >
            {form.formState.isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-hairline" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-canvas px-3 text-xs text-ink-2">or</span>
          </div>
        </div>

        {/* Google */}
        <Button type="button" variant="outline" size="lg" onClick={handleGoogle} className="w-full gap-2.5 tap-scale">
          <GoogleIcon />
          Continue with Google
        </Button>

        <p className="mt-7 text-center text-sm text-ink-2">
          New to GetInShape?{' '}
          <Link href="/auth/sign-up" className="font-bold text-brand-ink hover:underline">
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
