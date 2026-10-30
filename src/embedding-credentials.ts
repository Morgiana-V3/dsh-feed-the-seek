import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { Settings } from './types.js'

export interface EmbeddingCredentials {
  resolve(reference: string): Promise<{ value: string } | undefined>
  set(reference: string, value: string): Promise<void>
}

export const ApiKey = z
  .string()
  .trim()
  .max(4096)
  .regex(/^[^\r\n]*$/, 'API Key 不能包含换行')
  .optional()

// Bind a saved key to its endpoint so changing providers cannot forward an old secret.
export function embeddingKeyReference(url: string) {
  const normalized = new URL(url).href
  return (
    'FISH_BRAIN_EMBEDDING_' +
    createHash('sha256').update(normalized).digest('hex').slice(0, 24).toUpperCase()
  )
}

export async function resolveEmbeddingKey(settings: Settings, credentials?: EmbeddingCredentials) {
  if (credentials && settings.embeddingUrl) {
    const saved = await credentials.resolve(embeddingKeyReference(settings.embeddingUrl))
    if (saved?.value) {
      return saved.value
    }
    const legacy = await credentials.resolve(settings.embeddingKeyEnv)
    if (legacy?.value) {
      return legacy.value
    }
  }
  return process.env[settings.embeddingKeyEnv]
}
