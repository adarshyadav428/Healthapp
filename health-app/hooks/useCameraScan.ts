'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Food } from '../types/index'
import { toast } from '../components/ui/use-toast'
import { captureEvent, logMetaHeaders, markLogStart } from '../lib/posthog/client'
import { useQueryClient } from '@tanstack/react-query'
import { reportLogMilestone } from '../store/milestoneStore'
import type { LogMilestone } from '../lib/logMilestones'
import { coachingLine, dayContextFor } from '../lib/coaching'
import { dateStrToUtcMidnight } from '../lib/dateUtils'
import { mealForTime } from '../lib/meal'
import { scaleMacrosRaw } from '../lib/nutrition'
import { portionRange } from '../lib/portion-units'
import { useUser } from './useUser'
import { useDailyTotals } from './useDailyTotals'
import { resolveAiGateAction } from '../lib/aiGateRedirect'
import { recordAiVerificationBlock } from '../lib/verifyPromptStore'

export type Mode = 'barcode' | 'photo' | 'manual'
export type PhotoResult = {
  food: Food
  /** The AI's original portion guess — kept so we can tell if the user changed it. */
  estimated_grams: number
  unit: string
  /**
   * User-editable portion, seeded from `estimated_grams`. Lives on the item, not
   * the screen, so switching between detected foods no longer wipes an edit —
   * that reset was the whole bug this shape fixes.
   */
  grams: number
  /**
   * User-editable label, seeded from `food.name`. Only labels the toast and the
   * correction analytics; the logged row always references `food.id`.
   */
  name: string
}

type Params = {
  onClose: () => void
  onFoodFound: (food: Food) => void
  /**
   * The IST day being viewed (YYYY-MM-DD). Omitted by the global camera FAB,
   * which has no day context and therefore means today; passed by the Food
   * tab, where the user may be filling in an earlier day.
   */
  logDate?: string
  /**
   * Where this scan is happening. In `'onboarding'` a gated scan keeps the user
   * in the wizard with an inline message instead of redirecting to /upgrade —
   * see lib/aiGateRedirect. Defaults to `'standalone'` (redirect, unchanged).
   */
  context?: 'standalone' | 'onboarding'
}

/**
 * All camera-scan interaction: device stream lifecycle, the BarcodeDetector
 * scan loop, photo capture / gallery upload, and the three server flows
 * (barcode lookup, AI photo analysis, log-food). Extracted from CameraModal so
 * the component is pure presentation and the orchestration stays testable and
 * reusable across UI rewrites. Behaviour is intentionally identical to the
 * previous in-component implementation.
 */
export function useCameraScan({ onClose, onFoodFound, logDate, context = 'standalone' }: Params) {
  const router = useRouter()
  const { user, profile } = useUser()
  // Totals for the day being logged to, not always today: the coaching line
  // reads as authoritative, so it has to describe the same day the meal lands
  // on. Undefined logDate means today, which is what the global FAB wants.
  const { totals: dailyTotals, isLoading: totalsLoading, error: totalsError } =
    useDailyTotals(user?.id ?? null, logDate ? dateStrToUtcMidnight(logDate) : undefined)
  const videoRef    = useRef<HTMLVideoElement>(null)
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const rafRef      = useRef<number | null>(null)
  const lastBarcode = useRef<string | null>(null)
  const galleryRef  = useRef<HTMLInputElement>(null)

  const [barcodeSupport, setBarcodeSupport] = useState(false)
  const [mode, setMode]                     = useState<Mode>('photo')
  const [camError, setCamError]             = useState<string | null>(null)
  const [barcodeLoading, setBarcodeLoading] = useState(false)
  const [captured, setCaptured]             = useState<string | null>(null)
  const [analyzing, setAnalyzing]           = useState(false)
  const [results, setResults]               = useState<PhotoResult[] | null>(null)
  // Index into `results` of the food currently being reviewed/edited. Every
  // detected food is logged; this only picks which one the detail card shows.
  const [selectedIdx, setSelectedIdx]       = useState(0)
  const [confidence, setConfidence]         = useState<string | null>(null)
  // Free AI scans left after the most recent scan. null = Pro, or not yet known
  // (the count only rides back on a scan response). See lib/aiTrial.
  const [scansLeft, setScansLeft]           = useState<number | null>(null)
  const [photoContext, setPhotoContext]     = useState('')
  const [showContextInput, setShowContextInput] = useState(false)
  const [meal, setMeal]                     = useState<string>(mealForTime())
  const [logging, setLogging]               = useState(false)
  const [manualBarcode, setManualBarcode]   = useState('')
  const [manualLoading, setManualLoading]   = useState(false)
  const [editingName, setEditingName]       = useState(false)
  const queryClient = useQueryClient()

  // The food currently in the detail card, and editable views of its portion
  // and label. All three are derived from `results` so an edit persists on the
  // item when the user taps another chip and comes back.
  const selected   = results?.[selectedIdx] ?? null
  const grams      = selected?.grams ?? 100
  const customName = selected?.name ?? ''

  const patchSelected = useCallback(
    (patch: Partial<Pick<PhotoResult, 'grams' | 'name'>>) => {
      setResults((rs) => (rs ? rs.map((r, i) => (i === selectedIdx ? { ...r, ...patch } : r)) : rs))
    },
    [selectedIdx],
  )
  const setGrams      = useCallback((v: number) => patchSelected({ grams: v }), [patchSelected])
  const setCustomName = useCallback((v: string) => patchSelected({ name: v }), [patchSelected])

  // Start the clock for `seconds_to_log`: this surface opening is the moment
  // the user set out to log something. See markLogStart in lib/posthog/client.
  useEffect(() => { markLogStart() }, [])

  // ── Camera stream ────────────────────────────────────────────────────────────
  useEffect(() => {
    const hasBarcode = 'BarcodeDetector' in window
    setBarcodeSupport(hasBarcode)
    setMode(hasBarcode ? 'barcode' : 'photo')

    let cancelled = false
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        const video = videoRef.current
        if (!video) return
        video.setAttribute('playsinline', 'true')
        video.setAttribute('webkit-playsinline', 'true')
        video.muted = true
        video.srcObject = stream
        const tryPlay = () => video.play().catch(() => {})
        video.addEventListener('loadedmetadata', tryPlay, { once: true })
        video.addEventListener('canplay', tryPlay, { once: true })
        video.load()
      })
      .catch((e: Error) => {
        if (e.name === 'NotAllowedError') {
          setCamError('Camera permission denied. Allow camera access in your browser settings, then reopen this screen.')
        } else if (e.name === 'NotFoundError') {
          setCamError('No camera found on this device.')
        } else {
          setCamError(`Camera error: ${e.message}`)
        }
      })

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // ── Barcode lookup ───────────────────────────────────────────────────────────
  const onBarcodeFound = useCallback(async (code: string) => {
    setBarcodeLoading(true)
    setManualLoading(true)
    try {
      navigator.vibrate?.(40)
      const res  = await fetch(`/api/camera/barcode?code=${encodeURIComponent(code)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Product not found')
      onFoodFound(json as Food)
      onClose()
    } catch (e) {
      toast({ title: 'Product not found', description: `${(e as Error).message} — try searching by name instead.`, variant: 'error' })
      lastBarcode.current = null
      setBarcodeLoading(false)
      setManualLoading(false)
    }
  }, [onClose, onFoodFound])

  // ── Barcode detection loop ───────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'barcode' || !barcodeSupport || barcodeLoading || captured) return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (typeof BarcodeDetector === 'undefined') return

    const detector = new BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
    })
    let active = true

    async function loop() {
      if (!active || !videoRef.current || videoRef.current.readyState < 2) {
        if (active) rafRef.current = requestAnimationFrame(loop)
        return
      }
      try {
        const codes = await detector.detect(videoRef.current)
        if (codes.length && !barcodeLoading) {
          const code: string = codes[0].rawValue
          if (code !== lastBarcode.current) {
            lastBarcode.current = code
            active = false
            await onBarcodeFound(code)
            return
          }
        }
      } catch { /* ignore detector errors on individual frames */ }
      if (active) rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => { active = false; if (rafRef.current) cancelAnimationFrame(rafRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, barcodeSupport, barcodeLoading, captured])

  const submitManualBarcode = useCallback(() => {
    const code = manualBarcode.trim().replace(/\s/g, '')
    if (!code) return
    onBarcodeFound(code)
  }, [manualBarcode, onBarcodeFound])

  // ── Photo capture ────────────────────────────────────────────────────────────
  const capturePhoto = useCallback(() => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width  = video.videoWidth  || 1280
    canvas.height = video.videoHeight || 720
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    setCaptured(canvas.toDataURL('image/jpeg', 0.85))
  }, [])

  // ── Gallery upload ──────────────────────────────────────────────────────────
  const onGallerySelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please select an image file.', variant: 'error' })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setCaptured(dataUrl)
      setMode('photo')
    }
    reader.readAsDataURL(file)
    // Reset input so the same file can be selected again
    e.target.value = ''
  }, [])

  const analyzePhoto = useCallback(() => {
    if (!captured) return
    const base64 = captured.split(',')[1]

    setAnalyzing(true)
    setResults(null)
    setSelectedIdx(0)
    setConfidence(null)
    fetch('/api/camera/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: base64,
        mimeType: 'image/jpeg',
        context: photoContext.trim() || undefined,
      }),
    })
      .then(async (res) => {
        const json = await res.json()
        // Gated. Standalone: straight to the paywall rather than a toast the
        // user has to act on — they've already taken the photo. In onboarding:
        // stay in the wizard with an inline note (a redirect here ejects every
        // new, unverified user off the flow they signed up for).
        if (res.status === 403 && json.upgrade) {
          setCaptured(null)
          // An unverified block is the strongest reason to surface the verify
          // card — bypasses its grace period on the dashboard (see verifyPromptStore).
          if (json.block === 'unverified' && user?.id) recordAiVerificationBlock(user.id)
          const action = resolveAiGateAction({ block: json.block, scan: 'camera', context })
          onClose()
          if (action.kind === 'redirect') router.push(action.href)
          else toast({ title: action.message, duration: 5000 })
          return
        }
        if (!res.ok) throw new Error(json.error ?? 'Analysis failed')
        const items: PhotoResult[] = (json.foods as Array<Food & { estimated_grams: number; unit?: string }>).map((f) => {
          const estimated_grams = f.estimated_grams || f.serving_size_g || 100
          return {
            food: f,
            estimated_grams,
            unit: f.unit === 'ml' || f.unit === 'pcs' ? f.unit : 'g',
            // Seed the editable fields; both persist per item from here on.
            grams: estimated_grams,
            name: f.name,
          }
        })
        setResults(items)
        setSelectedIdx(0)
        setConfidence(json.confidence ?? null)
        if (typeof json.remaining === 'number') setScansLeft(json.remaining)
      })
      .catch((e) => {
        toast({ title: 'Could not analyse photo', description: (e as Error).message, variant: 'error' })
        setCaptured(null)
      })
      .finally(() => setAnalyzing(false))
  }, [captured, photoContext, onClose, router, context, user?.id])

  const retake = useCallback(() => {
    setCaptured(null); setResults(null); setSelectedIdx(0); setConfidence(null)
    setEditingName(false); setPhotoContext(''); setShowContextInput(false)
    lastBarcode.current = null; setBarcodeLoading(false)
    setManualBarcode(''); setManualLoading(false)
  }, [])

  const switchMode = useCallback((m: Mode) => { setMode(m); retake() }, [retake])

  /**
   * Bring one of the detected foods into the detail card. Edits made to the
   * others stay put — they live on `results`, not on the screen — which is the
   * behaviour the old `selectResult` broke by re-seeding grams/name every tap.
   */
  const selectResult = useCallback((idx: number) => {
    setSelectedIdx(idx); setEditingName(false)
  }, [])

  // ── Log food ─────────────────────────────────────────────────────────────────
  const logFood = useCallback(async () => {
    if (logging || !results || !selected) return
    setLogging(true)
    const multi = results.length > 1
    try {
      // One food goes through /api/logs/add unchanged; a plate with several
      // detected foods logs every one of them in a single /api/logs/add-bulk
      // write — the same route the chat flow uses for multi-item meals.
      const res = multi
        ? await fetch('/api/logs/add-bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...logMetaHeaders('photo_scan') },
            body: JSON.stringify({
              items: results.map((r) => ({ food_id: r.food.id, grams: r.grams, meal })),
              date: logDate,
            }),
          })
        : await fetch('/api/logs/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...logMetaHeaders('photo_scan') },
            body: JSON.stringify({ food_id: selected.food.id, meal, servings: 1, grams, date: logDate }),
          })
      const j = (await res.json().catch(() => ({}))) as { error?: string; milestone?: LogMilestone }
      if (!res.ok) throw new Error(j.error ?? 'Log failed')
      queryClient.invalidateQueries({ queryKey: ['food-logs'] })
      reportLogMilestone(j.milestone)

      // Correction signal, per food: did the user change what the AI suggested?
      for (const r of results) {
        captureEvent('ai_estimate_corrected', {
          type: 'camera',
          corrected: r.grams !== r.estimated_grams || r.name.trim() !== r.food.name,
          original_name: r.food.name,
          corrected_name: r.name.trim(),
          original_amount: r.estimated_grams,
          corrected_amount: r.grams,
          delta_amount: r.grams - r.estimated_grams,
          unit: r.unit,
          confidence,
        })
      }

      if (multi) {
        const loggedKcal = Math.round(
          results.reduce((s, r) => s + scaleMacrosRaw(r.food, r.grams).kcal, 0),
        )
        toast({ title: `Logged ${results.length} foods`, description: `${loggedKcal} kcal · ${meal}`, duration: 2500 })
      } else {
        toast({ title: `Logged ${selected.name || selected.food.name}`, description: `${grams} ${selected.unit} · ${meal}`, duration: 2500 })
      }
      onClose()
    } catch (e) {
      toast({ title: 'Failed to log', description: (e as Error).message, variant: 'error' })
    } finally {
      setLogging(false)
    }
  }, [results, selected, logging, meal, grams, confidence, queryClient, onClose, logDate])

  // ── Derived nutrition values ──────────────────────────────────────────────────
  const macros  = selected ? scaleMacrosRaw(selected.food, grams) : null
  const kcal    = macros ? Math.round(macros.kcal) : 0
  const protein = macros ? Math.round(macros.protein_g) : 0
  const carbs   = macros ? Math.round(macros.carbs_g) : 0
  const fat     = macros ? Math.round(macros.fat_g) : 0

  // Combined total across every detected food — what "Log all" writes, and the
  // figure the coaching line and the total card speak to when there's >1 item.
  const multiItem = (results?.length ?? 0) > 1
  const totalMacros = (results ?? []).reduce(
    (a, r) => {
      const m = scaleMacrosRaw(r.food, r.grams)
      return { kcal: a.kcal + m.kcal, protein: a.protein + m.protein_g, carbs: a.carbs + m.carbs_g, fat: a.fat + m.fat_g }
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  )
  const totalKcal    = Math.round(totalMacros.kcal)
  const totalProtein = Math.round(totalMacros.protein)
  const totalCarbs   = Math.round(totalMacros.carbs)
  const totalFat     = Math.round(totalMacros.fat)
  // The day's existing totals are the "before this meal" figure the coaching
  // line needs. Without them the sentence talks about the
  // meal as a share of the whole day and cheerfully says "good room left" to
  // someone who is already 300 over.
  //
  // dayContextFor drops the context entirely while the totals are loading or if
  // the read failed — see its comment for why zeros must not be passed through.
  const dayContext = dayContextFor({
    totals: dailyTotals,
    isLoading: totalsLoading,
    error: totalsError,
  })
  const coaching = selected && profile
    ? coachingLine(
        multiItem ? { kcal: totalKcal, protein: totalProtein } : { kcal, protein },
        { kcal: profile.daily_calorie_target, protein: profile.protein_g_target },
        dayContext
      )
    : null
  const { min: amountMin, max: amountMax, step: amountStep } = portionRange(selected?.unit)

  return {
    // refs
    videoRef, canvasRef, galleryRef,
    // state
    barcodeSupport, mode, camError, barcodeLoading, captured, analyzing,
    results, selected, selectedIdx, confidence, scansLeft, grams, photoContext, showContextInput,
    meal, logging, manualBarcode, manualLoading, customName, editingName,
    // setters exposed to the view
    setGrams, setPhotoContext, setShowContextInput, setMeal,
    setManualBarcode, setCustomName, setEditingName,
    // actions
    onGallerySelect, capturePhoto, analyzePhoto, submitManualBarcode,
    retake, switchMode, selectResult, logFood,
    // derived
    kcal, protein, carbs, fat, coaching, amountMin, amountMax, amountStep,
    multiItem, totalKcal, totalProtein, totalCarbs, totalFat,
  }
}
