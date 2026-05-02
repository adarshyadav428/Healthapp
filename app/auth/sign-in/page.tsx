'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { signInSchema, type SignInData } from '../../../lib/validations'
import { getBrowserSupabaseClient } from '../../../lib/supabase/client'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { toast } from '../../../components/ui/use-toast'

export default function SignInPage() {
  const router = useRouter()

  const form = useForm<SignInData>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async (data: SignInData) => {
    try {
      const supabase = getBrowserSupabaseClient()
      const { data: auth, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })
      if (error) throw new Error(error.message)

      const userId = auth.user?.id
      if (!userId) throw new Error('Missing user after sign in')

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('height_cm')
        .eq('id', userId)
        .maybeSingle()

      if (profileError) throw new Error(profileError.message)

      toast({ title: 'Welcome back', description: 'You are signed in.' })

      if (!profile || profile.height_cm === null) {
        router.push('/onboarding')
      } else {
        const params = new URLSearchParams(window.location.search)
        const returnTo = params.get('returnTo') || '/dashboard'
        router.push(returnTo)
      }
    } catch (err) {
      toast({ title: 'Sign in failed', description: (err as Error).message, variant: 'error' })
    }
  }

  const handleGoogle = async () => {
    try {
      const supabase = getBrowserSupabaseClient()
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
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
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">Sign in</h1>
        <p className="mt-1 text-sm text-gray-500">Welcome back to CalTrack.</p>

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

          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>

        <div className="mt-4">
          <Button variant="outline" className="w-full" onClick={handleGoogle}>
            Continue with Google
          </Button>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          Don&apos;t have an account?{' '}
          <Link href="/auth/sign-up" className="text-blue-600 hover:text-blue-700">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
