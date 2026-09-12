/**
 * Home's streaming placeholder. Mirrors the real layout — greeting, one hero
 * surface, the search pill, a short meal list — so the page settles into place
 * rather than swapping one composition for another.
 */
export default function DashboardLoading() {
  return (
    <div className="min-h-screen">
      <main
        className="relative mx-auto w-full max-w-md px-3 lg:max-w-5xl lg:px-6"
        style={{
          paddingTop: 'calc(12px + env(safe-area-inset-top))',
          paddingBottom: 'calc(var(--tab-bar-h, 72px) + 88px + env(safe-area-inset-bottom))',
        }}
      >
        {/* The page sits inside one frame, the same as Food — a still surface
            holding everything that moves. */}
        <div className="rounded-sheet border-2 border-hairline-2 px-3 pb-6 pt-3 lg:px-8 lg:pb-8 lg:pt-6">
        <div className="lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-16">
          <div>
            {/* Greeting */}
            <div className="flex items-start justify-between pt-2">
              <div className="space-y-2">
                <div className="h-4 w-36 rounded-full bg-surface-2 animate-shimmer" />
                <div className="h-7 w-52 rounded-lg bg-surface-2 animate-shimmer" />
              </div>
              <div className="mt-1 h-9 w-16 rounded-full bg-surface-2 animate-shimmer" />
            </div>

            {/* Calorie hero */}
            <div className="mt-5 flex justify-between gap-1.5">
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} className="h-14 flex-1 rounded-control bg-surface-2 animate-shimmer" />
              ))}
            </div>
            <div className="mt-6 rounded-card-lg border border-hairline bg-surface px-6 py-6 shadow-air">
              <div className="flex items-center gap-6">
                <div className="h-[132px] w-[132px] shrink-0 rounded-full bg-surface-2 animate-shimmer" />
                <div className="flex flex-1 flex-col gap-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-[34px] w-[34px] rounded-full bg-surface-2 animate-shimmer" />
                      <div className="h-4 w-24 rounded-full bg-surface-2 animate-shimmer" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-5 flex justify-between border-t border-hairline pt-4">
                <div className="h-3.5 w-24 rounded-full bg-surface-2 animate-shimmer" />
                <div className="h-3.5 w-28 rounded-full bg-surface-2 animate-shimmer" />
              </div>
            </div>

            {/* Search pill */}
            <div className="mt-6 h-12 w-full rounded-full bg-surface-2 animate-shimmer" />
          </div>

          <div className="mt-10 lg:mt-2">
            <div className="h-6 w-36 rounded-lg bg-surface-2 animate-shimmer" />
            <div className="mt-5 divide-y divide-hairline">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3.5 px-1 py-3">
                  <div className="h-11 w-11 shrink-0 rounded-full bg-surface-2 animate-shimmer" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-40 rounded-full bg-surface-2 animate-shimmer" />
                    <div className="h-3 w-24 rounded-full bg-surface-2 animate-shimmer" />
                  </div>
                  <div className="h-4 w-10 rounded-full bg-surface-2 animate-shimmer" />
                </div>
              ))}
            </div>
          </div>
        </div>
        </div>
      </main>
    </div>
  )
}
