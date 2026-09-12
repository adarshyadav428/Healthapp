// Mirrors SettingsClient's composition so the page does not jump when the
// data lands: header, identity row, the plan frame, then grouped rows.
export default function SettingsLoading() {
  const Row = () => (
    <div className="flex h-14 items-center gap-3 px-4">
      <div className="h-5 w-5 rounded-full bg-surface-2 animate-shimmer" />
      <div className="h-4 w-32 rounded bg-surface-2 animate-shimmer" />
    </div>
  )
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
          <div className="pt-2">
            <div className="h-4 w-16 rounded bg-surface-2 animate-shimmer" />
            <div className="mt-2 h-7 w-28 rounded-lg bg-surface-2 animate-shimmer" />
          </div>

          <div className="lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start lg:gap-10">
            <div>
              <div className="mt-5 flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-surface-2 animate-shimmer" />
                <div className="flex-1">
                  <div className="h-5 w-32 rounded bg-surface-2 animate-shimmer" />
                  <div className="mt-2 h-4 w-44 rounded bg-surface-2 animate-shimmer" />
                </div>
              </div>
              <div className="mt-5 rounded-card-lg border-2 border-hairline-2 px-4 pb-4 pt-4">
                <div className="h-5 w-16 rounded bg-surface-2 animate-shimmer" />
                <div className="mt-5 h-9 w-36 rounded-lg bg-surface-2 animate-shimmer" />
                <div className="mt-4 h-4 w-52 rounded bg-surface-2 animate-shimmer" />
                <div className="mt-5 grid grid-cols-3 gap-3 border-t border-hairline pt-4">
                  {[1, 2, 3].map((i) => <div key={i} className="h-9 rounded bg-surface-2 animate-shimmer" />)}
                </div>
              </div>
            </div>

            <div className="mt-6 lg:mt-5">
              {[1, 2, 2, 2].map((rows, i) => (
                <div key={i} className={i === 0 ? '' : 'mt-5'}>
                  <div className="ml-1 h-4 w-24 rounded bg-surface-2 animate-shimmer" />
                  <div className="mt-2 divide-y divide-hairline rounded-card-lg border border-hairline bg-surface">
                    {Array.from({ length: rows }, (_, j) => <Row key={j} />)}
                  </div>
                </div>
              ))}
              <div className="mt-8 h-11 w-full rounded-control bg-surface-2 animate-shimmer" />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
