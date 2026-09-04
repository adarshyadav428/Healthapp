'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '../../lib/utils'
import { useBackDismiss } from './use-back-dismiss'

/** Drag past this and the sheet dismisses; short of it, it springs back. */
const DISMISS_PX = 88

/**
 * Bottom sheet — an app-native modal that springs up from the bottom edge,
 * built on Radix Dialog so focus-trapping and dismiss behaviour come for free.
 * Prefer this over Dialog for anything the user acts on from a mobile screen.
 */
const Sheet = DialogPrimitive.Root
const SheetTrigger = DialogPrimitive.Trigger
const SheetClose = DialogPrimitive.Close
const SheetPortal = DialogPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-scrim backdrop-blur-md data-[state=open]:animate-[overlayShow_250ms_ease]',
      className
    )}
    {...props}
  />
))
SheetOverlay.displayName = 'SheetOverlay'

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { title?: string }
>(({ className, children, title, style, ...props }, ref) => {
  // Radix owns the open state, so the only sanctioned way to close from inside
  // is to trigger its own Close. A hidden one, clicked programmatically, keeps
  // the swipe and the Back button on exactly the same path as the ✕ — including
  // `onOpenChange` and the exit animation.
  const closeRef = React.useRef<HTMLButtonElement>(null)
  const close = React.useCallback(() => closeRef.current?.click(), [])

  // Mounted only while open (Radix unmounts Content on close), so the overlay
  // is "open" for exactly as long as this component exists.
  useBackDismiss(true, close)

  const dragStartY = React.useRef<number | null>(null)
  const [dragY, setDragY] = React.useState(0)

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStartY.current = e.clientY
    // Capture keeps the move/up events coming to the grabber once the finger
    // has slid off it, which it will — the whole gesture is downward. Guarded
    // because it throws if the pointer is already gone, and an exception here
    // would take the whole drag with it.
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* no capture; the drag still works while the finger stays on the strip */
    }
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null) return
    // Downward only. Dragging a bottom sheet *up* past its own top edge would
    // expose the page behind it through the gap.
    setDragY(Math.max(0, e.clientY - dragStartY.current))
  }
  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null) return
    const travelled = Math.max(0, e.clientY - dragStartY.current)
    dragStartY.current = null
    if (travelled > DISMISS_PX) {
      // Deliberately leaving `dragY` where it is: CSS animations outrank inline
      // styles in the cascade, so `sheetDown` carries on from the dragged
      // position instead of snapping back up first.
      close()
      return
    }
    setDragY(0)
  }

  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          // `bottom`, not `transform`: sheetUp/sheetDown animate translateY, so an
          // offset here composes with the entrance instead of fighting it. The
          // transition matters because iOS fires visualViewport `resize` only once
          // the keyboard animation has finished — without it the sheet snaps late.
          'fixed inset-x-0 bottom-[var(--kb-inset,0px)] z-50 mx-auto w-full max-w-lg rounded-t-sheet border-t border-hairline bg-surface px-5 pb-[calc(env(safe-area-inset-bottom,8px)+20px)] pt-3 shadow-float transition-[bottom,transform] duration-200 ease-out',
          'data-[state=open]:animate-[sheetUp_450ms_cubic-bezier(.32,.72,0,1)] data-[state=closed]:animate-[sheetDown_250ms_ease-in]',
          // Follow the finger exactly while dragging; only the spring-back and
          // the keyboard lift are animated.
          dragY > 0 && 'transition-none',
          className
        )}
        {...props}
        style={dragY > 0 ? { ...style, transform: `translateY(${dragY}px)` } : style}
      >
        <DialogPrimitive.Close ref={closeRef} className="sr-only" tabIndex={-1} aria-hidden="true" />
        {/* A11y: Radix requires an accessible name. Sheets with a visible
            SheetTitle supply their own; those without pass `title` for a
            screen-reader-only one (silences the DialogContent warning). */}
        {title ? (
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
        ) : null}
        {/* Grabber. The drag lives here rather than on the whole sheet on
            purpose: a sheet-wide handler has to guess whether a downward swipe
            means "dismiss" or "scroll the list I started on", and it guesses
            wrong often enough to feel broken. A grabber has one job, so it is
            given a full-width 28px strip to be grabbed by — `touch-none`
            because the browser must not also try to scroll during the drag. */}
        <div
          className="-mt-1 mb-3 flex h-7 w-full cursor-grab touch-none items-center justify-center active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          aria-hidden="true"
        >
          <div className="h-1 w-9 rounded-full bg-hairline" />
        </div>
        {children}
      </DialogPrimitive.Content>
    </SheetPortal>
  )
})
SheetContent.displayName = 'SheetContent'

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('mb-4 space-y-1', className)} {...props} />
)

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('font-display text-xl font-bold tracking-tight text-ink', className)} {...props} />
))
SheetTitle.displayName = 'SheetTitle'

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn('text-sm text-ink-2', className)} {...props} />
))
SheetDescription.displayName = 'SheetDescription'

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
}
