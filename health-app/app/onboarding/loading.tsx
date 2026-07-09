export default function OnboardingLoading() {
  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo placeholder */}
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="h-10 w-10 rounded-card bg-surface-2 animate-shimmer" />
          <div className="h-6 w-24 rounded-lg bg-surface-2 animate-shimmer" />
        </div>

        {/* Progress bar */}
        <div className="h-2 w-full rounded-full bg-surface-2 animate-shimmer" />

        {/* Card */}
        <div className="rounded-sheet border border-hairline bg-surface p-7 shadow-sm space-y-4">
          <div className="h-6 w-48 rounded-control bg-surface-2 animate-shimmer" />
          <div className="h-4 w-full rounded-lg bg-surface-2 animate-shimmer" />
          <div className="h-4 w-3/4 rounded-lg bg-surface-2 animate-shimmer" />
          <div className="h-12 w-full rounded-card bg-surface-2 animate-shimmer mt-4" />
          <div className="h-12 w-full rounded-card bg-surface-2 animate-shimmer" />
          <div className="h-12 w-full rounded-card bg-surface-2 animate-shimmer mt-2" />
        </div>
      </div>
    </div>
  )
}
