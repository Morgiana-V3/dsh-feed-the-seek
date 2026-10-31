import type { Settings } from '../settings/index.js'

export interface Embedder {
  key: string
  embed(text: string, signal?: AbortSignal): Promise<number[]>
}

export function validateVector(value: unknown): number[] {
  if (
    !Array.isArray(value) ||
    value.length < 2 ||
    value.length > 8192 ||
    !value.every((entry) => typeof entry === 'number' && Number.isFinite(entry)) ||
    !value.some((entry) => entry !== 0)
  ) {
    throw new Error('Embedding 返回了无效向量')
  }
  return value
}

function protocolFor(settings: Settings, url: URL) {
  if (settings.embeddingProtocol !== 'auto') {
    return settings.embeddingProtocol
  }
  const pathname = url.pathname.replace(/\/+$/, '')
  if (pathname.endsWith('/embeddings/multimodal')) {
    return 'doubao'
  }
  if (pathname.endsWith('/api/embed')) {
    return 'ollama'
  }
  return 'openai'
}

export function makeEmbedder(
  settings: Settings,
  resolveKey?: () => Promise<string | undefined>,
): Embedder | undefined {
  if (!settings.embeddingUrl || !settings.embeddingModel) {
    return
  }
  const url = new URL(settings.embeddingUrl)
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Embedding 地址必须是 HTTP 或 HTTPS')
  }
  const protocol = protocolFor(settings, url)
  const dimensions = settings.embeddingDimensions
  // Preserve existing indexes when request semantics have not changed.
  let identity = `${url.href}|${settings.embeddingModel}`
  if (protocol !== 'openai' || dimensions) {
    identity += `|${protocol}|${dimensions || 'default'}`
  }
  return {
    key: identity,
    async embed(text, signal) {
      const key = resolveKey ? await resolveKey() : process.env[settings.embeddingKeyEnv]
      const body = {
        model: settings.embeddingModel,
        input: protocol === 'doubao' ? [{ type: 'text', text }] : text,
        ...(protocol !== 'ollama' ? { encoding_format: 'float' } : {}),
        ...(dimensions && protocol !== 'ollama' ? { dimensions } : {}),
      }
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(key ? { authorization: `Bearer ${key}` } : {}),
        },
        body: JSON.stringify(body),
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
          : AbortSignal.timeout(15000),
      })
      if (!response.ok) {
        throw new Error(`Embedding 请求失败（HTTP ${response.status}）`)
      }
      const payload = (await response.json()) as {
        data?: { embedding?: unknown } | { embedding?: unknown }[]
        embeddings?: unknown[]
      } | null
      const data = payload?.data
      const rawVector = Array.isArray(data) ? data[0]?.embedding : data?.embedding
      const vector = validateVector(rawVector ?? payload?.embeddings?.[0])
      if (dimensions && vector.length !== dimensions) {
        throw new Error(`Embedding 返回 ${vector.length} 维，与配置的 ${dimensions} 维不一致`)
      }
      return vector
    },
  }
}
