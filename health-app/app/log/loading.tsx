export default function LogLoading() {
  return (
    <div className="min-h-screen bg-canvas pb-24">
      <div className="sticky top-0 z-40 border-b border-hairline/60 bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
          <div className="h-6 w-24 rounded-lg bg-surface-2 animate-shimmer" />
          <div className="h-8 w-8 rounded-full bg-surface-2 animate-shimmer" />
        </div>
      </div>

      <main className="mx-auto w-full max-w-md px-4 py-6 space-y-5">
        {/* Title */}
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-7 w-28 rounded-lg bg-surface-2 animate-shimmer" />
            <div className="h-4 w-48 rounded bg-surface-2 animate-shimmer" />
          </div>
          <div className="h-9 w-28 rounded-card bg-surface-2 animate-shimmer" />
        </div>

        {/* Search bar */}
        <div className="h-12 w-full rounded-card bg-surface-2 animate-shimmer" />

        {/* Copy yesterday banner */}
        <div className="h-16 w-full rounded-control bg-brand-soft animate-shimmer" />

        {/* Frequent foods */}
        <div className="space-y-2">
          <div className="h-4 w-20 rounded bg-surface-2 animate-shimmer" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 w-full rounded-control bg-surface-2 animate-shimmer" />
          ))}
        </div>

        {/* Recent foods */}
        <div className="space-y-2">
          <div className="h-4 w-16 rounded bg-surface-2 animate-shimmer" />
          {[1, 2].map((i) => (
            <div key={i} className="h-16 w-full rounded-control bg-surface-2 animate-shimmer" />
          ))}
        </div>
      </main>
    </div>
  )
}
