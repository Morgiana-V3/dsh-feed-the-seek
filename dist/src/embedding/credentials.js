import { createHash } from 'node:crypto';
import { z } from 'zod';
export const ApiKey = z
    .string()
    .trim()
    .max(4096)
    .regex(/^[^\r\n]*$/, 'API Key 不能包含换行')
    .optional();
// Bind a saved key to its endpoint so changing providers cannot forward an old secret.
export function embeddingKeyReference(url) {
    const normalized = new URL(url).href;
    return ('FISH_BRAIN_EMBEDDING_' +
        createHash('sha256').update(normalized).digest('hex').slice(0, 24).toUpperCase());
}
export async function resolveEmbeddingKey(settings, credentials) {
    if (credentials && settings.embeddingUrl) {
        const saved = await credentials.resolve(embeddingKeyReference(settings.embeddingUrl));
        if (saved?.value) {
            return saved.value;
        }
        const legacy = await credentials.resolve(settings.embeddingKeyEnv);
        if (legacy?.value) {
            return legacy.value;
        }
    }
    return process.env[settings.embeddingKeyEnv];
}
//# sourceMappingURL=credentials.js.map