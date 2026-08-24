/**
 * "Here's your plan" — the story shown once, immediately after onboarding.
 *
 * It replaces a 1.6s confetti overlay. Confetti congratulates someone for
 * filling in a form; this hands them the thing the form was *for*. At current
 * scale the biggest funnel risk isn't conversion, it's activation — people who
 * sign up and never log a meal — and the gap between "I answered six questions"
 * and "I know what to do tomorrow" is where they're lost.
 *
 * Pure, so the editorial rules (which numbers earn a card, what happens without
 * a projection) are testable.
 */

import type { StoryCard } from '../components/story/types'
import { projectGoalDate, formatGoalDate } from './projection'
import { planIntroFor, obstaclePlanLine } from './onboardingOptions'

export type PlanCardArgs = {
  firstName?: string | null
  dailyCalorieTarget: number
  proteinTargetG: number
  goal: 'lose' | 'maintain' | 'gain'
  currentWeightKg: number
  targetWeightKg: number
  paceKgPerWeek: number | null
  /**
   * The two personalising answers from onboarding (migration 039). Both
   * optional: every account created before those questions existed has null
   * here, and the story must read identically well without them.
   */
  obstacles?: readonly string[] | null
  trackingExperience?: string | null
  /** Injected so tests aren't hostage to the clock. */
  now?: Date
}

export function buildPlanCards(args: PlanCardArgs): StoryCard[] {
  const {
    firstName, dailyCalorieTarget, proteinTargetG, goal,
    currentWeightKg, targetWeightKg, paceKgPerWeek,
    obstacles, trackingExperience, now,
  } = args

  const name = firstName?.trim()
  const cards: StoryCard[] = [
    {
      id: 'plan-hello',
      tone: 'ember',
      glyph: '✅',
      eyebrow: 'You’re all set',
      title: name ? `Here’s your plan, ${name}.` : 'Here’s your plan.',
      // Shaped by the tracking-history answer, and falling back to the generic
      // line when it was skipped or predates the question. Someone who has
      // tried and stopped needs the opposite reassurance from a first-timer,
      // and this used to write one sentence for both.
      body: planIntroFor(trackingExperience),
    },
  ]

  if (dailyCalorieTarget > 0) {
    cards.push({
      id: 'plan-calories',
      glyph: '🔥',
      value: dailyCalorieTarget.toLocaleString('en-IN'),
      label: 'calories a day',
      body:
        goal === 'maintain'
          ? 'Eat around this and your weight holds steady.'
          : 'Hit this most days and the rest takes care of itself.',
    })
  }

  // Protein gets its own card and the other two macros don't. It's the one
  // people under-eat, the one that protects muscle in a deficit, and the only
  // macro the app actively coaches on — three cards would dilute all of it.
  if (proteinTargetG > 0) {
    cards.push({
      id: 'plan-protein',
      glyph: '🥚',
      value: `${Math.round(proteinTargetG)}g`,
      label: 'protein a day',
      body: 'The one number worth chasing. Dal, curd, eggs, paneer, chicken.',
    })
  }

  // The projected goal date — the single most motivating number available, and
  // only honest when there's a pace and a gap to close.
  const projection =
    goal !== 'maintain' && paceKgPerWeek
      ? projectGoalDate(currentWeightKg, targetWeightKg, paceKgPerWeek, now)
      : null

  if (projection) {
    cards.push({
      id: 'plan-goal-date',
      glyph: '🎯',
      value: formatGoalDate(projection.date),
      label: `when you reach ${targetWeightKg} kg`,
      body: 'At your chosen pace. Log consistently and this is the date to beat.',
    })
  }

  // What they said gets in the way, answered. This is the card that makes the
  // extra onboarding screen worth its drop-out risk: an answer that never
  // surfaces is friction the user paid for and got nothing back from.
  //
  // It sits *before* the closing card deliberately. The story has to end on
  // "log one meal" — that is the action the whole surface exists to produce,
  // and tests/planCards.test.ts pins it.
  const obstacleLine = obstaclePlanLine(obstacles)
  if (obstacleLine) {
    cards.push({
      id: 'plan-obstacle',
      glyph: '🚧',
      eyebrow: 'The hard part',
      label: 'We’ll aim at this',
      body: obstacleLine,
    })
  }

  cards.push({
    id: 'plan-go',
    tone: 'ember',
    glyph: '🍽️',
    title: 'Start with one meal.',
    body: 'Not the whole day, not tomorrow. Log the next thing you eat.',
  })

  return cards
}
