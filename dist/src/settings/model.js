import { z } from 'zod';
export const Settings = z.object({
    enabled: z.boolean().default(true),
    learning: z.boolean().default(true),
    growth: z.boolean().default(true),
    emotion: z.boolean().default(true),
    retrievalMode: z.enum(['local', 'semantic']).default('local'),
    embeddingUrl: z.string().max(500).default(''),
    embeddingModel: z.string().max(200).default(''),
    embeddingProtocol: z.enum(['auto', 'openai', 'ollama', 'doubao']).default('auto'),
    embeddingDimensions: z
        .number()
        .int()
        .min(0)
        .max(8192)
        .refine((value) => value === 0 || value >= 2)
        .default(0),
    embeddingKeyEnv: z
        .string()
        .regex(/^[A-Z][A-Z0-9_]*$/)
        .default('FEED_THE_SEEK_EMBEDDING_API_KEY'),
});
//# sourceMappingURL=model.js.map