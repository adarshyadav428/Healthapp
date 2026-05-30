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
import { useSubscription } from '../../hooks/useSubscription'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, Crown, Target, User, LogOut, Trash2, Download, Sliders } from 'lucide-react'

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
    <section className="rounded-3xl border border-gray-100 dark:border-slate-700 bg-white/90 dark:bg-slate-900/80 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 border-b border-gray-50 dark:border-slate-800 px-4 py-3">
        <span className="text-muted">{icon}</span>
        <h2 className="text-sm font-bold text-foreground">{title}</h2>
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
  const [useCustomTargets, setUseCustomTargets] = useState(false)

  const form = useForm<ProfileUpdateData>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      display_name: profile.display_name ?? '',
      height_cm: profile.height_cm,
      current_weight_kg: profile.current_weight_kg,
      target_weight_kg: profile.target_weight_kg,
      activity_level: profile.activity_level,
      goal: profile.goal,
      water_target_ml: profile.water_target_ml ?? 2500,
      custom_calorie_target: profile.daily_calorie_target,
      custom_protein_target: profile.protein_g_target,
      custom_carbs_target:   profile.carbs_g_target,
      custom_fat_target:     profile.fat_g_target,
    },
  })

  const onSubmit = async (values: ProfileUpdateData) => {
    try {
      // Only send custom target fields when the user has opted in
      const payload = useCustomTargets
        ? values
        : {
            ...values,
            custom_calorie_target: undefined,
            custom_protein_target: undefined,
            custom_carbs_target:   undefined,
            custom_fat_target:     undefined,
          }

      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || 'Failed to update profile')
      }
      const desc = useCustomTargets ? 'Custom targets saved.' : 'Calorie targets recalculated.'
      toast({ title: 'Profile updated ✓', description: desc, duration: 3000 })
      router.refresh() // re-render server component so DAILY GOAL stat updates
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
      const res = await fetch('/api/auth/signout', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'Sign out failed')
      }
      window.location.href = '/'
    } catch (err) {
      toast({ title: 'Sign out failed', description: (err as Error).message, variant: 'error', duration: 4000 })
      setSignOutLoading(false)
    }
  }

  const exportData = () => {
    window.location.href = '/api/export'
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
        <div className="rounded-3xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50 dark:bg-indigo-950/20 p-4">
          <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold uppercase tracking-wide">Daily goal</p>
          <p className="text-3xl font-black text-indigo-700 dark:text-indigo-400 mt-1">{profile.daily_calorie_target.toLocaleString()}</p>
          <p className="text-xs text-indigo-500 dark:text-indigo-500">kcal / day</p>
        </div>
        <div className="rounded-3xl border border-gray-100 dark:border-slate-700 bg-white/90 dark:bg-slate-900/80 p-4 space-y-1.5">
          <MacroChip label="Protein" g={profile.protein_g_target} color="text-blue-600" />
          <MacroChip label="Carbs" g={profile.carbs_g_target} color="text-amber-600" />
          <MacroChip label="Fat" g={profile.fat_g_target} color="text-rose-500" />
        </div>
      </div>

      {bmi !== null && (
        <div className="flex items-center justify-between rounded-2xl border border-gray-100 dark:border-slate-700 bg-white/90 dark:bg-slate-900/80 px-4 py-3">
          <span className="text-sm text-muted">BMI</span>
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
            <BmiRecommendation
              heightCm={form.watch('height_cm')}
              currentWeightKg={form.watch('current_weight_kg')}
              onSelect={(kg) => form.setValue('target_weight_kg', kg, { shouldValidate: true })}
            />
          </Field>
          <Field label="Daily water goal (ml)" error={form.formState.errors.water_target_ml?.message}>
            <div className="flex items-center gap-2">
              <Input id="water_target_ml" type="number" step="250" min="500" max="8000" {...form.register('water_target_ml', { valueAsNumber: true })} />
              <span className="text-xs text-muted whitespace-nowrap">💧 ml/day</span>
            </div>
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

          {/* Custom targets toggle */}
          <div className="rounded-2xl border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 p-3">
            <button
              type="button"
              onClick={() => setUseCustomTargets((v) => !v)}
              className="flex w-full items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-sm font-semibold text-foreground">Custom calorie &amp; macro targets</span>
              </div>
              <div className={`relative h-5 w-9 rounded-full transition-colors ${useCustomTargets ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-slate-600'}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${useCustomTargets ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
            </button>
            <p className="mt-1.5 text-xs text-muted">
              {useCustomTargets ? 'Targets below will be saved as-is — no auto-recalculation.' : 'Targets are auto-calculated from your stats above.'}
            </p>

            {useCustomTargets && (
              <div className="mt-3 space-y-3">
                <Field label="Daily calories (kcal)" error={form.formState.errors.custom_calorie_target?.message}>
                  <Input
                    type="number" min="500" max="10000" step="50"
                    {...form.register('custom_calorie_target', { valueAsNumber: true })}
                  />
                </Field>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Protein (g)" error={form.formState.errors.custom_protein_target?.message}>
                    <Input type="number" min="0" max="500" step="5" {...form.register('custom_protein_target', { valueAsNumber: true })} />
                  </Field>
                  <Field label="Carbs (g)" error={form.formState.errors.custom_carbs_target?.message}>
                    <Input type="number" min="0" max="1000" step="5" {...form.register('custom_carbs_target', { valueAsNumber: true })} />
                  </Field>
                  <Field label="Fat (g)" error={form.formState.errors.custom_fat_target?.message}>
                    <Input type="number" min="0" max="500" step="5" {...form.register('custom_fat_target', { valueAsNumber: true })} />
                  </Field>
                </div>
                {/* Live kcal check */}
                {(() => {
                  const p = form.watch('custom_protein_target') ?? 0
                  const c = form.watch('custom_carbs_target') ?? 0
                  const f = form.watch('custom_fat_target') ?? 0
                  const derivedKcal = p * 4 + c * 4 + f * 9
                  const targetKcal = form.watch('custom_calorie_target') ?? 0
                  const diff = Math.abs(derivedKcal - targetKcal)
                  if (derivedKcal === 0) return null
                  return (
                    <p className={`text-xs font-medium ${diff > 100 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {derivedKcal} kcal from macros
                      {diff > 100 ? ` — ${diff} kcal off from your calorie target` : ' ✓ matches calorie target'}
                    </p>
                  )
                })()}
              </div>
            )}
          </div>

          <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Saving...' : 'Save changes'}
          </Button>
        </form>
      </SectionCard>

      {/* Subscription */}
      <SectionCard title="Subscription" icon={<Crown className="h-4 w-4" />}>
        {subscription?.isPro ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-100 dark:bg-amber-950/40 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400">PRO</span>
              <span className="text-sm text-muted">Unlimited logging, all features</span>
            </div>
            <Button variant="outline" className="w-full" onClick={manageSubscription} disabled={portalLoading}>
              {portalLoading ? 'Opening...' : 'Manage Subscription'}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted">Free plan — last 7 days of history</p>
            <Button asChild className="w-full bg-indigo-600 hover:bg-indigo-700">
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
            onClick={exportData}
            className="flex w-full items-center justify-between rounded-2xl border border-gray-100 dark:border-slate-700 px-4 py-3 text-sm font-medium text-foreground hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Download className="h-4 w-4 text-muted" />
              Export my data (CSV)
            </span>
            <ChevronRight className="h-4 w-4 text-muted" />
          </button>
          <button
            type="button"
            onClick={signOut}
            disabled={signOutLoading}
            className="flex w-full items-center justify-between rounded-2xl border border-gray-100 dark:border-slate-700 px-4 py-3 text-sm font-medium text-foreground hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <LogOut className="h-4 w-4 text-muted" />
              {signOutLoading ? 'Signing out...' : 'Sign out'}
            </span>
            <ChevronRight className="h-4 w-4 text-muted" />
          </button>
          <button
            type="button"
            onClick={deleteAccount}
            disabled={deleteLoading}
            className="flex w-full items-center justify-between rounded-2xl border border-rose-100 dark:border-rose-900/30 px-4 py-3 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 disabled:opacity-50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              {deleteLoading ? 'Deleting...' : 'Delete account'}
            </span>
            <ChevronRight className="h-4 w-4 text-rose-300 dark:text-rose-700" />
          </button>
        </div>
        <p className="mt-3 text-center text-xs text-muted">GetInShape v{version}</p>
      </SectionCard>
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs font-semibold text-muted uppercase tracking-wide">{label}</Label>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-xs text-rose-500">{error}</p>}
    </div>
  )
}

function MacroChip({ label, g, color }: { label: string; g: number; color: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted">{label}</span>
      <span className={`font-bold ${color}`}>{g}g</span>
    </div>
  )
}

function BmiRecommendation({
  heightCm,
  currentWeightKg,
  onSelect,
}: {
  heightCm: number
  currentWeightKg: number
  onSelect: (kg: number) => void
}) {
  if (!heightCm || !currentWeightKg || heightCm <= 0 || currentWeightKg <= 0) return null

  const hM = heightCm / 100
  const currentBmi = +(currentWeightKg / (hM * hM)).toFixed(1)
  const bmiLabel =
    currentBmi < 18.5 ? 'Underweight' :
    currentBmi < 25   ? 'Healthy weight' :
    currentBmi < 30   ? 'Overweight' : 'Obese'
  const bmiColor =
    currentBmi < 18.5 ? 'text-blue-600 dark:text-blue-400' :
    currentBmi < 25   ? 'text-emerald-600 dark:text-emerald-400' :
    currentBmi < 30   ? 'text-amber-600 dark:text-amber-400' :
                        'text-rose-600 dark:text-rose-400'

  const suggestions = [
    { bmi: 20, kg: +(20 * hM * hM).toFixed(1) },
    { bmi: 22, kg: +(22 * hM * hM).toFixed(1) },
    { bmi: 24, kg: +(24 * hM * hM).toFixed(1) },
  ]
  const minHealthy = +(18.5 * hM * hM).toFixed(1)
  const maxHealthy = +(24.9 * hM * hM).toFixed(1)

  return (
    <div className="mt-2 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-950/10 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">Your current BMI</span>
        <span className={`text-xs font-bold ${bmiColor}`}>{currentBmi} · {bmiLabel}</span>
      </div>
      <p className="text-[11px] text-muted">
        Healthy range: <span className="font-semibold text-foreground">{minHealthy}–{maxHealthy} kg</span> (BMI 18.5–24.9)
      </p>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1.5">Tap to set target</p>
        <div className="flex gap-2">
          {suggestions.map((s) => (
            <button
              key={s.bmi}
              type="button"
              onClick={() => onSelect(s.kg)}
              className="flex-1 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 py-1.5 text-center hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 active:scale-95 transition-all"
            >
              <p className="text-xs font-black text-indigo-700 dark:text-indigo-400">{s.kg} kg</p>
              <p className="text-[10px] text-muted">BMI {s.bmi}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
