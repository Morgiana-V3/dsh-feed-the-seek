import type { Kind, Memory } from './types.js';
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
 * - Objective rules/conventions/facts and identity facts do not fade.
 * - Important memories (importance ≥ 0.8) never fall below the forgetting line.
 * - Forgotten memories are not deleted; they are left out of automatic injection
 *   and can still be found by a deliberate recall.
 */
export declare const FORGET_THRESHOLD = 0.15;
export declare const baseHalfLifeDays: Record<Kind, number>;
/** Accepts the 1–10 scale the organizer is asked for and the older 0–1 values. */
export declare function normalizeImportance(value: number): number;
export declare function strengthCap(memory: Pick<Memory, 'kind' | 'importance'>): number;
/** Knowledge the user stated about the world or about who is who does not fade with disuse. */
export declare function isDurableKnowledge(memory: Memory): boolean;
export declare function memoryStrength(memory: Memory, uses?: string[], now?: number): number;
export declare function isForgotten(memory: Memory, uses?: string[], now?: number): boolean;
