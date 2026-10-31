import type { Kind, Memory } from './model.js'

/**
 * Memory strength, adapted from the earlier bot's ACT-R style model.
 *
 *   cap       = (0.4 + 0.6 × importance) × kindWeight          how strong it can ever be
 *   age       = days since the later of: last content update, last real use
 *   halfLife  = baseHalfLife[kind] × (1 + importance)          a real half-life, in days
 *   recency   = 0.5 ^ (age / halfLife)
 *   boost     = Σ over recent real uses of daysSince^-0.5      frequent recent use helps
 *   strength  = min(cap, cap × recency × (1 + 0.1 × boost))
 *
 * Differences from the old formula, on purpose:
 * - No pair of parameters that cancel out; halfLife is the actual half-life.
 * - A real use resets the clock, so being remembered keeps a memory alive.
 * - Objective rules/conventions/facts, identity facts and lasting statements do not fade.
 * - Important memories (importance ≥ 0.8) never fall below the forgetting line.
 * - Forgotten memories are not deleted; they are left out of automatic injection
 *   and can still be found by a deliberate recall.
 */
export const FORGET_THRESHOLD = 0.15
const NEVER_FORGET_IMPORTANCE = 0.8
const DAY = 86_400_000

export const baseHalfLifeDays: Record<Kind, number> = {
  self: 40,
  cognition: 30,
  resonance: 25,
  experience: 15,
}
const kindWeight: Record<Kind, number> = {
  self: 1,
  cognition: 0.9,
  resonance: 0.85,
  experience: 0.8,
}

/** Accepts the 1–10 scale the organizer is asked for and the older 0–1 values. */
export function normalizeImportance(value: number): number {
  const scaled = value >= 1 ? value / 10 : value
  return Math.min(1, Math.max(0, scaled))
}

export function strengthCap(memory: Pick<Memory, 'kind' | 'importance'>): number {
  return (0.4 + 0.6 * normalizeImportance(memory.importance)) * kindWeight[memory.kind]
}

/** Knowledge the user stated about the world or about who is who does not fade with disuse. */
export function isDurableKnowledge(memory: Memory): boolean {
  if (memory.alias) {
    return true
  }
  // Something the user said holds from now on ("以后都…") does not fade with disuse.
  if (memory.durability === 'lasting' && memory.status === 'active') {
    return true
  }
  return (
    memory.kind === 'cognition' &&
    ['rule', 'convention', 'fact'].includes(memory.knowledge.category)
  )
}

export function memoryStrength(memory: Memory, uses: string[] = [], now = Date.now()): number {
  const cap = strengthCap(memory)
  if (isDurableKnowledge(memory)) {
    return cap
  }
  const importance = normalizeImportance(memory.importance)
  const times = uses.map(Date.parse).filter(Number.isFinite)
  const anchor = Math.max(Date.parse(memory.updatedAt) || 0, ...times)
  const age = Math.max(0, now - anchor) / DAY
  const halfLife = baseHalfLifeDays[memory.kind] * (1 + importance)
  const recency = Math.pow(0.5, age / halfLife)
  const boost = times.reduce((sum, at) => sum + Math.pow(Math.max(0.01, (now - at) / DAY), -0.5), 0)
  const strength = Math.min(cap, cap * recency * (1 + 0.1 * boost))
  return importance >= NEVER_FORGET_IMPORTANCE
    ? Math.max(strength, FORGET_THRESHOLD + 0.05)
    : strength
}

export function isForgotten(memory: Memory, uses: string[] = [], now = Date.now()): boolean {
  return memoryStrength(memory, uses, now) < FORGET_THRESHOLD
}
