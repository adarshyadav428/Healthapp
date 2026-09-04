import * as React from 'react'
import { cn } from '../../lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'flex h-11 w-full rounded-control border border-hairline bg-surface px-3.5 py-2 text-base text-ink placeholder:text-ink-3 transition-colors focus:outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-ring',
      className
    )}
    {...props}
  />
))
Input.displayName = 'Input'

export { Input }
