import { Camera, ChevronLeft, ChevronRight, Flame, Home, MessageCircle, Plus, ScanLine, Search, TrendingUp, User, Utensils } from 'lucide-react'
import { CalorieHeroCard } from '../home/CalorieHeroCard'
import { foodEmoji, tintFor } from '../../lib/foodVisual'
import { cn } from '../../lib/utils'

/**
 * The three product screens on the landing page — Home, Food, Progress.
 *
 * These are the app's own screens, not device mockups: the calorie ring is the
 * real `CalorieHeroCard`, the food tiles come from the same `foodEmoji` /
 * `tintFor` the diary uses, and every other block copies the classes of the
 * screen it stands for. The one liberty is that they are still — no links, no
 * buttons, fixed illustrative numbers — so a visitor can't tap into a page
 * that would only bounce them to sign-in. `aria-hidden` for the same reason:
 * the figure's label says what it is; the contents are decoration.
 *
 * Each screen is laid out at the app's real 390px width and scaled down, so
 * the proportions are exactly what a phone shows.
 */

const INNER_W = 390
const SCALE = 0.697 // 390px → 272px (17rem)

function Phone({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <figure
      aria-label={label}
      className={cn('relative w-[17rem] shrink-0 overflow-hidden rounded-phone border-2 border-hairline-2 bg-canvas shadow-float', className)}
    >
      <div className="h-[36rem] overflow-hidden" aria-hidden="true">
        <div className="origin-top-left" style={{ width: INNER_W, transform: `scale(${SCALE})` }}>
          {children}
        </div>
      </div>
    </figure>
  )
}

function TabBar({ active }: { active: 'home' | 'food' | 'progress' }) {
  const tab = (key: typeof active, Icon: typeof Home, label: string) => (
    <span className={cn('flex h-11 flex-1 flex-col items-center justify-center gap-0.5', active === key ? 'text-brand-ink' : 'text-ink-3')}>
      <Icon className="h-6 w-6" strokeWidth={active === key ? 2 : 1.75} />
      <span className={cn('text-micro', active === key ? 'font-semibold' : 'font-medium')}>{label}</span>
    </span>
  )
  return (
    <div className="absolute inset-x-0 bottom-0 border-t border-hairline bg-header-bg px-2 pb-3 pt-2 backdrop-blur-md">
      <div className="flex items-center">
        {tab('home', Home, 'Home')}
        {tab('food', Utensils, 'Food')}
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-cta-grad text-white shadow-fab">
          <Camera className="h-6 w-6" strokeWidth={2} />
        </span>
        {tab('progress', TrendingUp, 'Progress')}
        <span className="flex h-11 flex-1 flex-col items-center justify-center gap-0.5 text-ink-3">
          <User className="h-6 w-6" strokeWidth={1.75} />
          <span className="text-micro font-medium">Profile</span>
        </span>
      </div>
    </div>
  )
}

const WEEK = [
  { l: 'M', n: 18, log: true }, { l: 'T', n: 19, log: true }, { l: 'W', n: 20, log: true }, { l: 'T', n: 21, log: false },
  { l: 'F', n: 22, log: true }, { l: 'S', n: 23, log: true }, { l: 'S', n: 24, log: true, today: true },
]

const MEALS = [
  { name: 'Poha (Kanda)', detail: '1 plate · 8:12 am', kcal: 228 },
  { name: 'Masala Chai', detail: '1 glass · 8:20 am', kcal: 129 },
  { name: 'Rajma', detail: '1 katori · 1:34 pm', kcal: 174 },
]

function FoodTile({ name }: { name: string }) {
  return (
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-title-sm leading-none"
      style={{ backgroundColor: `color-mix(in srgb, ${tintFor(name)} 12%, transparent)` }}
    >
      {foodEmoji(name)}
    </span>
  )
}

function HomeScreen() {
  return (
    <div className="relative h-[826px] px-4 pt-5">
      <div className="flex h-9 items-center justify-between">
        <p className="text-caption font-medium text-ink-3">Today · Friday</p>
        <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 text-caption font-semibold tabular-nums text-ink">
          <Flame className="h-4 w-4 text-brand" strokeWidth={2} /> 13
        </span>
      </div>
      <p className="mt-1 font-display text-title font-semibold text-ink">Good morning, Adarsh</p>

      <div className="mt-5 flex justify-between gap-1.5">
        {WEEK.map((d) => (
          <span
            key={d.n}
            className={cn(
              'flex h-14 flex-1 flex-col items-center justify-center rounded-control',
              d.today ? 'bg-ink text-canvas' : 'border border-hairline bg-surface text-ink shadow-air'
            )}
          >
            <span className={cn('text-micro font-semibold', d.today ? 'text-canvas' : 'text-ink-3')}>{d.l}</span>
            <span className="text-caption font-semibold tabular-nums leading-none">{d.n}</span>
            <span className={cn('mt-1 h-1 w-1 rounded-full', d.log ? 'bg-brand' : 'bg-transparent')} />
          </span>
        ))}
      </div>

      <div className="mt-6">
        <CalorieHeroCard eaten={960} target={1600} proteinEaten={37} carbsEaten={131} fatEaten={32} proteinTarget={75} carbsTarget={220} fatTarget={60} />
      </div>

      <div className="mt-5 flex h-12 items-center gap-3 rounded-full border border-hairline bg-surface px-4 shadow-air">
        <Search className="h-5 w-5 text-ink-3" strokeWidth={1.75} />
        <span className="flex-1 text-body text-ink-3">Search food to log</span>
        <MessageCircle className="h-5 w-5 text-brand" strokeWidth={1.75} />
      </div>

      <div className="mt-6 rounded-card-lg border-2 border-hairline-2 px-4 pb-2 pt-4">
        <div className="flex items-baseline justify-between">
          <p className="font-display text-title-sm font-semibold text-ink">Today&apos;s meals</p>
          <span className="text-caption font-semibold text-brand-ink">See all</span>
        </div>
        <ul className="mt-2 divide-y divide-hairline">
          {MEALS.map((m) => (
            <li key={m.name} className="flex items-center gap-3.5 py-3">
              <FoodTile name={m.name} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-medium text-ink">{m.name}</span>
                <span className="mt-0.5 block text-caption text-ink-3">{m.detail}</span>
              </span>
              <span className="text-body font-semibold tabular-nums text-ink">{m.kcal}</span>
            </li>
          ))}
        </ul>
      </div>
      <TabBar active="home" />
    </div>
  )
}

const RECENT = [
  { name: 'Roti / Chapati (Wheat)', last: '2 roti · 180 kcal' },
  { name: 'Dal Tadka', last: '1 katori · 120 kcal' },
  { name: 'Egg (Boiled)', last: '2 eggs · 140 kcal' },
  { name: 'Chicken Biryani', last: '1 plate · 650 kcal' },
  { name: 'Paneer Butter Masala', last: '1 bowl · 470 kcal' },
  { name: 'Poha (Kanda)', last: '1 plate · 280 kcal' },
  { name: 'Curd (Dahi)', last: '1 katori · 98 kcal' },
]

function FoodScreen() {
  return (
    <div className="relative h-[826px] px-4 pt-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-caption font-medium text-ink-3">Friday</p>
          <p className="mt-1 font-display text-title font-semibold text-ink">Food</p>
        </div>
        <span className="flex items-center text-ink">
          <ChevronLeft className="h-6 w-6" strokeWidth={1.75} />
          <ChevronRight className="h-6 w-6 text-ink-3" strokeWidth={1.75} />
        </span>
      </div>

      <div className="mt-4 flex h-12 items-center gap-3 rounded-full border border-hairline bg-surface-2 px-4">
        <Search className="h-5 w-5 text-ink-3" strokeWidth={1.75} />
        <span className="flex-1 text-body text-ink-3">Search dal makhani, roti…</span>
        <MessageCircle className="h-5 w-5 text-brand" strokeWidth={1.75} />
        <ScanLine className="h-5 w-5 text-ink-2" strokeWidth={1.75} />
      </div>

      <div className="mt-4 rounded-card-lg border-2 border-hairline-2 px-3 pb-2 pt-3">
        <div className="flex gap-1 rounded-control bg-surface-2 p-1">
          {['Recent', 'Favourites', 'My foods'].map((t, i) => (
            <span key={t} className={cn('flex h-10 flex-1 items-center justify-center rounded-lg text-caption font-semibold', i === 0 ? 'bg-surface text-ink shadow-air' : 'text-ink-2')}>{t}</span>
          ))}
        </div>
        <ul className="mt-1 divide-y divide-hairline">
          {RECENT.map((f) => (
            <li key={f.name} className="flex items-center gap-3 py-2.5">
              <FoodTile name={f.name} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-medium text-ink">{f.name}</span>
                <span className="mt-0.5 block text-caption text-ink-3">Last time {f.last}</span>
              </span>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-ink">
                <Plus className="h-5 w-5" strokeWidth={2} />
              </span>
            </li>
          ))}
        </ul>
      </div>
      <TabBar active="food" />
    </div>
  )
}

// Weigh-ins over a month, in kg, oldest first. Drawn as the app draws them:
// ink dots over an ember four-week average with a wash beneath.
const WEIGHTS = [75.6, 75.4, 75.5, 75.1, 74.9, 75.0, 74.6, 74.4, 74.5, 74.1, 73.9, 73.8, 73.5, 73.6, 73.2, 73.0, 72.9, 72.7, 72.6, 72.4]

function TrendChart() {
  const w = 340, h = 150, pad = 10
  const min = Math.min(...WEIGHTS) - 0.4, max = Math.max(...WEIGHTS) + 0.4
  const x = (i: number) => pad + (i / (WEIGHTS.length - 1)) * (w - pad * 2)
  const y = (v: number) => pad + (1 - (v - min) / (max - min)) * (h - pad * 2)
  // A simple moving average stands in for computeWeightTrend here.
  const avg = WEIGHTS.map((_, i) => {
    const win = WEIGHTS.slice(Math.max(0, i - 3), i + 1)
    return win.reduce((s, v) => s + v, 0) / win.length
  })
  const line = avg.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-4 h-40 w-full" role="img" aria-label="Weight trend">
      <defs>
        <linearGradient id="landing-weight-wash" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.28} />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <polygon points={`${x(0)},${h} ${line} ${x(WEIGHTS.length - 1)},${h}`} fill="url(#landing-weight-wash)" />
      <polyline points={line} fill="none" stroke="var(--brand)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {WEIGHTS.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={2.5} fill="var(--ink-2)" opacity={0.75} />)}
    </svg>
  )
}

function ProgressScreen() {
  return (
    <div className="relative h-[826px] px-4 pt-5">
      <p className="text-caption font-medium text-ink-3">Your trends</p>
      <p className="mt-1 font-display text-title font-semibold text-ink">Progress</p>

      <div className="mt-5 flex items-center gap-4 rounded-card-lg bg-cta-grad px-4 py-4 text-white shadow-cta">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/20">
          <Flame className="h-7 w-7" strokeWidth={2} />
        </span>
        <span>
          <span className="flex items-baseline gap-2">
            <span className="font-display text-display font-semibold tabular-nums leading-none">13</span>
            <span className="text-body font-medium">day streak</span>
          </span>
          <span className="mt-2 flex items-center gap-1.5">
            {[1, 1, 0, 1, 1, 1, 1].map((v, i) => (
              <span key={i} className={cn('h-2 w-2 rounded-full', v ? 'bg-white' : 'bg-white/30', i === 6 && 'ring-2 ring-white ring-offset-2 ring-offset-transparent')} />
            ))}
          </span>
        </span>
      </div>

      <div className="mt-4 rounded-card-lg border-2 border-hairline-2 px-4 pb-4 pt-4">
        <p className="font-display text-title-sm font-semibold text-ink">Weight</p>
        <p className="mt-3 text-caption font-medium text-ink-3">Current</p>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="font-display text-hero font-semibold tabular-nums leading-none text-ink">72.4</span>
          <span className="text-title-sm text-ink-2">kg</span>
        </p>
        <p className="mt-3 text-body text-ink-2">
          <span className="font-semibold text-good">3.2 kg lost</span> since start · 4.4 kg to go
        </p>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full w-[42%] rounded-full bg-cta-grad" />
        </div>
        <div className="mt-1.5 flex justify-between text-micro tabular-nums text-ink-3">
          <span>75.6 kg</span><span className="font-semibold text-ink-2">42%</span><span>68.0 kg goal</span>
        </div>
        <p className="mt-4 text-caption text-ink-2">
          Down <span className="font-semibold text-ink">0.5 kg a week</span> on a 4-week average.
        </p>
        <TrendChart />
      </div>
      <TabBar active="progress" />
    </div>
  )
}

/**
 * Three screens: on a phone a scroll-snap row that opens on Home; from `lg` a
 * fan with Home raised in the middle, the way a hand holds three phones.
 */
export function ProductScreens() {
  return (
    <div className="relative">
      {/* Up to lg: a horizontal snap row, edge-to-edge inside the page padding. */}
      <div className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 lg:hidden [scrollbar-width:none]">
        <Phone label="Home screen" className="snap-center"><HomeScreen /></Phone>
        <Phone label="Food screen" className="snap-center"><FoodScreen /></Phone>
        <Phone label="Progress screen" className="snap-center"><ProgressScreen /></Phone>
      </div>
      {/* Desktop: Food · Home · Progress, the centre one forward. */}
      <div className="hidden items-end justify-center gap-6 lg:flex">
        <Phone label="Food screen" className="translate-y-8 rotate-[-3deg] scale-95"><FoodScreen /></Phone>
        <Phone label="Home screen" className="relative z-10"><HomeScreen /></Phone>
        <Phone label="Progress screen" className="translate-y-8 rotate-[3deg] scale-95"><ProgressScreen /></Phone>
      </div>
    </div>
  )
}
