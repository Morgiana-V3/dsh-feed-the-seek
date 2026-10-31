import { type Embedder, type EmbeddingCredentials } from '../embedding/index.js';
import { type Memory, type Scope, type Snapshot, type Source } from '../memory/index.js';
import { Store } from '../storage/index.js';
export declare function terms(text: string): Set<string>;
/**
 * Memories are written in the companion's own voice. In a system prompt "你" usually means the
 * model, so every injected block states who is who before using either pronoun.
 */
export declare const VOICE_NOTE = "\uFF08\u4EE5\u4E0B\u7528\u6211\u7684\u53E3\u543B\u8BB0\u5F55\uFF1A\u201C\u6211\u201D\u6307\u6211\u81EA\u5DF1\uFF0C\u4E5F\u5C31\u662F\u6B63\u5728\u56DE\u7B54\u7684\u52A9\u624B\uFF1B\u201C\u4F60\u201D\u6307\u6B63\u5728\u548C\u6211\u5BF9\u8BDD\u7684\u7528\u6237\u3002\uFF09";
export declare function quoteSupported(quote: string | undefined, sources: Source[]): boolean;
/** Returns why an organizer operation must not be stored, or '' when it may proceed. */
export declare function strictRejection(action: string, text: string, oldText: string | undefined, durability: string | undefined, durabilitySent: boolean, conditions: string): string;
/** Trigger words that appear verbatim (ignoring case and spacing) in at least one cited source. */
export declare function literalTags(tags: string[], sources: Source[]): string[];
/** One compact line: kind and basis, then the text, then only the conditions that are set. */
export declare function describeMemory(candidateMemory: Memory): string;
export declare class Engine {
    store: Store;
    private embeddingOverride?;
    credentials?: EmbeddingCredentials | undefined;
    constructor(store: Store, embeddingOverride?: Embedder | undefined, credentials?: EmbeddingCredentials | undefined);
    embedder(): Embedder | undefined;
    /**
     * strict: the proposal came from the organizer model. Then claims are checked against
     * their sources (user quote, durability, self-evidence, length) before they are stored.
     * Demo data and direct calls keep the older, lenient contract.
     */
    apply(raw: unknown, scope: Scope, allowedIds: string[], allowedSources: string[], options?: {
        strict?: boolean;
        retentionPolicy?: boolean;
    }): Memory[];
    index(scope: Scope, signal?: AbortSignal): Promise<number>;
    searchText(candidateMemory: Memory): string;
    candidates(scope: Scope, query: string, signal?: AbortSignal, related?: {
        sessions?: string[];
        now?: number;
    }): Promise<Memory[]>;
    /**
     * A standing, unconditional statement. Only used for the deliberate recall's "general profile"
     * and for older preferences that were filed as cognition before requests moved to self.
     */
    isProfile(memory: Memory): boolean;
    /** How you want her to behave from now on: a standing self request, or such a preference filed earlier as cognition. */
    isStandingRequest(memory: Memory): boolean;
    /**
     * Stable layer: who she is, how she was asked to behave, and what recently changed about her —
     * the whole self dimension, plus naming. Everything else (facts about you and the world,
     * experiences, the relationship) is recalled only when the topic touches it.
     * Rendered deterministically (fixed order, no dates, no scores) so the prompt prefix stays
     * cacheable; it only changes when a self observation or a name changes.
     */
    stableContext(scope: Scope, _now?: number, options?: {
        ignoreSwitch?: boolean;
    }): {
        text: string;
        ids: Set<string>;
    };
    /**
     * Turn layer (automatic) or a deliberate recall (the feed_the_seek_recall tool).
     * Automatic: skips what the stable layer carries, forgotten memories, and memories learned from
     * the excluded (current) sessions — their words are already in the conversation history.
     * Deliberate: searches everything, including forgotten memories.
     */
    recall(scope: Scope, query: string, signal?: AbortSignal, options?: {
        deliberate?: boolean;
        excludeIds?: Set<string>;
        excludeSessions?: Set<string>;
        now?: number;
    }): Promise<Snapshot>;
}
