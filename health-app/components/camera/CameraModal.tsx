'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, Check, AlertCircle, Pencil, ImagePlus, Minus, Plus } from 'lucide-react'
import type { Food } from '../../types/index'
import { Button } from '../ui/button'
import { Chip } from '../ui/chip'
import { cn } from '../../lib/utils'
import { useCameraScan, type AiFeedback, type Mode } from '../../hooks/useCameraScan'
import { useScrollLock } from '../ui/use-scroll-lock'
import { useBackDismiss } from '../ui/use-back-dismiss'
import { aiScansLeftLabel } from '../../lib/aiTrial'

type Props = {
  onClose: () => void
  onFoodFound: (food: Food) => void
  /** The IST day to log to. Omitted means today — see useCameraScan. */
  logDate?: string
  /** `'onboarding'` keeps a gated AI scan in the wizard — see useCameraScan. */
  context?: 'standalone' | 'onboarding'
}

const MEALS = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch',     label: 'Lunch' },
  { value: 'dinner',    label: 'Dinner' },
  { value: 'snack',     label: 'Snack' },
] as const

const mealLabel = (meal: string) => MEALS.find((m) => m.value === meal)?.label ?? meal

const FEEDBACK: { value: AiFeedback; label: string }[] = [
  { value: 'accurate', label: 'Accurate' },
  { value: 'unsure',   label: 'Not sure' },
  { value: 'off',      label: 'Off' },
]

// One line while the photo is with the model. Cycled, not animated: the
// words change because the work has stages, and that is the only motion the
// wait needs besides the ring.
const ANALYZING_LINES = ['Looking at your plate', 'Matching Indian foods', 'Working out the portion']

// The −/+ step is a nudge, not the resolution: the number field still takes
// any value inside portionRange. 25 g is one spoon of rice; a piece is a piece.
const NUDGE: Record<string, number> = { pcs: 1 }
const nudgeFor = (unit: string) => NUDGE[unit] ?? 25

// Chrome over the viewfinder: glass discs and pills on the photo itself, so
// the controls never compete with the food for the frame.
const glass = 'bg-white/15 text-white backdrop-blur-md hover:bg-white/25'
const glassDisc = `grid h-11 w-11 place-items-center rounded-full tap-scale transition-colors ${glass}`

// Nested corners inside a control — smaller than their container (design-system.md).
const segment = 'flex-1 rounded-lg text-caption font-semibold transition-colors'

/**
 * The portion number field. Backed by its own string so it tolerates an empty
 * or half-typed value instead of snapping to the minimum on every keystroke —
 * that snap made the trailing digit of "10" impossible to delete, since the
 * moment it read "1" the old handler clamped it straight back to 10. The
 * minimum is only enforced on blur; the ceiling still clamps live so a typed
 * value can't sail past the range.
 *
 * Rendered with `key` by the caller so switching between detected foods, or a
 * −/+ nudge, reseeds this from the item's own (persisted) grams instead of
 * carrying over a half-typed value meant for a different item.
 */
function PortionInput({
  grams, min, max, step, unit, onChange,
}: { grams: number; min: number; max: number; step: number; unit: string; onChange: (g: number) => void }) {
  const [str, setStr] = useState(String(grams))
  return (
    <label className="flex items-baseline justify-center gap-1">
      <span className="sr-only">Quantity</span>
      <input
        type="number"
        inputMode="numeric"
        min={min} max={max} step={step}
        value={str}
        onChange={(e) => {
          const cleaned = e.target.value.replace(/[^0-9]/g, '')
          setStr(cleaned)
          const n = parseInt(cleaned, 10)
          if (Number.isFinite(n)) onChange(Math.min(n, max))
        }}
        onBlur={() => {
          const n = parseInt(str, 10)
          const safe = Number.isFinite(n) ? Math.min(Math.max(n, min), max) : min
          setStr(String(safe))
          onChange(safe)
        }}
        onFocus={(e) => e.target.select()}
        className="w-20 bg-transparent text-center font-display text-title-sm font-semibold tabular-nums text-ink outline-none"
      />
      <span className="text-body text-ink-2">{unit}</span>
    </label>
  )
}

/** The wait between the shutter and the result — a ring and one changing line. */
function AnalyzingState() {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % ANALYZING_LINES.length), 1800)
    return () => clearInterval(t)
  }, [])
  return (
    <div role="status" className="absolute inset-0 grid place-items-center bg-black/60 px-8 text-center">
      <div>
        <span className="mx-auto block h-14 w-14 animate-spin rounded-full border-2 border-white/20 border-t-brand motion-reduce:animate-none" aria-hidden />
        <p className="mt-5 text-body-lg font-medium text-white" aria-live="polite">{ANALYZING_LINES[i]}</p>
        <p className="mt-1 text-caption text-white/60">Usually a few seconds</p>
      </div>
    </div>
  )
}

/** Four thin corners: "put the food here", without saying so. */
function FrameCorners({ className }: { className: string }) {
  const tick = 'absolute h-7 w-7 border-white/70'
  return (
    <div className={cn('relative', className)} aria-hidden>
      <span className={`${tick} left-0 top-0 rounded-tl-2xl border-l-2 border-t-2`} />
      <span className={`${tick} right-0 top-0 rounded-tr-2xl border-r-2 border-t-2`} />
      <span className={`${tick} bottom-0 left-0 rounded-bl-2xl border-b-2 border-l-2`} />
      <span className={`${tick} bottom-0 right-0 rounded-br-2xl border-b-2 border-r-2`} />
    </div>
  )
}

export function CameraModal({ onClose, onFoodFound, logDate, context }: Props) {
  const {
    videoRef, canvasRef, galleryRef,
    barcodeSupport, mode, camError, barcodeLoading, captured, analyzing,
    results, selected, selectedIdx, confidence, scansLeft, grams, photoContext, showContextInput,
    meal, logging, manualBarcode, manualLoading, customName, editingName, feedback, logged,
    setGrams, setPhotoContext, setShowContextInput, setMeal,
    setManualBarcode, setCustomName, setEditingName,
    onGallerySelect, capturePhoto, analyzePhoto, submitManualBarcode,
    retake, switchMode, selectResult, logFood, rateResult,
    kcal, protein, carbs, fat, coaching, amountMin, amountMax, amountStep,
    multiItem, totalKcal,
  } = useCameraScan({ onClose, onFoodFound, logDate, context })

  useScrollLock()
  useBackDismiss(true, onClose)

  // Bumped on every −/+ so the number field reseeds from the nudged value.
  // Keyed on this rather than on `grams` itself: a keystroke also changes
  // grams, and remounting mid-word would throw the cursor out of the field.
  const [nudgeSeq, setNudgeSeq] = useState(0)

  const showResults = !!(results && selected) && !logged
  const sheetOpen = showResults || !!logged
  const scansLine = aiScansLeftLabel(scansLeft)
  const unit = selected?.unit ?? 'g'
  const nudge = (dir: -1 | 1) => {
    const next = Math.min(Math.max(grams + dir * nudgeFor(unit), amountMin), amountMax)
    setGrams(next)
    setNudgeSeq((n) => n + 1)
  }
  const addLabel = multiItem
    ? `Add ${results!.length} foods to ${mealLabel(meal)} · ${totalKcal.toLocaleString('en-IN')} kcal`
    : `Add to ${mealLabel(meal)} · ${kcal.toLocaleString('en-IN')} kcal`

  return (
    // Full-bleed on a phone. From md up the tool keeps its phone shape in the
    // middle of a scrim — a camera is a portrait object, and stretching the
    // viewfinder across a monitor makes a small plate very large.
    <div className="fixed inset-0 z-50 md:grid md:place-items-center md:bg-scrim md:backdrop-blur-md">
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-black text-white md:h-[min(56rem,94vh)] md:w-[26.875rem] md:rounded-sheet md:shadow-float">
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          onChange={onGallerySelect}
          className="hidden"
          aria-hidden="true"
        />

        {/* ── Stage: the live camera, or the photo it took ── */}
        <div
          className="relative min-h-0 overflow-hidden bg-black transition-[flex-basis] duration-300 ease-out"
          style={{ flex: sheetOpen ? '0 0 38%' : '1 1 auto' }}
        >
          {/* The video stays mounted underneath the photo: the stream is
              attached to this one element when the screen opens, and a Retake
              that remounted it came back to a black viewfinder. */}
          <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" />
          {captured && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={captured} alt="Your photo" className="absolute inset-0 h-full w-full object-cover" />
          )}
          <canvas ref={canvasRef} className="hidden" />

          {camError && !captured && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
              <AlertCircle className="h-8 w-8 text-white/70" strokeWidth={1.75} />
              <p className="text-body text-white/80">{camError}</p>
              <button type="button" onClick={() => galleryRef.current?.click()} className={`h-11 rounded-full px-5 text-body font-semibold tap-scale ${glass}`}>
                Choose a photo instead
              </button>
            </div>
          )}

          {!camError && !captured && mode === 'photo' && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <FrameCorners className="aspect-square w-3/5 max-w-xs" />
            </div>
          )}

          {!captured && mode === 'barcode' && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-5">
              <FrameCorners className="h-40 w-64" />
              {barcodeLoading
                ? <Loader2 className="h-6 w-6 animate-spin text-white" />
                : <span className="rounded-full bg-black/40 px-3 py-1 text-caption text-white">Point at a barcode</span>}
            </div>
          )}

          {/* Top chrome — close, and once there is a photo, the way back. */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4" style={{ paddingTop: 'calc(12px + env(safe-area-inset-top))' }}>
            <button type="button" onClick={onClose} aria-label="Close camera" className={glassDisc}>
              <X className="h-5 w-5" strokeWidth={1.75} />
            </button>
            {captured && !analyzing && !logged && (
              <button type="button" onClick={retake} className={`h-10 rounded-full px-4 text-caption font-semibold tap-scale ${glass}`}>
                Retake
              </button>
            )}
          </div>

          {mode === 'photo' && analyzing && <AnalyzingState />}
          {mode === 'manual' && <div className="absolute inset-0 bg-black/60" aria-hidden />}
        </div>

        {/* ── Capture chrome: what sits under the viewfinder before a result ── */}
        {!sheetOpen && !analyzing && mode !== 'manual' && (
          <div
            className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-5 pt-16"
            style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}
          >
            {captured ? (
              // Review: the photo is taken, the model has not seen it yet.
              <div className="space-y-3">
                {showContextInput ? (
                  <input
                    type="text"
                    value={photoContext}
                    onChange={(e) => setPhotoContext(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') analyzePhoto() }}
                    placeholder="A note for the AI — 'no oil', '2 rotis'"
                    maxLength={200}
                    aria-label="Note for the AI"
                    className="h-12 w-full rounded-control bg-white/15 px-4 text-body text-white outline-none backdrop-blur-md placeholder:text-white/50 focus:bg-white/25"
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowContextInput(true)}
                    className="flex h-9 items-center gap-1.5 text-caption font-medium text-white/70 hover:text-white"
                  >
                    <Pencil className="h-4 w-4" strokeWidth={1.75} /> Add a note
                  </button>
                )}
                {scansLine && <p className="text-caption text-white/60 tabular-nums">{scansLine}</p>}
                <Button onClick={analyzePhoto} size="lg" className="w-full">
                  Analyse photo
                </Button>
              </div>
            ) : (
              <div className="space-y-5">
                {barcodeSupport && (
                  <div role="tablist" aria-label="Camera mode" className="mx-auto flex h-10 w-48 gap-1 rounded-control bg-white/15 p-1 backdrop-blur-md">
                    {([['photo', 'Photo'], ['barcode', 'Barcode']] as [Mode, string][]).map(([value, label]) => (
                      <button
                        key={value}
                        role="tab"
                        aria-selected={mode === value}
                        type="button"
                        onClick={() => switchMode(value)}
                        className={cn(segment, mode === value ? 'bg-white text-black' : 'text-white/80')}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                {mode === 'photo' ? (
                  <div className="grid grid-cols-3 items-center">
                    <button type="button" onClick={() => galleryRef.current?.click()} aria-label="Choose a photo" className={`${glassDisc} justify-self-start`}>
                      <ImagePlus className="h-5 w-5" strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      onClick={capturePhoto}
                      disabled={!!camError}
                      aria-label="Take photo"
                      className="group grid h-[4.5rem] w-[4.5rem] place-items-center justify-self-center rounded-full border-4 border-white disabled:opacity-40"
                    >
                      <span className="h-14 w-14 rounded-full bg-white transition-transform group-active:scale-90" />
                    </button>
                    <span />
                  </div>
                ) : (
                  <div className="grid h-[4.5rem] place-items-center">
                    <button type="button" onClick={() => switchMode('manual')} className="h-11 text-caption font-medium text-white/70 hover:text-white">
                      Type the code instead
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Manual barcode: a small sheet over the dimmed viewfinder ── */}
        {mode === 'manual' && (
          <div className="absolute inset-x-0 bottom-0 rounded-t-sheet bg-canvas px-5 pt-5 text-ink" style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}>
            <h2 className="font-display text-title-sm font-semibold">Enter the barcode</h2>
            <p className="mt-1 text-caption text-ink-2">The number under the bars on the pack.</p>
            <input
              type="text"
              inputMode="numeric"
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitManualBarcode() }}
              placeholder="8901058851823"
              aria-label="Barcode number"
              className="mt-4 h-12 w-full rounded-control border border-hairline bg-surface-2 px-4 text-center text-body-lg tabular-nums text-ink outline-none placeholder:text-ink-3 focus:border-brand focus:bg-surface"
              autoFocus
            />
            <Button onClick={submitManualBarcode} disabled={!manualBarcode.trim() || manualLoading} size="lg" className="mt-3 w-full">
              {manualLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
              {manualLoading ? 'Looking up…' : 'Look up product'}
            </Button>
            <button type="button" onClick={() => switchMode(barcodeSupport ? 'barcode' : 'photo')} className="mt-1 flex h-11 w-full items-center justify-center text-caption font-medium text-ink-2">
              Back to the camera
            </button>
          </div>
        )}

        {/* ── Result: the sheet that rises over the photo ── */}
        {showResults && (
          <div className="relative -mt-6 flex min-h-0 flex-1 flex-col rounded-t-sheet bg-canvas text-ink">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 pt-5">
              {/* What it saw — the name is the headline and it is editable. */}
              {editingName ? (
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') setEditingName(false) }}
                    aria-label="Food name"
                    className="min-w-0 flex-1 border-b-2 border-brand bg-transparent pb-1 font-display text-title font-semibold text-ink outline-none"
                    autoFocus
                  />
                  <button type="button" onClick={() => setEditingName(false)} className="h-11 shrink-0 px-2 text-body font-semibold text-brand-text">
                    Done
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setEditingName(true)} className="group flex w-full items-start gap-2 text-left" aria-label={`Edit name: ${customName}`}>
                  <span className="min-w-0 font-display text-title font-semibold leading-tight text-ink">{customName}</span>
                  <Pencil className="mt-1.5 h-4 w-4 shrink-0 text-ink-3 group-hover:text-ink" strokeWidth={1.75} />
                </button>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-ink-3">
                {selected!.food.brand && <span>{selected!.food.brand}</span>}
                {confidence === 'low' && <Chip tone="energy" size="sm">Check this one</Chip>}
                {scansLine && <span className="tabular-nums">{scansLine}</span>}
              </div>

              {/* The number, and what it is made of. */}
              <div className="mt-4 rounded-card-lg border border-hairline bg-surface px-4 py-4 shadow-air">
                {multiItem && <p className="mb-2 truncate text-caption font-medium text-ink-2">{customName}</p>}
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-display font-semibold tabular-nums leading-none text-ink">{kcal.toLocaleString('en-IN')}</span>
                  <span className="text-body text-ink-2">kcal</span>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-hairline pt-3">
                  {[
                    { label: 'Protein', value: protein, swatch: 'bg-protein' },
                    { label: 'Carbs',   value: carbs,   swatch: 'bg-carbs' },
                    { label: 'Fat',     value: fat,     swatch: 'bg-fat' },
                  ].map(({ label, value, swatch }) => (
                    <div key={label}>
                      <dt className="flex items-center gap-1.5 text-micro font-medium text-ink-3">
                        <span className={`h-2 w-2 rounded-sm ${swatch}`} aria-hidden />{label}
                      </dt>
                      <dd className="mt-0.5 text-body font-semibold tabular-nums text-ink">{value} g</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Several foods on one plate: all go in; tap one to edit it. */}
              {multiItem && (
                <div className="mt-5">
                  <h3 className="text-caption font-semibold text-ink-2">On the plate</h3>
                  <ul className="mt-1 divide-y divide-hairline">
                    {results!.map((r, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => selectResult(i)}
                          aria-pressed={selectedIdx === i}
                          className={cn('flex h-12 w-full items-center gap-3 rounded-control px-2 text-left tap-scale', selectedIdx === i ? 'bg-surface-2' : 'hover:bg-surface-2')}
                        >
                          <span className="min-w-0 flex-1 truncate text-body font-medium text-ink">{r.name || r.food.name}</span>
                          <span className="text-caption tabular-nums text-ink-3">{Math.round(r.grams)} {r.unit}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 flex justify-between border-t border-hairline pt-2 text-caption text-ink-2">
                    <span>All {results!.length} together</span>
                    <span className="font-semibold tabular-nums text-ink">{totalKcal.toLocaleString('en-IN')} kcal</span>
                  </p>
                </div>
              )}

              {/* Quantity — the estimate is a starting point. */}
              <div className="mt-5">
                <h3 className="text-caption font-semibold text-ink-2">Quantity{multiItem ? ` · ${customName}` : ''}</h3>
                <div className="mt-2 flex items-center justify-between rounded-card border border-hairline bg-surface px-2 py-2">
                  <button type="button" onClick={() => nudge(-1)} disabled={grams <= amountMin} aria-label="Decrease quantity" className="grid h-11 w-11 place-items-center rounded-full bg-surface-2 text-ink tap-scale disabled:opacity-40">
                    <Minus className="h-5 w-5" strokeWidth={2} />
                  </button>
                  <PortionInput
                    key={`${selectedIdx}:${nudgeSeq}`}
                    grams={grams}
                    min={amountMin} max={amountMax} step={amountStep}
                    unit={unit}
                    onChange={setGrams}
                  />
                  <button type="button" onClick={() => nudge(1)} disabled={grams >= amountMax} aria-label="Increase quantity" className="grid h-11 w-11 place-items-center rounded-full bg-surface-2 text-ink tap-scale disabled:opacity-40">
                    <Plus className="h-5 w-5" strokeWidth={2} />
                  </button>
                </div>
              </div>

              {/* Meal — today's slot is already picked. */}
              <div className="mt-5">
                <h3 className="text-caption font-semibold text-ink-2">Add to</h3>
                <div role="radiogroup" aria-label="Meal" className="mt-2 grid grid-cols-4 gap-1.5">
                  {MEALS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      role="radio"
                      aria-checked={meal === m.value}
                      onClick={() => setMeal(m.value)}
                      className={cn('h-11 rounded-control text-caption font-semibold tap-scale transition-colors', meal === m.value ? 'bg-ink text-canvas' : 'bg-surface-2 text-ink-2 hover:text-ink')}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Feedback — one tap, optional. */}
              <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
                <h3 className="text-caption font-semibold text-ink-2">Was this right?</h3>
                <div role="group" aria-label="Was this right?" className="flex gap-1.5">
                  {FEEDBACK.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      aria-pressed={feedback === f.value}
                      onClick={() => rateResult(f.value)}
                      className={cn('h-10 rounded-full border px-4 text-caption font-semibold tap-scale transition-colors', feedback === f.value ? 'border-ink bg-ink text-canvas' : 'border-hairline bg-surface text-ink-2 hover:text-ink')}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {coaching && <p className="mt-4 text-caption leading-relaxed text-ink-2">{coaching}</p>}
            </div>

            {/* The one action, outside the scroller so it is always on screen. */}
            <div className="shrink-0 border-t border-hairline bg-canvas px-5 pt-3" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
              <Button onClick={logFood} disabled={logging} size="lg" className="w-full">
                {logging ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                {addLabel}
              </Button>
            </div>
          </div>
        )}

        {/* ── Logged: what went in, and where the day stands ── */}
        {logged && (
          <div role="status" className="relative -mt-6 flex min-h-0 flex-1 flex-col rounded-t-sheet bg-canvas text-ink">
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-6 text-center">
              <span className="animate-fade-up grid h-16 w-16 place-items-center rounded-full bg-good-soft text-good">
                <Check className="h-8 w-8" strokeWidth={2} />
              </span>
              <h2 className="mt-4 font-display text-title font-semibold">Logged to {mealLabel(logged.meal)}</h2>
              <p className="mt-1 text-body text-ink-2">
                {logged.name} · <span className="font-semibold tabular-nums text-ink">{logged.kcal.toLocaleString('en-IN')} kcal</span>
              </p>
              {logged.dayKcal !== null && logged.dayTarget ? (
                <div className="mt-6 w-full max-w-xs rounded-card-lg border border-hairline bg-surface px-4 py-4 text-left shadow-air">
                  <p className="flex items-baseline justify-between text-caption text-ink-2">
                    <span>Today</span>
                    <span className="tabular-nums">
                      <span className="text-body font-semibold tabular-nums text-ink">{logged.dayKcal.toLocaleString('en-IN')}</span> / {logged.dayTarget.toLocaleString('en-IN')} kcal
                    </span>
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                    <div className="h-full rounded-full bg-cta-grad" style={{ width: `${Math.min(100, Math.round((logged.dayKcal / logged.dayTarget) * 100))}%` }} />
                  </div>
                  <p className="mt-2 text-caption">
                    {logged.dayKcal > logged.dayTarget
                      ? <span className="font-semibold tabular-nums text-brand-text">{(logged.dayKcal - logged.dayTarget).toLocaleString('en-IN')} over</span>
                      : <span className="font-semibold tabular-nums text-good">{(logged.dayTarget - logged.dayKcal).toLocaleString('en-IN')} left</span>}
                    <span className="text-ink-3"> for the day</span>
                  </p>
                </div>
              ) : null}
            </div>
            <div className="shrink-0 px-5 pt-3" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
              <Button onClick={onClose} size="lg" className="w-full">Done</Button>
              <Button onClick={retake} variant="subtle" className="mt-1 w-full">Scan another</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
