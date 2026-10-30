import type { Store } from './store.js';
import type { Memory, Scope } from './types.js';
/**
 * Self observations barely fade, so they need their own compaction (from the earlier bot's
 * "self 精炼"). Above the limit the model proposes merges by index; the code adds the merged
 * observation first and retires the originals after, then checks the count really went down.
 */
export declare const SELF_LIMIT = 20;
export declare const SELF_CONSOLIDATION_PROMPT = "\u4E0B\u9762\u662F\u89D2\u8272\u7684\u81EA\u6211\u89C2\u5BDF\uFF0C\u5E26\u5E8F\u53F7\u3002\u6761\u76EE\u8FC7\u591A\uFF0C\u9700\u8981\u628A\u8BF4\u540C\u4E00\u4EF6\u4E8B\u3001\u540C\u4E00\u60C5\u5883\u7684\u89C2\u5BDF\u5408\u5E76\u6210\u4E00\u6761\u3002\u53EA\u8F93\u51FA JSON\uFF1A{\"merged\":[{\"text\":\"\u5408\u5E76\u540E\u7684\u4E00\u53E5\u8BDD\uFF0C60\u5B57\u4EE5\u5185\",\"sourceIndexes\":[0,4],\"selfKind\":\"behavior|feedback|intention|claim|verified\"}]}\u3002\n\u5408\u5E76\u540E\u7684 text \u7528\u89D2\u8272\u81EA\u5DF1\u7684\u53E3\u543B\u5199\uFF1A\u201C\u6211\u201D\u6307\u89D2\u8272\uFF0C\u201C\u4F60\u201D\u6307\u7528\u6237\u3002\u53EA\u5408\u5E76\u542B\u4E49\u76F8\u540C\u7684\u6761\u76EE\uFF1B\u4E0D\u540C\u60C5\u5883\u4E0B\u7684\u4E0D\u540C\u8868\u73B0\u4E0D\u662F\u77DB\u76FE\uFF0C\u4E0D\u8981\u5408\u5E76\u3002\u540C\u4E00\u60C5\u5883\u524D\u540E\u4E0D\u4E00\u81F4\u65F6\u4FDD\u7559\u8F83\u65B0\u7684\u8BF4\u6CD5\u3002selfKind \u53D6\u88AB\u5408\u5E76\u6761\u76EE\u4E2D\u8BC1\u636E\u6700\u5F31\u7684\u90A3\u4E00\u7C7B\uFF08claim/intention \u6700\u5F31\uFF09\u3002\u6CA1\u6709\u53EF\u5408\u5E76\u7684\u8FD4\u56DE {\"merged\":[]}\u3002";
export declare function selfObservations(store: Store, scope: Scope): Memory[];
export declare function consolidateSelf(store: Store, scope: Scope, generate: (system: string, user: string, signal: AbortSignal) => Promise<string>, signal: AbortSignal): Promise<{
    before: number;
    after: number;
    merged: number;
} | undefined>;
