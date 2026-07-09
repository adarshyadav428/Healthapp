export default function RecipesLoading() {
  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="h-14 bg-background/80 border-b border-border animate-shimmer" />
      <div className="mx-auto w-full max-w-md px-4 py-6 space-y-4">
        {/* Title */}
        <div className="h-7 w-40 rounded-xl bg-gray-200 animate-shimmer" />
        <div className="h-4 w-56 rounded-lg bg-gray-100 animate-shimmer" />

        {/* Search bar */}
        <div className="h-12 w-full rounded-2xl bg-card border border-border animate-shimmer" />

        {/* Ingredient rows */}
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl bg-card border border-border p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gray-100 animate-shimmer flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded-lg bg-gray-100 animate-shimmer" />
              <div className="h-3 w-1/2 rounded-lg bg-gray-100 animate-shimmer" />
            </div>
          </div>
        ))}

        {/* Nutrition summary card */}
        <div className="rounded-3xl bg-card border border-border p-4 space-y-3 animate-shimmer">
          <div className="h-5 w-32 rounded-lg bg-gray-100" />
          <div className="grid grid-cols-4 gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 rounded-2xl bg-gray-100" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
