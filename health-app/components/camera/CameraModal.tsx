'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  X, ScanLine, Camera, Loader2, RefreshCw, CheckCircle2, AlertCircle,
} from 'lucide-react'
import type { Food } from '../../types/index'
import { toast } from '../ui/use-toast'
import { useQueryClient } from '@tanstack/react-query'

type Mode = 'barcode' | 'photo'

type PhotoResult = { food: Food; estimated_grams: number }

type Props = {
  onClose: () => void
  /** Called when a barcode is successfully resolved to a food. Parent opens AddFoodModal. */
  onFoodFound: (food: Food) => void
}

const MEAL_OPTIONS = [
  { value: 'breakfast', label: '🥣 Breakfast' },
  { value: 'lunch',     label: '🍛 Lunch' },
  { value: 'dinner',    label: '🍲 Dinner' },
  { value: 'snack',     label: '🥜 Snack' },
] as const

function defaultMeal() {
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 16) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}

export function CameraModal({ onClose, onFoodFound }: Props) {
  const videoRef      = useRef<HTMLVideoElement>(null)
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const streamRef     = useRef<MediaStream | null>(null)
  const rafRef        = useRef<number | null>(null)
  const lastBarcode   = useRef<string | null>(null)

  const [mode, setMode]               = useState<Mode>('barcode')
  const [barcodeSupport, setBarcodeSupport] = useState(true)
  const [camError, setCamError]       = useState<string | null>(null)
  const [barcodeLoading, setBarcodeLoading] = useState(false)
  const [captured, setCaptured]       = useState<string | null>(null)
  const [analyzing, setAnalyzing]     = useState(false)
  const [results, setResults]         = useState<PhotoResult[] | null>(null)
  const [selected, setSelected]       = useState<PhotoResult | null>(null)
  const [grams, setGrams]             = useState(100)
  const [meal, setMeal]               = useState<string>(defaultMeal())
  const [logging, setLogging]         = useState(false)
  const queryClient = useQueryClient()

  // Start camera stream
  useEffect(() => {
    if (!('BarcodeDetector' in window)) {
      setBarcodeSupport(false)
      setMode('photo')
    }

    let cancelled = false
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } } })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
      })
      .catch(() => setCamError('Camera access denied. Please allow camera permissions and retry.'))

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // Barcode detection loop
  useEffect(() => {
    if (mode !== 'barcode' || !barcodeSupport || barcodeLoading || captured) return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    const BarcodeDetectorAPI = (window as Record<string, unknown>).BarcodeDetector
    if (!BarcodeDetectorAPI) return

    const detector = new BarcodeDetectorAPI({
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
      } catch { /* detector error on some frames — ignore */ }
      if (active) rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => { active = false; if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, barcodeSupport, barcodeLoading, captured])

  const onBarcodeFound = useCallback(async (code: string) => {
    setBarcodeLoading(true)
    try {
      navigator.vibrate?.(40)
      const res = await fetch(`/api/camera/barcode?code=${encodeURIComponent(code)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Product not found')
      onFoodFound(json as Food)
      onClose()
    } catch (e) {
      toast({ title: 'Product not found', description: (e as Error).message, variant: 'error' })
      lastBarcode.current = null
      setBarcodeLoading(false)
    }
  }, [onClose, onFoodFound])

  const capturePhoto = useCallback(() => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    setCaptured(dataUrl)
    const base64 = dataUrl.split(',')[1]

    setAnalyzing(true)
    setResults(null)
    fetch('/api/camera/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg' }),
    })
      .then(async (res) => {
        const json = await res.json()
        if (res.status === 429) {
          toast({ title: 'Daily scan limit reached', description: 'Upgrade to Pro for unlimited photo scans.', variant: 'error' })
          setCaptured(null)
          return
        }
        if (!res.ok) throw new Error(json.error ?? 'Analysis failed')
        const items: PhotoResult[] = (json.foods as Array<Food & { estimated_grams: number }>).map((f) => ({
          food: f,
          estimated_grams: f.estimated_grams || f.serving_size_g || 100,
        }))
        setResults(items)
        if (items[0]) { setSelected(items[0]); setGrams(items[0].estimated_grams) }
      })
      .catch((e) => {
        toast({ title: 'Could not analyse photo', description: (e as Error).message, variant: 'error' })
        setCaptured(null)
      })
      .finally(() => setAnalyzing(false))
  }, [])

  const retake = useCallback(() => {
    setCaptured(null)
    setResults(null)
    setSelected(null)
    lastBarcode.current = null
    setBarcodeLoading(false)
  }, [])

  const logFood = useCallback(async () => {
    if (!selected || logging) return
    setLogging(true)
    try {
      const res = await fetch('/api/logs/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ food_id: selected.food.id, meal, servings: 1, grams }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Log failed')
      }
      queryClient.invalidateQueries({ queryKey: ['food-logs'] })
      toast({ title: `Logged ${selected.food.name}`, description: `${grams}g · ${meal}`, duration: 2500 })
      onClose()
    } catch (e) {
      toast({ title: 'Failed to log', description: (e as Error).message, variant: 'error' })
    } finally {
      setLogging(false)
    }
  }, [selected, logging, meal, grams, queryClient, onClose])

  const switchMode = useCallback((m: Mode) => { setMode(m); retake() }, [retake])

  const kcal = selected ? Math.round((selected.food.kcal_per_100g * grams) / 100) : 0

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <button
          onClick={onClose}
          className="rounded-full p-2 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
        <span className="text-white text-sm font-semibold">
          {mode === 'barcode' ? 'Scan Barcode' : 'Photo Scan'}
        </span>
        <div className="w-9" />
      </div>

      {/* Viewport */}
      <div className="relative flex-1 overflow-hidden bg-black">
        {camError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <AlertCircle className="h-10 w-10 text-red-400" />
            <p className="text-white/80 text-sm">{camError}</p>
          </div>
        ) : (
          <>
            {captured ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={captured} alt="Captured frame" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
            )}
            <canvas ref={canvasRef} className="hidden" />

            {/* Barcode targeting overlay */}
            {mode === 'barcode' && !captured && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="relative w-64 h-40">
                  <div className="absolute top-0 left-0 w-7 h-7 border-t-2 border-l-2 border-orange-400 rounded-tl-sm" />
                  <div className="absolute top-0 right-0 w-7 h-7 border-t-2 border-r-2 border-orange-400 rounded-tr-sm" />
                  <div className="absolute bottom-0 left-0 w-7 h-7 border-b-2 border-l-2 border-orange-400 rounded-bl-sm" />
                  <div className="absolute bottom-0 right-0 w-7 h-7 border-b-2 border-r-2 border-orange-400 rounded-br-sm" />
                  {barcodeLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="h-8 w-8 text-orange-400 animate-spin" />
                    </div>
                  ) : (
                    <div className="absolute top-1/2 -translate-y-1/2 left-2 right-2 h-px bg-orange-400/70 animate-pulse" />
                  )}
                </div>
                <p className="mt-5 text-white/60 text-xs">
                  {barcodeLoading ? 'Looking up product…' : 'Point camera at a barcode'}
                </p>
              </div>
            )}

            {/* Photo: analysing overlay */}
            {mode === 'photo' && analyzing && (
              <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-10 w-10 text-orange-400 animate-spin" />
                <p className="text-white font-medium text-sm">Identifying food…</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom panel */}
      <div className="shrink-0 bg-gray-950 px-4 pb-6 pt-4 space-y-4">
        {/* Photo results card */}
        {results && selected && (
          <div className="space-y-3">
            {/* Multi-food selector */}
            {results.length > 1 && (
              <div className="flex gap-2">
                {results.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => { setSelected(r); setGrams(r.estimated_grams) }}
                    className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      selected === r
                        ? 'bg-orange-600 text-white'
                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}
                  >
                    {r.food.name}
                  </button>
                ))}
              </div>
            )}

            {/* Food card */}
            <div className="rounded-2xl bg-white/10 p-4 space-y-3">
              <div>
                <p className="text-white font-bold">{selected.food.name}</p>
                {selected.food.brand && (
                  <p className="text-white/40 text-xs">{selected.food.brand}</p>
                )}
                <p className="text-orange-400 font-black text-2xl mt-1">
                  {kcal}{' '}
                  <span className="text-sm font-normal text-white/50">kcal</span>
                </p>
              </div>

              {/* Portion slider */}
              <div>
                <div className="flex justify-between text-xs text-white/50 mb-1">
                  <span>Portion size</span>
                  <span className="text-white font-semibold">{grams}g</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={500}
                  step={5}
                  value={grams}
                  onChange={(e) => setGrams(Number(e.target.value))}
                  className="w-full accent-orange-600"
                />
              </div>

              {/* Meal + log */}
              <div className="flex gap-2">
                <select
                  value={meal}
                  onChange={(e) => setMeal(e.target.value)}
                  className="flex-1 rounded-xl bg-white/10 text-white text-sm py-2 px-3 outline-none border border-white/10 focus:border-orange-500"
                >
                  {MEAL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value} className="bg-gray-900 text-white">
                      {o.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={logFood}
                  disabled={logging}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-orange-600 py-2 px-4 text-sm font-bold text-white hover:bg-orange-700 active:scale-[.98] disabled:opacity-60 transition-all"
                >
                  {logging
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <CheckCircle2 className="h-4 w-4" />}
                  Log food
                </button>
              </div>
            </div>

            <button
              onClick={retake}
              className="flex w-full items-center justify-center gap-1.5 py-1.5 text-white/40 text-sm hover:text-white/70 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retake
            </button>
          </div>
        )}

        {/* Mode tabs + shutter — hidden while showing results */}
        {!results && !analyzing && (
          <>
            {barcodeSupport && (
              <div className="flex rounded-2xl bg-white/10 p-1">
                <button
                  onClick={() => switchMode('barcode')}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold transition-colors ${
                    mode === 'barcode' ? 'bg-orange-600 text-white' : 'text-white/50 hover:text-white'
                  }`}
                >
                  <ScanLine className="h-4 w-4" /> Barcode
                </button>
                <button
                  onClick={() => switchMode('photo')}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold transition-colors ${
                    mode === 'photo' ? 'bg-orange-600 text-white' : 'text-white/50 hover:text-white'
                  }`}
                >
                  <Camera className="h-4 w-4" /> Photo
                </button>
              </div>
            )}

            {mode === 'photo' && (
              <div className="flex justify-center pt-1">
                <button
                  onClick={capturePhoto}
                  disabled={!!camError}
                  aria-label="Take photo"
                  className="h-16 w-16 rounded-full bg-white border-4 border-orange-600 active:scale-90 hover:scale-95 transition-transform disabled:opacity-40 shadow-lg"
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
