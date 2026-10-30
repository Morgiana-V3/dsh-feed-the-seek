import type { Settings } from './types.js';
export interface Embedder {
    key: string;
    embed(text: string, signal?: AbortSignal): Promise<number[]>;
}
export declare function validateVector(value: unknown): number[];
export declare function makeEmbedder(settings: Settings, resolveKey?: () => Promise<string | undefined>): Embedder | undefined;
