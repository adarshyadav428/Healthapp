export default function LogLoading() {
  return (
    <div className="min-h-screen bg-background pb-24 dark:bg-slate-950">
      <div className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-900/80">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
          <div className="h-6 w-24 rounded-lg bg-gray-200 animate-shimmer dark:bg-slate-700" />
          <div className="h-8 w-8 rounded-full bg-gray-200 animate-shimmer dark:bg-slate-700" />
        </div>
      </div>

      <main className="mx-auto w-full max-w-md px-4 py-6 space-y-5">
        {/* Title */}
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-7 w-28 rounded-lg bg-gray-200 animate-shimmer dark:bg-slate-700" />
            <div className="h-4 w-48 rounded bg-gray-200 animate-shimmer dark:bg-slate-700" />
          </div>
          <div className="h-9 w-28 rounded-2xl bg-gray-200 animate-shimmer dark:bg-slate-700" />
        </div>

        {/* Search bar */}
        <div className="h-12 w-full rounded-2xl bg-gray-200 animate-shimmer dark:bg-slate-700" />

        {/* Copy yesterday banner */}
        <div className="h-16 w-full rounded-xl bg-blue-50 animate-shimmer dark:bg-slate-800" />

        {/* Frequent foods */}
        <div className="space-y-2">
          <div className="h-4 w-20 rounded bg-gray-200 animate-shimmer dark:bg-slate-700" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 w-full rounded-xl bg-gray-100 animate-shimmer dark:bg-slate-800" />
          ))}
        </div>

        {/* Recent foods */}
        <div className="space-y-2">
          <div className="h-4 w-16 rounded bg-gray-200 animate-shimmer dark:bg-slate-700" />
          {[1, 2].map((i) => (
            <div key={i} className="h-16 w-full rounded-xl bg-gray-100 animate-shimmer dark:bg-slate-800" />
          ))}
        </div>
      </main>
    </div>
  )
}
