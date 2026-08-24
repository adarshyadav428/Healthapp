import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-control font-semibold tap-scale transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Ember owns every action
        default: 'bg-cta-grad text-white shadow-cta hover:brightness-105',
        outline: 'border border-hairline bg-surface text-ink hover:bg-surface-2',
        ghost:   'bg-brand-soft text-brand-ink hover:brightness-95',
        subtle:  'bg-transparent text-ink hover:bg-surface-2',
        danger:  'bg-danger-soft text-danger hover:brightness-95',
      },
      // `default` and `lg` already clear the 44px minimum touch target on their
      // own. `sm` (36px) and `icon` (40px) do not — so they keep their drawn
      // size and grow an invisible pseudo-element out to 44px instead. Padding
      // the button itself would have made a "small" button not small, which is
      // the whole reason these variants exist; a hit area is not a look.
      size: {
        default: 'h-11 px-5 text-body',
        sm:      "h-9 px-3.5 text-body relative after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']",
        lg:      'h-12 px-6 text-body-lg',
        icon:    "h-10 w-10 relative after:absolute after:-inset-0.5 after:content-['']",
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
