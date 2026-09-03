/**
 * Builds the Pro welcome sequence from a user's own history.
 *
 * Pure, and separate from the route, because the interesting decisions here are
 * editorial rather than technical — which stats earn a card, what happens to
 * someone who upgraded on day one, and which numbers are never worth showing at
 * the moment somebody has just paid. Those deserve tests.
 *
 * The sequence always opens on the moment and closes on an action. What sits in
 * between is whatever this user has actually earned — a card is included only
 * when its number means something, so nobody is shown a proud "0".
 */

import type { StoryCard } from '../components/story/types'
import type { WrappedStats } from './wrappedStats'
import { AI_TRIAL_SCANS } from './aiTrial'
import { RESCUES_PER_MONTH } from './streakRescue'

export type WelcomeCardArgs = {
  stats: WrappedStats
  /** Used only to warm up the opening line; absent for anonymous accounts. */
  firstName?: string | null
  /** Free AI calls already spent, for the "what changed" card. */
  aiTrialUsed?: number
}

/** Below this a dish count is a coincidence, not a habit worth a card. */
const MIN_TOP_FOOD_COUNT = 3

export function buildWelcomeCards({ stats, firstName, aiTrialUsed = 0 }: WelcomeCardArgs): StoryCard[] {
  const name = firstName?.trim()

  const opening: StoryCard = {
    id: 'welcome-hello',
    tone: 'ember',
    glyph: '👑',
    eyebrow: 'GetInShape Pro',
    title: name ? `You're Pro, ${name}.` : "You're Pro.",
    body: stats.hasStory
      ? 'Before the new stuff — here’s what you’ve already done.'
      : 'Everything is unlocked from right now. Here’s where to start.',
  }

  const unlocked: StoryCard = {
    id: 'welcome-unlocked',
    glyph: '🔓',
    title: 'What just changed',
    swaps: [
      {
        // Naming the spent count makes the wall they hit concrete. Someone who
        // never used a scan gets the allowance framed instead of a usage tally,
        // because "0 of 3 used" reads like they're being told off.
        before: aiTrialUsed > 0
          ? `${Math.min(aiTrialUsed, AI_TRIAL_SCANS)} of ${AI_TRIAL_SCANS} AI scans used`
          : `${AI_TRIAL_SCANS} free AI scans`,
        after: 'Unlimited',
      },
      // Cohort-neutral: the free window is 7 days pre-cutoff and 5 after
      // (lib/freeTier.ts), and this card has no access to which one applied.
      { before: 'Recent days only', after: 'Full history' },
      { before: 'No custom foods', after: 'Your own recipes' },
    ],
  }

  // The only card that hands over an object rather than reporting a number.
  // It's last before the CTA on purpose: everything above is either history or
  // a wall coming down, and this is the one thing Pro actually *gives*.
  const rescue: StoryCard = {
    id: 'welcome-rescue',
    glyph: '🛟',
    value: String(RESCUES_PER_MONTH),
    label: 'Streak Rescue a month',
    body: 'Miss a day and break your streak? Repair it — yours now, every month.',
  }

  const closing: StoryCard = {
    id: 'welcome-go',
    tone: 'ember',
    glyph: '📸',
    title: 'Now go use it.',
    body: 'Point the camera at your next meal. No counter, no limit.',
  }

  // ── Day one ────────────────────────────────────────────────────────────
  // Someone who upgraded before logging anything has no story, and the honest
  // move is to say so rather than parade a screen of zeroes at the exact
  // moment they've handed over money.
  if (!stats.hasStory) {
    return [
      opening,
      {
        id: 'welcome-day-one',
        glyph: '🌱',
        title: 'Day one.',
        body: 'Log a few meals and this screen fills up with your own numbers — streaks, your most-eaten dishes, the weight curve.',
      },
      unlocked,
      rescue,
      closing,
    ]
  }

  // ── The story ──────────────────────────────────────────────────────────
  const story: StoryCard[] = []

  story.push({
    id: 'welcome-days',
    glyph: '📆',
    value: String(stats.daysLogged),
    label: stats.daysLogged === 1 ? 'day logged' : 'days logged',
    body:
      stats.daysLogged >= 21 ? 'That’s not a phase any more. That’s a habit.' :
      stats.daysLogged >= 7  ? 'A week of showing up is the hardest week.' :
      undefined,
  })

  if (stats.totalMeals >= 10) {
    story.push({
      id: 'welcome-meals',
      glyph: '🍛',
      value: String(stats.totalMeals),
      label: 'meals logged',
    })
  }

  // The most specific, most shareable card in the set — and the one that
  // proves the app has been paying attention.
  if (stats.topFood && stats.topFood.count >= MIN_TOP_FOOD_COUNT) {
    story.push({
      id: 'welcome-top-food',
      glyph: '🥘',
      value: `${stats.topFood.count}×`,
      label: stats.topFood.name,
      body: 'Your most-logged dish. No judgement.',
    })
  }

  if (stats.longestStreakDays >= 3) {
    story.push({
      id: 'welcome-streak',
      glyph: '🔥',
      value: String(stats.longestStreakDays),
      label: 'day best streak',
    })
  }

  // Weight only when it's good news. A gain is real and the app shows it
  // everywhere else — but a celebration screen is not where somebody learns
  // it, and "+1.5 kg" seconds after paying reads as an accusation.
  if (stats.weightDeltaKg != null && stats.weightDeltaKg <= -0.1) {
    story.push({
      id: 'welcome-weight',
      glyph: '⚖️',
      value: `${Math.abs(stats.weightDeltaKg).toFixed(1)} kg`,
      label: 'down since you started',
    })
  }

  return [opening, ...story, unlocked, rescue, closing]
}
