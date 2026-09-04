import { useEffect } from 'react'

/**
 * Locks background page scroll while a hand-rolled `fixed inset-0` overlay is
 * open.
 *
 * Radix-based sheets do NOT need this — `@radix-ui/react-dialog` ships
 * `react-remove-scroll` and already locks. This is for the overlays that aren't
 * dialogs: AddFoodModal, CameraModal, UnitPicker, LogMilestones, Story. Prefer
 * `SheetContent` for anything new (see the note at the top of sheet.tsx); reach
 * for this hook only where a Radix dialog is genuinely wrong for the surface.
 *
 * Three things it has to get right:
 *
 * 1. **Refcounted at module scope**, because these nest — UnitPicker opens on
 *    top of AddFoodModal — and a per-component lock would release the body the
 *    moment the inner overlay closed.
 *
 * 2. **`position: fixed` + `top: -scrollY`, not `overflow: hidden`.** iOS Safari
 *    happily rubber-bands and scroll-chains the document through an
 *    `overflow: hidden` body, which is how the page ends up somewhere else when
 *    a full-screen overlay closes.
 *
 * 3. **Defers when Radix already holds the lock.** `react-remove-scroll-bar`
 *    injects `body[data-scroll-locked] { position: relative !important }`,
 *    which beats a plain inline `position: fixed` — so when UnitPicker opens
 *    inside EditFoodLogModal's Radix sheet this lock would silently do nothing.
 *    The body is already locked in that case, so deferring is correct;
 *    escalating to `setProperty(..., 'important')` would just fight it.
 */

/** react-remove-scroll-bar's public lock marker (its `lockAttribute`). */
const RRS_LOCK_ATTR = 'data-scroll-locked'

let lockCount = 0
let savedScrollY = 0
let savedPaddingRight = ''
let deferredToRadix = false

function applyLock() {
  const body = document.body

  if (body.hasAttribute(RRS_LOCK_ATTR)) {
    deferredToRadix = true
    return
  }
  deferredToRadix = false

  savedScrollY = window.scrollY

  // Taking body out of flow collapses the document scrollbar; reserve its width
  // so desktop doesn't shift right. Self-zeroes when nested under Radix, which
  // has already removed the bar.
  const gap = window.innerWidth - document.documentElement.clientWidth
  savedPaddingRight = body.style.paddingRight
  if (gap > 0) body.style.paddingRight = `${gap}px`

  body.style.position = 'fixed'
  body.style.top = `${-savedScrollY}px`
  body.style.left = '0'
  body.style.width = '100%'
}

function releaseLock() {
  if (deferredToRadix) {
    deferredToRadix = false
    return
  }

  const body = document.body
  body.style.position = ''
  body.style.top = ''
  body.style.left = ''
  body.style.width = ''
  body.style.paddingRight = savedPaddingRight

  // Same task as the style reset, so there is no intermediate paint and no
  // visible jump. Nothing in the app sets `scroll-behavior: smooth`, so this
  // does not animate.
  window.scrollTo(0, savedScrollY)
}

/**
 * @param enabled gate for overlays whose component also renders when closed
 *   (LogMilestones, Story) — the hook still runs unconditionally, only its
 *   effect is gated, so it stays above any early return.
 */
export function useScrollLock(enabled = true) {
  useEffect(() => {
    if (!enabled) return

    lockCount += 1
    if (lockCount === 1) applyLock()

    return () => {
      lockCount -= 1
      if (lockCount === 0) releaseLock()
    }
  }, [enabled])
}
