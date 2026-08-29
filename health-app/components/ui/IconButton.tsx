import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

/**
 * A small icon-only action button whose tap target is larger than its icon.
 *
 * The row actions in the food and exercise logs were ~22px hit areas (a 14px
 * icon in `p-1`) — well under the 44px the growth-advice audit flags. These
 * rows sit inside `overflow-hidden` cards, so a pseudo-element that overflows
 * the row is clipped, and a true 44px target would need a row redesign. This
 * takes the box to 32px without a negative margin (which would overlap
 * adjacent buttons): the log rows are already taller than 32px, so row height
 * and layout are unchanged, and the target grows by half again.
 *
 * `label` is required — an icon-only control with no accessible name is a bug.
 */
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string }
>(({ className, label, children, type, ...props }, ref) => (
  <button
    ref={ref}
    type={type ?? 'button'}
    aria-label={label}
    className={cn(
      'grid h-8 w-8 place-items-center rounded-full tap-scale transition-colors',
      className,
    )}
    {...props}
  >
    {children}
  </button>
))

IconButton.displayName = 'IconButton'
