/**
 * The one picture the whole feature rests on:
 *
 *   [████████████████░░░░░]
 *    eaten            gap      ← the gap IS the fat loss
 *   └──── maintenance ────┘
 *
 * Shows the mechanism rather than asserting it. A user who sees the gap once
 * does not need "deficit" defined again.
 *
 * The bar scales to whichever is larger, maintenance or eaten, so an over-
 * maintenance day grows past the marker instead of silently pinning at 100%.
 */
export function EnergyBar({
  maintenance,
  eaten,
  label,
}: {
  maintenance: number
  eaten: number
  /** Optional caption under the bar, e.g. "Daily average this week". */
  label?: string
}) {
  const scale = Math.max(maintenance, eaten, 1)
  const eatenPct = (eaten / scale) * 100
  const maintPct = (maintenance / scale) * 100
  const gap = Math.round(maintenance - eaten)
  const under = gap >= 0

  return (
    <div>
      <div
        className="relative h-8 w-full overflow-hidden rounded-control bg-track"
        role="img"
        aria-label={`Ate ${Math.round(eaten).toLocaleString('en-IN')} kcal of ${Math.round(maintenance).toLocaleString('en-IN')} kcal maintenance — ${Math.abs(gap).toLocaleString('en-IN')} kcal ${under ? 'below' : 'above'}`}
      >
        {/* The gap — painted first so the eaten fill sits on top of it. */}
        {under && (
          <div
            className="absolute inset-y-0 left-0 rounded-control"
            style={{
              width: `${maintPct}%`,
              background: 'color-mix(in srgb, var(--good) 18%, transparent)',
            }}
          />
        )}
        {/* What was actually eaten. */}
        <div
          className="absolute inset-y-0 left-0 rounded-control transition-all duration-700"
          style={{
            width: `${eatenPct}%`,
            background: under ? 'var(--brand)' : 'var(--bad)',
          }}
        />
        {/* Maintenance marker — only meaningful once something overshoots it. */}
        {!under && (
          <div
            className="absolute inset-y-0 w-0.5"
            style={{ left: `${maintPct}%`, background: 'var(--ink)' }}
          />
        )}
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <p className="text-[11px] text-ink-2">
          Ate <span className="font-semibold tabular-nums text-ink">{Math.round(eaten).toLocaleString('en-IN')}</span>
          {' '}of{' '}
          <span className="font-semibold tabular-nums text-ink">{Math.round(maintenance).toLocaleString('en-IN')}</span> kcal
        </p>
        <p
          className="text-[11px] font-bold tabular-nums"
          style={{ color: under ? 'var(--good)' : 'var(--bad)' }}
        >
          {Math.abs(gap).toLocaleString('en-IN')} kcal {under ? 'below' : 'above'}
        </p>
      </div>
      {label && <p className="mt-1 text-[10.5px] text-ink-3">{label}</p>}
    </div>
  )
}
