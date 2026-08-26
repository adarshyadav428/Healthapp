import type { Maintenance } from '../../lib/tdee'
import type { Profile } from '../../types/index'

const ACTIVITY_LABEL: Record<Profile['activity_level'], string> = {
  sedentary: 'Sedentary',
  light: 'Light',
  moderate: 'Moderate',
  active: 'Active',
  very_active: 'Very active',
}

/**
 * "Explain to him that his maintenance calorie is this" — shown as a derivation
 * rather than asserted as a figure.
 *
 * The two notes underneath are not hedging. The estimate caveat is why
 * `lib/adaptiveTarget.ts` exists at all, and the activity note is where the
 * decision that logged workouts do not add to the deficit gets explained
 * instead of quietly applied.
 */
export function MaintenanceBreakdown({
  maintenance,
  activityLevel,
}: {
  maintenance: Maintenance
  activityLevel: Profile['activity_level']
}) {
  const { bmr, multiplier, activityKcal, tdee } = maintenance
  const bmrPct = tdee > 0 ? (bmr / tdee) * 100 : 0

  return (
    <div className="rounded-sheet border border-hairline bg-surface p-4 shadow-rest">
      <p className="mb-3 text-micro font-bold uppercase tracking-caps text-ink-3">
        Where your maintenance comes from
      </p>

      {/* Stacked bar: the two things that add up to maintenance. */}
      <div className="flex h-9 w-full overflow-hidden rounded-control bg-track" role="presentation">
        <div
          className="flex items-center justify-center"
          style={{ width: `${bmrPct}%`, background: 'var(--brand)' }}
        >
          <span className="px-1 text-micro font-bold text-white">BMR</span>
        </div>
        <div
          className="flex flex-1 items-center justify-center"
          style={{ background: 'color-mix(in srgb, var(--brand) 35%, transparent)' }}
        >
          <span className="px-1 text-micro font-bold text-brand-ink">Activity</span>
        </div>
      </div>

      <dl className="mt-4 space-y-2.5">
        <Row
          term="Just staying alive"
          hint="Breathing, heartbeat, brain — your body at complete rest (BMR)"
          value={bmr}
        />
        <Row
          term={`Your activity — ${ACTIVITY_LABEL[activityLevel] ?? 'Sedentary'}`}
          hint={`BMR × ${multiplier} for everything you do in a normal day`}
          value={activityKcal}
          prefix="+"
        />
        <div className="border-t border-hairline pt-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-caption font-bold text-ink">Maintenance</dt>
            <dd className="font-display text-title-sm font-bold tabular-nums text-ink">
              {tdee.toLocaleString('en-IN')}
              <span className="ml-1 text-micro font-medium text-ink-3">kcal</span>
            </dd>
          </div>
          <p className="mt-1 text-caption text-ink-2">
            Eat this much and your weight holds. Eat less and the difference comes out of storage.
          </p>
        </div>
      </dl>

      <div className="mt-4 space-y-2 rounded-card bg-surface-2 p-3">
        <p className="text-micro text-ink-2">
          <span className="font-semibold text-ink">It is an estimate.</span> Two people with identical
          height, weight and age can burn 10–15% differently. So we watch what actually happens to your
          weight each week and adjust the target rather than trusting the formula.
        </p>
        <p className="text-micro text-ink-2">
          <span className="font-semibold text-ink">Your workouts are already in here.</span> The activity
          step above covers them, which is why logging a run does not add extra calories to eat back.
        </p>
      </div>
    </div>
  )
}

function Row({ term, hint, value, prefix }: { term: string; hint: string; value: number; prefix?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <dt className="text-caption font-semibold text-ink">{term}</dt>
        <p className="mt-0.5 text-micro leading-snug text-ink-3">{hint}</p>
      </div>
      <dd className="shrink-0 text-body font-bold tabular-nums text-ink">
        {prefix}{value.toLocaleString('en-IN')}
        <span className="ml-1 text-micro font-medium text-ink-3">kcal</span>
      </dd>
    </div>
  )
}
