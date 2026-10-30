import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { makeEmbedder } from '../src/embedding.js'
import { Settings } from '../src/types.js'

for (const protocol of ['openai', 'ollama', 'doubao'] as const) {
  test(`embedding adapter uses the ${protocol} request and response format`, async (context) => {
    let received: any
    const server = createServer(async (request, response) => {
      let body = ''
      for await (const chunk of request) body += chunk
      received = JSON.parse(body)
      const vector = [0.2, -0.3, 0.9]
      response.setHeader('content-type', 'application/json')
      response.end(
        JSON.stringify(
          protocol === 'ollama'
            ? { embeddings: [vector] }
            : protocol === 'doubao'
              ? { data: { embedding: vector } }
              : { data: [{ embedding: vector }] },
        ),
      )
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    context.after(() => new Promise<void>((resolve) => server.close(() => resolve())))
    const address = server.address() as { port: number }
    const route =
      protocol === 'ollama'
        ? '/api/embed'
        : protocol === 'doubao'
          ? '/api/v3/embeddings/multimodal'
          : '/v1/embeddings'
    const settings = Settings.parse({
      embeddingUrl: `http://127.0.0.1:${address.port}${route}`,
      embeddingModel: 'test-model',
      embeddingDimensions: 3,
    })
    const embedder = makeEmbedder(settings)!
    assert.deepEqual(await embedder.embed('测试内容'), [0.2, -0.3, 0.9])
    assert.equal(received.model, 'test-model')
    assert.deepEqual(
      received.input,
      protocol === 'doubao' ? [{ type: 'text', text: '测试内容' }] : '测试内容',
    )
    if (protocol !== 'ollama') {
      assert.equal(received.dimensions, 3)
      assert.equal(received.encoding_format, 'float')
    } else {
      assert.equal(Object.hasOwn(received, 'encoding_format'), false)
    }
    const changed = makeEmbedder({ ...settings, embeddingDimensions: 4 })!
    assert.notEqual(changed.key, embedder.key)
    await assert.rejects(changed.embed('测试内容'), /维.*不一致/)
  })
}

test('explicit protocol supports proxy paths and preserves legacy OpenAI index identities', () => {
  const settings = Settings.parse({
    embeddingUrl: 'https://example.com/proxy',
    embeddingModel: 'test',
  })
  assert.equal(makeEmbedder(settings)!.key, 'https://example.com/proxy|test')
  assert.notEqual(
    makeEmbedder({ ...settings, embeddingProtocol: 'doubao' })!.key,
    makeEmbedder(settings)!.key,
  )
  assert.equal(Settings.safeParse({ embeddingDimensions: 1 }).success, false)
})
