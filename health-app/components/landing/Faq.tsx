import { Plus } from 'lucide-react'

/**
 * Native <details> rows — no JS, keyboard-operable out of the box, and the
 * open state survives a hydration miss. The plus turns into a cross when open.
 */
export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="divide-y divide-hairline border-y border-hairline">
      {items.map((f) => (
        <details key={f.q} className="group">
          <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 py-4 text-body font-medium text-ink [&::-webkit-details-marker]:hidden">
            {f.q}
            <Plus className="h-5 w-5 shrink-0 text-ink-3 transition-transform duration-200 ease-out group-open:rotate-45" strokeWidth={1.75} aria-hidden="true" />
          </summary>
          <p className="max-w-prose pb-5 text-body leading-relaxed text-ink-2">{f.a}</p>
        </details>
      ))}
    </div>
  )
}
