import * as React from 'react'
import { cn } from '../../lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'flex h-11 w-full rounded-control border border-hairline bg-surface-2 px-3.5 py-2 text-base text-ink placeholder:text-ink-3 transition-[border-color,box-shadow] duration-150 focus:outline-none focus:border-brand focus:bg-surface focus:ring-[3px] focus:ring-brand-ring disabled:cursor-not-allowed disabled:opacity-40',
      className
    )}
    {...props}
  />
))
Input.displayName = 'Input'

export { Input }
