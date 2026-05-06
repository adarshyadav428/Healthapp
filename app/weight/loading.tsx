export default function WeightLoading() {
  return (
    <div className="min-h-screen bg-[#fff7ed] pb-24 dark:bg-slate-950">
      <div className="sticky top-0 z-40 border-b border-orange-100/60 bg-white/80 backdrop-blur-md dark:border-slate-800/60 dark:bg-slate-900/80">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
          <div className="h-6 w-24 rounded-lg bg-gray-200 animate-shimmer dark:bg-slate-700" />
          <div className="h-8 w-8 rounded-full bg-gray-200 animate-shimmer dark:bg-slate-700" />
        </div>
      </div>

      <main className="mx-auto w-full max-w-md px-4 py-6 space-y-6">
        {/* Title + add button */}
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-7 w-24 rounded-lg bg-gray-200 animate-shimmer dark:bg-slate-700" />
            <div className="h-4 w-36 rounded bg-gray-200 animate-shimmer dark:bg-slate-700" />
          </div>
          <div className="h-10 w-32 rounded-2xl bg-gray-200 animate-shimmer dark:bg-slate-700" />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl bg-white p-3 shadow-sm border border-gray-100 h-20 animate-shimmer dark:border-slate-800 dark:bg-slate-900" />
          ))}
        </div>

        {/* Chart */}
        <div className="rounded-3xl bg-white p-4 shadow-sm border border-emerald-100 dark:border-emerald-500/40 dark:bg-slate-900">
          <div className="h-4 w-24 rounded bg-gray-200 animate-shimmer mb-4 dark:bg-slate-700" />
          <div className="h-52 w-full rounded-xl bg-gray-100 animate-shimmer dark:bg-slate-800" />
        </div>

        {/* Log entries */}
        <div className="space-y-2">
          <div className="h-4 w-20 rounded bg-gray-200 animate-shimmer dark:bg-slate-700" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 w-full rounded-2xl bg-white shadow-sm border border-gray-100 animate-shimmer dark:border-slate-800 dark:bg-slate-900" />
          ))}
        </div>
      </main>
    </div>
  )
}
