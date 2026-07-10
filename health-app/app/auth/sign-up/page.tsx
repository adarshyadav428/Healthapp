'use client'

import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { signUpSchema, type SignUpData } from '../../../lib/validations'
import { getBrowserSupabaseClient } from '../../../lib/supabase/client'
import { toast } from '../../../components/ui/use-toast'
import { useState } from 'react'
import { captureEvent, identifyUser } from '../../../lib/posthog/client'
import { Input } from '../../../components/ui/input'
import { Button } from '../../../components/ui/button'
import { Mail, Flame } from 'lucide-react'

export default function SignUpPage() {
  const [emailSent, setEmailSent] = useState(false)

  const form = useForm<SignUpData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  })

  const onSubmit = async (data: SignUpData) => {
    try {
      const supabase = getBrowserSupabaseClient()
      const { data: auth, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      })
      if (error) throw new Error(error.message)

      if (!auth.session) {
        setEmailSent(true)
        return
      }

      if (auth.user) {
        identifyUser(auth.user.id, { email: auth.user.email })
        captureEvent('user_signed_up', { method: 'email' })
      }

      window.location.href = '/onboarding'
    } catch (err) {
      toast({ title: 'Sign up failed', description: (err as Error).message, variant: 'error' })
    }
  }

  const handleGoogle = async () => {
    try {
      const supabase = getBrowserSupabaseClient()
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${appUrl}/onboarding` },
      })
      if (error) throw new Error(error.message)
    } catch (err) {
      toast({ title: 'Google sign up failed', description: (err as Error).message, variant: 'error' })
    }
  }

  if (emailSent) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm text-center">
          <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-brand-soft mb-5">
            <Mail className="h-6 w-6 text-brand" strokeWidth={2} />
          </div>
          <h2 className="font-display text-2xl font-bold text-ink">Check your inbox</h2>
          <p className="mt-2 text-sm text-ink-2 max-w-xs mx-auto">
            We sent you a confirmation link. Click it to activate your account, then sign in.
          </p>
          <Link href="/auth/sign-in">
            <Button size="lg" className="mt-8 tap-scale">Go to sign in</Button>
          </Link>
        </div>
      </div>
    )
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
        <h1 className="font-display text-2xl font-bold text-ink mb-1">Start for free</h1>
        <p className="text-sm text-ink-2 mb-7">Create your account in seconds.</p>

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
            <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wide text-ink-2 mb-1.5">
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...form.register('password')}
              placeholder="min. 8 characters"
            />
            {form.formState.errors.password && (
              <p className="mt-1.5 text-xs text-danger">{form.formState.errors.password.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-xs font-bold uppercase tracking-wide text-ink-2 mb-1.5">
              Confirm password
            </label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...form.register('confirmPassword')}
              placeholder="••••••••"
            />
            {form.formState.errors.confirmPassword && (
              <p className="mt-1.5 text-xs text-danger">{form.formState.errors.confirmPassword.message}</p>
            )}
          </div>

          <Button type="submit" size="lg" disabled={form.formState.isSubmitting} className="w-full mt-2 tap-scale">
            {form.formState.isSubmitting ? 'Creating account…' : 'Create account'}
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

        <p className="mt-5 text-center text-xs text-ink-2">
          By signing up you agree to our{' '}
          <Link href="/terms" className="text-brand-ink hover:underline">Terms</Link>
          {' '}and{' '}
          <Link href="/privacy" className="text-brand-ink hover:underline">Privacy Policy</Link>.
        </p>

        <p className="mt-4 text-center text-sm text-ink-2">
          Already have an account?{' '}
          <Link href="/auth/sign-in" className="font-bold text-brand-ink hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

function GoogleIcon() {
  // token-check-ignore-start — fixed Google "G" brand mark, never themed
  return (
    <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
    // token-check-ignore-end
  )
}
