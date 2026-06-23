import Link from 'next/link'
import { Utensils } from 'lucide-react'

export function EmptyMeals() {
  return (
    <div
      className="flex flex-col items-center text-center px-6 py-10 rounded-[20px] bg-white"
      style={{ border: '1px solid #F1EFE9', boxShadow: '0 2px 14px rgba(20,24,29,.05)' }}
    >
      <div
        className="flex items-center justify-center mb-4"
        style={{
          width: 60, height: 60, borderRadius: 18,
          background: '#FFF0E7',
        }}
      >
        <Utensils className="h-6 w-6" style={{ color: '#FB7445' }} strokeWidth={1.8} />
      </div>
      <p className="text-[17px] font-bold text-ink">Nothing logged yet</p>
      <p className="text-[13.5px] font-medium text-secondary mt-1.5 max-w-[240px] leading-snug">
        Start with breakfast — a couple of idli, a bowl of poha, whatever you&apos;re having.
      </p>
      <Link
        href="/log"
        className="mt-5 inline-block rounded-[14px] px-[22px] py-[13px] text-[14px] font-semibold text-white tap-scale"
        style={{
          background: '#FB7445',
          boxShadow: '0 6px 16px -6px #FB7445',
        }}
      >
        Log your first meal
      </Link>
    </div>
  )
}
