export default function SettingsLoading() {
  return (
    <div className="min-h-screen bg-canvas pb-24">
      <div className="sticky top-0 z-40 border-b border-hairline bg-header-bg backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
          <div className="h-6 w-24 rounded-lg bg-surface-2 animate-shimmer" />
          <div className="h-8 w-8 rounded-full bg-surface-2 animate-shimmer" />
        </div>
      </div>

      <main className="mx-auto w-full max-w-md px-4 py-6 space-y-6">
        {/* Avatar + name */}
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="h-20 w-20 rounded-full bg-surface-2 animate-shimmer" />
          <div className="h-5 w-32 rounded-lg bg-surface-2 animate-shimmer" />
          <div className="h-4 w-40 rounded bg-surface-2 animate-shimmer" />
        </div>

        {/* Form sections */}
        {[1, 2, 3].map((section) => (
          <div key={section} className="rounded-sheet bg-surface p-5 shadow-rest border border-hairline space-y-4">
            <div className="h-4 w-28 rounded bg-surface-2 animate-shimmer" />
            {[1, 2, 3].map((field) => (
              <div key={field} className="space-y-1.5">
                <div className="h-3 w-20 rounded bg-surface-2 animate-shimmer" />
                <div className="h-10 w-full rounded-control bg-surface-2 animate-shimmer" />
              </div>
            ))}
          </div>
        ))}

        {/* Targets card */}
        <div className="rounded-sheet bg-surface p-5 shadow-rest border border-hairline">
          <div className="h-4 w-24 rounded bg-surface-2 animate-shimmer mb-4" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 rounded-card bg-surface-2 animate-shimmer" />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
