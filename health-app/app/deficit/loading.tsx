export default function DeficitLoading() {
  return (
    <div className="min-h-screen">
      <main
        className="mx-auto w-full max-w-md px-6"
        style={{
          paddingTop: 'calc(20px + env(safe-area-inset-top))',
          paddingBottom: 'calc(120px + env(safe-area-inset-bottom))',
        }}
      >
        {/* PageHeader: label + title + back chevron */}
        <div className="pt-2 space-y-2">
          <div className="h-4 w-40 rounded bg-surface-2 animate-shimmer" />
          <div className="h-7 w-24 rounded-lg bg-surface-2 animate-shimmer" />
        </div>

        {/* Deficit summary card */}
        <div className="mt-5 h-36 w-full rounded-card bg-surface-2 animate-shimmer" />

        {/* Bar chart card */}
        <div className="mt-4 h-64 w-full rounded-card bg-surface-2 animate-shimmer" />

        {/* Totals card */}
        <div className="mt-4 h-24 w-full rounded-card bg-surface-2 animate-shimmer" />
      </main>
    </div>
  )
}
