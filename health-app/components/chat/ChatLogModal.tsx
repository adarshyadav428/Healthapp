'use client'

import { useLayoutEffect, useRef } from 'react'
import { X, Send, Loader2, RotateCcw, CheckCircle, CornerDownLeft, MessageSquarePlus, Minus, Plus } from 'lucide-react'
import { Sheet, SheetContent } from '../ui/sheet'
import { Button } from '../ui/button'
import { useChatLog, type Meal } from '../../hooks/useChatLog'
import { aiScansLeftLabel } from '../../lib/aiTrial'

const MEAL_OPTIONS: { value: Meal; label: string }[] = [
  { value: 'breakfast', label: '🌅 Breakfast' },
  { value: 'lunch', label: '🍱 Lunch' },
  { value: 'dinner', label: '🌙 Dinner' },
  { value: 'snack', label: '🍎 Snack' },
]

const EXAMPLES = [
  '4 medium roti, aloo beans sabzi, 1 katori dal, 3 katori chawal',
  '2 paratha with curd and achar',
  'Poha with chai for breakfast',
]

function round1(n: number) { return Math.round(n * 10) / 10 }

/** Roughly four lines at `text-base`; past this the textarea scrolls itself. */
const INPUT_MAX_H = 120

export function ChatLogModal({
  onClose,
  logDate,
  context,
}: {
  onClose: () => void
  logDate?: string
  /** `'onboarding'` keeps a gated AI scan in the wizard — see useChatLog. */
  context?: 'standalone' | 'onboarding'
}) {
  const {
    state, setState, input, setInput, scansLeft,
    handleSend, updateGrams, updateCount, removeItem, handleLog,
    totalKcal, coaching,
  } = useChatLog({ onClose, logDate, context })
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Grow the input with its content instead of reserving two lines up front,
  // and collapse it again when `handleSend` clears the value.
  //
  // The border width has to be added back: Tailwind sets `box-sizing:
  // border-box`, so `height` includes the border, while `scrollHeight` does
  // not. Assigning one to the other leaves the box exactly `border-top +
  // border-bottom` short of its own text — 2px here, enough to shave the
  // descenders off the last line and to leave the field permanently, subtly
  // scrollable.
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    const cs = getComputedStyle(el)
    const border = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth)
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight + border, INPUT_MAX_H)}px`
  }, [input])

  const canSend = input.trim().length > 0

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      {/* `px-0` rather than `p-0`: tailwind-merge would let `p-0` strip the
          sheet's own safe-area `pb-`, which is what left the input row sitting
          under the keyboard.

          A fixed `h-` rather than a `max-h`, deliberately: this is a
          conversation, and a sheet that is 40% tall when idle and 90% tall
          after a scan reads as a box being resized by its contents rather than
          as a screen. Chat surfaces are stable — the input sits at the bottom
          and the transcript grows into the space above it. The keyboard inset
          is subtracted so the sheet *shrinks* as sheet.tsx lifts it, instead of
          pushing its own header off the top of the screen. */}
      <SheetContent
        title="Log a meal with AI"
        className="sm:max-w-lg flex flex-col h-[calc(80vh-var(--kb-inset,0px))] px-0"
      >

        {/* Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-hairline px-5 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-control bg-brand-soft">
              <MessageSquarePlus className="h-[18px] w-[18px] text-brand" strokeWidth={2.2} />
            </span>
            <h2 className="font-display text-lg font-bold tracking-tight text-ink">Log with AI</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="tap-scale -mr-1.5 flex h-11 w-11 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-surface-2"
          >
            <X className="h-5 w-5" strokeWidth={2.2} />
          </button>
        </div>

        {/* Content — `min-h-0` is load-bearing: a flex child defaults to
            `min-height: auto`, so without it a long conversation refuses to
            shrink and pushes the input row out of the sheet entirely. */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 space-y-4">

          {/* User message bubble */}
          {'message' in state && (
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-card rounded-tr-sm bg-brand px-4 py-2.5 text-body leading-snug text-white">
                {(state as { message: string }).message}
              </div>
            </div>
          )}

          {/* Analyzing state */}
          {state.type === 'analyzing' && (
            <div className="flex items-center gap-2.5 text-body text-ink-2">
              <Loader2 className="h-4 w-4 animate-spin text-brand" />
              <span>Analysing your meal...</span>
            </div>
          )}

          {/* Confirm state */}
          {(state.type === 'confirm' || state.type === 'logging') && (
            <div className="space-y-3">
              {/* Meal selector */}
              <div className="flex gap-2 flex-wrap">
                {MEAL_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => state.type === 'confirm' && setState({ ...state, meal: opt.value })}
                    className={`tap-scale rounded-control border px-3 py-2 text-caption font-semibold transition-colors ${
                      state.meal === opt.value
                        ? 'border-brand bg-brand-soft text-brand-ink'
                        : 'border-hairline bg-surface-2 text-ink-2'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* How the AI read the message — shown whenever it inferred or
                  corrected something, e.g. folding "6 chicken pieces" back
                  into a stated total instead of double-counting it. */}
              {state.type === 'confirm' && state.assumptions && (
                <div className="rounded-card border border-hairline bg-surface-2 p-3">
                  <p className="text-caption font-semibold text-ink">How I read this</p>
                  <p className="mt-0.5 text-caption leading-relaxed text-ink-2">{state.assumptions}</p>
                </div>
              )}

              {/* Item list */}
              <div className="space-y-2">
                {state.type === 'confirm' && state.items.map((item, idx) => {
                  const itemKcal = Math.round(item.food.kcal_per_100g * item.grams / 100)
                  return (
                    <div key={idx} className="rounded-card border border-hairline bg-surface-2 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-body font-semibold text-ink truncate">{item.food.name}</p>
                          <p className="mt-0.5 text-caption text-ink-2">
                            {item.portion_desc}
                            {item.confidence === 'low' && (
                              <span className="ml-1.5 inline-block align-middle rounded-full border border-hairline px-1.5 py-0.5 text-[10px] font-semibold text-ink-2">
                                rough estimate
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-body font-bold text-brand-ink tabular-nums">{itemKcal} kcal</span>
                          <button
                            onClick={() => removeItem(idx)}
                            aria-label={`Remove ${item.food.name}`}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-hairline"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      {/* A naturally-countable item (chicken pieces, paneer cubes) gets a
                          pieces stepper instead of a gram slider — editing "6" to "8" reads
                          the way the user actually thinks about it. */}
                      {item.unit === 'pcs' && item.count != null ? (
                        <div className="mt-2.5 flex items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => updateCount(idx, Math.max(1, item.count! - 1))}
                              aria-label={`Fewer ${item.food.name}`}
                              className="flex h-7 w-7 items-center justify-center rounded-full border border-hairline text-ink transition-colors hover:bg-hairline"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-20 text-center text-body font-bold text-ink tabular-nums">{item.count} pieces</span>
                            <button
                              type="button"
                              onClick={() => updateCount(idx, item.count! + 1)}
                              aria-label={`More ${item.food.name}`}
                              className="flex h-7 w-7 items-center justify-center rounded-full border border-hairline text-ink transition-colors hover:bg-hairline"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <span className="text-caption text-ink-2 tabular-nums">{item.grams}g</span>
                        </div>
                      ) : (
                        <div className="mt-2.5 flex items-center gap-2.5">
                          <input
                            type="range"
                            min={10}
                            max={600}
                            step={5}
                            value={item.grams}
                            onChange={(e) => updateGrams(idx, Number(e.target.value))}
                            aria-label={`Grams of ${item.food.name}`}
                            className="flex-1 accent-brand"
                          />
                          <span className="text-caption font-bold text-ink w-12 text-right tabular-nums">{item.grams}g</span>
                        </div>
                      )}
                      <div className="mt-1.5 flex gap-3 text-caption text-ink-2 tabular-nums">
                        <span style={{ color: 'var(--protein)' }}>P {round1(item.food.protein_g_per_100g * item.grams / 100)}g</span>
                        <span style={{ color: 'var(--carbs)' }}>C {round1(item.food.carbs_g_per_100g * item.grams / 100)}g</span>
                        <span style={{ color: 'var(--fat)' }}>F {round1(item.food.fat_g_per_100g * item.grams / 100)}g</span>
                      </div>
                    </div>
                  )
                })}

                {state.type === 'logging' && (
                  <div className="flex items-center gap-2 py-2 text-body text-ink-2">
                    <Loader2 className="h-4 w-4 animate-spin text-brand" />
                    <span>Logging your meal...</span>
                  </div>
                )}
              </div>

              {/* Post-scan coaching line — makes the AI feel like a coach */}
              {state.type === 'confirm' && coaching && (
                <p className="mb-2 px-1 text-caption leading-relaxed text-ink-2">💡 {coaching}</p>
              )}
            </div>
          )}

          {/* Done state */}
          {state.type === 'done' && (
            <div className="space-y-3">
              <div className="rounded-card border border-hairline p-4 text-center" style={{ background: 'color-mix(in srgb, var(--good) 8%, transparent)' }}>
                <CheckCircle className="mx-auto mb-2 h-8 w-8 text-good" />
                <p className="text-body font-bold text-good">
                  Logged {state.logged} item{state.logged > 1 ? 's' : ''} · {state.kcal} kcal
                </p>
                <p className="mt-0.5 text-caption capitalize text-good opacity-80">Added to {state.meal}</p>
              </div>
              <Button variant="outline" size="lg" onClick={() => setState({ type: 'idle' })} className="w-full tap-scale">
                Log another meal
              </Button>
            </div>
          )}

          {/* Idle — the first thing anyone sees. It used to be a grey box of
              underlined links, which is why the sheet read as a web page: the
              examples are the primary action here, so they get card-sized tap
              targets and an "insert" affordance rather than link styling. */}
          {state.type === 'idle' && (
            /* `min-h-full` + `justify-center` centres the empty state in the
               sheet rather than stranding it at the top above a third of a
               screen of nothing — the sheet is a fixed height, so top-aligning
               a short empty state is what makes it look unfinished. Safe inside
               a scroll container because the height is a *minimum*: once the
               content is taller the box grows and `justify-center` stops
               applying, so it can never clip its own top. */
            <div className="flex min-h-full flex-col justify-center gap-5">
              <p className="px-1 text-body leading-relaxed text-ink-2">
                Tell me what you ate in your own words and I&rsquo;ll work out the calories.
              </p>

              <div className="space-y-2">
                <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                  Try saying
                </p>
                {EXAMPLES.map(ex => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setInput(ex)}
                    className="tap-scale flex w-full items-center gap-3 rounded-card border border-hairline bg-surface-2 px-4 py-3 text-left transition-colors hover:border-brand"
                  >
                    <span className="flex-1 text-body leading-snug text-ink">{ex}</span>
                    <CornerDownLeft className="h-4 w-4 shrink-0 text-ink-3" strokeWidth={2} aria-hidden="true" />
                  </button>
                ))}
              </div>

              {aiScansLeftLabel(scansLeft) && (
                <p className="px-1 text-caption text-ink-3 tabular-nums">{aiScansLeftLabel(scansLeft)}</p>
              )}
            </div>
          )}

          {state.type === 'done' && aiScansLeftLabel(scansLeft) && (
            <p className="px-1 pt-1 text-caption text-ink-3 tabular-nums">{aiScansLeftLabel(scansLeft)}</p>
          )}
        </div>

        {/* Total + actions — a `shrink-0` sibling of the scroller, never inside
            it. Same rule the camera's "Log food" row now follows: the button a
            surface exists for does not scroll away. With four detected items
            and a coaching line the transcript is taller than the sheet, and
            this used to be the last thing in it. */}
        {state.type === 'confirm' && (
          <div className="shrink-0 border-t border-hairline px-5 py-3">
            <div className="mb-2.5 flex items-center justify-between px-0.5">
              <span className="text-caption font-semibold text-energy-ink">Total</span>
              <span className="font-display text-lg font-bold text-ink tabular-nums">{totalKcal} kcal</span>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleLog} className="flex-1 gap-1.5 tap-scale">
                <CheckCircle className="h-4 w-4" />
                Log {state.items.length} item{state.items.length > 1 ? 's' : ''}
              </Button>
              <Button variant="outline" onClick={() => setState({ type: 'idle' })} className="gap-1.5 tap-scale">
                <RotateCcw className="h-3.5 w-3.5" />
                Redo
              </Button>
            </div>
          </div>
        )}

        {/* Input area. `items-end` so the send button stays pinned to the last
            line as the textarea grows. The disabled send is a neutral surface
            rather than a faded brand fill — 40% of a saturated ember reads as a
            broken button, not an inactive one. */}
        {(state.type === 'idle' || state.type === 'done') && (
          <div className="shrink-0 border-t border-hairline px-5 py-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                /* Kept short on purpose: the box is one line tall until it has
                   content to grow with, so a placeholder that wraps is a
                   placeholder that gets sliced in half. The examples above
                   carry the detail this used to try to. */
                placeholder="What did you eat?"
                rows={1}
                className="flex-1 resize-none rounded-control border border-hairline bg-surface-2 px-4 py-3 text-base leading-snug text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-brand focus:ring-[3px] focus:ring-brand-ring"
              />
              <button
                onClick={handleSend}
                disabled={!canSend}
                aria-label="Send"
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all ${
                  canSend
                    ? 'tap-scale bg-cta-grad text-white shadow-cta'
                    : 'bg-surface-2 text-ink-3'
                }`}
              >
                <Send className="h-[18px] w-[18px]" strokeWidth={2.2} />
              </button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
