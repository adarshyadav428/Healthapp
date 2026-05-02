export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto w-full max-w-2xl rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">Terms of Service</h1>
        <p className="mt-4 text-sm text-gray-600">
          By using CalTrack, you agree to use the app responsibly. CalTrack provides nutrition guidance but is
          not a substitute for medical advice. Always consult a healthcare professional before starting a new
          diet or exercise plan.
        </p>
        <p className="mt-3 text-sm text-gray-600">
          Subscription billing is handled by Stripe. You can manage or cancel your subscription in Settings.
        </p>
        <p className="mt-6 text-xs text-gray-400">Last updated: May 1, 2026</p>
      </div>
    </div>
  )
}
