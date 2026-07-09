import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-control font-semibold tap-scale transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Peacock owns every action
        default: 'bg-brand text-white shadow-rest hover:brightness-110',
        outline: 'border border-hairline bg-surface text-ink hover:bg-surface-2',
        ghost:   'bg-brand-soft text-brand-ink hover:brightness-95',
        subtle:  'bg-transparent text-ink hover:bg-surface-2',
        danger:  'bg-danger-soft text-danger hover:brightness-95',
      },
      size: {
        default: 'h-11 px-5 text-sm',
        sm:      'h-9 px-3.5 text-sm',
        lg:      'h-12 px-6 text-base',
        icon:    'h-10 w-10',
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
