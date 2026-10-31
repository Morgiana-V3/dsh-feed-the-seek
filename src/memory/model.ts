import { z } from 'zod'
import { StateInput, type State } from '../emotion/index.js'

export const Kind = z.enum(['cognition', 'experience', 'resonance', 'self'])
export type Kind = z.infer<typeof Kind>
export const Scope = z.object({
  user: z.string().min(1).max(100),
  persona: z.string().min(1).max(100),
  project: z.string().max(500).default(''),
})
export type Scope = z.infer<typeof Scope>
export interface Source {
  id: string
  session: string
  event?: string
  role: string
  text: string
  at: string
  scope: Scope
}
export const Knowledge = z
  .object({
    category: z
      .enum([
        'person',
        'fact',
        'rule',
        'convention',
        'opinion',
        'preference',
        'event',
        'relationship',
        'tendency',
      ])
      .default('fact'),
    domain: z.string().max(160).default(''),
    edition: z.string().max(100).default(''),
    conditions: z.string().max(400).default(''),
  })
  .strict()
export type Knowledge = z.infer<typeof Knowledge>
/**
 * How a memory takes part in conversations, as the settings page shows it:
 * pinned – carried in every conversation (the stable layer);
 * topical – recalled when the topic touches it;
 * faded – no longer recalled automatically, still found by a deliberate recall;
 * record – kept as a record only (unverified self descriptions are never recalled).
 */
export type Presence = 'pinned' | 'topical' | 'faded' | 'record'
export interface Memory {
  id: string
  kind: Kind
  text: string
  tags: string[]
  scope: Scope
  evidence: 'explicit' | 'inferred'
  importance: number
  status: 'active' | 'inactive'
  version: number
  sources: string[]
  createdAt: string
  updatedAt: string
  knowledge: Knowledge
  confidence: number
  /** How long the statement is meant to hold. Absent on records written before 0.2.15. */
  durability?: Durability
  /** For self observations: what kind of evidence backs it. Absent on older records. */
  selfKind?: SelfKind
  /** Naming fact: one name, of one kind. Kept apart so it never competes with other profile items. */
  alias?: Alias
  /** Why this information deserves long-term retention; absent on legacy records. */
  retention?: Retention
}
/**
 * user_preferred: what the user wants to be called (a newer one replaces the older);
 * user_nickname: a nickname seen in use (kept as history);
 * assistant_name: the name the user gave her (a newer one replaces the older).
 */
export const Alias = z
  .object({
    kind: z.enum(['user_preferred', 'user_nickname', 'assistant_name']),
    value: z.string().trim().min(1).max(40),
  })
  .strict()
export type Alias = z.infer<typeof Alias>
export const Durability = z.enum(['turn', 'situational', 'habit', 'lasting'])
export type Durability = z.infer<typeof Durability>
/** behavior/verified need the tool trace; feedback needs a user source; intention and claim never count as growth. */
export const SelfKind = z.enum(['behavior', 'feedback', 'intention', 'claim', 'verified'])
export type SelfKind = z.infer<typeof SelfKind>
export const Retention = z
  .object({
    basis: z.enum(['knowledge', 'preference', 'relationship', 'milestone', 'feedback']),
    reason: z.string().trim().min(1).max(200),
  })
  .strict()
export type Retention = z.infer<typeof Retention>
export const Operation = z
  .object({
    action: z.enum(['ADD', 'UPDATE', 'DELETE', 'NONE']),
    target: z.string().optional(),
    expectedVersion: z.number().int().positive().optional(),
    kind: Kind.optional(),
    text: z.string().trim().max(1000).optional(),
    tags: z.array(z.string().max(40)).max(8).default([]),
    evidence: z.enum(['explicit', 'inferred']).default('inferred'),
    // 1–10 as asked of the organizer; older 0–1 values are still accepted (see normalizeImportance).
    importance: z.number().min(0).max(10).default(0.5),
    confidence: z.number().min(0).max(1).default(0.5),
    knowledge: Knowledge.prefault({}),
    consolidate: z.boolean().default(false),
    userQuote: z.string().trim().max(300).optional(),
    durability: Durability.optional(),
    selfKind: SelfKind.optional(),
    alias: Alias.optional(),
    retention: Retention.optional(),
    global: z.boolean().default(false),
    sources: z.array(z.string()).min(1).max(12),
    reason: z.string().trim().min(1).max(500),
  })
  .strict()
export type Operation = z.infer<typeof Operation>
export const Proposal = z
  .object({ operations: z.array(Operation).max(8), state: StateInput.nullable().optional() })
  .strict()
export type Proposal = z.infer<typeof Proposal>
export interface RecallItem {
  memory: Memory
  score: number
  reasons: string[]
}
export interface Snapshot {
  query: string
  scope: Scope
  items: RecallItem[]
  states: State[]
  context: string
  mode: 'keyword' | 'hybrid'
  note: string
  revision: number
}
export const DEFAULT_SCOPE: Scope = { user: 'owner', persona: 'default', project: '' }
export function sameOwner(leftScope: Scope, rightScope: Scope) {
  return leftScope.user === rightScope.user && leftScope.persona === rightScope.persona
}
/**
 * One companion, one memory: nothing is split by project or session. The project
 * field stays readable on older records but no longer limits where a memory applies.
 */
export function visible(leftScope: Scope, rightScope: Scope) {
  return sameOwner(leftScope, rightScope)
}
