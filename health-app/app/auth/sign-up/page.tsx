'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { signUpSchema, type SignUpData } from '../../../lib/validations'
import { getBrowserSupabaseClient } from '../../../lib/supabase/client'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { toast } from '../../../components/ui/use-toast'
import { useState } from 'react'

export default function SignUpPage() {
  const router = useRouter()
  const [info, setInfo] = useState<string | null>(null)

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
        setInfo('Check your email to confirm your account before signing in.')
        return
      }

      toast({ title: 'Account created', description: 'Let’s set up your goals.' })
      router.push('/onboarding')
    } catch (err) {
      toast({ title: 'Sign up failed', description: (err as Error).message, variant: 'error' })
    }
  }

  const handleGoogle = async () => {
    try {
      const supabase = getBrowserSupabaseClient()
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${appUrl}/onboarding` },
      })
      if (error) throw new Error(error.message)
    } catch (err) {
      toast({ title: 'Google sign up failed', description: (err as Error).message, variant: 'error' })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">Create your account</h1>
        <p className="mt-1 text-sm text-gray-500">Start tracking in minutes.</p>

        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...form.register('email')} />
            {form.formState.errors.email ? (
              <p className="mt-1 text-xs text-red-500">{form.formState.errors.email.message}</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" {...form.register('password')} />
            {form.formState.errors.password ? (
              <p className="mt-1 text-xs text-red-500">{form.formState.errors.password.message}</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input id="confirmPassword" type="password" {...form.register('confirmPassword')} />
            {form.formState.errors.confirmPassword ? (
              <p className="mt-1 text-xs text-red-500">{form.formState.errors.confirmPassword.message}</p>
            ) : null}
          </div>

          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Creating account...' : 'Sign up'}
          </Button>
        </form>

        <div className="mt-4">
          <Button variant="outline" className="w-full" onClick={handleGoogle}>
            Continue with Google
          </Button>
        </div>

        {info ? <p className="mt-4 text-sm text-gray-600">{info}</p> : null}

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link href="/auth/sign-in" className="text-blue-600 hover:text-blue-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
