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
import { ChevronRight, Crown, Target, User, LogOut, Trash2 } from 'lucide-react'

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: 'Sedentary (desk job, no exercise)',
  light: 'Light (1–3 days/week)',
  moderate: 'Moderate (3–5 days/week)',
  active: 'Active (6–7 days/week)',
  very_active: 'Very active (twice a day)',
}

const GOAL_LABELS: Record<string, string> = {
  lose: '⬇️ Lose weight',
  maintain: '⚖️ Maintain weight',
  gain: '⬆️ Gain muscle',
}

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-gray-100 bg-white/90 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 border-b border-gray-50 px-4 py-3">
        <span className="text-gray-500">{icon}</span>
        <h2 className="text-sm font-bold text-gray-800">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

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
      target_weight_kg: profile.target_weight_kg,
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
      toast({ title: 'Profile updated ✓', description: 'Calorie targets recalculated.', duration: 3000 })
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
      window.location.href = '/'
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

  // BMI calculation
  const bmi = profile.height_cm && profile.current_weight_kg
    ? +(profile.current_weight_kg / Math.pow(profile.height_cm / 100, 2)).toFixed(1)
    : null
  const bmiLabel = bmi === null ? null : bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Healthy' : bmi < 30 ? 'Overweight' : 'Obese'
  const bmiColor = bmi === null ? '' : bmi < 18.5 ? 'text-blue-600' : bmi < 25 ? 'text-emerald-600' : bmi < 30 ? 'text-amber-600' : 'text-rose-600'

  return (
    <div className="space-y-4">

      {/* Targets summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl border border-orange-100 bg-orange-50 p-4">
          <p className="text-xs text-orange-600 font-semibold uppercase tracking-wide">Daily goal</p>
          <p className="text-3xl font-black text-orange-700 mt-1">{profile.daily_calorie_target.toLocaleString()}</p>
          <p className="text-xs text-orange-500">kcal / day</p>
        </div>
        <div className="rounded-3xl border border-gray-100 bg-white/90 p-4 space-y-1.5">
          <MacroChip label="Protein" g={profile.protein_g_target} color="text-blue-600" />
          <MacroChip label="Carbs" g={profile.carbs_g_target} color="text-amber-600" />
          <MacroChip label="Fat" g={profile.fat_g_target} color="text-rose-500" />
        </div>
      </div>

      {bmi !== null && (
        <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white/90 px-4 py-3">
          <span className="text-sm text-gray-600">BMI</span>
          <span className={`text-sm font-bold ${bmiColor}`}>{bmi} — {bmiLabel}</span>
        </div>
      )}

      {/* Profile form */}
      <SectionCard title="Profile" icon={<User className="h-4 w-4" />}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Display name" error={form.formState.errors.display_name?.message}>
            <Input id="display_name" {...form.register('display_name')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Height (cm)" error={form.formState.errors.height_cm?.message}>
              <Input id="height_cm" type="number" {...form.register('height_cm', { valueAsNumber: true })} />
            </Field>
            <Field label="Current weight (kg)" error={form.formState.errors.current_weight_kg?.message}>
              <Input id="current_weight_kg" type="number" step="0.1" min="1" {...form.register('current_weight_kg', { valueAsNumber: true })} />
            </Field>
          </div>
          <Field label="Target weight (kg)" error={form.formState.errors.target_weight_kg?.message}>
            <Input id="target_weight_kg" type="number" step="0.1" min="1" {...form.register('target_weight_kg', { valueAsNumber: true })} />
          </Field>
          <Field label="Activity level" error={form.formState.errors.activity_level?.message}>
            <Select value={form.watch('activity_level')} onValueChange={(v) => form.setValue('activity_level', v as Profile['activity_level'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ACTIVITY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Goal" error={form.formState.errors.goal?.message}>
            <Select value={form.watch('goal')} onValueChange={(v) => form.setValue('goal', v as Profile['goal'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(GOAL_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Saving...' : 'Save changes'}
          </Button>
        </form>
      </SectionCard>

      {/* Subscription */}
      <SectionCard title="Subscription" icon={<Crown className="h-4 w-4" />}>
        {subscription?.isPro ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">PRO</span>
              <span className="text-sm text-gray-600">Unlimited logging, all features</span>
            </div>
            <Button variant="outline" className="w-full" onClick={manageSubscription} disabled={portalLoading}>
              {portalLoading ? 'Opening...' : 'Manage Subscription'}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Free plan — 5 food logs per day</p>
            <Button asChild className="w-full bg-orange-600 hover:bg-orange-700">
              <Link href="/upgrade">
                <Crown className="mr-1.5 h-4 w-4" />
                Upgrade to Pro
              </Link>
            </Button>
          </div>
        )}
      </SectionCard>

      {/* Account */}
      <SectionCard title="Account" icon={<Target className="h-4 w-4" />}>
        <div className="space-y-2">
          <button
            type="button"
            onClick={signOut}
            disabled={signOutLoading}
            className="flex w-full items-center justify-between rounded-2xl border border-gray-100 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <LogOut className="h-4 w-4 text-gray-400" />
              {signOutLoading ? 'Signing out...' : 'Sign out'}
            </span>
            <ChevronRight className="h-4 w-4 text-gray-300" />
          </button>
          <button
            type="button"
            onClick={deleteAccount}
            disabled={deleteLoading}
            className="flex w-full items-center justify-between rounded-2xl border border-rose-100 px-4 py-3 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              {deleteLoading ? 'Deleting...' : 'Delete account'}
            </span>
            <ChevronRight className="h-4 w-4 text-rose-300" />
          </button>
        </div>
        <p className="mt-3 text-center text-xs text-gray-300">CalTrack v{version}</p>
      </SectionCard>
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</Label>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-xs text-rose-500">{error}</p>}
    </div>
  )
}

function MacroChip({ label, g, color }: { label: string; g: number; color: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-500">{label}</span>
      <span className={`font-bold ${color}`}>{g}g</span>
    </div>
  )
}
