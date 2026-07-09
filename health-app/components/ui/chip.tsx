import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const chipVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-2 text-ink-2',
        brand:   'bg-brand-soft text-brand-ink',
        energy:  'bg-energy-soft text-energy-ink',
        good:    'bg-brand-soft text-good',
        danger:  'bg-danger-soft text-danger',
      },
      size: {
        sm: 'px-2.5 py-0.5 text-[11px]',
        md: 'px-3 py-1 text-xs',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'md' },
  }
)

export interface ChipProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof chipVariants> {}

/** Small status/label pill. Encodes state in color as well as text. */
function Chip({ className, tone, size, ...props }: ChipProps) {
  return <span className={cn(chipVariants({ tone, size, className }))} {...props} />
}

export { Chip, chipVariants }
