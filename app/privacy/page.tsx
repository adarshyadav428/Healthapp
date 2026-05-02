export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto w-full max-w-2xl rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">Privacy Policy</h1>
        <p className="mt-4 text-sm text-gray-600">
          We collect only the information needed to run CalTrack: account details, food logs, and weight logs.
          Your data is stored securely in Supabase. We never sell your data and only share it with trusted
          providers required to operate the app (e.g., Stripe for billing).
        </p>
        <p className="mt-3 text-sm text-gray-600">
          You can request deletion of your account and data at any time from Settings.
        </p>
        <p className="mt-6 text-xs text-gray-400">Last updated: May 1, 2026</p>
      </div>
    </div>
  )
}
