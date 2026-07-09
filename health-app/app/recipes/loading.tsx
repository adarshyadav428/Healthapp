export default function RecipesLoading() {
  return (
    <div className="min-h-screen bg-canvas pb-24">
      <div className="h-14 bg-canvas/80 border-b border-hairline animate-shimmer" />
      <div className="mx-auto w-full max-w-md px-4 py-6 space-y-4">
        {/* Title */}
        <div className="h-7 w-40 rounded-control bg-surface-2 animate-shimmer" />
        <div className="h-4 w-56 rounded-lg bg-surface-2 animate-shimmer" />

        {/* Search bar */}
        <div className="h-12 w-full rounded-card bg-surface border border-hairline animate-shimmer" />

        {/* Ingredient rows */}
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-card bg-surface border border-hairline p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-control bg-surface-2 animate-shimmer flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded-lg bg-surface-2 animate-shimmer" />
              <div className="h-3 w-1/2 rounded-lg bg-surface-2 animate-shimmer" />
            </div>
          </div>
        ))}

        {/* Nutrition summary card */}
        <div className="rounded-sheet bg-surface border border-hairline p-4 space-y-3 animate-shimmer">
          <div className="h-5 w-32 rounded-lg bg-surface-2" />
          <div className="grid grid-cols-4 gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 rounded-card bg-surface-2" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
