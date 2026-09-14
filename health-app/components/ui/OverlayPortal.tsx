'use client'

import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

/**
 * Portals a hand-rolled `fixed inset-0` overlay straight to `document.body`.
 *
 * `position: fixed` escapes layout, but not stacking. Any ancestor that
 * creates a stacking context scopes the overlay's own z-index to compare
 * only against ITS siblings inside that subtree — a sibling elsewhere in the
 * tree with any explicit (non-auto) z-index then paints over the whole
 * subtree, no matter how high the overlay's own z-index reads. This is what
 * made AddFoodModal's "Add" button unreachable at desktop widths: it opens
 * from inside `app/log/page.tsx`'s `lg:sticky` search column, and
 * `position: sticky` unconditionally creates a stacking context (CSS
 * Positioned Layout Module Level 3) regardless of z-index. BottomNav's
 * `z-40` sits outside that column and painted above the modal's `z-50`
 * every time. Confirmed live via `elementsFromPoint`, and confirmed as the
 * fix by forcing the sticky ancestor to `position: static`.
 *
 * Portalling to body is the fix that holds for that ancestor and any future
 * one — it isn't specific to `lg:sticky`. Use for every hand-rolled overlay
 * `use-scroll-lock.ts` lists that can be mounted from inside a page's
 * layout (not just rendered at the top level): AddFoodModal, CameraModal,
 * UnitPicker. Radix-based sheets/dialogs already do this via their own
 * Portal and don't need it.
 */
export function OverlayPortal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body)
}
