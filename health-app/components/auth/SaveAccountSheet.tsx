'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Mail, ShieldCheck } from 'lucide-react'
import { signUpSchema, type SignUpData } from '../../lib/validations'
import { getBrowserSupabaseClient } from '../../lib/supabase/client'
import { captureEvent, identifyUser } from '../../lib/posthog/client'
import { EVENTS } from '../../lib/posthog/events'
import { useSaveAccountStore, type SaveAccountTrigger } from '../../store/saveAccountStore'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../ui/sheet'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { toast } from '../ui/use-toast'

/** Why we're asking, in the user's terms — not ours. */
const REASON: Record<SaveAccountTrigger, string> = {
  camera_scan: 'AI photo scan needs an account.',
  chat_log: 'AI meal logging needs an account.',
  upgrade: 'You need an account before you can subscribe.',
  first_log: 'Nice — first meal logged.',
  settings: 'Save your account.',
}

/**
 * Converts an anonymous user into a registered one, in place.
 *
 * updateUser() mutates the *same* auth.users row, so the user id never changes
 * and every log, weight entry and streak they've already built carries over
 * untouched. There is deliberately no merge or migration step anywhere in this
 * flow — that's the whole reason the feature is built on anonymous auth rather
 * than on local storage.
 */
export function SaveAccountSheet() {
  const trigger = useSaveAccountStore((s) => s.trigger)
  const close = useSaveAccountStore((s) => s.close)
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm<SignUpData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async (data: SignUpData) => {
    try {
      const supabase = getBrowserSupabaseClient()

      // Read created_at before the update so `days_since_anon` measures how
      // long they trialled anonymously — the number that tells us whether the
      // prompt is landing too early or too late.
      const { data: before } = await supabase.auth.getUser()
      const createdAt = before.user?.created_at

      const { data: updated, error } = await supabase.auth.updateUser({
        email: data.email,
        password: data.password,
      })
      if (error) throw new Error(error.message)

      const user = updated.user
      if (user) {
        identifyUser(user.id, { email: data.email, is_anonymous: false })
        captureEvent(EVENTS.ACCOUNT_SAVED, {
          trigger,
          days_since_anon: createdAt
            ? Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000)
            : null,
        })
      }

      close()
      form.reset()

      // With email confirmation enabled, updateUser() parks the address in
      // new_email and doesn't apply it until the link is clicked — the password
      // is live immediately but the account isn't recoverable by email yet.
      // Saying "You're all set" here would be a lie in that case.
      const pending = user?.email !== data.email
      toast({
        title: pending ? 'Check your inbox' : 'Account saved',
        description: pending
          ? 'Tap the confirmation link to finish securing your account. Your data is already safe.'
          : 'Your progress is now saved to your account.',
      })
    } catch (err) {
      toast({
        title: "Couldn't save account",
        description: (err as Error).message,
        variant: 'error',
      })
    }
  }

  return (
    <Sheet open={trigger !== null} onOpenChange={(o) => { if (!o) close() }}>
      <SheetContent title="Save your account">
        <SheetHeader>
          <SheetTitle>{trigger ? REASON[trigger] : 'Save your account'}</SheetTitle>
          <SheetDescription>
            Add an email and password to keep your data. Everything you&apos;ve logged so far
            comes with you — nothing is lost.
          </SheetDescription>
        </SheetHeader>

        {/* The honest version of the risk. An anonymous session lives entirely
            in this browser's cookies, so clearing site data orphans the account
            permanently. Burying that would be a nasty surprise later. */}
        <div className="mb-4 flex items-start gap-2.5 rounded-control bg-surface-2 px-3 py-2.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-2" strokeWidth={2} />
          <p className="text-xs text-ink-2">
            Right now your progress only exists on this device. Clearing your browser data
            would erase it.
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="save-email" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-2">
              Email
            </label>
            <Input
              id="save-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              {...form.register('email')}
            />
            {form.formState.errors.email && (
              <p className="mt-1.5 text-xs text-danger">{form.formState.errors.email.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="save-password" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-ink-2">
              Password
            </label>
            <div className="relative">
              <Input
                id="save-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="min. 8 characters"
                className="pr-11"
                {...form.register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 tap-scale hover:text-ink"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {form.formState.errors.password && (
              <p className="mt-1.5 text-xs text-danger">{form.formState.errors.password.message}</p>
            )}
          </div>

          <Button type="submit" size="lg" disabled={form.formState.isSubmitting} className="mt-2 w-full gap-2 tap-scale">
            <Mail className="h-4 w-4" />
            {form.formState.isSubmitting ? 'Saving…' : 'Save my account'}
          </Button>
        </form>

        <button
          type="button"
          onClick={close}
          className="mt-3 w-full py-2 text-sm font-medium text-ink-2 tap-scale hover:text-ink"
        >
          Not now
        </button>
      </SheetContent>
    </Sheet>
  )
}
