import type { Metadata } from 'next'
import { StudioClient } from '../../components/studio/StudioClient'

// Design-review room: two complete visual directions rendered on real pixels,
// real fonts, real blur — so direction decisions happen on-device, not in the
// abstract. Static mock data only; safe to expose publicly; never indexed.
export const metadata: Metadata = {
  title: 'Design Studio — GetInShape',
  robots: { index: false, follow: false },
}

export default function StudioPage() {
  return <StudioClient />
}
