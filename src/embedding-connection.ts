import { performance } from 'node:perf_hooks'
import { makeEmbedder } from './embedding.js'
import { Settings } from './types.js'
import { ApiKey } from './embedding-credentials.js'

const Connection = Settings.pick({
  embeddingUrl: true,
  embeddingModel: true,
  embeddingKeyEnv: true,
  embeddingProtocol: true,
  embeddingDimensions: true,
})
  .extend({ embeddingApiKey: ApiKey })
  .strict()

// A probe uses only the submitted connection and a fixed sentence, never stored memories.
export async function testEmbeddingConnection(
  input: unknown,
  resolveSavedKey?: (url: string) => Promise<string | undefined>,
) {
  const connection = Connection.parse(input)
  const embedder = makeEmbedder(Settings.parse(connection), async () => {
    if (connection.embeddingApiKey) {
      return connection.embeddingApiKey
    }
    if (resolveSavedKey) {
      return resolveSavedKey(connection.embeddingUrl)
    }
    return process.env[connection.embeddingKeyEnv]
  })
  if (!embedder) {
    throw new Error('请填写接口地址和模型名称')
  }
  const started = performance.now()
  try {
    const vector = await embedder.embed('这是一条文本向量连接测试。')
    return {
      ok: true,
      dimensions: vector.length,
      elapsedMs: Math.round(performance.now() - started),
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new Error('连接超时，请检查接口地址或稍后重试')
    }
    if (error instanceof TypeError) {
      throw new Error('无法连接接口，请检查地址、网络和服务状态')
    }
    if (error instanceof SyntaxError) {
      throw new Error('接口没有返回有效 JSON，请确认填写的是文本向量接口')
    }
    throw error
  }
}
