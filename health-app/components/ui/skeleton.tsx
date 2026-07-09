import * as React from 'react'
import { cn } from '../../lib/utils'

/** Loading placeholder. Premium apps show skeletons, never spinners. */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-shimmer rounded-control bg-surface-2', className)}
      {...props}
    />
  )
}

export { Skeleton }
