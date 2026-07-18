'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Food } from '../types/index'
import { toast } from '../components/ui/use-toast'
import { captureEvent, logMetaHeaders } from '../lib/posthog/client'
import { useQueryClient } from '@tanstack/react-query'
import { reportLogMilestone } from '../store/milestoneStore'
import type { LogMilestone } from '../lib/logMilestones'
import { coachingLine } from '../lib/coaching'
import { mealForTime } from '../lib/meal'
import { scaleMacrosRaw } from '../lib/nutrition'
import { portionRange } from '../lib/portion-units'
import { useUser } from './useUser'

export type Mode = 'barcode' | 'photo' | 'manual'
export type PhotoResult = { food: Food; estimated_grams: number; unit: string }

type Params = {
  onClose: () => void
  onFoodFound: (food: Food) => void
}

/**
 * All camera-scan interaction: device stream lifecycle, the BarcodeDetector
 * scan loop, photo capture / gallery upload, and the three server flows
 * (barcode lookup, AI photo analysis, log-food). Extracted from CameraModal so
 * the component is pure presentation and the orchestration stays testable and
 * reusable across UI rewrites. Behaviour is intentionally identical to the
 * previous in-component implementation.
 */
export function useCameraScan({ onClose, onFoodFound }: Params) {
  const router = useRouter()
  const { profile } = useUser()
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
  const [selected, setSelected]             = useState<PhotoResult | null>(null)
  const [confidence, setConfidence]         = useState<string | null>(null)
  const [grams, setGrams]                   = useState(100)
  const [photoContext, setPhotoContext]     = useState('')
  const [showContextInput, setShowContextInput] = useState(false)
  const [meal, setMeal]                     = useState<string>(mealForTime())
  const [logging, setLogging]               = useState(false)
  const [manualBarcode, setManualBarcode]   = useState('')
  const [manualLoading, setManualLoading]   = useState(false)
  const [customName, setCustomName]         = useState('')
  const [editingName, setEditingName]       = useState(false)
  const queryClient = useQueryClient()

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
        if (res.status === 429) {
          toast({
            title: 'Daily scan limit reached',
            description: 'Upgrade to Pro for unlimited photo scans.',
            variant: 'error',
            action: {
              label: 'Upgrade',
              altText: 'Go to upgrade page',
              onClick: () => { onClose(); router.push('/upgrade?reason=camera_scan_limit') },
            },
          })
          setCaptured(null)
          return
        }
        if (!res.ok) throw new Error(json.error ?? 'Analysis failed')
        const items: PhotoResult[] = (json.foods as Array<Food & { estimated_grams: number; unit?: string }>).map((f) => ({
          food: f,
          estimated_grams: f.estimated_grams || f.serving_size_g || 100,
          unit: f.unit === 'ml' || f.unit === 'pcs' ? f.unit : 'g',
        }))
        setResults(items)
        setConfidence(json.confidence ?? null)
        if (items[0]) { setSelected(items[0]); setGrams(items[0].estimated_grams); setCustomName(items[0].food.name) }
      })
      .catch((e) => {
        toast({ title: 'Could not analyse photo', description: (e as Error).message, variant: 'error' })
        setCaptured(null)
      })
      .finally(() => setAnalyzing(false))
  }, [captured, photoContext, onClose, router])

  const retake = useCallback(() => {
    setCaptured(null); setResults(null); setSelected(null); setConfidence(null)
    setCustomName(''); setEditingName(false); setPhotoContext(''); setShowContextInput(false)
    lastBarcode.current = null; setBarcodeLoading(false)
    setManualBarcode(''); setManualLoading(false)
  }, [])

  const switchMode = useCallback((m: Mode) => { setMode(m); retake() }, [retake])

  /** Choose one of several detected foods and reset the portion/name editors. */
  const selectResult = useCallback((r: PhotoResult) => {
    setSelected(r); setGrams(r.estimated_grams); setCustomName(r.food.name); setEditingName(false)
  }, [])

  // ── Log food ─────────────────────────────────────────────────────────────────
  const logFood = useCallback(async () => {
    if (!selected || logging) return
    setLogging(true)
    try {
      const res = await fetch('/api/logs/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...logMetaHeaders('photo_scan') },
        body: JSON.stringify({ food_id: selected.food.id, meal, servings: 1, grams }),
      })
      const j = (await res.json().catch(() => ({}))) as { error?: string; milestone?: LogMilestone }
      if (!res.ok) throw new Error(j.error ?? 'Log failed')
      queryClient.invalidateQueries({ queryKey: ['food-logs'] })
      reportLogMilestone(j.milestone)

      // Correction signal: did the user change what the AI suggested before confirming?
      const amountCorrected = grams !== selected.estimated_grams
      const nameCorrected = customName.trim() !== selected.food.name
      captureEvent('ai_estimate_corrected', {
        type: 'camera',
        corrected: amountCorrected || nameCorrected,
        original_name: selected.food.name,
        corrected_name: customName.trim(),
        original_amount: selected.estimated_grams,
        corrected_amount: grams,
        delta_amount: grams - selected.estimated_grams,
        unit: selected.unit,
        confidence,
      })

      toast({ title: `Logged ${customName || selected.food.name}`, description: `${grams} ${selected.unit} · ${meal}`, duration: 2500 })
      onClose()
    } catch (e) {
      toast({ title: 'Failed to log', description: (e as Error).message, variant: 'error' })
    } finally {
      setLogging(false)
    }
  }, [selected, logging, meal, grams, customName, confidence, queryClient, onClose])

  // ── Derived nutrition values ──────────────────────────────────────────────────
  const macros  = selected ? scaleMacrosRaw(selected.food, grams) : null
  const kcal    = macros ? Math.round(macros.kcal) : 0
  const protein = macros ? Math.round(macros.protein_g) : 0
  const carbs   = macros ? Math.round(macros.carbs_g) : 0
  const fat     = macros ? Math.round(macros.fat_g) : 0
  const coaching = selected && profile
    ? coachingLine({ kcal, protein }, { kcal: profile.daily_calorie_target, protein: profile.protein_g_target })
    : null
  const { min: amountMin, max: amountMax, step: amountStep } = portionRange(selected?.unit)

  return {
    // refs
    videoRef, canvasRef, galleryRef,
    // state
    barcodeSupport, mode, camError, barcodeLoading, captured, analyzing,
    results, selected, confidence, grams, photoContext, showContextInput,
    meal, logging, manualBarcode, manualLoading, customName, editingName,
    // setters exposed to the view
    setGrams, setPhotoContext, setShowContextInput, setMeal,
    setManualBarcode, setCustomName, setEditingName,
    // actions
    onGallerySelect, capturePhoto, analyzePhoto, submitManualBarcode,
    retake, switchMode, selectResult, logFood,
    // derived
    kcal, protein, carbs, fat, coaching, amountMin, amountMax, amountStep,
  }
}
