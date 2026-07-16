export default function ProgressLoading() {
  return (
    <div className="min-h-screen">
      <main
        className="mx-auto w-full max-w-md px-6"
        style={{
          paddingTop: 'calc(20px + env(safe-area-inset-top))',
          paddingBottom: 'calc(120px + env(safe-area-inset-bottom))',
        }}
      >
        {/* Per-page header: small label over title */}
        <div className="pt-2 space-y-2">
          <div className="h-4 w-24 rounded bg-surface-2 animate-shimmer" />
          <div className="h-7 w-28 rounded-lg bg-surface-2 animate-shimmer" />
        </div>

        {/* Streak + calendar card */}
        <div className="mt-4 h-40 w-full rounded-[24px] bg-surface-2 animate-shimmer" />

        {/* Weight trend card */}
        <div className="mt-4 h-56 w-full rounded-[24px] bg-surface-2 animate-shimmer" />

        {/* Calorie / macro trend card */}
        <div className="mt-4 h-56 w-full rounded-[24px] bg-surface-2 animate-shimmer" />

        {/* Day diary rows */}
        <div className="mt-6 space-y-2.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 w-full rounded-[20px] bg-surface-2 animate-shimmer" />
          ))}
        </div>
      </main>
    </div>
  )
}
