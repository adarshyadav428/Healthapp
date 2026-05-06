export default function OnboardingLoading() {
  return (
    <div className="min-h-screen bg-[#fff7ed] flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo placeholder */}
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="h-10 w-10 rounded-2xl bg-orange-200 animate-shimmer" />
          <div className="h-6 w-24 rounded-lg bg-orange-100 animate-shimmer" />
        </div>

        {/* Progress bar */}
        <div className="h-2 w-full rounded-full bg-orange-100 animate-shimmer" />

        {/* Card */}
        <div className="rounded-3xl border border-orange-100 bg-white/90 p-7 shadow-sm space-y-4">
          <div className="h-6 w-48 rounded-xl bg-orange-100 animate-shimmer" />
          <div className="h-4 w-full rounded-lg bg-gray-100 animate-shimmer" />
          <div className="h-4 w-3/4 rounded-lg bg-gray-100 animate-shimmer" />
          <div className="h-12 w-full rounded-2xl bg-orange-50 animate-shimmer mt-4" />
          <div className="h-12 w-full rounded-2xl bg-orange-50 animate-shimmer" />
          <div className="h-12 w-full rounded-2xl bg-orange-600/30 animate-shimmer mt-2" />
        </div>
      </div>
    </div>
  )
}
