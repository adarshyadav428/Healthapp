import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const buttonVariants = cva(
  // Press feedback is a transform, so it never shifts layout; `tap-scale`
  // carries the transition and the reduced-motion opt-out. The one focus ring
  // is keyboard-only (`focus-visible`) — a tap never draws it.
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-control font-semibold tap-scale transition-[color,background-color,border-color,filter] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      variant: {
        // Ember owns every action. The primary is the only filled ember on a
        // screen; everything else is ink on a quiet surface.
        default: 'bg-cta-grad text-white shadow-cta hover:brightness-105 active:brightness-95',
        outline: 'border border-hairline bg-surface text-ink hover:bg-surface-2 active:bg-surface-2',
        ghost:   'bg-brand-soft text-brand-ink hover:brightness-95 active:brightness-90',
        subtle:  'bg-transparent text-ink hover:bg-surface-2 active:bg-surface-2',
        danger:  'bg-danger-soft text-danger hover:brightness-95 active:brightness-90',
      },
      size: {
        default: 'h-11 px-5 text-body',
        sm:      'h-9 px-3.5 text-caption',
        lg:      'h-12 px-6 text-body-lg',
        // 44px — the touch minimum. A visually smaller glyph keeps its size;
        // the box is the target.
        icon:    'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
