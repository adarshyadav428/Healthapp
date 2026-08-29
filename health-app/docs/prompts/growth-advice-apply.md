# Prompt: apply a growth/marketing playbook to GetInShape

Reusable prompt. Run from a cold session with no prior context beyond this file and the repo. It
performs a gap analysis of an external growth-advice source against the live app and produces a ranked,
evidence-cited backlog — without writing any code.

The first run of this prompt (against Jake Castillo's *Growth Advice*) produced
`docs/growth-advice-audit-2026-08-25.md`. Match that document's structure and depth.

---

## Inputs

1. **The source document** — a path to a `.docx` (or similar) containing the growth advice to apply.
2. **`health-app/CLAUDE.md`** — read this in full first. It is authoritative for what the app is, what
   it deliberately does *not* do, and why. Every score and every "Contradicts" classification below is
   checked against it.
3. **The prior audit**, if one exists (`docs/growth-advice-audit-*.md`) — read it for precedent on
   structure, tone, and any findings that might now be stale (a "Fixed" claim that regressed is worth
   more than a fresh finding of the same bug).

### Extracting a `.docx` with no docx tooling available

A `.docx` is a zip. This PowerShell recipe extracts the visible text without any external CLI:

```powershell
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead("D:\path\to\file.docx")
$entry = $zip.Entries | Where-Object { $_.FullName -eq "word/document.xml" }
$reader = New-Object System.IO.StreamReader($entry.Open())
$xml = $reader.ReadToEnd()
$reader.Close(); $zip.Dispose()
# Strip XML tags, decode entities, collapse to one line per paragraph
$text = $xml -replace '<w:p[ >].*?</w:p>(*SKIP)(*FAIL)|<w:p[ >]', "`n" `
             -replace '<[^>]+>', '' `
             -replace '&amp;', '&' -replace '&lt;', '<' -replace '&gt;', '>' -replace '&quot;', '"'
$text | Out-File -FilePath "extracted.txt" -Encoding utf8
```

If that regex trick misbehaves on a given file, the reliable fallback is: strip every `<...>` tag with
`-replace '<[^>]+>', ''`, decode the four XML entities above, then re-paragraph by eye — `.docx` line
breaks don't survive tag-stripping cleanly, so treat the output as one wall of text and re-derive
structure from headings/numbering in the raw XML if needed.

---

## Phase 1 — reconstruct the source

Extract every claim, benchmark, and named mechanic into a table with a chapter/section cite. Do not
summarize — enumerate. Separate three kinds of statement, because they get audited differently:

- **Claims** — arguable positions ("long onboarding increases conversion for high-pain apps"). These get
  weighed against the app's own documented reasoning, not accepted at face value.
- **Benchmarks** — numbers ("75%+ paywall rate", "10.7% vs 2.1%"). Note the population they were measured
  on (market, platform, app category) — a US iOS benchmark applied to an India-first Android+web app is
  a citation, not a target.
- **Rules** — concrete prescriptions ("44pt minimum tap targets", "1 font, 4px/8px spacing scale"). These
  are the easiest to check mechanically against the codebase.

Note the evidence quality behind each claim as you go (named case study vs. aggregate stat vs. bare
assertion) — it matters later when a Contradicts finding needs to argue against a low-evidence claim.

---

## Phase 2 — map the app

Three parallel Explore agents. Each must return `file:line` citations, not summaries, and must
**describe what exists — do not propose changes.** Proposals happen in Phase 6, after every gap across
all three areas has been classified. Be efficient: prefer targeted greps over reading whole large files.

**Agent A — conversion funnel.** Map: the onboarding flow (steps, what each collects, what blocks
progress, drop-off points if instrumented), where and when the paywall appears (proactive interstitials,
passive upsell surfaces, thresholds/triggers that fire them), every place free-vs-Pro feature lists are
rendered (and whether they agree with each other), the trial mechanism (length, platform, what happens
at expiry), and the first-run path from landing page to first meaningful action.

**Agent B — design system.** Map: font stack and how many faces/weights, the color token system (is raw
hex forbidden and is it enforced by a guard script?), spacing/radius/type scales and whether they're
mechanically enforced or just conventional, minimum interactive-control sizing, `tabular-nums` usage on
numeric surfaces, motion/reduced-motion handling, and app-identity assets (favicon, OG/social image,
manifest colors vs. live theme colors — check for drift between static config files and the CSS that
actually ships).

**Agent C — growth instrumentation.** Map: the full analytics event catalog (name every event and what
properties it carries — note events that fire with *no* properties), any attribution capture (UTM
params, referrer, install-referrer, campaign IDs — search for these strings across the whole app, not
just an "analytics" folder), referral/invite mechanics, programmatic SEO surfaces and whether they carry
structured data (JSON-LD) and trackable CTAs, lifecycle/re-engagement push (what triggers it, what
suppresses it), and any A/B testing or feature-flag capability (search for flag/experiment/variant
naming conventions — absence is as important a finding as presence).

---

## Phase 3 — score each chapter 0–10

Score each major section of the source against the mapped reality. **A score with no `file:line` cited
for every material claim behind it is not a score — cut it or go verify it.** State the one-line verdict
that would survive if someone only read the scorecard row.

---

## Phase 4 — classify every gap

Every finding lands in exactly one bucket:

- **Confirms** — the app already does what the source recommends. Cite where.
- **Contradicts** — the app deliberately does the opposite, and that choice is documented (in
  `CLAUDE.md`, in code comments, in a prior audit/plan doc). **This bucket is the valuable one and must
  never be silently resolved in the source's favor.** State both positions. If the app's documented
  reasoning holds up, say so plainly — CLAUDE.md rules exist because an assumption produced a wrong
  answer in production once already, and a growth book's aggregate stats don't automatically outrank
  that.
- **Absent** — a genuine gap. The app has no position on this; the source's recommendation is a real
  candidate for the backlog.
- **Not applicable** — platform mismatch (iOS-only advice on an Android+web product) or market mismatch
  (US pricing/behavior cited as if it transfers to an India-first, INR-only product without adjustment).

---

## Phase 5 — the reversibility filter

Before ranking anything, sort every candidate backlog item into:

- **Cheap to reverse** — copy, thresholds, card ordering, additive changes.
- **Sticky** — pricing changes (consent/notice implications), store-listing metadata (review delay),
  anything with a cooldown.
- **One-way door** — anything touching a public commitment made in `CLAUDE.md` or on a live page (e.g. a
  "free forever" claim), Play Console monetization config, or an existing status/enum vocabulary whose
  historical rows can't be backfilled without a migration tool the project doesn't have. Flag these
  explicitly and require a higher bar of evidence before recommending them.

---

## Phase 6 — ranked backlog

Every item names the specific event (existing or newly-proposed) that would tell you whether it worked.
No item is "just build it and see" — if there's no event that would falsify it, it's not ready for the
backlog, it's a Phase-2 gap that needs an instrumentation prerequisite first.

If a central claim from the source (e.g. "hard paywall beats freemium") can't be evaluated with the
app's current traffic, don't pick a side. Run the numbers: what lift would be detectable at current
traffic in a reasonable window (two-proportion z-test, α=.05, power=.80, randomizing on the *first*
decision point the source's mechanic would affect — not downstream of it), and say plainly whether the
experiment is reachable today. If it isn't, the backlog item is "get to the point where it's reachable,"
not the object-level answer.

---

## Standing constraints to carry into any implementation that follows

- Vercel Hobby plan: 2 cron jobs maximum, both already spoken for. No proposal may need a third.
- Migrations are hand-applied, no Supabase CLI — any schema change must be idempotent and safe to run
  by hand.
- Writes happen only in `app/api/` route handlers — no direct writes from client components.
- Pricing is INR-only; no other currency, no USDA/US-market nutrition data.
- The five gates (typecheck, lint, token guard, tests, build) must stay green — though a pure
  documentation pass doesn't touch code, so this only applies once implementation starts.
- Prefer surgical, additive changes over rewrites.

## Anti-patterns

- Do not fabricate social proof, testimonials, or user counts to satisfy a "show social proof" rule.
- Do not propose iOS-only tactics (App Store-specific mechanics) for what is currently an Android (TWA)
  + web product.
- Do not treat a US-market aggregate statistic as if it directly predicts local behavior — cite it,
  don't inherit it.
- Do not propose a third Vercel cron job under any framing.
- Do not resolve a Contradicts finding unilaterally in the source's favor just because it has a number
  attached — the app's documented counter-reasoning gets equal weight.
- Do not include a claim about the codebase that isn't backed by an actual grep/read performed in this
  session. "This probably doesn't exist" is not a finding.
