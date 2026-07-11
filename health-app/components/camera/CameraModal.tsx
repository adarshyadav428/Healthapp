'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  X, ScanLine, Camera, Loader2, RefreshCw, CheckCircle2, AlertCircle,
  Hash, Search, AlertTriangle, Pencil,
} from 'lucide-react'
import type { Food } from '../../types/index'
import { toast } from '../ui/use-toast'
import { Button } from '../ui/button'
import { captureEvent } from '../../lib/posthog/client'
import { useQueryClient } from '@tanstack/react-query'

type Mode = 'barcode' | 'photo' | 'manual'
type PhotoResult = { food: Food; estimated_grams: number }

type Props = {
  onClose: () => void
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
  const router = useRouter()
  const videoRef    = useRef<HTMLVideoElement>(null)
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const rafRef      = useRef<number | null>(null)
  const lastBarcode = useRef<string | null>(null)

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
  const [meal, setMeal]                     = useState<string>(defaultMeal())
  const [logging, setLogging]               = useState(false)
  const [manualBarcode, setManualBarcode]   = useState('')
  const [manualLoading, setManualLoading]   = useState(false)
  const [customName, setCustomName]         = useState('')
  const [editingName, setEditingName]       = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
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
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    setCaptured(dataUrl)
    const base64 = dataUrl.split(',')[1]

    setAnalyzing(true)
    setResults(null)
    setConfidence(null)
    fetch('/api/camera/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg' }),
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
        const items: PhotoResult[] = (json.foods as Array<Food & { estimated_grams: number }>).map((f) => ({
          food: f,
          estimated_grams: f.estimated_grams || f.serving_size_g || 100,
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
  }, [onClose, router])

  const retake = useCallback(() => {
    setCaptured(null); setResults(null); setSelected(null); setConfidence(null)
    setCustomName(''); setEditingName(false)
    lastBarcode.current = null; setBarcodeLoading(false)
    setManualBarcode(''); setManualLoading(false)
  }, [])

  const switchMode = useCallback((m: Mode) => { setMode(m); retake() }, [retake])

  // ── Log food ─────────────────────────────────────────────────────────────────
  const logFood = useCallback(async () => {
    if (!selected || logging) return
    setLogging(true)
    try {
      const res = await fetch('/api/logs/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ food_id: selected.food.id, meal, servings: 1, grams }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? 'Log failed') }
      queryClient.invalidateQueries({ queryKey: ['food-logs'] })

      // Correction signal: did the user change what the AI suggested before confirming?
      const gramsCorrected = grams !== selected.estimated_grams
      const nameCorrected = customName.trim() !== selected.food.name
      captureEvent('ai_estimate_corrected', {
        type: 'camera',
        corrected: gramsCorrected || nameCorrected,
        original_name: selected.food.name,
        corrected_name: customName.trim(),
        original_grams: selected.estimated_grams,
        corrected_grams: grams,
        delta_grams: grams - selected.estimated_grams,
        confidence,
      })

      toast({ title: `Logged ${customName || selected.food.name}`, description: `${grams}g · ${meal}`, duration: 2500 })
      onClose()
    } catch (e) {
      toast({ title: 'Failed to log', description: (e as Error).message, variant: 'error' })
    } finally {
      setLogging(false)
    }
  }, [selected, logging, meal, grams, customName, confidence, queryClient, onClose])

  // ── Derived nutrition values ──────────────────────────────────────────────────
  const factor  = grams / 100
  const kcal    = selected ? Math.round(selected.food.kcal_per_100g    * factor) : 0
  const protein = selected ? Math.round(selected.food.protein_g_per_100g * factor) : 0
  const carbs   = selected ? Math.round(selected.food.carbs_g_per_100g  * factor) : 0
  const fat     = selected ? Math.round(selected.food.fat_g_per_100g    * factor) : 0

  const tabs: { value: Mode; label: string; icon: React.ReactNode }[] = [
    ...(barcodeSupport ? [{ value: 'barcode' as Mode, label: 'Barcode', icon: <ScanLine className="h-4 w-4" /> }] : []),
    { value: 'photo',  label: 'Photo',     icon: <Camera className="h-4 w-4" /> },
    { value: 'manual', label: 'Type Code', icon: <Hash   className="h-4 w-4" /> },
  ]

  const showResults = !!(results && selected)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <button
          onClick={onClose}
          className="rounded-full p-2 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
        <span className="text-white text-sm font-semibold">
          {mode === 'barcode' ? 'Scan Barcode' : mode === 'photo' ? 'Photo Scan' : 'Enter Barcode'}
        </span>
        <div className="w-9" />
      </div>

      {/* ── Viewport ── */}
      {mode !== 'manual' && (
        <div
          className="relative overflow-hidden bg-black"
          style={{ flex: showResults ? '0 0 42%' : '1 1 auto' }}
        >
          {camError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
              <AlertCircle className="h-10 w-10" style={{ color: 'var(--bad)' }} />
              <p className="text-white/80 text-sm">{camError}</p>
            </div>
          ) : (
            <>
              {captured ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={captured} alt="Captured food" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
              )}
              <canvas ref={canvasRef} className="hidden" />

              {/* Barcode targeting overlay */}
              {mode === 'barcode' && !captured && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="relative w-64 h-40">
                    <div className="absolute top-0 left-0 w-7 h-7 border-t-2 border-l-2 rounded-tl-sm" style={{ borderColor: 'var(--energy)' }} />
                    <div className="absolute top-0 right-0 w-7 h-7 border-t-2 border-r-2 rounded-tr-sm" style={{ borderColor: 'var(--energy)' }} />
                    <div className="absolute bottom-0 left-0 w-7 h-7 border-b-2 border-l-2 rounded-bl-sm" style={{ borderColor: 'var(--energy)' }} />
                    <div className="absolute bottom-0 right-0 w-7 h-7 border-b-2 border-r-2 rounded-br-sm" style={{ borderColor: 'var(--energy)' }} />
                    {barcodeLoading
                      ? <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--energy)' }} /></div>
                      : <div className="absolute top-1/2 -translate-y-1/2 left-2 right-2 h-px animate-pulse" style={{ background: 'var(--energy)', opacity: 0.7 }} />
                    }
                  </div>
                  <p className="mt-5 text-white/60 text-xs">{barcodeLoading ? 'Looking up product…' : 'Point camera at a barcode'}</p>
                </div>
              )}

              {/* Analysing overlay */}
              {mode === 'photo' && analyzing && (
                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="h-10 w-10 animate-spin" style={{ color: 'var(--energy)' }} />
                  <p className="text-white font-medium text-sm">Identifying food…</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Manual barcode input ── */}
      {mode === 'manual' && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6">
          <div className="text-center">
            <Hash className="h-12 w-12 mx-auto mb-3" style={{ color: 'var(--energy)' }} />
            <p className="text-white font-semibold text-base">Enter barcode number</p>
            <p className="text-white/50 text-sm mt-1">Type or paste the barcode from any packaged product</p>
          </div>
          <div className="w-full space-y-3">
            <input
              type="text"
              inputMode="numeric"
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitManualBarcode() }}
              placeholder="e.g. 8901058851823"
              className="w-full rounded-control bg-white/10 border border-white/20 text-white text-center text-lg font-mono px-4 py-3.5 outline-none focus:border-[var(--energy)] placeholder:text-white/30 transition-colors"
              autoFocus
            />
            <Button
              onClick={submitManualBarcode}
              disabled={!manualBarcode.trim() || manualLoading}
              size="lg"
              className="w-full gap-2 tap-scale"
            >
              {manualLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {manualLoading ? 'Looking up…' : 'Look up product'}
            </Button>
          </div>
          <p className="text-white/30 text-xs text-center">
            Can&apos;t find a barcode? Use Photo mode to snap your meal, or search by name in the food log.
          </p>
        </div>
      )}

      {/* ── Bottom panel ── */}
      <div
        className={`shrink-0 px-4 pb-6 pt-5 space-y-4 ${showResults ? 'bg-surface rounded-t-sheet' : ''}`}
        style={!showResults ? { background: '#030712' } : undefined} // token-check-ignore — camera viewfinder chrome is intentionally near-black regardless of theme
      >

        {/* ── Result card (photo mode) ── */}
        {showResults && (
          <div className="space-y-4">

            {/* Multiple items chips */}
            {results!.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {results!.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => { setSelected(r); setGrams(r.estimated_grams); setCustomName(r.food.name); setEditingName(false) }}
                    className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors tap-scale ${
                      selected === r ? 'bg-brand text-white' : 'bg-surface-2 text-ink-2'
                    }`}
                  >
                    {r.food.name}
                  </button>
                ))}
              </div>
            )}

            {/* Low-confidence warning */}
            {confidence === 'low' && (
              <div className="flex items-start gap-2 rounded-card bg-energy-soft border border-hairline px-3 py-2.5">
                <AlertTriangle className="h-4 w-4 mt-[1px] flex-shrink-0 text-energy-ink" />
                <p className="text-[12px] font-medium leading-snug text-energy-ink">
                  AI isn&apos;t confident about this one — check the numbers before logging.
                </p>
              </div>
            )}

            {/* Food name — tappable to edit */}
            <div>
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') setEditingName(false) }}
                    className="flex-1 font-display text-[20px] font-bold text-ink bg-transparent outline-none pb-0.5 border-b-2 border-brand"
                    autoFocus
                  />
                  <button
                    onClick={() => setEditingName(false)}
                    className="text-[13px] font-bold shrink-0 text-brand-ink"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingName(true)}
                  className="flex items-center gap-1.5 group text-left w-full"
                >
                  <p className="font-display text-[20px] font-bold text-ink leading-tight">{customName}</p>
                  <Pencil className="h-3.5 w-3.5 text-ink-2 group-hover:text-ink transition-colors shrink-0" />
                </button>
              )}
              {selected!.food.brand && (
                <p className="text-[12px] text-ink-2 mt-0.5">{selected!.food.brand}</p>
              )}
            </div>

            {/* Kcal + macros */}
            <div className="rounded-card bg-energy-soft border border-hairline p-4 space-y-3">
              {/* Kcal */}
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-[36px] font-bold tabular-nums text-ink leading-none">{kcal}</span>
                <span className="text-[14px] font-medium text-energy-ink">kcal</span>
              </div>

              {/* Macro row */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-hairline">
                {[
                  { label: 'Protein', value: protein, color: 'var(--protein)' },
                  { label: 'Carbs',   value: carbs,   color: 'var(--carbs)' },
                  { label: 'Fat',     value: fat,     color: 'var(--fat)' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-semibold text-ink-2">{label}</span>
                    <span className="text-[15px] font-bold tabular-nums" style={{ color }}>
                      {value}<span className="text-[11px] font-medium text-ink-2">g</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Portion: number input + slider */}
            <div>
              <p className="text-[12px] text-ink-2 mb-2">Portion size</p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={10} max={500} step={5}
                    value={grams}
                    onChange={(e) => {
                      const v = Math.max(10, Math.min(500, Number(e.target.value) || 10))
                      setGrams(v)
                    }}
                    className="w-[64px] text-center text-[15px] font-bold text-ink rounded-control py-1.5 outline-none bg-surface-2 border border-hairline"
                  />
                  <span className="text-[12px] text-ink-2 font-medium">g</span>
                </div>
                <input
                  type="range" min={10} max={500} step={5} value={grams}
                  onChange={(e) => setGrams(Number(e.target.value))}
                  className="flex-1 accent-brand"
                />
              </div>
            </div>

            {/* Meal + log */}
            <div className="flex gap-2">
              <select
                value={meal}
                onChange={(e) => setMeal(e.target.value)}
                className="flex-1 rounded-control text-sm py-2.5 px-3 outline-none transition-colors bg-surface-2 border border-hairline text-ink"
              >
                {MEAL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <Button onClick={logFood} disabled={logging} size="lg" className="flex-1 gap-1.5 tap-scale">
                {logging ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Log food
              </Button>
            </div>

            {/* Retake */}
            <button
              onClick={retake}
              className="flex w-full items-center justify-center gap-1.5 py-1 text-[13px] font-medium text-ink-2 hover:text-ink transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retake photo
            </button>
          </div>
        )}

        {/* ── Mode tabs + shutter (when no results) ── */}
        {!results && !analyzing && (
          <>
            <div className="flex rounded-control bg-white/10 p-1 gap-0.5">
              {tabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => switchMode(tab.value)}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-[0.625rem] py-2 text-xs font-semibold transition-colors ${
                    mode === tab.value ? 'bg-brand text-white' : 'text-white/50 hover:text-white'
                  }`}
                >
                  {tab.icon}{tab.label}
                </button>
              ))}
            </div>

            {mode === 'photo' && (
              <div className="flex justify-center pt-1">
                <button
                  onClick={capturePhoto}
                  disabled={!!camError}
                  aria-label="Take photo"
                  className="h-16 w-16 rounded-full bg-white border-4 border-brand active:scale-90 hover:scale-95 transition-transform disabled:opacity-40 shadow-lg"
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
