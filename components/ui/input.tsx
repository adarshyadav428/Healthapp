import * as React from 'react'
import { cn } from '../../lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'flex h-10 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30',
      className
    )}
    {...props}
  />
))
Input.displayName = 'Input'

export { Input }
