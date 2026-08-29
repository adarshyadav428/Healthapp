'use client'

import { useState, useRef, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTheme } from 'next-themes'
import type { Profile } from '../../types/index'
import { profileUpdateSchema, type ProfileUpdateData } from '../../lib/validations'
import { DEFAULT_REMINDER_HOUR } from '../../lib/reminderSchedule'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { toast } from '../ui/use-toast'
import { useSubscription } from '../../hooks/useSubscription'
import { useManageSubscription } from '../../hooks/useManageSubscription'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronRight, Crown, Target, Scale, Bell, SunMoon, Download, Sliders, Pencil, Check, X, BookOpen, BarChart3,
} from 'lucide-react'
import { isAnalyticsOptedOut, setAnalyticsOptOut } from '../../lib/posthog/client'
import { cn } from '../../lib/utils'
import {
  Sheet, SheetContent, SheetTrigger, SheetTitle,
} from '../ui/sheet'
import { ThemeSegmented } from '../ui/theme-toggle'
import { PushNotificationToggle } from './PushNotificationToggle'
import { ReminderHourPicker } from './ReminderHourPicker'
import { userFacingApiError } from '../../lib/apiError'

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

const THEME_LABELS: Record<string, string> = { light: 'Light', dark: 'Dark', system: 'System' }

export function SettingsClient({ profile, version, email }: { profile: Profile; version: string; email: string }) {
  const router = useRouter()
  const { data: subscription } = useSubscription(profile.id)
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [analyticsOptOut, setOptOutState] = useState(false)
  // localStorage is only readable after mount, so seed the switch there.
  useEffect(() => {
    setMounted(true)
    setOptOutState(isAnalyticsOptedOut())
  }, [])

  const toggleAnalytics = (next: boolean) => {
    setOptOutState(next)
    setAnalyticsOptOut(next)
  }

  const { manageSubscription, portalLoading } = useManageSubscription(subscription, profile.id)
  const [signOutLoading, setSignOutLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [useCustomTargets, setUseCustomTargets] = useState(false)
  const initHeight = cmToFtIn(profile.height_cm ?? 170)
  const [heightFt, setHeightFt] = useState(initHeight.ft)
  const [heightIn, setHeightIn] = useState(initHeight.inches)
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
      const payload = useCustomTargets
        ? values
        : { ...values, custom_calorie_target: undefined, custom_protein_target: undefined, custom_carbs_target: undefined, custom_fat_target: undefined }
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        // 4xx is a validation message meant for the user; 5xx is a DB string
        // meant for us. See lib/apiError.ts.
        throw new Error(userFacingApiError(res.status, body?.error, 'Could not update your profile.'))
      }
      const desc = useCustomTargets ? 'Custom targets saved.' : 'Calorie targets recalculated.'
      toast({ title: 'Profile updated ✓', description: desc, duration: 3000 })
      router.refresh()
    } catch (err) {
      toast({ title: 'Update failed', description: (err as Error).message, variant: 'error', duration: 4000 })
    }
  }

  const signOut = async () => {
    try {
      setSignOutLoading(true)
      const res = await fetch('/api/auth/signout', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(userFacingApiError(res.status, body?.error, 'Could not sign you out.'))
      }
      window.location.href = '/'
    } catch (err) {
      toast({ title: 'Sign out failed', description: (err as Error).message, variant: 'error', duration: 4000 })
      setSignOutLoading(false)
    }
  }

  const exportData = () => { window.location.href = '/api/export' }

  const deleteAccount = async () => {
    const confirmed = window.confirm('Delete your account and all data? This cannot be undone.')
    if (!confirmed) return
    try {
      setDeleteLoading(true)
      const res = await fetch('/api/account/delete', { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(
          userFacingApiError(res.status, data?.error, 'Could not delete your account. Please try again, or email us.')
        )
      }
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

  const initial = (profile.display_name?.trim()?.[0] ?? email?.[0] ?? 'A').toUpperCase()
  const isPro = subscription?.isPro

  return (
    <>
      {/* ── Header ── */}
      <div className="pt-2">
        <p className="text-[13px] font-medium text-ink-3">Account</p>
        <h1 className="font-display mt-[3px] text-[24px] font-bold tracking-[-0.02em] text-ink">Profile</h1>
      </div>

      {/* ── Identity ── */}
      <div className="mt-5 flex flex-col items-center gap-3 pb-1 pt-2">
        <div className="flex h-[76px] w-[76px] items-center justify-center rounded-full" style={{ backgroundImage: 'var(--ava-grad)' }}>
          <span className="font-display text-[30px] font-semibold text-white">{initial}</span>
        </div>
        <div className="text-center">
          <p className="text-[18px] font-bold tracking-[-0.01em] text-ink">{profile.display_name || 'You'}</p>
          <p className="mt-[3px] text-[12.5px] text-ink-3">{email}</p>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="mt-[18px] grid grid-cols-3 rounded-[24px] bg-surface py-[18px]" style={{ boxShadow: 'var(--shadow-air)' }}>
        <Stat value={profile.daily_calorie_target.toLocaleString('en-IN')} label="kcal goal" divider />
        <Stat value={`${profile.protein_g_target ?? 0}g`} label="protein" divider />
        <Stat value={profile.current_weight_kg ? String(profile.current_weight_kg) : '—'} label="weight kg" />
      </div>

      {/* ── Settings rows ── */}
      <div className="mt-3.5 overflow-hidden rounded-[24px] bg-surface" style={{ boxShadow: 'var(--shadow-air)' }}>
        {/* Goals — opens the full profile + targets form */}
        <Sheet>
          <SheetTrigger asChild>
            <button type="button" className="flex w-full items-center gap-3.5 px-[18px] py-4 text-left tap-scale">
              <Target className="h-[19px] w-[19px] shrink-0 text-ink" strokeWidth={1.9} />
              <span className="flex-1 text-[15px] font-medium text-ink">Goals</span>
              <RowChevron />
            </button>
          </SheetTrigger>
          <SheetContent className="max-h-[88vh] overflow-y-auto">
            <SheetTitle className="mb-4">Goals &amp; targets</SheetTitle>

            {/* Calorie quick-editor */}
            <div className="rounded-card bg-brand-soft p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-widest text-brand-ink">Daily calorie goal</p>
                {!editingCalories && (
                  <button
                    type="button"
                    onClick={() => { setQuickKcal(String(profile.daily_calorie_target)); setEditingCalories(true); setTimeout(() => kcalInputRef.current?.focus(), 50) }}
                    className="flex items-center gap-1 rounded-control border border-hairline bg-surface px-2.5 py-1 text-xs font-semibold text-brand-ink tap-scale"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                )}
              </div>
              {!editingCalories ? (
                <>
                  <p className="font-display text-4xl font-bold leading-none tabular-nums text-ink">{profile.daily_calorie_target.toLocaleString()}</p>
                  <p className="mt-1 text-sm text-brand-ink">kcal / day</p>
                  <div className="mt-3 flex gap-3 text-xs">
                    <span className="font-semibold tabular-nums" style={{ color: 'var(--protein)' }}>P {profile.protein_g_target}g</span>
                    <span className="font-semibold tabular-nums" style={{ color: 'var(--carbs)' }}>C {profile.carbs_g_target}g</span>
                    <span className="font-semibold tabular-nums" style={{ color: 'var(--fat)' }}>F {profile.fat_g_target}g</span>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {[1200, 1500, 1800, 2000, 2200, 2500].map((kcal) => (
                      <button
                        key={kcal} type="button" onClick={() => setQuickKcal(String(kcal))}
                        className={`rounded-control border px-3 py-1.5 text-sm font-bold transition-all ${quickKcal === String(kcal) ? 'border-brand bg-brand text-white' : 'border-hairline bg-surface text-ink'}`}
                      >{kcal.toLocaleString()}</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={kcalInputRef} type="number" value={quickKcal} min={500} max={10000} step={50}
                      onChange={(e) => setQuickKcal(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveQuickKcal(Number(quickKcal))}
                      className="w-32 rounded-control border border-hairline bg-surface px-4 py-2.5 text-lg font-bold text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-ring"
                    />
                    <span className="text-sm font-medium text-ink-2">kcal / day</span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveQuickKcal(Number(quickKcal))} disabled={savingKcal || !quickKcal || Number(quickKcal) < 500} className="gap-1.5 tap-scale">
                      <Check className="h-4 w-4" />{savingKcal ? 'Saving…' : 'Save'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingCalories(false)} className="gap-1.5 tap-scale">
                      <X className="h-4 w-4" /> Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Profile form */}
            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-4">
              <Field label="Display name" error={form.formState.errors.display_name?.message}>
                <Input id="display_name" {...form.register('display_name')} />
              </Field>
              <Field label="Height" error={form.formState.errors.height_cm?.message}>
                <div className="flex gap-2">
                  <select
                    value={heightFt}
                    onChange={(e) => { const ft = Number(e.target.value); setHeightFt(ft); form.setValue('height_cm', ftInToCm(ft, heightIn), { shouldValidate: true }) }}
                    className="flex-1 rounded-control border border-hairline bg-surface px-3 py-2 text-sm font-bold text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-ring"
                  >
                    {[3,4,5,6,7,8].map(ft => <option key={ft} value={ft}>{ft} ft</option>)}
                  </select>
                  <select
                    value={heightIn}
                    onChange={(e) => { const inches = Number(e.target.value); setHeightIn(inches); form.setValue('height_cm', ftInToCm(heightFt, inches), { shouldValidate: true }) }}
                    className="flex-1 rounded-control border border-hairline bg-surface px-3 py-2 text-sm font-bold text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-ring"
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
              <Field label="Activity level" error={form.formState.errors.activity_level?.message}>
                <select
                  {...form.register('activity_level')}
                  className="w-full rounded-control border border-hairline bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-ring"
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
                      key={g.value} type="button" onClick={() => form.setValue('goal', g.value, { shouldDirty: true })}
                      className={`rounded-control border py-2.5 text-sm font-semibold transition-all ${form.watch('goal') === g.value ? 'border-brand bg-brand-soft text-brand-ink' : 'border-hairline bg-surface text-ink'}`}
                    >{g.emoji} {g.label}</button>
                  ))}
                </div>
              </Field>
              <Field label="Weekly loss goal" error={form.formState.errors.pace_kg_per_week?.message}>
                <select
                  {...form.register('pace_kg_per_week', { valueAsNumber: true })}
                  className="w-full rounded-control border border-hairline bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-ring"
                >
                  <option value="0.25">0.25 kg/week — 275 kcal/day deficit</option>
                  <option value="0.5">0.50 kg/week — 550 kcal/day deficit</option>
                  <option value="0.75">0.75 kg/week — 825 kcal/day deficit</option>
                  <option value="1">1.00 kg/week — 1,100 kcal/day deficit</option>
                </select>
              </Field>

              <div className="rounded-card border border-hairline bg-surface-2 p-3">
                <button type="button" onClick={() => setUseCustomTargets((v) => !v)} className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-brand" />
                    <span className="text-sm font-semibold text-ink">Custom calorie &amp; macro targets</span>
                  </div>
                  <div className={`relative h-5 w-9 rounded-full transition-colors ${useCustomTargets ? 'bg-brand' : 'bg-hairline'}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-surface shadow transition-transform ${useCustomTargets ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                </button>
                {useCustomTargets && (
                  <div className="mt-3 space-y-3">
                    <Field label="Daily calories (kcal)" error={form.formState.errors.custom_calorie_target?.message}>
                      <Input type="number" min="500" max="10000" step="50" {...form.register('custom_calorie_target', { valueAsNumber: true })} />
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
                  </div>
                )}
              </div>

              <Button type="submit" size="lg" className="w-full tap-scale" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Saving...' : 'Save changes'}
              </Button>
            </form>
          </SheetContent>
        </Sheet>

        <Divider />

        {/* Log weight — dedicated page */}
        <Link href="/weight" className="flex w-full items-center gap-3.5 px-[18px] py-4 tap-scale">
          <Scale className="h-[19px] w-[19px] shrink-0 text-ink" strokeWidth={1.9} />
          <span className="flex-1 text-[15px] font-medium text-ink">Log weight</span>
          <RowChevron />
        </Link>

        <Divider />

        {/* Custom foods & recipes — the recipe builder (was orphaned; P1-13) */}
        <Link href="/recipes" className="flex w-full items-center gap-3.5 px-[18px] py-4 tap-scale">
          <BookOpen className="h-[19px] w-[19px] shrink-0 text-ink" strokeWidth={1.9} />
          <span className="flex-1 text-[15px] font-medium text-ink">Custom foods &amp; recipes</span>
          {!isPro && (
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand-ink">PRO</span>
          )}
          <RowChevron />
        </Link>

        <Divider />

        {/* Reminders */}
        <Sheet>
          <SheetTrigger asChild>
            <button type="button" className="flex w-full items-center gap-3.5 px-[18px] py-4 text-left tap-scale">
              <Bell className="h-[19px] w-[19px] shrink-0 text-ink" strokeWidth={1.9} />
              <span className="flex-1 text-[15px] font-medium text-ink">Reminders</span>
              <RowChevron />
            </button>
          </SheetTrigger>
          <SheetContent>
            <SheetTitle className="mb-1">Meal reminders</SheetTitle>
            <p className="mb-4 text-sm text-ink-2">A gentle nudge to log if you haven&apos;t yet today.</p>
            <PushNotificationToggle />
            <ReminderHourPicker initialHour={profile.reminder_hour ?? DEFAULT_REMINDER_HOUR} />
          </SheetContent>
        </Sheet>

        <Divider />

        {/* Appearance */}
        <Sheet>
          <SheetTrigger asChild>
            <button type="button" className="flex w-full items-center gap-3.5 px-[18px] py-4 text-left tap-scale">
              <SunMoon className="h-[19px] w-[19px] shrink-0 text-ink" strokeWidth={1.9} />
              <span className="flex-1 text-[15px] font-medium text-ink">Appearance</span>
              {mounted && <span className="text-[13px] text-ink-3">{THEME_LABELS[theme ?? 'system']}</span>}
              <RowChevron />
            </button>
          </SheetTrigger>
          <SheetContent>
            <SheetTitle className="mb-4">Appearance</SheetTitle>
            <ThemeSegmented />
            <p className="mt-2.5 text-xs text-ink-2">System follows your phone&apos;s light/dark setting automatically.</p>
          </SheetContent>
        </Sheet>

        <Divider />

        {/* Analytics opt-out */}
        <Sheet>
          <SheetTrigger asChild>
            <button type="button" className="flex w-full items-center gap-3.5 px-[18px] py-4 text-left tap-scale">
              <BarChart3 className="h-[19px] w-[19px] shrink-0 text-ink" strokeWidth={1.9} />
              <span className="flex-1 text-[15px] font-medium text-ink">Usage analytics</span>
              {mounted && <span className="text-[13px] text-ink-3">{analyticsOptOut ? 'Off' : 'On'}</span>}
              <RowChevron />
            </button>
          </SheetTrigger>
          <SheetContent>
            <SheetTitle className="mb-1">Usage analytics</SheetTitle>
            <p className="mb-4 text-sm text-ink-2">
              Anonymous product usage helps us see which features actually help people stay consistent.
              We never send your food, weight or personal details.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => toggleAnalytics(false)}
                className={cn(
                  'flex-1 rounded-control border py-2.5 text-[13px] font-semibold transition-colors',
                  analyticsOptOut ? 'border-hairline bg-surface-2 text-ink-2' : 'border-brand bg-brand-soft text-brand-ink'
                )}
              >
                Share usage data
              </button>
              <button
                type="button"
                onClick={() => toggleAnalytics(true)}
                className={cn(
                  'flex-1 rounded-control border py-2.5 text-[13px] font-semibold transition-colors',
                  analyticsOptOut ? 'border-brand bg-brand-soft text-brand-ink' : 'border-hairline bg-surface-2 text-ink-2'
                )}
              >
                Opt out
              </button>
            </div>
          </SheetContent>
        </Sheet>

        <Divider />

        {/* Export */}
        <button type="button" onClick={exportData} className="flex w-full items-center gap-3.5 px-[18px] py-4 text-left tap-scale">
          <Download className="h-[19px] w-[19px] shrink-0 text-ink" strokeWidth={1.9} />
          <span className="flex-1 text-[15px] font-medium text-ink">Export data</span>
          <RowChevron />
        </button>

        <Divider />

        {/* Subscription */}
        {isPro ? (
          <button type="button" onClick={manageSubscription} disabled={portalLoading} className="flex w-full items-center gap-3.5 px-[18px] py-4 text-left tap-scale disabled:opacity-50">
            <Crown className="h-[19px] w-[19px] shrink-0 text-brand" strokeWidth={1.9} />
            <span className="flex-1 text-[15px] font-medium text-ink">Subscription</span>
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand-ink">PRO</span>
            <RowChevron />
          </button>
        ) : (
          <Link href="/upgrade" className="flex w-full items-center gap-3.5 px-[18px] py-4 tap-scale">
            <Crown className="h-[19px] w-[19px] shrink-0 text-brand" strokeWidth={1.9} />
            <span className="flex-1 text-[15px] font-medium text-ink">Upgrade to Pro</span>
            <RowChevron />
          </Link>
        )}
      </div>

      {/* ── Sign out / delete ── */}
      <div className="mt-3.5 flex flex-col items-center gap-0.5">
        <button type="button" onClick={signOut} disabled={signOutLoading} className="px-6 py-3 text-[14px] font-medium text-ink-2 tap-scale disabled:opacity-50">
          {signOutLoading ? 'Signing out…' : 'Sign out'}
        </button>
        <button type="button" onClick={deleteAccount} disabled={deleteLoading} className="px-6 py-1 text-[13px] font-medium text-danger tap-scale disabled:opacity-50">
          {deleteLoading ? 'Deleting…' : 'Delete account'}
        </button>
        <p className="mt-2 text-[11px] text-ink-3">GetInShape v{version}</p>
      </div>
    </>
  )
}

function Stat({ value, label, divider }: { value: string; label: string; divider?: boolean }) {
  return (
    <div className={`text-center ${divider ? 'border-r border-hairline' : ''}`}>
      <p className="font-display text-[22px] font-bold tabular-nums tracking-[-0.02em] text-ink">{value}</p>
      <p className="mt-[3px] text-[11px] text-ink-3">{label}</p>
    </div>
  )
}

function RowChevron() {
  return <ChevronRight className="h-[15px] w-[15px] shrink-0 text-ink-3" strokeWidth={2} />
}

function Divider() {
  return <div className="mx-[18px] border-t border-hairline" />
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs font-semibold uppercase tracking-wide text-ink-2">{label}</Label>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  )
}

function BmiRecommendation({ heightCm, currentWeightKg, onSelect }: {
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
    <div className="mt-2 space-y-2 rounded-card border border-hairline bg-brand-soft p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-2">Your current BMI</span>
        <span className="text-xs font-bold" style={{ color: bmiColor }}>{currentBmi} · {bmiLabel}</span>
      </div>
      <p className="text-[11px] text-ink-2">
        Healthy range: <span className="font-semibold text-ink">{minHealthy}–{maxHealthy} kg</span> (BMI 18.5–24.9)
      </p>
      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-2">Tap to set target</p>
        <div className="flex gap-2">
          {suggestions.map((s) => (
            <button
              key={s.bmi} type="button" onClick={() => onSelect(s.kg)}
              className="flex-1 rounded-control border border-hairline bg-surface py-1.5 text-center tap-scale"
            >
              <p className="text-xs font-bold tabular-nums text-brand-ink">{s.kg} kg</p>
              <p className="text-[10px] text-ink-2">BMI {s.bmi}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
