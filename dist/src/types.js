import { z } from 'zod';
export const Kind = z.enum(['cognition', 'experience', 'resonance', 'self']);
export const Scope = z.object({ user: z.string().min(1).max(100), persona: z.string().min(1).max(100), project: z.string().max(500).default('') });
export const Knowledge = z.object({
    category: z.enum(['person', 'fact', 'rule', 'convention', 'opinion', 'preference', 'event', 'relationship', 'tendency']).default('fact'),
    domain: z.string().max(160).default(''), edition: z.string().max(100).default(''),
    conditions: z.string().max(400).default(''),
}).strict();
/**
 * user_preferred: what the user wants to be called (a newer one replaces the older);
 * user_nickname: a nickname seen in use (kept as history);
 * assistant_name: the name the user gave her (a newer one replaces the older).
 */
export const Alias = z.object({ kind: z.enum(['user_preferred', 'user_nickname', 'assistant_name']), value: z.string().trim().min(1).max(40) }).strict();
export const Durability = z.enum(['turn', 'situational', 'habit', 'lasting']);
/** behavior/verified need the tool trace; feedback needs a user source; intention and claim never count as growth. */
export const SelfKind = z.enum(['behavior', 'feedback', 'intention', 'claim', 'verified']);
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
/** steady is the pre-0.2.15 name of calm; it stays readable so stored states keep working. */
export const Mood = z.enum(['calm', 'happy', 'hopeful', 'concerned', 'discouraged', 'annoyed', 'shy', 'relieved', 'steady']);
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
export const Proposal = z.object({ operations: z.array(Operation).max(8), state: StateInput.nullable().optional() }).strict();
export const Settings = z.object({
    enabled: z.boolean().default(true), learning: z.boolean().default(true), growth: z.boolean().default(true),
    emotion: z.boolean().default(true),
    retrievalMode: z.enum(['local', 'semantic']).default('local'),
    embeddingUrl: z.string().max(500).default(''), embeddingModel: z.string().max(200).default(''),
    embeddingProtocol: z.enum(['auto', 'openai', 'ollama', 'doubao']).default('auto'),
    embeddingDimensions: z.number().int().min(0).max(8192).refine(value => value === 0 || value >= 2).default(0),
    embeddingKeyEnv: z.string().regex(/^[A-Z][A-Z0-9_]*$/).default('YUWEN_EMBEDDING_API_KEY'),
});
export const DEFAULT_SCOPE = { user: 'owner', persona: 'yuwen', project: '' };
export function sameOwner(a, b) { return a.user === b.user && a.persona === b.persona; }
export function visible(a, b) { return sameOwner(a, b) && (!a.project || a.project === b.project); }
//# sourceMappingURL=types.js.map