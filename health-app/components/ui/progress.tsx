import * as React from 'react'
import * as ProgressPrimitive from '@radix-ui/react-progress'
import { cn } from '../../lib/utils'

type ProgressProps = React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
  indicatorClassName?: string
}

const Progress = React.forwardRef<React.ElementRef<typeof ProgressPrimitive.Root>, ProgressProps>(
  ({ className, value, indicatorClassName, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn('relative h-2 w-full overflow-hidden rounded-full bg-surface-2', className)}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn('h-full w-full origin-left rounded-full bg-energy transition-transform duration-500 ease-spring', indicatorClassName)}
      style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
    />
  </ProgressPrimitive.Root>
  )
)
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
