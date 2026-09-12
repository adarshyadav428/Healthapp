import * as React from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface SearchFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Shown as a trailing ✕ while there is a value. Omit to hide the control. */
  onClear?: () => void
  /**
   * Trailing controls inside the pill (scan, chat). Rendered after the clear
   * button; each should be a 44px target. The field pads itself to fit.
   */
  actions?: React.ReactNode
  /** Number of `actions` targets, so the input can reserve room for them. */
  actionCount?: number
}

const PR = ['pr-4', 'pr-12', 'pr-24', 'pr-36', 'pr-48'] as const

/**
 * The one search field. A filled pill with a leading glass and a 44px clear
 * target — `type="search"` so the keyboard offers "Search" and screen readers
 * announce the role, with the browser's own cancel button suppressed so the
 * clear control looks the same everywhere.
 *
 * Deliberately a plain `Input` variant rather than a widget: it owns no state,
 * no debounce and no results. The Food screen's `FoodSearch` is its first
 * consumer and passes scan + chat in `actions`.
 */
const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(
  ({ className, onClear, actions, actionCount = 0, value, ...props }, ref) => {
    const showClear = Boolean(onClear) && typeof value === 'string' && value.length > 0
    const trailing = Math.min(actionCount + (showClear ? 1 : 0), PR.length - 1)
    return (
      <div className={cn('relative flex items-center', className)}>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-4 h-5 w-5 text-ink-3"
          strokeWidth={1.75}
        />
        <input
          ref={ref}
          type="search"
          value={value}
          className={cn(
            'h-12 w-full appearance-none rounded-full border border-hairline bg-surface-2 pl-12 text-base text-ink placeholder:text-ink-3 transition-[border-color,box-shadow,background-color] duration-150',
            'focus:border-brand focus:bg-surface focus:outline-none focus:ring-[3px] focus:ring-brand-ring',
            'disabled:cursor-not-allowed disabled:opacity-40',
            '[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden',
            PR[trailing]
          )}
          {...props}
        />
        {(showClear || actions) && (
          <div className="absolute right-1 flex items-center">
            {showClear && (
              <button
                type="button"
                onClick={onClear}
                aria-label="Clear search"
                className="grid h-11 w-11 place-items-center rounded-full text-ink-2 tap-scale hover:text-ink"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            )}
            {actions}
          </div>
        )}
      </div>
    )
  }
)
SearchField.displayName = 'SearchField'

export { SearchField }
