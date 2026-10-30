import { Store } from './store.js';
import { type Scope, type Memory, type Snapshot, type Source } from './types.js';
import { type Embedder } from './embedding.js';
import { type EmbeddingCredentials } from './embedding-credentials.js';
export declare function terms(text: string): Set<string>;
import { localDay } from './time.js';
/**
 * Memories are written in the companion's own voice. In a system prompt "你" usually means the
 * model, so every injected block states who is who before using either pronoun.
 */
export declare const VOICE_NOTE = "\uFF08\u4EE5\u4E0B\u7528\u6211\u7684\u53E3\u543B\u8BB0\u5F55\uFF1A\u201C\u6211\u201D\u6307\u6211\u81EA\u5DF1\uFF0C\u4E5F\u5C31\u662F\u6B63\u5728\u56DE\u7B54\u7684\u52A9\u624B\uFF1B\u201C\u4F60\u201D\u6307\u6B63\u5728\u548C\u6211\u5BF9\u8BDD\u7684\u7528\u6237\u3002\uFF09";
export { localDay };
export declare function quoteSupported(quote: string | undefined, sources: Source[]): boolean;
/** Returns why an organizer operation must not be stored, or '' when it may proceed. */
export declare function strictRejection(action: string, text: string, oldText: string | undefined, durability: string | undefined, durabilitySent: boolean, conditions: string): string;
/** One compact line: kind and basis, then the text, then only the conditions that are set. */
export declare function describeMemory(m: Memory): string;
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
    }): Memory[];
    index(scope: Scope, signal?: AbortSignal): Promise<number>;
    searchText(m: Memory): string;
    candidates(scope: Scope, query: string, signal?: AbortSignal, related?: {
        sessions?: string[];
        now?: number;
    }): Promise<Memory[]>;
    /**
     * Profile memories that hold in any conversation: unconditional preferences, person facts and
     * relationship patterns. They live in the stable layer, so the turn layer never repeats them.
     */
    isProfile(memory: Memory): boolean;
    /**
     * Stable layer: who she is and who you are. Rendered deterministically (fixed order, no dates,
     * no scores) because it sits at the head of every request; it should only change when the
     * underlying facts change, so the prompt prefix stays cacheable.
     */
    stableContext(scope: Scope, now?: number): {
        text: string;
        ids: Set<string>;
    };
    /**
     * Turn layer (automatic) or a deliberate recall (the yuwen_recall tool).
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
