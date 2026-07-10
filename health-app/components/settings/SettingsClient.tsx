'use client'

import { useState, useRef } from 'react'
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
import { ChevronRight, Crown, Target, User, LogOut, Trash2, Download, Sliders, Pencil, Check, X, Zap, SunMoon } from 'lucide-react'
import { ThemeSegmented } from '../ui/theme-toggle'

function ftInToCm(ft: number, inches: number) {
  return Math.round((ft * 12 + inches) * 2.54)
}
function cmToFtIn(cm: number) {
  const totalIn = cm / 2.54
  return { ft: Math.floor(totalIn / 12), inches: Math.round(totalIn % 12) }
}

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
    <section className="rounded-sheet border border-hairline bg-surface shadow-rest overflow-hidden">
      <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
        <span className="text-ink-2">{icon}</span>
        <h2 className="font-display text-sm font-bold text-ink">{title}</h2>
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
  const initHeight = cmToFtIn(profile.height_cm ?? 170)
  const [heightFt, setHeightFt] = useState(initHeight.ft)
  const [heightIn, setHeightIn] = useState(initHeight.inches)
  // Quick calorie editor state
  const [editingCalories, setEditingCalories] = useState(false)
  const [quickKcal, setQuickKcal] = useState(String(profile.daily_calorie_target))
  const [savingKcal, setSavingKcal] = useState(false)
  const kcalInputRef = useRef<HTMLInputElement>(null)

  const form = useForm<ProfileUpdateData>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      display_name: profile.display_name ?? '',
      height_cm: profile.height_cm,
      current_weight_kg: profile.current_weight_kg,
      target_weight_kg: profile.target_weight_kg,
      activity_level: profile.activity_level,
      goal: profile.goal,
      pace_kg_per_week: profile.pace_kg_per_week ?? 0.5,
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
    // Google Play subscriptions can only be managed in the Play Store, not the
    // Stripe billing portal.
    if (subscription?.provider === 'google_play') {
      const sku = subscription.playProductId
      const url = sku
        ? `https://play.google.com/store/account/subscriptions?sku=${sku}&package=com.getinshape.app`
        : 'https://play.google.com/store/account/subscriptions'
      window.location.href = url
      return
    }

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

  const saveQuickKcal = async (kcal: number) => {
    if (!kcal || kcal < 500 || kcal > 10000) return
    setSavingKcal(true)
    try {
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: profile.display_name ?? '',
          height_cm: profile.height_cm,
          current_weight_kg: profile.current_weight_kg,
          target_weight_kg: profile.target_weight_kg,
          activity_level: profile.activity_level,
          goal: profile.goal,
          water_target_ml: profile.water_target_ml ?? 2500,
          custom_calorie_target: kcal,
          custom_protein_target: profile.protein_g_target,
          custom_carbs_target: profile.carbs_g_target,
          custom_fat_target: profile.fat_g_target,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      toast({ title: `Calorie target set to ${kcal.toLocaleString()} kcal ✓`, duration: 2500 })
      setEditingCalories(false)
      router.refresh()
    } catch {
      toast({ title: 'Could not save', variant: 'error', duration: 3000 })
    } finally {
      setSavingKcal(false)
    }
  }

  // BMI calculation
  const bmi = profile.height_cm && profile.current_weight_kg
    ? +(profile.current_weight_kg / Math.pow(profile.height_cm / 100, 2)).toFixed(1)
    : null
  const bmiLabel = bmi === null ? null : bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Healthy' : bmi < 30 ? 'Overweight' : 'Obese'
  const bmiColor = bmi === null ? '' : bmi < 18.5 ? 'var(--protein)' : bmi < 25 ? 'var(--good)' : bmi < 30 ? 'var(--energy-ink)' : 'var(--bad)'

  return (
    <div className="space-y-4">

      {/* ── Calorie target — quick editor ── */}
      <div className="rounded-sheet border border-hairline bg-brand-soft p-4 shadow-rest">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-brand" />
            <p className="text-xs font-bold uppercase tracking-widest text-brand-ink">Daily Calorie Goal</p>
          </div>
          {!editingCalories && (
            <button
              type="button"
              onClick={() => {
                setQuickKcal(String(profile.daily_calorie_target))
                setEditingCalories(true)
                setTimeout(() => kcalInputRef.current?.focus(), 50)
              }}
              className="flex items-center gap-1 rounded-control bg-surface border border-hairline px-2.5 py-1 text-xs font-semibold text-brand-ink hover:bg-brand-soft transition-all"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
          )}
        </div>

        {!editingCalories ? (
          <>
            <p className="font-display text-4xl font-bold text-ink leading-none tabular-nums">
              {profile.daily_calorie_target.toLocaleString()}
            </p>
            <p className="text-sm text-brand-ink mt-1">kcal / day</p>
            <div className="mt-3 flex gap-3 text-xs">
              <span className="font-semibold tabular-nums" style={{ color: 'var(--protein)' }}>P {profile.protein_g_target}g</span>
              <span className="font-semibold tabular-nums" style={{ color: 'var(--carbs)' }}>C {profile.carbs_g_target}g</span>
              <span className="font-semibold tabular-nums" style={{ color: 'var(--fat)' }}>F {profile.fat_g_target}g</span>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            {/* Preset chips */}
            <div>
              <p className="text-xs text-brand-ink font-semibold mb-2">Quick presets</p>
              <div className="flex flex-wrap gap-2">
                {[1200, 1500, 1800, 2000, 2200, 2500].map((kcal) => (
                  <button
                    key={kcal}
                    type="button"
                    onClick={() => setQuickKcal(String(kcal))}
                    className={`rounded-control px-3 py-1.5 text-sm font-bold border transition-all ${
                      quickKcal === String(kcal)
                        ? 'bg-brand text-white border-brand shadow-rest'
                        : 'bg-surface text-ink border-hairline hover:border-brand-ring'
                    }`}
                  >
                    {kcal.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom input */}
            <div>
              <p className="text-xs text-brand-ink font-semibold mb-1.5">Or type a custom value</p>
              <div className="flex items-center gap-2">
                <input
                  ref={kcalInputRef}
                  type="number"
                  value={quickKcal}
                  min={500}
                  max={10000}
                  step={50}
                  onChange={(e) => setQuickKcal(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveQuickKcal(Number(quickKcal))}
                  className="w-32 rounded-control border border-hairline bg-surface px-4 py-2.5 text-lg font-bold text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-ring transition-all"
                />
                <span className="text-sm text-ink-2 font-medium">kcal / day</span>
              </div>
            </div>

            {/* Save / Cancel */}
            <div className="flex gap-2">
              <Button size="sm" onClick={() => saveQuickKcal(Number(quickKcal))} disabled={savingKcal || !quickKcal || Number(quickKcal) < 500} className="gap-1.5 tap-scale">
                <Check className="h-4 w-4" />
                {savingKcal ? 'Saving…' : 'Save'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditingCalories(false)} className="gap-1.5 tap-scale">
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </div>
            <p className="text-[11px] text-brand-ink opacity-80">
              This overrides the auto-calculated target. Macros will keep their current values.
            </p>
          </div>
        )}
      </div>

      {bmi !== null && (
        <div className="flex items-center justify-between rounded-card border border-hairline bg-surface px-4 py-3">
          <span className="text-sm text-ink-2">BMI</span>
          <span className="text-sm font-bold" style={{ color: bmiColor }}>{bmi} — {bmiLabel}</span>
        </div>
      )}

      {/* Appearance */}
      <SectionCard title="Appearance" icon={<SunMoon className="h-4 w-4" />}>
        <ThemeSegmented />
        <p className="mt-2.5 text-xs text-ink-2">System follows your phone&apos;s light/dark setting automatically.</p>
      </SectionCard>

      {/* Profile form */}
      <SectionCard title="Profile" icon={<User className="h-4 w-4" />}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Display name" error={form.formState.errors.display_name?.message}>
            <Input id="display_name" {...form.register('display_name')} />
          </Field>
          <Field label="Height" error={form.formState.errors.height_cm?.message}>
            <div className="flex gap-2">
              <select
                value={heightFt}
                onChange={(e) => {
                  const ft = Number(e.target.value)
                  setHeightFt(ft)
                  form.setValue('height_cm', ftInToCm(ft, heightIn), { shouldValidate: true })
                }}
                className="flex-1 rounded-control border border-hairline bg-surface px-3 py-2 text-sm font-bold text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-ring transition-all"
              >
                {[3,4,5,6,7,8].map(ft => <option key={ft} value={ft}>{ft} ft</option>)}
              </select>
              <select
                value={heightIn}
                onChange={(e) => {
                  const inches = Number(e.target.value)
                  setHeightIn(inches)
                  form.setValue('height_cm', ftInToCm(heightFt, inches), { shouldValidate: true })
                }}
                className="flex-1 rounded-control border border-hairline bg-surface px-3 py-2 text-sm font-bold text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-ring transition-all"
              >
                {[0,1,2,3,4,5,6,7,8,9,10,11].map(i => <option key={i} value={i}>{i} in</option>)}
              </select>
            </div>
          </Field>
          <Field label="Current weight (kg)" error={form.formState.errors.current_weight_kg?.message}>
            <Input id="current_weight_kg" type="number" step="0.1" min="1" {...form.register('current_weight_kg', { valueAsNumber: true })} />
          </Field>
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
              <span className="text-xs text-ink-2 whitespace-nowrap">💧 ml/day</span>
            </div>
          </Field>
          <Field label="Activity level" error={form.formState.errors.activity_level?.message}>
            <select
              {...form.register('activity_level')}
              className="w-full rounded-control border border-hairline bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-ring transition-all"
            >
              {Object.entries(ACTIVITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Goal" error={form.formState.errors.goal?.message}>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'lose', label: 'Lose', emoji: '📉' },
                { value: 'maintain', label: 'Maintain', emoji: '⚖️' },
                { value: 'gain', label: 'Gain', emoji: '📈' },
              ] as const).map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => form.setValue('goal', g.value, { shouldDirty: true })}
                  className={`rounded-control border py-2.5 text-sm font-semibold transition-all ${
                    form.watch('goal') === g.value
                      ? 'border-brand bg-brand-soft text-brand-ink'
                      : 'border-hairline bg-surface text-ink hover:border-brand-ring'
                  }`}
                >
                  {g.emoji} {g.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Weekly loss goal" error={form.formState.errors.pace_kg_per_week?.message}>
            <select
              {...form.register('pace_kg_per_week', { valueAsNumber: true })}
              className="w-full rounded-control border border-hairline bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-ring transition-all"
            >
              <option value="0.25">0.25 kg/week — 275 kcal/day deficit</option>
              <option value="0.5">0.50 kg/week — 550 kcal/day deficit</option>
              <option value="0.75">0.75 kg/week — 825 kcal/day deficit</option>
              <option value="1">1.00 kg/week — 1,100 kcal/day deficit</option>
            </select>
          </Field>

          {/* Custom targets toggle */}
          <div className="rounded-card border border-hairline bg-surface-2 p-3">
            <button
              type="button"
              onClick={() => setUseCustomTargets((v) => !v)}
              className="flex w-full items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-brand" />
                <span className="text-sm font-semibold text-ink">Custom calorie &amp; macro targets</span>
              </div>
              <div className={`relative h-5 w-9 rounded-full transition-colors ${useCustomTargets ? 'bg-brand' : 'bg-hairline'}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-surface shadow transition-transform ${useCustomTargets ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
            </button>
            <p className="mt-1.5 text-xs text-ink-2">
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
                    <p className="text-xs font-medium" style={{ color: diff > 100 ? 'var(--energy-ink)' : 'var(--good)' }}>
                      {derivedKcal} kcal from macros
                      {diff > 100 ? ` — ${diff} kcal off from your calorie target` : ' ✓ matches calorie target'}
                    </p>
                  )
                })()}
              </div>
            )}
          </div>

          <Button type="submit" size="lg" className="w-full tap-scale" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Saving...' : 'Save changes'}
          </Button>
        </form>
      </SectionCard>

      {/* Subscription */}
      <SectionCard title="Subscription" icon={<Crown className="h-4 w-4" />}>
        {subscription?.isPro ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-energy-soft px-2 py-0.5 text-xs font-bold text-energy-ink">PRO</span>
              <span className="text-sm text-ink-2">Unlimited logging, all features</span>
            </div>
            <Button variant="outline" size="lg" className="w-full tap-scale" onClick={manageSubscription} disabled={portalLoading}>
              {portalLoading ? 'Opening...' : 'Manage Subscription'}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink-2">Free plan — last 7 days of history</p>
            <Button asChild size="lg" className="w-full tap-scale">
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
            className="flex w-full items-center justify-between rounded-card border border-hairline px-4 py-3 text-sm font-medium text-ink hover:bg-surface-2 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Download className="h-4 w-4 text-ink-2" />
              Export my data (CSV)
            </span>
            <ChevronRight className="h-4 w-4 text-ink-2" />
          </button>
          <button
            type="button"
            onClick={signOut}
            disabled={signOutLoading}
            className="flex w-full items-center justify-between rounded-card border border-hairline px-4 py-3 text-sm font-medium text-ink hover:bg-surface-2 disabled:opacity-50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <LogOut className="h-4 w-4 text-ink-2" />
              {signOutLoading ? 'Signing out...' : 'Sign out'}
            </span>
            <ChevronRight className="h-4 w-4 text-ink-2" />
          </button>
          <button
            type="button"
            onClick={deleteAccount}
            disabled={deleteLoading}
            className="flex w-full items-center justify-between rounded-card border border-hairline px-4 py-3 text-sm font-medium text-danger hover:bg-danger-soft disabled:opacity-50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              {deleteLoading ? 'Deleting...' : 'Delete account'}
            </span>
            <ChevronRight className="h-4 w-4 opacity-50" />
          </button>
        </div>
        <p className="mt-3 text-center text-xs text-ink-2">GetInShape v{version}</p>
      </SectionCard>
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs font-semibold text-ink-2 uppercase tracking-wide">{label}</Label>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  )
}

function MacroChip({ label, g, color }: { label: string; g: number; color: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-ink-2">{label}</span>
      <span className="font-bold tabular-nums" style={{ color }}>{g}g</span>
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
    currentBmi < 18.5 ? 'var(--protein)' :
    currentBmi < 25   ? 'var(--good)' :
    currentBmi < 30   ? 'var(--energy-ink)' :
                        'var(--bad)'

  const suggestions = [
    { bmi: 20, kg: +(20 * hM * hM).toFixed(1) },
    { bmi: 22, kg: +(22 * hM * hM).toFixed(1) },
    { bmi: 24, kg: +(24 * hM * hM).toFixed(1) },
  ]
  const minHealthy = +(18.5 * hM * hM).toFixed(1)
  const maxHealthy = +(24.9 * hM * hM).toFixed(1)

  return (
    <div className="mt-2 rounded-card border border-hairline bg-brand-soft p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-2">Your current BMI</span>
        <span className="text-xs font-bold" style={{ color: bmiColor }}>{currentBmi} · {bmiLabel}</span>
      </div>
      <p className="text-[11px] text-ink-2">
        Healthy range: <span className="font-semibold text-ink">{minHealthy}–{maxHealthy} kg</span> (BMI 18.5–24.9)
      </p>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-2 mb-1.5">Tap to set target</p>
        <div className="flex gap-2">
          {suggestions.map((s) => (
            <button
              key={s.bmi}
              type="button"
              onClick={() => onSelect(s.kg)}
              className="flex-1 rounded-control border border-hairline bg-surface py-1.5 text-center hover:border-brand tap-scale transition-all"
            >
              <p className="text-xs font-bold text-brand-ink tabular-nums">{s.kg} kg</p>
              <p className="text-[10px] text-ink-2">BMI {s.bmi}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
