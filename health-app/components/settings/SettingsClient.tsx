'use client'

import { forwardRef, useState, useRef, useEffect, type ComponentProps, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTheme } from 'next-themes'
import type { Profile } from '../../types/index'
import { profileUpdateSchema, type ProfileUpdateData } from '../../lib/validations'
import { DEFAULT_REMINDER_HOUR, formatReminderHour, normaliseReminderHour } from '../../lib/reminderSchedule'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Chip } from '../ui/chip'
import { toast } from '../ui/use-toast'
import { useSubscription } from '../../hooks/useSubscription'
import { useManageSubscription } from '../../hooks/useManageSubscription'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronRight, Crown, Scale, Bell, SunMoon, Download, Sliders, Pencil, Check, X, BookOpen, BarChart3, type LucideIcon,
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
import { formatKg } from '../../lib/formatWeight'
import { formatIst } from '../../lib/dateUtils'
import { BODY_FOCUSES, BODY_FOCUS_META, planForFocus, focusFromProfile, type BodyFocus } from '../../lib/bodyType'

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

// The short form for the plan summary — the long one is for choosing.
const ACTIVITY_SHORT: Record<string, string> = {
  sedentary: 'Sedentary',
  light: 'Lightly active',
  moderate: 'Moderately active',
  active: 'Active',
  very_active: 'Very active',
}

const THEME_LABELS: Record<string, string> = { light: 'Light', dark: 'Dark', system: 'System' }

const PLAN_LABELS: Record<string, string> = { monthly: 'Monthly', annual: 'Annual' }

// The frame weight every redesigned screen uses around a big region.
const FRAME = 'rounded-card-lg border-2 border-hairline-2 px-4 pb-4 pt-4'

// The one filled field style, shared by every <select> in the sheet so they
// match the Input primitive (filled, hairline, brand ring on focus).
const SELECT = 'h-11 w-full rounded-control border border-hairline bg-surface-2 px-3.5 text-base text-ink outline-none focus:border-brand focus:bg-surface focus:ring-[3px] focus:ring-brand-ring'

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
      // Every account that onboarded before migration 040 has body_focus NULL,
      // so this derives the tile to light up from their existing goal.
      body_focus: focusFromProfile(profile),
      pace_kg_per_week: profile.pace_kg_per_week ?? 0.5,
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

  // The plan in one line: what the user chose, and how fast. Maintain has no pace.
  const focusLabel = BODY_FOCUS_META[focusFromProfile(profile)].label
  const paceLabel = profile.goal !== 'maintain' && profile.pace_kg_per_week
    ? `${profile.pace_kg_per_week} kg a week`
    : null
  const height = cmToFtIn(profile.height_cm)
  const reminderLabel = formatReminderHour(normaliseReminderHour(profile.reminder_hour ?? DEFAULT_REMINDER_HOUR))

  // "Annual · renews 12 Mar 2027" — or "ends", once a cancellation is scheduled.
  const planLabel = subscription?.plan ? PLAN_LABELS[subscription.plan] ?? null : null
  const periodEnd = subscription?.expiresAt
    ? formatIst(subscription.expiresAt, { day: 'numeric', month: 'short', year: 'numeric' })
    : null
  const endsWord = subscription?.subscription?.cancel_at_period_end ? 'ends' : 'renews'
  const subscriptionLine = [planLabel, periodEnd ? `${endsWord} ${periodEnd}` : null].filter(Boolean).join(' · ') || 'Active'

  return (
    <>
      {/* ── Header ── */}
      <div className="pt-2">
        <p className="text-caption font-medium text-ink-3">Account</p>
        <h1 className="font-display mt-1 text-title font-semibold text-ink">Profile</h1>
      </div>

      {/* One column on a phone; from lg the identity and the plan sit on the
          left, the settings on the right. */}
      <div className="lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start lg:gap-10">
        <div className="lg:sticky lg:top-6">
          {/* ── Identity ── */}
          <section aria-label="Identity" className="mt-5 flex items-center gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full shadow-cta"
              style={{ backgroundImage: 'var(--ava-grad)' }}
              aria-hidden="true"
            >
              <span className="font-display text-title-sm font-semibold text-white">{initial}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="truncate font-display text-title-sm font-semibold text-ink">{profile.display_name || 'You'}</p>
                {isPro && <Chip tone="brand" size="sm">Pro</Chip>}
              </div>
              <p className="mt-0.5 truncate text-caption text-ink-2">{email}</p>
            </div>
          </section>

          {/* ── Plan — the one place the goal is summarised; Home and Progress
              hold the live numbers. ── */}
          <Sheet>
            <section aria-label="Plan" className={`mt-5 ${FRAME}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-display text-title-sm font-semibold text-ink">Plan</h2>
                  <p className="mt-0.5 text-caption text-ink-2">
                    {focusLabel}{paceLabel && <> · {paceLabel}</>}
                  </p>
                </div>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="shrink-0 gap-1.5">
                    <Pencil className="h-4 w-4" strokeWidth={1.75} /> Edit
                  </Button>
                </SheetTrigger>
              </div>

              <p className="mt-4 flex items-baseline gap-1.5">
                <span className="font-display text-display font-semibold tabular-nums leading-none text-ink">
                  {profile.daily_calorie_target.toLocaleString('en-IN')}
                </span>
                <span className="text-caption text-ink-2">kcal a day</span>
              </p>
              <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-caption">
                <Macro label="Protein" grams={profile.protein_g_target} color="var(--protein)" />
                <Macro label="Carbs" grams={profile.carbs_g_target} color="var(--carbs)" />
                <Macro label="Fat" grams={profile.fat_g_target} color="var(--fat)" />
              </dl>

              <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-hairline pt-4">
                <Fact label="Target" value={`${formatKg(profile.target_weight_kg)} kg`} />
                <Fact label="Activity" value={ACTIVITY_SHORT[profile.activity_level] ?? profile.activity_level} />
                <Fact label="Height" value={`${height.ft} ft ${height.inches} in`} />
              </dl>
            </section>

            <SheetContent className="max-h-[calc(88vh-var(--kb-inset,0px))] overflow-y-auto overscroll-contain">
              <SheetTitle className="mb-4">Edit plan</SheetTitle>

              {/* Calorie quick-editor */}
              <div className="rounded-card bg-surface-2 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-caption font-medium text-ink-2">Daily calorie goal</p>
                  {!editingCalories && (
                    <button
                      type="button"
                      onClick={() => { setQuickKcal(String(profile.daily_calorie_target)); setEditingCalories(true); setTimeout(() => kcalInputRef.current?.focus(), 50) }}
                      className="flex h-9 items-center gap-1.5 rounded-control border border-hairline bg-surface px-3 text-caption font-semibold text-ink tap-scale"
                    >
                      <Pencil className="h-4 w-4" strokeWidth={1.75} /> Edit
                    </button>
                  )}
                </div>
                {!editingCalories ? (
                  <>
                    <p className="flex items-baseline gap-1.5">
                      <span className="font-display text-display font-semibold tabular-nums leading-none text-ink">{profile.daily_calorie_target.toLocaleString()}</span>
                      <span className="text-caption text-ink-2">kcal a day</span>
                    </p>
                    <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-caption">
                      <Macro label="Protein" grams={profile.protein_g_target} color="var(--protein)" />
                      <Macro label="Carbs" grams={profile.carbs_g_target} color="var(--carbs)" />
                      <Macro label="Fat" grams={profile.fat_g_target} color="var(--fat)" />
                    </dl>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {[1200, 1500, 1800, 2000, 2200, 2500].map((kcal) => (
                        <button
                          key={kcal} type="button" onClick={() => setQuickKcal(String(kcal))}
                          aria-pressed={quickKcal === String(kcal)}
                          className={`h-9 rounded-full px-3.5 text-caption font-semibold tabular-nums transition-colors tap-scale ${quickKcal === String(kcal) ? 'bg-ink text-canvas' : 'border border-hairline bg-surface text-ink'}`}
                        >{kcal.toLocaleString()}</button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        ref={kcalInputRef} type="number" value={quickKcal} min={500} max={10000} step={50}
                        aria-label="Daily calorie goal"
                        onChange={(e) => setQuickKcal(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveQuickKcal(Number(quickKcal))}
                        className="h-11 w-32 rounded-control border border-hairline bg-surface px-3.5 text-body-lg font-semibold tabular-nums text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-ring"
                      />
                      <span className="text-caption text-ink-2">kcal a day</span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => saveQuickKcal(Number(quickKcal))} disabled={savingKcal || !quickKcal || Number(quickKcal) < 500} className="gap-1.5">
                        <Check className="h-4 w-4" />{savingKcal ? 'Saving…' : 'Save'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingCalories(false)} className="gap-1.5">
                        <X className="h-4 w-4" /> Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Profile form */}
              <form onSubmit={form.handleSubmit(onSubmit)} className="mt-5 space-y-4">
                <Field label="Display name" error={form.formState.errors.display_name?.message}>
                  <Input id="display_name" {...form.register('display_name')} />
                </Field>
                <Field label="Height" error={form.formState.errors.height_cm?.message}>
                  <div className="flex gap-2">
                    <select
                      value={heightFt}
                      aria-label="Height in feet"
                      onChange={(e) => { const ft = Number(e.target.value); setHeightFt(ft); form.setValue('height_cm', ftInToCm(ft, heightIn), { shouldValidate: true }) }}
                      className={`${SELECT} flex-1`}
                    >
                      {[3,4,5,6,7,8].map(ft => <option key={ft} value={ft}>{ft} ft</option>)}
                    </select>
                    <select
                      value={heightIn}
                      aria-label="Height in inches"
                      onChange={(e) => { const inches = Number(e.target.value); setHeightIn(inches); form.setValue('height_cm', ftInToCm(heightFt, inches), { shouldValidate: true }) }}
                      className={`${SELECT} flex-1`}
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
                  <select {...form.register('activity_level')} className={SELECT}>
                    {Object.entries(ACTIVITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </Field>
                <Field label="Goal" error={form.formState.errors.body_focus?.message}>
                  <div className="grid grid-cols-2 gap-2">
                    {BODY_FOCUSES.map((f) => {
                      const on = form.watch('body_focus') === f
                      const meta = BODY_FOCUS_META[f]
                      return (
                        <button
                          key={f}
                          type="button"
                          aria-pressed={on}
                          onClick={() => {
                            const { goal, pace } = planForFocus(f as BodyFocus)
                            form.setValue('body_focus', f, { shouldDirty: true })
                            form.setValue('goal', goal, { shouldDirty: true })
                            if (pace !== null) form.setValue('pace_kg_per_week', pace, { shouldDirty: true })
                          }}
                          className={`flex flex-col items-start gap-0.5 rounded-control border px-3 py-2.5 text-left transition-colors tap-scale ${on ? 'border-brand bg-brand-soft text-brand-ink' : 'border-hairline bg-surface-2 text-ink'}`}
                        >
                          <span className="text-caption font-semibold leading-tight">{meta.emoji} {meta.label}</span>
                          <span className={`text-micro leading-tight ${on ? 'text-brand-ink' : 'text-ink-2'}`}>{meta.desc}</span>
                        </button>
                      )
                    })}
                  </div>
                </Field>
                <Field label="Weekly loss goal" error={form.formState.errors.pace_kg_per_week?.message}>
                  <select {...form.register('pace_kg_per_week', { valueAsNumber: true })} className={SELECT}>
                    <option value="0.25">0.25 kg/week — 275 kcal/day deficit</option>
                    <option value="0.5">0.50 kg/week — 550 kcal/day deficit</option>
                    <option value="0.75">0.75 kg/week — 825 kcal/day deficit</option>
                    <option value="1">1.00 kg/week — 1,100 kcal/day deficit</option>
                  </select>
                </Field>

                <div className="rounded-card border border-hairline bg-surface-2 p-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={useCustomTargets}
                    onClick={() => setUseCustomTargets((v) => !v)}
                    className="flex min-h-[44px] w-full items-center justify-between gap-3"
                  >
                    <span className="flex items-center gap-2">
                      <Sliders className="h-5 w-5 text-ink-2" strokeWidth={1.75} />
                      <span className="text-body font-medium text-ink">Custom calorie &amp; macro targets</span>
                    </span>
                    <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${useCustomTargets ? 'bg-brand' : 'bg-hairline-2'}`}>
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-air transition-transform ${useCustomTargets ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                    </span>
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

                <Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Saving...' : 'Save changes'}
                </Button>
              </form>
            </SheetContent>
          </Sheet>
        </div>

        <div className="mt-6 lg:mt-5">
          {/* ── Subscription — a status line, not a pitch. ── */}
          <Group title="Subscription">
            {isPro ? (
              <RowButton icon={Crown} label="Pro subscription" sub={subscriptionLine} onClick={manageSubscription} disabled={portalLoading} />
            ) : (
              <RowLink icon={Crown} label="GetInShape Pro" value="Free plan" href="/upgrade" />
            )}
          </Group>

          {/* ── Tracking ── */}
          <Group title="Tracking">
            <RowLink icon={Scale} label="Log weight" href="/weight" />
            <RowLink icon={BookOpen} label="Custom foods & recipes" href="/recipes" chip={!isPro ? 'Pro' : undefined} />
          </Group>

          {/* ── Preferences ── */}
          <Group title="Preferences">
            <Sheet>
              <SheetTrigger asChild>
                <RowButton icon={Bell} label="Reminders" value={reminderLabel} />
              </SheetTrigger>
              <SheetContent>
                <SheetTitle className="mb-1">Meal reminders</SheetTitle>
                <p className="mb-4 text-body text-ink-2">A gentle nudge to log if you haven&apos;t yet today.</p>
                <PushNotificationToggle />
                <ReminderHourPicker initialHour={profile.reminder_hour ?? DEFAULT_REMINDER_HOUR} />
              </SheetContent>
            </Sheet>

            <Sheet>
              <SheetTrigger asChild>
                <RowButton icon={SunMoon} label="Appearance" value={mounted ? THEME_LABELS[theme ?? 'system'] : undefined} />
              </SheetTrigger>
              <SheetContent>
                <SheetTitle className="mb-4">Appearance</SheetTitle>
                <ThemeSegmented />
                <p className="mt-3 text-caption text-ink-2">System follows your phone&apos;s light/dark setting automatically.</p>
              </SheetContent>
            </Sheet>
          </Group>

          {/* ── Privacy & data ── */}
          <Group title="Privacy & data">
            <Sheet>
              <SheetTrigger asChild>
                <RowButton icon={BarChart3} label="Usage analytics" value={mounted ? (analyticsOptOut ? 'Off' : 'On') : undefined} />
              </SheetTrigger>
              <SheetContent>
                <SheetTitle className="mb-1">Usage analytics</SheetTitle>
                <p className="mb-4 text-body text-ink-2">
                  Anonymous product usage helps us see which features actually help people stay consistent.
                  We never send your food, weight or personal details.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    aria-pressed={!analyticsOptOut}
                    onClick={() => toggleAnalytics(false)}
                    className={cn(
                      'h-11 flex-1 rounded-control text-caption font-semibold transition-colors tap-scale',
                      analyticsOptOut ? 'border border-hairline bg-surface text-ink' : 'bg-ink text-canvas'
                    )}
                  >
                    Share usage data
                  </button>
                  <button
                    type="button"
                    aria-pressed={analyticsOptOut}
                    onClick={() => toggleAnalytics(true)}
                    className={cn(
                      'h-11 flex-1 rounded-control text-caption font-semibold transition-colors tap-scale',
                      analyticsOptOut ? 'bg-ink text-canvas' : 'border border-hairline bg-surface text-ink'
                    )}
                  >
                    Opt out
                  </button>
                </div>
              </SheetContent>
            </Sheet>

            <RowButton icon={Download} label="Export data" onClick={exportData} />
          </Group>

          {/* ── Sign out / delete ── */}
          <div className="mt-8 flex flex-col items-center gap-2">
            <Button variant="outline" className="w-full" onClick={signOut} disabled={signOutLoading}>
              {signOutLoading ? 'Signing out…' : 'Sign out'}
            </Button>
            <button type="button" onClick={deleteAccount} disabled={deleteLoading} className="mt-2 h-11 px-4 text-caption font-medium text-danger tap-scale disabled:opacity-40">
              {deleteLoading ? 'Deleting…' : 'Delete account'}
            </button>
            <p className="text-micro text-ink-3">GetInShape v{version}</p>
          </div>
        </div>
      </div>
    </>
  )
}

function Macro({ label, grams, color }: { label: string; grams: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden="true" />
      <dt className="text-ink-2">{label}</dt>
      <dd className="font-semibold tabular-nums text-ink">{grams ?? 0} g</dd>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-micro font-medium text-ink-3">{label}</dt>
      <dd className="mt-0.5 truncate text-caption font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  )
}

/** A titled group of rows — one card, hairlines between rows, no card inside. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="mt-5 first:mt-0">
      <h2 className="px-1 text-caption font-semibold text-ink-3">{title}</h2>
      <div className="mt-2 divide-y divide-hairline overflow-hidden rounded-card-lg border border-hairline bg-surface shadow-air">
        {children}
      </div>
    </section>
  )
}

// A settings row: icon, label, an optional current value, an optional Pro
// chip, and the chevron that says it opens something. Two flavours so a link
// is a link and a sheet trigger is a button — `forwardRef` because Radix's
// Slot hands the trigger ref down.
function RowBody({ icon: Icon, label, value, sub, chip }: { icon: LucideIcon; label: string; value?: string; sub?: string; chip?: string }) {
  return (
    <>
      <Icon className="h-5 w-5 shrink-0 text-ink-2" strokeWidth={1.75} />
      <span className="min-w-0 flex-1 py-2">
        <span className="block truncate text-body font-medium text-ink">{label}</span>
        {sub && <span className="mt-0.5 block truncate text-caption text-ink-3">{sub}</span>}
      </span>
      {chip && <Chip tone="brand" size="sm">{chip}</Chip>}
      {value && <span className="max-w-[45%] truncate text-caption text-ink-3">{value}</span>}
      <ChevronRight className="h-5 w-5 shrink-0 text-ink-3" strokeWidth={1.75} />
    </>
  )
}

const ROW = 'flex min-h-[56px] w-full items-center gap-3 px-4 text-left tap-scale hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand disabled:opacity-40'

const RowButton = forwardRef<HTMLButtonElement, ComponentProps<typeof RowBody> & ComponentProps<'button'>>(
  function RowButton({ icon, label, value, sub, chip, className, ...props }, ref) {
    return (
      <button ref={ref} type="button" className={cn(ROW, className)} {...props}>
        <RowBody icon={icon} label={label} value={value} sub={sub} chip={chip} />
      </button>
    )
  }
)

function RowLink({ icon, label, value, sub, chip, href }: ComponentProps<typeof RowBody> & { href: string }) {
  return (
    <Link href={href} className={ROW}>
      <RowBody icon={icon} label={label} value={value} sub={sub} chip={chip} />
    </Link>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1.5">{children}</div>
      {error && <p className="mt-1 text-caption text-danger">{error}</p>}
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
    <div className="mt-2 space-y-2 rounded-card border border-hairline bg-surface-2 p-3">
      <div className="flex items-center justify-between">
        <span className="text-caption text-ink-2">Your current BMI</span>
        <span className="text-caption font-semibold tabular-nums" style={{ color: bmiColor }}>{currentBmi} · {bmiLabel}</span>
      </div>
      <p className="text-micro text-ink-2">
        Healthy range: <span className="font-semibold text-ink">{minHealthy}–{maxHealthy} kg</span> (BMI 18.5–24.9)
      </p>
      <div>
        <p className="mb-1.5 text-micro font-medium text-ink-2">Tap to set target</p>
        <div className="flex gap-2">
          {suggestions.map((s) => (
            <button
              key={s.bmi} type="button" onClick={() => onSelect(s.kg)}
              className="flex-1 rounded-control border border-hairline bg-surface py-2 text-center tap-scale"
            >
              <p className="text-caption font-semibold tabular-nums text-ink">{s.kg} kg</p>
              <p className="text-micro text-ink-2">BMI {s.bmi}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
