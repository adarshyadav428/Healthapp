export default function HistoryLoading() {
  return (
    <div className="min-h-screen bg-canvas pb-24">
      <div className="sticky top-0 z-40 border-b border-hairline/60 bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
          <div className="h-6 w-24 rounded-lg bg-surface-2 animate-shimmer" />
          <div className="h-8 w-8 rounded-full bg-surface-2 animate-shimmer" />
        </div>
      </div>

      <main className="mx-auto w-full max-w-md px-4 py-6 space-y-6">
        <div className="space-y-1.5">
          <div className="h-7 w-28 rounded-lg bg-surface-2 animate-shimmer" />
          <div className="h-4 w-40 rounded bg-surface-2 animate-shimmer" />
        </div>

        {/* Day range toggle */}
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 flex-1 rounded-control bg-surface-2 animate-shimmer" />
          ))}
        </div>

        {/* Metric tabs */}
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 flex-1 rounded-control bg-surface-2 animate-shimmer" />
          ))}
        </div>

        {/* Chart */}
        <div className="rounded-sheet bg-surface p-4 shadow-sm border border-hairline">
          <div className="h-4 w-32 rounded bg-surface-2 animate-shimmer mb-4" />
          <div className="h-48 w-full rounded-control bg-surface-2 animate-shimmer" />
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-card bg-surface p-4 shadow-sm border border-hairline h-20 animate-shimmer" />
          ))}
        </div>

        {/* Weekly rows */}
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 w-full rounded-card bg-surface shadow-sm border border-hairline animate-shimmer" />
          ))}
        </div>
      </main>
    </div>
  )
}
