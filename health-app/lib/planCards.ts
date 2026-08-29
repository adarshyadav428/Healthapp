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
import { PRICE_MONTHLY } from './pricing'

export type PlanCardArgs = {
  firstName?: string | null
  dailyCalorieTarget: number
  proteinTargetG: number
  goal: 'lose' | 'maintain' | 'gain'
  currentWeightKg: number
  targetWeightKg: number
  paceKgPerWeek: number | null
  /** Injected so tests aren't hostage to the clock. */
  now?: Date
}

export function buildPlanCards(args: PlanCardArgs): StoryCard[] {
  const {
    firstName, dailyCalorieTarget, proteinTargetG, goal,
    currentWeightKg, targetWeightKg, paceKgPerWeek, now,
  } = args

  const name = firstName?.trim()
  const cards: StoryCard[] = [
    {
      id: 'plan-hello',
      tone: 'ember',
      glyph: '✅',
      eyebrow: 'You’re all set',
      title: name ? `Here’s your plan, ${name}.` : 'Here’s your plan.',
      body: 'Built from your height, weight, age and how active you are.',
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

  // One quiet mention that Pro exists, framed so it can't contradict the
  // "Free forever" claim on the landing page — everything they just set up is
  // free, always. No trial copy: this runs server-side with no Play detection,
  // and the trial is Play-only. Cheap to reverse (a card is data).
  cards.push({
    id: 'plan-pro',
    glyph: '✨',
    eyebrow: 'Optional',
    title: 'Free forever. Pro when you want more.',
    body: `Everything you've set up is free, always. Pro (${PRICE_MONTHLY}/mo) adds AI photo & chat logging and your full history.`,
  })

  cards.push({
    id: 'plan-go',
    tone: 'ember',
    glyph: '🍽️',
    title: 'Start with one meal.',
    body: 'Not the whole day, not tomorrow. Log the next thing you eat.',
  })

  return cards
}
