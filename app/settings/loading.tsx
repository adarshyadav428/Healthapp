export default function SettingsLoading() {
  return (
    <div className="min-h-screen bg-[#fff7ed] pb-24">
      <div className="sticky top-0 z-40 border-b border-orange-100/60 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
          <div className="h-6 w-24 rounded-lg bg-gray-200 animate-shimmer" />
          <div className="h-8 w-8 rounded-full bg-gray-200 animate-shimmer" />
        </div>
      </div>

      <main className="mx-auto w-full max-w-md px-4 py-6 space-y-6">
        {/* Avatar + name */}
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="h-20 w-20 rounded-full bg-gray-200 animate-shimmer" />
          <div className="h-5 w-32 rounded-lg bg-gray-200 animate-shimmer" />
          <div className="h-4 w-40 rounded bg-gray-200 animate-shimmer" />
        </div>

        {/* Form sections */}
        {[1, 2, 3].map((section) => (
          <div key={section} className="rounded-3xl bg-white p-5 shadow-sm border border-gray-100 space-y-4">
            <div className="h-4 w-28 rounded bg-gray-200 animate-shimmer" />
            {[1, 2, 3].map((field) => (
              <div key={field} className="space-y-1.5">
                <div className="h-3 w-20 rounded bg-gray-200 animate-shimmer" />
                <div className="h-10 w-full rounded-xl bg-gray-100 animate-shimmer" />
              </div>
            ))}
          </div>
        ))}

        {/* Targets card */}
        <div className="rounded-3xl bg-white p-5 shadow-sm border border-gray-100">
          <div className="h-4 w-24 rounded bg-gray-200 animate-shimmer mb-4" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 rounded-2xl bg-gray-100 animate-shimmer" />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
