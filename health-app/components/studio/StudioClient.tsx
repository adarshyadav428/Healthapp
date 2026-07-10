'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Design Studio — two complete directions, one doctrine.
// Identical markup for both; each direction is purely a set of CSS variables,
// so what's being compared is the material world, not the layout.
// Everything here is scoped under #gis-studio: the live app is untouched.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import {
  Flame, Home, UtensilsCrossed, TrendingUp, User, Plus, X, Check,
  ChevronLeft, Camera, Sparkles,
} from 'lucide-react'

type Direction = 'onyx' | 'porcelain'
type Screen = 'dashboard' | 'paywall' | 'quickadd'

// ── Direction token sets ─────────────────────────────────────────────────────
const WORLDS: Record<Direction, Record<string, string>> = {
  onyx: {
    '--s-canvas': '#0F0E0C',
    '--s-surface': '#171512',
    '--s-surface2': '#201D19',
    '--s-ink': '#F5F2EC',
    '--s-sec': '#A8A199',
    '--s-ter': '#6E6860',
    '--s-hair': 'rgba(245,242,236,.07)',
    '--s-accent': '#FF7A45',
    '--s-accent-hi': '#FF9F6E',
    '--s-accent-lo': '#FF5C1F',
    '--s-accent-ink': '#FFA47D',
    '--s-accent-soft': 'rgba(255,122,69,.14)',
    '--s-ambient':
      'radial-gradient(120% 42% at 50% -6%, rgba(255,110,60,.13), transparent 62%), radial-gradient(60% 28% at 88% 0%, rgba(255,170,90,.06), transparent 58%)',
    '--s-card-shadow': '0 1px 0 rgba(255,255,255,.04) inset, 0 16px 40px -20px rgba(0,0,0,.6)',
    '--s-float-shadow': '0 1px 0 rgba(255,255,255,.05) inset, 0 24px 60px -24px rgba(0,0,0,.75)',
    '--s-cta-shadow': '0 10px 28px -8px rgba(255,92,31,.45)',
    '--s-fab-shadow': '0 10px 26px -8px rgba(255,92,31,.55)',
    '--s-track': 'rgba(245,242,236,.07)',
    '--s-arc-glow': '.55',
    '--s-ring-drop': 'drop-shadow(0 0 18px rgba(255,110,60,.25))',
    '--s-glass': 'rgba(23,21,18,.55)',
    '--s-glass-hair': 'rgba(245,242,236,.08)',
    '--s-p': '#6E9BFF',
    '--s-c': '#FFB454',
    '--s-f': '#FF7A6E',
    '--s-pill': 'rgba(245,242,236,.05)',
    '--s-dim': 'rgba(0,0,0,.55)',
    '--s-cta-grad': 'linear-gradient(160deg, #FF8A55, #F5551A)',
    '--s-ava-grad': 'linear-gradient(150deg, #FF9F6E, #F5551A)',
    '--s-ava-halo': 'rgba(255,122,69,.25)',
  },
  porcelain: {
    '--s-canvas': '#F7F6F3',
    '--s-surface': '#FFFFFF',
    '--s-surface2': '#F2F0EB',
    '--s-ink': '#17150F',
    '--s-sec': '#6E6963',
    '--s-ter': '#A6A099',
    '--s-hair': 'rgba(23,21,15,.06)',
    '--s-accent': '#F1662E',
    '--s-accent-hi': '#FF8A50',
    '--s-accent-lo': '#E8551C',
    '--s-accent-ink': '#C24E1E',
    '--s-accent-soft': 'rgba(241,102,46,.10)',
    '--s-ambient':
      'radial-gradient(120% 40% at 50% -6%, rgba(241,102,46,.07), transparent 60%), radial-gradient(60% 26% at 88% 0%, rgba(232,150,30,.05), transparent 56%)',
    '--s-card-shadow':
      '0 1px 1px rgba(23,21,15,.03), 0 8px 20px -8px rgba(23,21,15,.08), 0 24px 48px -24px rgba(23,21,15,.10)',
    '--s-float-shadow':
      '0 2px 4px rgba(23,21,15,.04), 0 16px 32px -12px rgba(23,21,15,.12), 0 32px 64px -28px rgba(23,21,15,.14)',
    '--s-cta-shadow': '0 10px 24px -8px rgba(241,102,46,.45)',
    '--s-fab-shadow': '0 10px 24px -8px rgba(241,102,46,.5)',
    '--s-track': '#EFEDE8',
    '--s-arc-glow': '.22',
    '--s-ring-drop': 'drop-shadow(0 8px 16px rgba(241,102,46,.18))',
    '--s-glass': 'rgba(255,255,255,.72)',
    '--s-glass-hair': 'rgba(23,21,15,.05)',
    '--s-p': '#4A7DE0',
    '--s-c': '#E0961F',
    '--s-f': '#E05A4E',
    '--s-pill': 'rgba(23,21,15,.04)',
    '--s-dim': 'rgba(23,21,15,.38)',
    '--s-cta-grad': 'linear-gradient(160deg, #FF8A50, #EB5A20)',
    '--s-ava-grad': 'linear-gradient(150deg, #FF9560, #E8551C)',
    '--s-ava-halo': 'rgba(241,102,46,.22)',
  },
}

// ── Count-up hook (respects reduced motion) ─────────────────────────────────
function useCountUp(target: number, duration = 700, deps: unknown[] = []) {
  const [val, setVal] = useState(0)
  const raf = useRef<number>()
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVal(target)
      return
    }
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 4)
      setVal(Math.round(target * eased))
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return val
}

// ── The luminous ring ───────────────────────────────────────────────────────
function StudioRing({ eaten, target, animKey }: { eaten: number; target: number; animKey: string }) {
  const R = 86
  const C = 2 * Math.PI * R
  const pct = Math.min(eaten / target, 1)
  const shown = useCountUp(eaten, 800, [animKey])
  return (
    <div className="st-ringwrap">
      <svg key={animKey} width="196" height="196" viewBox="0 0 196 196" style={{ filter: 'var(--s-ring-drop)' }}>
        <defs>
          <linearGradient id={`arc-${animKey}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--s-accent-hi)" />
            <stop offset="100%" stopColor="var(--s-accent-lo)" />
          </linearGradient>
        </defs>
        <circle cx="98" cy="98" r={R} fill="none" stroke="var(--s-track)" strokeWidth="9" />
        {/* luminescence: blurred duplicate underneath */}
        <circle
          className="st-arc"
          cx="98" cy="98" r={R} fill="none"
          stroke={`url(#arc-${animKey})`} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={C} style={{ ['--dash' as string]: C, ['--off' as string]: C * (1 - pct), filter: 'blur(10px)', opacity: 'var(--s-arc-glow)' }}
          transform="rotate(-90 98 98)"
        />
        <circle
          className="st-arc"
          cx="98" cy="98" r={R} fill="none"
          stroke={`url(#arc-${animKey})`} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={C} style={{ ['--dash' as string]: C, ['--off' as string]: C * (1 - pct) }}
          transform="rotate(-90 98 98)"
        />
      </svg>
      <div className="st-ring-center">
        <span className="st-label">Eaten</span>
        <span className="st-hero-num">{shown.toLocaleString('en-IN')}</span>
        <span className="st-ring-of">of <b>{target.toLocaleString('en-IN')}</b> kcal</span>
      </div>
    </div>
  )
}

// ── Dashboard screen ────────────────────────────────────────────────────────
function DashboardScreen({ animKey }: { animKey: string }) {
  return (
    <div className="st-page">
      <div className="st-greet st-up" style={{ animationDelay: '0ms' }}>
        <div>
          <div className="st-label">Thursday · 9 July</div>
          <h2 className="st-title">Good evening, Adarsh</h2>
          <p className="st-sub">536 kcal to go — right on track</p>
        </div>
        <div className="st-ava">A</div>
      </div>

      <div className="st-card st-hero-card st-up" style={{ animationDelay: '60ms' }}>
        <div className="st-hero-top">
          <span className="st-label">Today</span>
          <span className="st-streak"><Flame size={12} strokeWidth={2.2} /> 6 days</span>
        </div>

        <StudioRing eaten={1264} target={1800} animKey={animKey} />

        <div className="st-remaining"><span><b>536</b> kcal remaining</span></div>

        <div className="st-macros">
          {[
            { l: 'Protein', v: '92 / 140 g', w: 66, c: 'var(--s-p)' },
            { l: 'Carbs', v: '148 / 205 g', w: 72, c: 'var(--s-c)' },
            { l: 'Fat', v: '41 / 56 g', w: 73, c: 'var(--s-f)' },
          ].map(m => (
            <div key={m.l} className="st-macro">
              <div className="st-macro-lr"><span className="st-label">{m.l}</span><b>{m.v}</b></div>
              <div className="st-bar"><i style={{ width: `${m.w}%`, background: m.c }} /></div>
            </div>
          ))}
        </div>
      </div>

      <div className="st-sec st-up" style={{ animationDelay: '120ms' }}>
        <span className="st-sec-t">Today&apos;s meals</span>
        <span className="st-sec-v">1,264 kcal</span>
      </div>

      <div className="st-card st-meals st-up" style={{ animationDelay: '160ms' }}>
        {[
          { k: 'B', name: 'Breakfast', desc: 'Poha with peanuts · Masala chai', kcal: '486' },
          { k: 'L', name: 'Lunch', desc: 'Rajma chawal · photo scan', kcal: '686', scan: true },
          { k: 'S', name: 'Snack', desc: 'Roasted makhana', kcal: '92' },
          { k: 'D', name: 'Dinner', desc: 'Not logged yet', kcal: '', empty: true },
        ].map(r => (
          <div key={r.k} className={`st-row ${r.empty ? 'st-row-empty' : ''}`}>
            <div className="st-chip-l">{r.k}</div>
            <div className="st-row-t">
              <b>{r.name}</b>
              <span>{r.scan && <Camera size={11} strokeWidth={2} style={{ marginRight: 4, verticalAlign: '-1px' }} />}{r.desc}</span>
            </div>
            <div className="st-row-v">{r.empty ? <i>—</i> : <><b>{r.kcal}</b><span>kcal</span></>}</div>
          </div>
        ))}
      </div>

      <div className="st-nav">
        {[
          { icon: Home, l: 'Home', on: true },
          { icon: UtensilsCrossed, l: 'Food' },
          null,
          { icon: TrendingUp, l: 'Trends' },
          { icon: User, l: 'You' },
        ].map((t, i) =>
          t === null
            ? <div key={i} style={{ width: 52 }} />
            : <div key={i} className={`st-tab ${t.on ? 'on' : ''}`}><t.icon size={20} strokeWidth={t.on ? 2 : 1.75} /><span>{t.l}</span></div>
        )}
      </div>
      <div className="st-fab"><Plus size={24} strokeWidth={2.2} /></div>
    </div>
  )
}

// ── Paywall screen ──────────────────────────────────────────────────────────
function PaywallScreen() {
  return (
    <div className="st-page">
      <div className="st-pw-back st-up" style={{ animationDelay: '0ms' }}><ChevronLeft size={15} strokeWidth={2} /> Back</div>

      <div className="st-pw-head st-up" style={{ animationDelay: '40ms' }}>
        <div className="st-eyebrow">GetInShape Pro</div>
        <h2 className="st-pw-h">Everything,<br />unlocked.</h2>
        <p className="st-sub" style={{ marginTop: 12 }}>Unlimited AI logging, your full history,<br />and deeper insight into your progress.</p>
      </div>

      <div className="st-feats st-up" style={{ animationDelay: '90ms' }}>
        {[
          ['Unlimited', ' AI photo & chat logging'],
          ['Full history', ' — beyond the last 7 days'],
          ['Custom foods', ' & family recipes'],
          ['Advanced trends', ' & full weight history'],
          ['Data export', ' · priority support'],
        ].map(([b, rest]) => (
          <div key={b} className="st-feat"><i><Check size={10} strokeWidth={3} /></i><span><b>{b}</b>{rest}</span></div>
        ))}
      </div>

      <div className="st-card st-plan st-plan-hi st-up" style={{ animationDelay: '140ms' }}>
        <div className="st-badge">Best value · Save 71%</div>
        <div className="st-plan-row">
          <div>
            <div className="st-label">Annual</div>
            <div className="st-price">₹699<span> / year</span></div>
            <div className="st-note">7-day free trial · cancel anytime</div>
          </div>
          <div className="st-permo">≈ ₹58 / mo</div>
        </div>
        <div className="st-btn st-btn-cta"><Sparkles size={15} strokeWidth={2} /> Start free trial</div>
      </div>

      <div className="st-card st-plan st-up" style={{ animationDelay: '180ms' }}>
        <div className="st-plan-row">
          <div>
            <div className="st-label">Monthly</div>
            <div className="st-price">₹199<span> / month</span></div>
            <div className="st-note">Cancel anytime</div>
          </div>
        </div>
        <div className="st-btn st-btn-quiet">Start monthly</div>
      </div>

      <p className="st-trust st-up" style={{ animationDelay: '220ms' }}>Secured by Stripe · Cancel anytime<br />30-day money-back guarantee</p>
    </div>
  )
}

// ── Quick Add sheet ─────────────────────────────────────────────────────────
function QuickAddScreen({ animKey }: { animKey: string }) {
  const shown = useCountUp(486, 600, [animKey])
  return (
    <div className="st-page" style={{ padding: 0 }}>
      {/* dimmed dashboard behind */}
      <div style={{ padding: '0 22px', filter: 'blur(1px)' }} aria-hidden="true">
        <div className="st-greet">
          <div>
            <div className="st-label">Thursday · 9 July</div>
            <h2 className="st-title">Good evening, Adarsh</h2>
          </div>
          <div className="st-ava">A</div>
        </div>
        <div className="st-card st-hero-card" style={{ height: 300 }} />
      </div>
      <div className="st-dim" />

      <div className="st-sheet">
        <div className="st-grab" />
        <div className="st-sheet-h">
          <b>Quick add</b>
          <div className="st-x"><X size={14} strokeWidth={2.2} /></div>
        </div>
        <div className="st-bignum">
          <span className="st-hero-num" style={{ fontSize: 64 }}>{shown}</span>
          <span className="st-bignum-u">kcal</span>
          <div className="st-hint">Tap to edit</div>
        </div>
        <div className="st-chips">
          {['Breakfast', 'Lunch', 'Dinner', 'Snack'].map((c) => (
            <div key={c} className={`st-mealchip ${c === 'Dinner' ? 'on' : ''}`}>{c}</div>
          ))}
        </div>
        <div className="st-addmacros">＋ Add macros (optional)</div>
        <div className="st-btn st-btn-cta" style={{ marginTop: 0 }}>Add 486 kcal to dinner</div>
      </div>
    </div>
  )
}

// ── Studio shell ────────────────────────────────────────────────────────────
export function StudioClient() {
  const [dir, setDir] = useState<Direction>('onyx')
  const [screen, setScreen] = useState<Screen>('dashboard')
  const animKey = `${dir}-${screen}`

  return (
    <div id="gis-studio">
      <style dangerouslySetInnerHTML={{ __html: STUDIO_CSS }} />

      <header className="st-toolbar">
        <div className="st-brand">Design studio</div>
        <div className="st-seg">
          <button className={dir === 'onyx' ? 'on' : ''} onClick={() => setDir('onyx')}>Onyx Ember</button>
          <button className={dir === 'porcelain' ? 'on' : ''} onClick={() => setDir('porcelain')}>Porcelain</button>
        </div>
        <div className="st-seg st-seg-sm">
          <button className={screen === 'dashboard' ? 'on' : ''} onClick={() => setScreen('dashboard')}>Home</button>
          <button className={screen === 'paywall' ? 'on' : ''} onClick={() => setScreen('paywall')}>Pro</button>
          <button className={screen === 'quickadd' ? 'on' : ''} onClick={() => setScreen('quickadd')}>Add</button>
        </div>
      </header>

      <main className="st-stage">
        <div className="st-frame" style={WORLDS[dir] as React.CSSProperties}>
          <div className="st-ambient" aria-hidden="true" />
          {screen === 'dashboard' && <DashboardScreen animKey={animKey} />}
          {screen === 'paywall' && <PaywallScreen key={animKey} />}
          {screen === 'quickadd' && <QuickAddScreen animKey={animKey} />}
        </div>
        <p className="st-caption">
          {dir === 'onyx' ? 'Onyx Ember — dark luxury, luminous data' : 'Porcelain — bright precision, quiet warmth'}
        </p>
      </main>
    </div>
  )
}

// ── Scoped styles ───────────────────────────────────────────────────────────
const STUDIO_CSS = `
#gis-studio {
  min-height: 100vh; background: #0B0A09; color: #E8E4DC;
  font-family: var(--font-inter, ui-sans-serif, system-ui, sans-serif);
  -webkit-font-smoothing: antialiased; display: flex; flex-direction: column;
}
#gis-studio * { box-sizing: border-box; margin: 0; }

/* toolbar */
#gis-studio .st-toolbar {
  display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap;
  padding: 14px 16px; position: sticky; top: 0; z-index: 50;
  background: rgba(11,10,9,.8); backdrop-filter: blur(16px);
}
#gis-studio .st-brand { font-size: 11px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: #7A756C; margin-right: 6px; }
#gis-studio .st-seg { display: flex; background: rgba(255,255,255,.06); border-radius: 999px; padding: 3px; }
#gis-studio .st-seg button {
  border: 0; background: transparent; color: #A8A199; font: inherit; font-size: 12.5px; font-weight: 500;
  padding: 7px 14px; border-radius: 999px; cursor: pointer; transition: all .16s cubic-bezier(.22,1,.36,1);
}
#gis-studio .st-seg button.on { background: #F5F2EC; color: #17150F; font-weight: 600; }
#gis-studio .st-seg-sm button { padding: 7px 12px; }

/* stage + frame */
#gis-studio .st-stage { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 18px 12px 40px; }
#gis-studio .st-frame {
  width: 396px; max-width: 100%; height: min(824px, calc(100dvh - 130px)); min-height: 640px;
  border-radius: 44px; overflow: hidden; position: relative;
  background: var(--s-canvas); color: var(--s-ink);
  box-shadow: 0 0 0 1px rgba(255,255,255,.06), 0 40px 90px -30px rgba(0,0,0,.8);
  transition: background .35s ease;
}
#gis-studio .st-caption { margin-top: 14px; font-size: 12.5px; color: #7A756C; }

#gis-studio .st-ambient { position: absolute; inset: 0; pointer-events: none; background: var(--s-ambient); }

/* page scroller */
#gis-studio .st-page { position: absolute; inset: 0; overflow-y: auto; overflow-x: hidden; padding: 0 22px; scrollbar-width: none; }
#gis-studio .st-page::-webkit-scrollbar { display: none; }

/* entrance */
@keyframes stUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
#gis-studio .st-up { animation: stUp .45s cubic-bezier(.22,1,.36,1) both; }

/* ── type roles ── */
#gis-studio .st-label { font-size: 11px; font-weight: 500; letter-spacing: .08em; text-transform: uppercase; color: var(--s-ter); }
#gis-studio .st-title { font-family: var(--font-inter-tight, var(--font-inter, sans-serif)); font-size: 23px; font-weight: 600; letter-spacing: -.02em; color: var(--s-ink); margin-top: 7px; }
#gis-studio .st-sub { font-size: 13.5px; font-weight: 400; color: var(--s-sec); line-height: 1.5; margin-top: 4px; }
#gis-studio .st-hero-num {
  font-family: var(--font-inter-tight, var(--font-inter, sans-serif));
  font-size: 46px; font-weight: 700; letter-spacing: -.03em; line-height: 1; color: var(--s-ink);
  font-variant-numeric: tabular-nums;
}

/* greeting */
#gis-studio .st-greet { display: flex; align-items: flex-start; justify-content: space-between; padding: 30px 0 22px; }
#gis-studio .st-ava {
  width: 42px; height: 42px; border-radius: 50%; flex: 0 0 auto; margin-top: 2px;
  background: var(--s-ava-grad); color: #fff; display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 600;
  box-shadow: 0 0 0 2px var(--s-canvas), 0 0 0 3.5px var(--s-ava-halo), 0 8px 20px -8px var(--s-ava-halo);
}

/* cards */
#gis-studio .st-card { background: var(--s-surface); border-radius: 20px; box-shadow: var(--s-card-shadow); }
#gis-studio .st-hero-card { padding: 24px; }
#gis-studio .st-hero-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
#gis-studio .st-streak {
  display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 600;
  color: var(--s-accent-ink); background: var(--s-accent-soft); border-radius: 999px; padding: 5px 11px;
}

/* ring */
#gis-studio .st-ringwrap { position: relative; width: 196px; height: 196px; margin: 0 auto; }
@keyframes stSweep { from { stroke-dashoffset: var(--dash); } to { stroke-dashoffset: var(--off); } }
#gis-studio .st-arc { animation: stSweep .9s cubic-bezier(.22,1,.36,1) .25s both; }
#gis-studio .st-ring-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
#gis-studio .st-ring-of { font-size: 12px; color: var(--s-sec); }
#gis-studio .st-ring-of b { font-weight: 600; color: var(--s-ink); font-variant-numeric: tabular-nums; }
#gis-studio .st-remaining { display: flex; justify-content: center; margin-top: 14px; }
#gis-studio .st-remaining span { font-size: 12.5px; color: var(--s-sec); background: var(--s-pill); border-radius: 999px; padding: 6px 14px; }
#gis-studio .st-remaining b { font-weight: 600; color: var(--s-accent-ink); font-variant-numeric: tabular-nums; }

/* macros */
#gis-studio .st-macros { display: flex; gap: 18px; margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--s-hair); }
#gis-studio .st-macro { flex: 1; }
#gis-studio .st-macro-lr { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
#gis-studio .st-macro-lr b { font-size: 11.5px; font-weight: 500; color: var(--s-sec); font-variant-numeric: tabular-nums; }
#gis-studio .st-bar { height: 4px; border-radius: 2px; background: var(--s-track); overflow: hidden; }
#gis-studio .st-bar i { display: block; height: 100%; border-radius: 2px; }

/* meals */
#gis-studio .st-sec { display: flex; justify-content: space-between; align-items: baseline; margin: 26px 2px 12px; }
#gis-studio .st-sec-t { font-size: 15px; font-weight: 600; letter-spacing: -.01em; color: var(--s-ink); }
#gis-studio .st-sec-v { font-size: 12px; font-weight: 500; color: var(--s-ter); font-variant-numeric: tabular-nums; }
#gis-studio .st-meals { overflow: hidden; margin-bottom: 118px; }
#gis-studio .st-row { display: flex; align-items: center; gap: 13px; padding: 15px 18px; }
#gis-studio .st-row + .st-row { border-top: 1px solid var(--s-hair); }
#gis-studio .st-chip-l {
  width: 34px; height: 34px; border-radius: 12px; flex: 0 0 auto;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 600; background: var(--s-surface2); color: var(--s-sec);
}
#gis-studio .st-row-t { flex: 1; min-width: 0; }
#gis-studio .st-row-t b { display: block; font-size: 14px; font-weight: 600; letter-spacing: -.01em; color: var(--s-ink); }
#gis-studio .st-row-t span { display: block; font-size: 11.5px; color: var(--s-ter); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#gis-studio .st-row-v { text-align: right; }
#gis-studio .st-row-v b { display: block; font-size: 14px; font-weight: 600; color: var(--s-ink); font-variant-numeric: tabular-nums; }
#gis-studio .st-row-v span { font-size: 10px; color: var(--s-ter); }
#gis-studio .st-row-v i { font-style: normal; color: var(--s-ter); }
#gis-studio .st-row-empty .st-row-t b { color: var(--s-sec); font-weight: 500; }

/* nav + fab */
#gis-studio .st-nav {
  position: absolute; left: 20px; right: 20px; bottom: 18px; z-index: 6;
  display: flex; align-items: center; justify-content: space-around;
  background: var(--s-glass); backdrop-filter: blur(24px) saturate(1.6);
  box-shadow: 0 0 0 1px var(--s-glass-hair), var(--s-card-shadow);
  border-radius: 26px; padding: 10px 6px;
}
#gis-studio .st-tab { display: flex; flex-direction: column; align-items: center; gap: 3px; width: 56px; font-size: 10px; font-weight: 500; color: var(--s-ter); }
#gis-studio .st-tab.on { color: var(--s-accent-ink); font-weight: 600; }
#gis-studio .st-fab {
  position: absolute; left: 50%; transform: translateX(-50%); bottom: 32px; z-index: 7;
  width: 52px; height: 52px; border-radius: 17px; background: var(--s-cta-grad);
  display: flex; align-items: center; justify-content: center; color: #fff;
  box-shadow: 0 0 0 3px var(--s-canvas), var(--s-fab-shadow);
  transition: transform .16s cubic-bezier(.22,1,.36,1);
}
#gis-studio .st-fab:active { transform: translateX(-50%) scale(.96); }

/* ── paywall ── */
#gis-studio .st-pw-back { display: flex; align-items: center; gap: 2px; font-size: 12.5px; color: var(--s-ter); padding: 26px 0 6px; }
#gis-studio .st-pw-head { text-align: center; padding: 24px 0 24px; }
#gis-studio .st-eyebrow { font-size: 10.5px; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; color: var(--s-accent-ink); margin-bottom: 12px; }
#gis-studio .st-pw-h { font-family: var(--font-inter-tight, sans-serif); font-size: 31px; font-weight: 700; letter-spacing: -.025em; line-height: 1.1; color: var(--s-ink); }
#gis-studio .st-feats { padding: 0 6px 22px; }
#gis-studio .st-feat { display: flex; align-items: center; gap: 12px; font-size: 13.5px; color: var(--s-sec); padding: 7px 0; }
#gis-studio .st-feat b { font-weight: 600; color: var(--s-ink); }
#gis-studio .st-feat i {
  width: 20px; height: 20px; border-radius: 50%; flex: 0 0 auto;
  background: var(--s-accent-soft); color: var(--s-accent-ink);
  display: flex; align-items: center; justify-content: center;
}
#gis-studio .st-plan { padding: 20px; margin-bottom: 12px; position: relative; }
#gis-studio .st-plan-hi { box-shadow: 0 0 0 1.5px var(--s-accent), var(--s-cta-shadow); }
#gis-studio .st-badge {
  position: absolute; top: -10px; left: 20px; background: var(--s-cta-grad); color: #fff;
  font-size: 9.5px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase;
  border-radius: 999px; padding: 4px 11px;
}
#gis-studio .st-plan-row { display: flex; align-items: flex-end; justify-content: space-between; }
#gis-studio .st-price { font-family: var(--font-inter-tight, sans-serif); font-size: 30px; font-weight: 700; letter-spacing: -.03em; color: var(--s-ink); line-height: 1; margin-top: 7px; font-variant-numeric: tabular-nums; }
#gis-studio .st-price span { font-size: 13px; font-weight: 400; color: var(--s-ter); letter-spacing: 0; }
#gis-studio .st-note { font-size: 11.5px; color: var(--s-sec); margin-top: 8px; }
#gis-studio .st-permo { font-size: 12px; font-weight: 600; color: var(--s-accent-ink); }
#gis-studio .st-btn {
  display: flex; align-items: center; justify-content: center; gap: 7px;
  border-radius: 999px; padding: 13px 16px; margin-top: 14px;
  font-size: 14.5px; font-weight: 600; letter-spacing: -.01em; cursor: pointer;
  transition: transform .16s cubic-bezier(.22,1,.36,1), filter .16s;
}
#gis-studio .st-btn:active { transform: scale(.98); }
#gis-studio .st-btn-cta { background: var(--s-cta-grad); color: #fff; box-shadow: var(--s-cta-shadow); }
#gis-studio .st-btn-cta:hover { filter: brightness(1.05); }
#gis-studio .st-btn-quiet { background: transparent; color: var(--s-sec); box-shadow: 0 0 0 1px var(--s-hair); padding: 11px 16px; margin-top: 12px; }
#gis-studio .st-trust { text-align: center; font-size: 11px; color: var(--s-ter); line-height: 1.6; margin: 16px 0 30px; }

/* ── quick add sheet ── */
#gis-studio .st-dim { position: absolute; inset: 0; background: var(--s-dim); z-index: 8; }
#gis-studio .st-sheet {
  position: absolute; left: 0; right: 0; bottom: 0; z-index: 9;
  background: var(--s-surface); border-radius: 30px 30px 0 0; padding: 14px 26px 34px;
  box-shadow: var(--s-float-shadow);
  animation: stSheet .4s cubic-bezier(.22,1,.36,1) both;
}
@keyframes stSheet { from { transform: translateY(40px); opacity: 0; } to { transform: none; opacity: 1; } }
#gis-studio .st-grab { width: 34px; height: 4px; border-radius: 2px; background: var(--s-hair); margin: 0 auto 22px; }
#gis-studio .st-sheet-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; }
#gis-studio .st-sheet-h b { font-size: 17px; font-weight: 600; letter-spacing: -.01em; color: var(--s-ink); }
#gis-studio .st-x { width: 30px; height: 30px; border-radius: 50%; background: var(--s-surface2); color: var(--s-ter); display: flex; align-items: center; justify-content: center; }
#gis-studio .st-bignum { text-align: center; }
#gis-studio .st-bignum-u { font-size: 15px; font-weight: 500; color: var(--s-ter); margin-left: 7px; }
#gis-studio .st-hint { font-size: 11px; color: var(--s-ter); opacity: .7; margin-top: 10px; }
#gis-studio .st-chips { display: flex; gap: 8px; margin: 26px 0 20px; justify-content: center; flex-wrap: wrap; }
#gis-studio .st-mealchip { border-radius: 999px; padding: 8px 15px; font-size: 12px; font-weight: 500; background: var(--s-surface2); color: var(--s-sec); cursor: pointer; }
#gis-studio .st-mealchip.on { background: var(--s-accent-soft); color: var(--s-accent-ink); font-weight: 600; box-shadow: inset 0 0 0 1px var(--s-accent); }
#gis-studio .st-addmacros { text-align: center; font-size: 12px; font-weight: 500; color: var(--s-ter); margin-bottom: 22px; }

@media (prefers-reduced-motion: reduce) {
  #gis-studio .st-up, #gis-studio .st-arc, #gis-studio .st-sheet { animation: none !important; }
}
`
