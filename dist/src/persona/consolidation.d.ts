import type { Memory, Scope } from '../memory/index.js';
import type { Store } from '../storage/index.js';
export { SELF_CONSOLIDATION_PROMPT } from './prompts/consolidation.js';
/**
 * Self observations barely fade, so they need their own compaction (from the earlier bot's
 * "self 精炼"). Above the limit the model proposes merges by index; the code adds the merged
 * observation first and retires the originals after, then checks the count really went down.
 */
export declare const SELF_LIMIT = 20;
export declare function selfObservations(store: Store, scope: Scope): Memory[];
export declare function consolidateSelf(store: Store, scope: Scope, generate: (system: string, user: string, signal: AbortSignal) => Promise<string>, signal: AbortSignal): Promise<{
    before: number;
    after: number;
    merged: number;
} | undefined>;
