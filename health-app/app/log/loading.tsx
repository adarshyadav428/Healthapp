export default function LogLoading() {
  const row = (i: number) => (
    <div key={i} className="flex items-center gap-3 py-2.5">
      <div className="h-11 w-11 rounded-control bg-surface-2 animate-shimmer" />
      <div className="flex-1">
        <div className="h-4 w-2/5 rounded-full bg-surface-2 animate-shimmer" />
        <div className="mt-2 h-3 w-1/4 rounded-full bg-surface-2 animate-shimmer" />
      </div>
      <div className="h-11 w-11 rounded-full bg-surface-2 animate-shimmer" />
    </div>
  )
  return (
    <div className="min-h-screen bg-canvas">
      <main
        className="mx-auto w-full max-w-md px-6 lg:max-w-5xl lg:px-10"
        style={{
          paddingTop: 'calc(20px + env(safe-area-inset-top))',
          paddingBottom: 'calc(var(--tab-bar-h, 72px) + 48px + env(safe-area-inset-bottom))',
        }}
      >
        {/* Header */}
        <div className="flex items-end justify-between pt-2">
          <div>
            <div className="h-4 w-28 rounded-full bg-surface-2 animate-shimmer" />
            <div className="mt-2 h-7 w-20 rounded-full bg-surface-2 animate-shimmer" />
          </div>
          <div className="flex gap-1">
            <div className="h-11 w-11 rounded-full bg-surface-2 animate-shimmer" />
            <div className="h-11 w-11 rounded-full bg-surface-2 animate-shimmer" />
          </div>
        </div>

        <div className="lg:grid lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] lg:items-start lg:gap-16">
          <div className="mt-5">
            {/* Search */}
            <div className="h-12 w-full rounded-full bg-surface-2 animate-shimmer" />
            {/* Shelves */}
            <div className="mt-4 h-11 w-full rounded-control bg-surface-2 animate-shimmer" />
            <div className="mt-2 divide-y divide-hairline">{[1, 2, 3, 4].map(row)}</div>
          </div>
          <div className="mt-10 lg:mt-5">
            <div className="h-6 w-28 rounded-full bg-surface-2 animate-shimmer" />
            <div className="mt-4 divide-y divide-hairline">{[1, 2].map(row)}</div>
          </div>
        </div>
      </main>
    </div>
  )
}
