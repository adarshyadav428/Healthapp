# Apply a growth book to GetInShape — reusable prompt

> Paste everything below the line into a **fresh Claude Code session** opened at
> `C:\Users\plump\Downloads\Health App`. Written for
> `D:\Growth Advice - Book Analysis.docx` (Jake Castillo, *Growth Advice*), but the
> phases work for any growth or marketing book you want held against the app.
>
> First run: 2026-08-25 → `docs/growth-advice-audit-2026-08-25.md`.

---

You are holding an external growth playbook against **GetInShape** and producing a
written audit. This is an **audit, not a fix-up**. Do not change product code. You write
two things and nothing else: the analysis document, and — if I ask — an updated version
of this prompt.

Work the phases in order. Do not skip a phase because an earlier one looked clean.

---

## Inputs

1. **The source document** — `D:\Growth Advice - Book Analysis.docx`.

   It is a zip, and there is no `docx` CLI in this toolchain. Either invoke the `docx`
   skill, or extract it with this, which works:

   ```powershell
   Add-Type -AssemblyName System.IO.Compression.FileSystem
   $zip = [System.IO.Compression.ZipFile]::OpenRead("D:\Growth Advice - Book Analysis.docx")
   $entry = $zip.Entries | Where-Object { $_.FullName -eq "word/document.xml" }
   $reader = New-Object System.IO.StreamReader($entry.Open())
   $xml = $reader.ReadToEnd(); $reader.Close(); $zip.Dispose()
   $xml = $xml -replace '</w:p>', [Environment]::NewLine
   $text = [System.Text.RegularExpressions.Regex]::Replace($xml, '<[^>]+>', '')
   [System.Net.WebUtility]::HtmlDecode($text) | Set-Content -Encoding utf8 source.txt
   ```

   Do not ask me to convert it for you.

2. **`health-app/CLAUDE.md`** — read it in full before forming any opinion. It is
   **authoritative**. The "Hard rules" section is not negotiable, and several long
   paragraphs record *why* a piece of logic looks the way it does. **If the book
   contradicts something documented there, that is a finding, not an error to correct.**

3. **The previous run of this audit**, if one exists in `docs/`. Do not re-report its
   findings as new. Say what changed.

---

## Phase 1 — Reconstruct the source

Read the extracted text end to end. Then build **three separate tables**. Do not
summarize into prose; enumerate.

| Table | Contains | Example |
|---|---|---|
| **Claims** | Arguable assertions about how the world works | "Friction during the buying decision is an asset" |
| **Benchmarks** | Bare numbers you could measure yourself against | "75%+ open-to-paywall rate"; "10.7% vs 2.1%" |
| **Rules** | Direct prescriptions | "1 font, 4px/8px spacing, ~8 semantic colours, 44pt tap targets" |

Every row carries its chapter. Keep the author's framing — if he says something
counterintuitive on purpose ("increase onboarding friction"), record it that way rather
than softening it into the consensus version.

Also record the **stated evidence** behind each claim and where it came from: a
third-party aggregate (RevenueCat), a named company's result, the author's own A/B
tests, or nothing at all. A claim with no evidence behind it must be visibly marked as
such — it changes how much weight it earns in Phase 3.

---

## Phase 2 — Map the app

Launch **three Explore agents in parallel**, in one message. These briefs returned
usable evidence on the first pass — reuse them, adjusting only for what the book
actually covers.

**Agent A — conversion funnel.** Enumerate every onboarding step in order and what it
collects; whether there is a personalization payoff; where the paywall sits and every
entry point into it; hard-wall vs freemium with the gating logic quoted; the exact
free-vs-Pro split from *every* place it is stated; trial mechanics including TWA
detection and where trial copy renders; the paywall screen's full structure (headline,
social proof, price presentation, CTA copy, guarantee, dismiss affordance) with copy
quoted verbatim; the tap-by-tap path from sign-up to first successful log; and the
review/rating ask with its gates.

**Agent B — design system.** Font families, weights, and where declared; the semantic
colour token list with a count; the type scale with exact px, line-height and tracking;
radius steps; whether spacing is a custom scale or Tailwind's default, and whether the
token guard polices it; counts of arbitrary values (`h-[`, `w-[`, `px-[`, `text-[`, …)
with the worst files; every interactive control whose hit area is under 44px, with
`file:line`; `tabular-nums` coverage on the big numeric surfaces; and app identity —
manifest, TWA manifest, icons, OG image, page metadata.

**Agent C — growth instrumentation.** Attribution first and hardest: grep for `utm_`,
`gclid`, `fbclid`, `referrer`, `campaign`, `install_source` across app, lib, migrations
and middleware, and check the purchase payloads. Then the full event catalog grouped by
funnel stage with emit sites, flagging any constant — **or any declared property value**
— with zero emit sites. Then: which funnel questions are answerable today, yes/no with
event names; the share and referral mechanics, and whether the shared artifact carries a
tagged link; the public/SEO surface including programmatic pages, sitemap, robots and
structured data; the lifecycle push rungs and which moments have no push; and whether
any A/B or feature-flag capability exists at all.

Insist on `file:line` in every answer. Tell each agent explicitly: **describe what
exists, do not propose changes.** Proposals in Phase 2 contaminate Phase 4.

---

## Phase 3 — Score each chapter 0–10

One score per chapter, against the mapped reality.

**A score with no `file:line` cited is not a score.** If you cannot point at the code
that earns or loses the points, go back to Phase 2 and find it.

Score what the app *does*, not what it *intends*. A well-argued comment explaining why
something is missing does not raise the score — it belongs in Phase 4's *Contradicts*
bucket instead.

---

## Phase 4 — Classify every gap

Four buckets. Every finding goes in exactly one.

| Bucket | Meaning |
|---|---|
| **Confirms** | The app already does this. Say so and move on — do not pad the doc by re-describing working code at length. |
| **Contradicts** | The app deliberately does the opposite, and documented why. |
| **Absent** | A genuine gap. Nothing in the repo addresses it. |
| **Not applicable** | The advice does not transfer — iOS/App Store tactics on an Android-plus-web product, USD pricing on an INR product, App Store Connect features with no Play equivalent. |

**The Contradicts bucket is the valuable one, and it must never be silently resolved in
the book's favour.** Nearly every rule in `CLAUDE.md` exists because a reasonable-looking
assumption produced a wrong answer in production. When the book and the codebase
disagree, write **both** arguments at their strongest, name what evidence would settle
it, and leave the call to Adarsh. An audit that only agrees with the book is a summary of
the book, not an audit of the app.

Watch for the population mismatch specifically. The book's numbers are US consumer-app
aggregates. GetInShape is India-only, INR-priced, Android-first and unlaunched. A
benchmark can be perfectly real for its population and useless as a local target.

---

## Phase 5 — The reversibility filter

Before ranking anything, sort every candidate proposal into three tiers.

- **Cheap to reverse** — one deploy, hours, no external party. Copy, constants, data
  arrays, where a gate redirects, *adding* capability to Pro.
- **Sticky** — days to weeks, external review, partial propagation. Play Console pricing
  and offers, store-listing metadata.
- **One-way door** — treat as blocked pending an explicit decision from Adarsh. Anything
  touching **the public free-tier claim on `app/page.tsx`** (CLAUDE.md makes it a public
  claim with a synchronization rule); **Play Console monetization config while a release
  is pending verification**; **the `subscriptions` status vocabulary** (`isProStatus` is
  exactly `'active'` or `'trialing'` — adding a value is cheap, repurposing one is not,
  because historical rows carry the old meaning and migrations here are hand-applied with
  no CLI); or **anything that revokes something existing users already have**.

A high-impact proposal on the wrong side of that line ranks below a modest one on the
right side. Say so explicitly wherever it applies.

---

## Phase 6 — Ranked backlog

Order by *what unblocks what*, not by size of claimed upside. Measurement before
optimization; correctness before growth; reversible before sticky.

**Every item names the event that would tell you it worked** — an existing constant from
`lib/posthog/events.ts`, or a new one you specify precisely. An item you cannot attach a
success signal to is a preference, and belongs in a different document.

Where the book's advice would require an experiment, **do the power calculation before
recommending the experiment.** State the assumed traffic rate openly. If the required
sample is unreachable at plausible near-term scale, say that plainly and rank the
instrumentation instead — the honest answer to "should we hard-paywall" is usually "you
cannot currently tell, and here is the cheapest path to being able to."

---

## Standing constraints — hand these to every agent

- **Vercel Hobby.** Exactly two crons and both are used. A third is forbidden.
- **Migrations are applied by hand** in the Supabase SQL editor. No Supabase CLI. Every
  value-changing `UPDATE` must be idempotent. A proposal needing a migration carries more
  cost here than it would elsewhere.
- **Every DB write lives in `app/api/`.** Zero writes in `components/` or `hooks/`.
- **INR pricing only** — ₹299/mo, ₹1,999/yr. Never USD.
- **The 3-day trial is a Play Console offer**, so trial copy renders only inside the TWA.
  Razorpay charges immediately; promising a web trial would be a false claim.
- **No raw hex, no off-scale type, radius or tracking.** `npm run check:tokens` fails the
  build on all of it.
- **Five gates green** before any change is done: `npm test && npx tsc --noEmit && npm run lint && npm run check:tokens && npm run build`.
- **Surgical changes only.** No drive-by refactors.

---

## Anti-patterns — do not do these

- **Do not fabricate social proof.** Pre-launch there are no users to count and no
  reviews to quote. Where the book calls for social proof, the honest substitute is
  *self*-proof — the user's own streak, their own logs, their own projected date.
- **Do not propose iOS-only tactics.** No App Store Connect features, no StoreKit, no
  native App Store review prompt. This ships to Google Play and the web.
- **Do not treat US aggregates as local truth.** Cite them as the book's evidence, never
  as GetInShape's target.
- **Do not propose a third cron.** Ever.
- **Do not resolve a Contradicts finding on your own authority.** Present both sides.
- **Do not report a gap you did not open the file to confirm.** A grep miss is not proof
  of absence, and a grep hit inside `public/sw.js` or `package-lock.json` is not proof of
  presence.
