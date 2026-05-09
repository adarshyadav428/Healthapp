export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-background pb-24 dark:bg-slate-950">
      {/* Navbar skeleton */}
      <div className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-900/80">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
          <div className="h-6 w-24 rounded-lg bg-gray-200 animate-shimmer dark:bg-slate-700" />
          <div className="h-8 w-8 rounded-full bg-gray-200 animate-shimmer dark:bg-slate-700" />
        </div>
      </div>

      <main className="relative mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-6">
        {/* Greeting skeleton */}
        <div className="space-y-1.5">
          <div className="h-4 w-40 rounded bg-gray-200 animate-shimmer dark:bg-slate-700" />
          <div className="h-7 w-16 rounded-lg bg-gray-200 animate-shimmer dark:bg-slate-700" />
          <div className="h-3 w-32 rounded bg-gray-200 animate-shimmer dark:bg-slate-700" />
        </div>

        {/* Calorie ring skeleton */}
        <div className="rounded-3xl bg-card p-5 shadow-sm border border-border dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-5">
            <div className="h-28 w-28 rounded-full bg-gray-200 animate-shimmer flex-shrink-0 dark:bg-slate-700" />
            <div className="flex-1 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-1">
                  <div className="h-3 w-16 rounded bg-gray-200 animate-shimmer dark:bg-slate-700" />
                  <div className="h-2 w-full rounded-full bg-gray-200 animate-shimmer dark:bg-slate-700" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Streak + weight cards skeleton */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl bg-card p-4 shadow-sm border border-border h-24 animate-shimmer dark:border-slate-800 dark:bg-slate-900" />
          <div className="rounded-3xl bg-card p-4 shadow-sm border border-border h-24 animate-shimmer dark:border-slate-800 dark:bg-slate-900" />
        </div>

        {/* Insight card skeleton */}
        <div className="rounded-3xl bg-white p-4 shadow-sm border border-gray-100 h-16 animate-shimmer dark:border-slate-800 dark:bg-slate-900" />

        {/* Macros + water skeleton */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl bg-white p-4 shadow-sm border border-amber-100 h-36 animate-shimmer dark:border-amber-500/40 dark:bg-slate-900" />
          <div className="rounded-3xl bg-white p-4 shadow-sm border border-blue-100 h-36 animate-shimmer dark:border-blue-500/40 dark:bg-slate-900" />
        </div>

        {/* Exercise card skeleton */}
        <div className="rounded-3xl bg-white p-4 shadow-sm border border-emerald-100 h-24 animate-shimmer dark:border-emerald-500/40 dark:bg-slate-900" />

        {/* Meal sections skeleton */}
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100 h-20 animate-shimmer dark:border-slate-800 dark:bg-slate-900" />
          ))}
        </div>
      </main>

      {/* Bottom nav skeleton */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-100 bg-white/95 backdrop-blur-md safe-area-bottom dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex h-16 max-w-md items-center justify-around px-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="h-6 w-6 rounded bg-gray-200 animate-shimmer dark:bg-slate-700" />
              <div className="h-2 w-8 rounded bg-gray-200 animate-shimmer dark:bg-slate-700" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
