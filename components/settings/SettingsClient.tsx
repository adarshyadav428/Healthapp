'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Profile } from '../../types/index'
import { profileUpdateSchema, type ProfileUpdateData } from '../../lib/validations'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { toast } from '../ui/use-toast'
import { getBrowserSupabaseClient } from '../../lib/supabase/client'
import { useSubscription } from '../../hooks/useSubscription'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export function SettingsClient({ profile, version }: { profile: Profile; version: string }) {
  const router = useRouter()
  const { data: subscription } = useSubscription(profile.id)
  const [portalLoading, setPortalLoading] = useState(false)
  const [signOutLoading, setSignOutLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const form = useForm<ProfileUpdateData>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      display_name: profile.display_name ?? '',
      height_cm: profile.height_cm,
      current_weight_kg: profile.current_weight_kg,
      activity_level: profile.activity_level,
      goal: profile.goal,
    },
  })

  const onSubmit = async (values: ProfileUpdateData) => {
    try {
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || 'Failed to update profile')
      }
      toast({ title: 'Profile updated', description: 'Targets recalculated.', duration: 3000 })
    } catch (err) {
      toast({ title: 'Update failed', description: (err as Error).message, variant: 'error', duration: 4000 })
    }
  }

  const manageSubscription = async () => {
    try {
      setPortalLoading(true)
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      window.location.href = data.url
    } catch (err) {
      toast({ title: 'Could not open portal', description: (err as Error).message, variant: 'error', duration: 4000 })
      setPortalLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setSignOutLoading(true)
      const supabase = getBrowserSupabaseClient()
      const { error } = await supabase.auth.signOut()
      if (error) throw new Error(error.message)
      router.push('/')
    } catch (err) {
      toast({ title: 'Sign out failed', description: (err as Error).message, variant: 'error', duration: 4000 })
      setSignOutLoading(false)
    }
  }

  const deleteAccount = async () => {
    const confirmed = window.confirm('Delete your account and all data? This cannot be undone.')
    if (!confirmed) return

    try {
      setDeleteLoading(true)
      const res = await fetch('/api/account/delete', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push('/')
    } catch (err) {
      toast({ title: 'Delete failed', description: (err as Error).message, variant: 'error', duration: 4000 })
      setDeleteLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-gray-100 bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-4">
          <div>
            <Label htmlFor="display_name">Display name</Label>
            <Input id="display_name" {...form.register('display_name')} />
            {form.formState.errors.display_name ? (
              <p className="mt-1 text-xs text-red-500">{form.formState.errors.display_name.message}</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="height_cm">Height (cm)</Label>
            <Input id="height_cm" type="number" {...form.register('height_cm', { valueAsNumber: true })} />
            {form.formState.errors.height_cm ? (
              <p className="mt-1 text-xs text-red-500">{form.formState.errors.height_cm.message}</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="current_weight_kg">Current weight (kg)</Label>
            <Input id="current_weight_kg" type="number" {...form.register('current_weight_kg', { valueAsNumber: true })} />
            {form.formState.errors.current_weight_kg ? (
              <p className="mt-1 text-xs text-red-500">{form.formState.errors.current_weight_kg.message}</p>
            ) : null}
          </div>
          <div>
            <Label>Activity level</Label>
            <Select value={form.watch('activity_level')} onValueChange={(value) => form.setValue('activity_level', value as Profile['activity_level'])}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sedentary">Sedentary</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="very_active">Very active</SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.activity_level ? (
              <p className="mt-1 text-xs text-red-500">{form.formState.errors.activity_level.message}</p>
            ) : null}
          </div>
          <div>
            <Label>Goal</Label>
            <Select value={form.watch('goal')} onValueChange={(value) => form.setValue('goal', value as Profile['goal'])}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lose">Lose</SelectItem>
                <SelectItem value="maintain">Maintain</SelectItem>
                <SelectItem value="gain">Gain</SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.goal ? (
              <p className="mt-1 text-xs text-red-500">{form.formState.errors.goal.message}</p>
            ) : null}
          </div>

          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Saving...' : 'Save changes'}
          </Button>
        </form>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900">Subscription</h2>
        <p className="text-sm text-gray-500">
          {subscription?.isPro ? 'You are on Pro.' : 'Free plan: up to 5 logs per day.'}
        </p>
        <div className="mt-3">
          {subscription?.isPro ? (
            <Button variant="outline" onClick={manageSubscription} disabled={portalLoading}>
              {portalLoading ? 'Opening...' : 'Manage Subscription'}
            </Button>
          ) : (
            <Button asChild>
              <Link href="/upgrade">Upgrade to Pro</Link>
            </Button>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900">Account</h2>
        <div className="mt-3 flex flex-col gap-3">
          <Button variant="outline" onClick={signOut} disabled={signOutLoading}>
            {signOutLoading ? 'Signing out...' : 'Sign out'}
          </Button>
          <Button variant="ghost" className="text-red-600" onClick={deleteAccount} disabled={deleteLoading}>
            {deleteLoading ? 'Deleting...' : 'Delete account'}
          </Button>
        </div>
        <p className="mt-4 text-xs text-gray-400">App version {version}</p>
      </section>
    </div>
  )
}
