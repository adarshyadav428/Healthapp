export default function OnboardingLoading() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo placeholder */}
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="h-10 w-10 rounded-2xl bg-gray-200 animate-shimmer dark:bg-slate-700" />
          <div className="h-6 w-24 rounded-lg bg-gray-200 animate-shimmer dark:bg-slate-700" />
        </div>

        {/* Progress bar */}
        <div className="h-2 w-full rounded-full bg-gray-200 animate-shimmer dark:bg-slate-800" />

        {/* Card */}
        <div className="rounded-3xl border border-border bg-card p-7 shadow-sm space-y-4 dark:border-slate-800 dark:bg-slate-900/90">
          <div className="h-6 w-48 rounded-xl bg-gray-200 animate-shimmer dark:bg-slate-700" />
          <div className="h-4 w-full rounded-lg bg-gray-100 animate-shimmer dark:bg-slate-800" />
          <div className="h-4 w-3/4 rounded-lg bg-gray-100 animate-shimmer dark:bg-slate-800" />
          <div className="h-12 w-full rounded-2xl bg-gray-100 animate-shimmer mt-4 dark:bg-slate-800" />
          <div className="h-12 w-full rounded-2xl bg-gray-100 animate-shimmer dark:bg-slate-800" />
          <div className="h-12 w-full rounded-2xl bg-gray-200 animate-shimmer mt-2 dark:bg-slate-700" />
        </div>
      </div>
    </div>
  )
}
