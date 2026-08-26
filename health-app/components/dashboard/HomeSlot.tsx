'use client'

import { createContext, useContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { pickDashboardMoment, type DashboardMoment } from '../../lib/dashboardMoments'

/**
 * Home has exactly one attention slot, and this decides who gets it.
 *
 * The ordering itself is pure and lives in lib/dashboardMoments.ts. What was
 * missing is a way to *apply* it to the six cards that decide their own
 * eligibility by probing the browser — localStorage dismissals, the Digital
 * Goods API, `beforeinstallprompt`, an existing push subscription. Their
 * eligibility genuinely isn't knowable until they mount, which is why
 * dashboardMoments could only ever coordinate the three cards Home knew about
 * from props, leaving five to pile up underneath.
 *
 * So the cards keep their own probes — they stay the one place that knows how
 * to answer "could I speak" — and simply *claim* the slot instead of rendering
 * on the strength of it. Lifting those probes into a central hook was the
 * alternative and was rejected: it would have re-implemented six components'
 * gating logic in a second place, and the two copies would have drifted the
 * first time one of them was fixed. This codebase has that scar already
 * (see the FoodLanding/FoodSearch note in CLAUDE.md).
 *
 * Cost: a claim arrives during the mount pass, so a card wins its slot on the
 * following render. That is a frame, and it is the right trade — the slot
 * appears once it is actually decided, rather than three cards appearing and
 * two vanishing.
 */

type ClaimFn = (moment: DashboardMoment, eligible: boolean) => void

const HomeSlotContext = createContext<{ winner: DashboardMoment | null; claim: ClaimFn } | null>(null)

export function HomeSlotProvider({ children }: { children: ReactNode }) {
  const [claims, setClaims] = useState<Partial<Record<DashboardMoment, boolean>>>({})

  const claim = useCallback<ClaimFn>((moment, eligible) => {
    setClaims((prev) => {
      // Bail out when nothing changed — every card calls this from an effect on
      // each render, and setting identical state would loop forever.
      if (prev[moment] === eligible) return prev
      return { ...prev, [moment]: eligible }
    })
  }, [])

  const winner = useMemo(() => {
    const eligible = (Object.keys(claims) as DashboardMoment[]).filter((m) => claims[m])
    return pickDashboardMoment(eligible)
  }, [claims])

  const value = useMemo(() => ({ winner, claim }), [winner, claim])

  return <HomeSlotContext.Provider value={value}>{children}</HomeSlotContext.Provider>
}

/**
 * Claim Home's attention slot for `moment`, and learn whether you won it.
 *
 * `eligible` is the card's own answer to "could I speak" — pass the result of
 * whatever probe it already does. Returns true only when this card both could
 * speak and outranks everything else that could.
 *
 * Outside a provider it returns `eligible` unchanged, so a card rendered
 * anywhere else (a story surface, a test, Settings) behaves exactly as it did
 * before this existed rather than silently disappearing.
 */
export function useHomeSlot(moment: DashboardMoment, eligible: boolean): boolean {
  const ctx = useContext(HomeSlotContext)
  const claim = ctx?.claim

  // Claim from an effect, never during render: calling the provider's setState
  // while a child renders is the "Cannot update a component while rendering a
  // different component" violation, and React is right to complain.
  //
  // The ordering this produces is the one we want anyway. On the first pass no
  // claims have landed, so `winner` is null and **nothing renders**; the winner
  // appears on the next pass. Cards therefore fade in one at a time rather than
  // three appearing and two vanishing.
  useEffect(() => {
    if (claim) claim(moment, eligible)
  }, [claim, moment, eligible])

  if (!ctx) return eligible
  return eligible && ctx.winner === moment
}
