import { z } from 'zod';

export const Kind = z.enum(['cognition', 'experience', 'resonance', 'self']);
export type Kind = z.infer<typeof Kind>;
export const Scope = z.object({ user: z.string().min(1).max(100), persona: z.string().min(1).max(100), project: z.string().max(500).default('') });
export type Scope = z.infer<typeof Scope>;
export interface Source { id: string; session: string; event?: string; role: string; text: string; at: string; scope: Scope }
export const Knowledge = z.object({
  category: z.enum(['person','fact','rule','convention','opinion','preference','event','relationship','tendency']).default('fact'),
  domain: z.string().max(160).default(''), edition: z.string().max(100).default(''),
  conditions: z.string().max(400).default(''),
}).strict();
export type Knowledge = z.infer<typeof Knowledge>;
export interface Persona { id: string; name: string; createdAt: string }
export interface Trait { id: string; text: string; scope: Scope; sources: string[]; version: number; updatedAt: string }
export interface Memory {
  id: string; kind: Kind; text: string; tags: string[]; scope: Scope;
  evidence: 'explicit' | 'inferred'; importance: number; status: 'active' | 'inactive';
  version: number; sources: string[]; createdAt: string; updatedAt: string;
  knowledge: Knowledge; confidence: number;
  /** How long the statement is meant to hold. Absent on records written before 0.2.15. */
  durability?: Durability;
  /** For self observations: what kind of evidence backs it. Absent on older records. */
  selfKind?: SelfKind;
  /** Naming fact: one name, of one kind. Kept apart so it never competes with other profile items. */
  alias?: Alias;
}
/**
 * user_preferred: what the user wants to be called (a newer one replaces the older);
 * user_nickname: a nickname seen in use (kept as history);
 * assistant_name: the name the user gave her (a newer one replaces the older).
 */
export const Alias = z.object({ kind: z.enum(['user_preferred', 'user_nickname', 'assistant_name']), value: z.string().trim().min(1).max(40) }).strict();
export type Alias = z.infer<typeof Alias>;
export const Durability = z.enum(['turn', 'situational', 'habit', 'lasting']);
export type Durability = z.infer<typeof Durability>;
/** behavior/verified need the tool trace; feedback needs a user source; intention and claim never count as growth. */
export const SelfKind = z.enum(['behavior', 'feedback', 'intention', 'claim', 'verified']);
export type SelfKind = z.infer<typeof SelfKind>;
export const Operation = z.object({
  action: z.enum(['ADD', 'UPDATE', 'DELETE', 'NONE']), target: z.string().optional(),
  expectedVersion: z.number().int().positive().optional(),
  kind: Kind.optional(), text: z.string().trim().max(1000).optional(),
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
  global: z.boolean().default(false),
  sources: z.array(z.string()).min(1).max(12), reason: z.string().trim().min(1).max(500)
}).strict();
export type Operation = z.infer<typeof Operation>;
/** steady is the pre-0.2.15 name of calm; it stays readable so stored states keep working. */
export const Mood = z.enum(['calm', 'happy', 'hopeful', 'concerned', 'discouraged', 'annoyed', 'shy', 'relieved', 'steady']);
export type Mood = z.infer<typeof Mood>;
export const StateInput = z.object({
  mood: Mood,
  reason: z.string().trim().min(1).max(400), behavior: z.string().trim().min(1).max(400),
  intensity: z.number().min(0).max(0.7), sources: z.array(z.string()).min(1).max(12),
  topic: z.string().trim().min(1).max(100),
  /** How the character reads the event, including what is still uncertain. */
  appraisal: z.string().trim().max(300).optional(),
  /** One short line for the UI; technical detail stays in the linked experience. */
  displayReason: z.string().trim().max(40).optional(),
  /** Certainty of this emotional reading; not the same as intensity. */
  confidence: z.number().min(0).max(1).optional(),
  /** Memory the state reacts to (a candidate id, or "op:N" for a memory created in the same batch). */
  target: z.string().max(100).optional(),
  /** relationship = background mood across projects; task = reaction inside this project. */
  layer: z.enum(['task', 'relationship']).optional(),
}).strict();
export type StateInput = z.infer<typeof StateInput>;
export interface State extends StateInput { id: string; scope: Scope; updatedAt: string; onsetAt?: string; resolvedAt?: string; effectiveIntensity: number }
export const Proposal = z.object({ operations: z.array(Operation).max(8), state: StateInput.nullable().optional() }).strict();
export type Proposal = z.infer<typeof Proposal>;
export interface RecallItem { memory: Memory; score: number; reasons: string[] }
export interface Snapshot { query: string; scope: Scope; items: RecallItem[]; states: State[]; context: string; mode: 'keyword' | 'hybrid'; note: string; revision: number }
export const Settings = z.object({
  enabled: z.boolean().default(true), learning: z.boolean().default(true), growth: z.boolean().default(true),
  emotion: z.boolean().default(true),
  retrievalMode: z.enum(['local', 'semantic']).default('local'),
  embeddingUrl: z.string().max(500).default(''), embeddingModel: z.string().max(200).default(''),
  embeddingProtocol: z.enum(['auto', 'openai', 'ollama', 'doubao']).default('auto'),
  embeddingDimensions: z.number().int().min(0).max(8192).refine(value => value === 0 || value >= 2).default(0),
  embeddingKeyEnv: z.string().regex(/^[A-Z][A-Z0-9_]*$/).default('YUWEN_EMBEDDING_API_KEY'),
});
export type Settings = z.infer<typeof Settings>;
export const DEFAULT_SCOPE: Scope = { user: 'owner', persona: 'yuwen', project: '' };
export function sameOwner(a: Scope, b: Scope) { return a.user === b.user && a.persona === b.persona; }
export function visible(a: Scope, b: Scope) { return sameOwner(a, b) && (!a.project || a.project === b.project); }
