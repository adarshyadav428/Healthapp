/**
 * Card shapes for the story engine.
 *
 * Kept in their own file, free of JSX and of `'use client'`, because the cards
 * are built on the server (Server Component shell fetches the stats, Client
 * Component renders them — the pattern the rest of the app follows) and then
 * cross the serialization boundary as props. That rules out render functions
 * or component references on a card: everything here has to survive being
 * turned into JSON.
 */

/**
 * `ember` is full-bleed gradient with white text — the deliberate break from
 * the Ember Air restraint, reserved for the opening and closing beats.
 * `calm` is the ordinary canvas, used for the stat cards in between so the
 * loud ones keep their impact.
 */
export type StoryTone = 'ember' | 'calm'

export type StorySwap = {
  /** The old state, rendered struck through — e.g. "3 of 3 scans used". */
  before: string
  /** What it became — e.g. "Unlimited". */
  after: string
}

export type StoryCard = {
  /** Stable id — used for analytics and as the React key. */
  id: string
  tone?: StoryTone
  /** A single emoji. Never an image: stories must cost no extra bytes. */
  glyph?: string
  /** Small label above the headline. */
  eyebrow?: string
  /** The one big number or word the card exists to show. */
  value?: string
  /** Sits under `value`, or acts as the headline when there is no value. */
  label?: string
  /** Display heading, for cards that lead with words rather than a figure. */
  title?: string
  /** One supporting sentence. Keep it to one. */
  body?: string
  /** Before → after pairs, for "here's what changed" cards. */
  swaps?: StorySwap[]
}
