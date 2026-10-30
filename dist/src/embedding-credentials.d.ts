import { z } from 'zod';
import type { Settings } from './types.js';
export interface EmbeddingCredentials {
    resolve(reference: string): Promise<{
        value: string;
    } | undefined>;
    set(reference: string, value: string): Promise<void>;
}
export declare const ApiKey: z.ZodOptional<z.ZodString>;
export declare function embeddingKeyReference(url: string): string;
export declare function resolveEmbeddingKey(settings: Settings, credentials?: EmbeddingCredentials): Promise<string | undefined>;
