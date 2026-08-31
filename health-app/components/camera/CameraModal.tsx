'use client'

import { useRef } from 'react'
import {
  X, ScanLine, Camera, Loader2, RefreshCw, CheckCircle2, AlertCircle,
  Hash, Search, AlertTriangle, Pencil, ImagePlus,
} from 'lucide-react'
import type { Food } from '../../types/index'
import { Button } from '../ui/button'
import { useCameraScan, type Mode } from '../../hooks/useCameraScan'
import { aiScansLeftLabel } from '../../lib/aiTrial'

type Props = {
  onClose: () => void
  onFoodFound: (food: Food) => void
  /** The IST day to log to. Omitted means today — see useCameraScan. */
  logDate?: string
  /** `'onboarding'` keeps a gated AI scan in the wizard — see useCameraScan. */
  context?: 'standalone' | 'onboarding'
}

const MEAL_OPTIONS = [
  { value: 'breakfast', label: '🥣 Breakfast' },
  { value: 'lunch',     label: '🍛 Lunch' },
  { value: 'dinner',    label: '🍲 Dinner' },
  { value: 'snack',     label: '🥜 Snack' },
] as const

export function CameraModal({ onClose, onFoodFound, logDate, context }: Props) {
  const {
    videoRef, canvasRef, galleryRef,
    barcodeSupport, mode, camError, barcodeLoading, captured, analyzing,
    results, selected, confidence, scansLeft, grams, photoContext, showContextInput,
    meal, logging, manualBarcode, manualLoading, customName, editingName,
    setGrams, setPhotoContext, setShowContextInput, setMeal,
    setManualBarcode, setCustomName, setEditingName,
    onGallerySelect, capturePhoto, analyzePhoto, submitManualBarcode,
    retake, switchMode, selectResult, logFood,
    kcal, protein, carbs, fat, coaching, amountMin, amountMax, amountStep,
  } = useCameraScan({ onClose, onFoodFound, logDate, context })

  const nameInputRef = useRef<HTMLInputElement>(null)

  const tabs: { value: Mode; label: string; icon: React.ReactNode }[] = [
    ...(barcodeSupport ? [{ value: 'barcode' as Mode, label: 'Barcode', icon: <ScanLine className="h-4 w-4" /> }] : []),
    { value: 'photo',  label: 'Photo',     icon: <Camera className="h-4 w-4" /> },
    { value: 'manual', label: 'Type Code', icon: <Hash   className="h-4 w-4" /> },
  ]

  // Hidden file input for gallery uploads
  const galleryInput = (
    <input
      ref={galleryRef}
      type="file"
      accept="image/*"
      capture={undefined}
      onChange={onGallerySelect}
      className="hidden"
      aria-hidden="true"
    />
  )

  const showResults = !!(results && selected)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {galleryInput}

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
                    onClick={() => selectResult(r)}
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

            {aiScansLeftLabel(scansLeft) && (
              <p className="text-[12.5px] text-ink-2 tabular-nums">{aiScansLeftLabel(scansLeft)}</p>
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

            {/* Post-scan coaching line — makes the AI feel like a coach */}
            {coaching && (
              <p className="px-1 text-[12.5px] leading-relaxed text-ink-2">💡 {coaching}</p>
            )}

            {/* Portion: number input + slider */}
            <div>
              <p className="text-[12px] text-ink-2 mb-2">Portion size</p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={amountMin} max={amountMax} step={amountStep}
                    value={grams}
                    onChange={(e) => {
                      const v = Math.max(amountMin, Math.min(amountMax, Number(e.target.value) || amountMin))
                      setGrams(v)
                    }}
                    className="w-[64px] text-center text-[15px] font-bold text-ink rounded-control py-1.5 outline-none bg-surface-2 border border-hairline"
                  />
                  <span className="text-[12px] text-ink-2 font-medium">{selected?.unit ?? 'g'}</span>
                </div>
                <input
                  type="range" min={amountMin} max={amountMax} step={amountStep} value={grams}
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

        {/* ── Review capture + optional context, before sending to AI (photo mode) ── */}
        {mode === 'photo' && captured && !analyzing && !results && (
          <div className="space-y-3">
            {showContextInput ? (
              <input
                type="text"
                value={photoContext}
                onChange={(e) => setPhotoContext(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') analyzePhoto() }}
                placeholder="e.g. 'no oil', 'diet version', '2 rotis not 1'"
                maxLength={200}
                className="w-full rounded-control bg-white/10 border border-white/20 text-white text-sm px-4 py-3 outline-none focus:border-[var(--energy)] placeholder:text-white/40 transition-colors"
                autoFocus
              />
            ) : (
              <button
                onClick={() => setShowContextInput(true)}
                className="flex items-center gap-1.5 text-[13px] font-medium text-white/50 hover:text-white transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" /> Add context (optional)
              </button>
            )}
            {aiScansLeftLabel(scansLeft) && (
              <p className="text-center text-[12px] font-medium text-white/40 tabular-nums">
                {aiScansLeftLabel(scansLeft)}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={retake}
                className="flex items-center justify-center gap-1.5 rounded-control px-4 h-12 text-sm font-semibold text-white/60 hover:text-white bg-white/10 transition-colors tap-scale"
              >
                <RefreshCw className="h-4 w-4" /> Retake
              </button>
              <Button onClick={analyzePhoto} size="lg" className="flex-1 gap-2 tap-scale">
                <Camera className="h-4 w-4" />
                Analyze
              </Button>
            </div>
          </div>
        )}

        {/* ── Mode tabs + shutter (when no results) ── */}
        {!results && !analyzing && !captured && (
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
              <div className="flex items-center justify-center gap-6 pt-1">
                {/* Gallery upload button */}
                <button
                  onClick={() => galleryRef.current?.click()}
                  aria-label="Upload from gallery"
                  className="flex flex-col items-center gap-1 group"
                >
                  <span className="flex items-center justify-center h-12 w-12 rounded-full bg-white/10 border-2 border-white/25 group-hover:border-white/50 group-active:scale-90 transition-all">
                    <ImagePlus className="h-5 w-5 text-white/70 group-hover:text-white transition-colors" />
                  </span>
                  <span className="text-[10px] font-medium text-white/40 group-hover:text-white/60 transition-colors">Gallery</span>
                </button>

                {/* Shutter button */}
                <button
                  onClick={capturePhoto}
                  disabled={!!camError}
                  aria-label="Take photo"
                  className="h-16 w-16 rounded-full bg-white border-4 border-brand active:scale-90 hover:scale-95 transition-transform disabled:opacity-40 shadow-lg"
                />

                {/* Spacer to keep shutter centered */}
                <div className="w-12" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
