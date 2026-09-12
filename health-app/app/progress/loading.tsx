export default function ProgressLoading() {
  return (
    <div className="min-h-screen">
      <main
        className="mx-auto w-full max-w-md px-3 lg:max-w-5xl lg:px-6"
        style={{
          paddingTop: 'calc(12px + env(safe-area-inset-top))',
          paddingBottom: 'calc(var(--tab-bar-h, 72px) + 40px + env(safe-area-inset-bottom))',
        }}
      >
        <div className="rounded-sheet border-2 border-hairline-2 px-3 pb-6 pt-3 lg:px-8 lg:pb-8 lg:pt-6">
          {/* Per-page header: small label over title */}
          <div className="space-y-2 pt-2">
            <div className="h-4 w-24 animate-shimmer rounded bg-surface-2" />
            <div className="h-7 w-32 animate-shimmer rounded-lg bg-surface-2" />
          </div>

          <div className="lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-16">
            <div className="mt-6">
              {/* Weight hero numeral + bar + chart */}
              <div className="h-4 w-28 animate-shimmer rounded bg-surface-2" />
              <div className="mt-2 h-16 w-44 animate-shimmer rounded-lg bg-surface-2" />
              <div className="mt-4 h-1.5 w-full animate-shimmer rounded-full bg-surface-2" />
              <div className="mt-6 h-52 w-full animate-shimmer rounded-card bg-surface-2" />
              {/* Energy balance */}
              <div className="mt-10 h-6 w-40 animate-shimmer rounded bg-surface-2" />
              <div className="mt-4 h-44 w-full animate-shimmer rounded-card bg-surface-2" />
            </div>
            <div className="mt-10 lg:mt-6">
              {/* Calories chart */}
              <div className="h-6 w-32 animate-shimmer rounded bg-surface-2" />
              <div className="mt-4 h-44 w-full animate-shimmer rounded-card bg-surface-2" />
              {/* Calendar */}
              <div className="mt-10 h-6 w-36 animate-shimmer rounded bg-surface-2" />
              <div className="mt-4 h-52 w-full animate-shimmer rounded-card bg-surface-2" />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
