import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { Store } from '../src/store.js'
import { Engine } from '../src/engine.js'
import { createDashboard } from '../src/server.js'
import { embeddingKeyReference } from '../src/embedding-credentials.js'

test('connection probe uses unsaved fields, validates responses and never writes to the database', async (context) => {
  let calls = 0
  let status = 200
  let payload: unknown = { data: [{ embedding: [0.1, 0.5, 0.7] }] }
  let received: any
  let authorization: string | undefined
  const remote = createServer(async (request, response) => {
    calls++
    let body = ''
    for await (const chunk of request) {
      body += chunk
    }
    received = JSON.parse(body)
    authorization = request.headers.authorization
    response.writeHead(status, { 'content-type': 'application/json' })
    response.end(JSON.stringify(payload))
  })
  await new Promise<void>((resolve) => remote.listen(0, '127.0.0.1', resolve))
  context.after(() => new Promise<void>((resolve) => remote.close(() => resolve())))
  const store = new Store(':memory:')
  context.after(() => store.close())
  const secrets = new Map<string, string>()
  const credentials = {
    async resolve(reference: string) {
      const value = secrets.get(reference)
      return value ? { value } : undefined
    },
    async set(reference: string, value: string) {
      secrets.set(reference, value)
    },
  }
  const engine = new Engine(store, undefined, credentials)
  const dashboard = createDashboard(engine, { demo: false, port: 0 })
  await dashboard.listen()
  context.after(() => new Promise<void>((resolve) => dashboard.server.close(() => resolve())))
  const origin = `http://127.0.0.1:${(dashboard.server.address() as { port: number }).port}`
  const { token } = (await (await fetch(origin + '/api/state')).json()) as { token: string }
  const connection = {
    embeddingUrl: `http://127.0.0.1:${(remote.address() as { port: number }).port}/v1/embeddings`,
    embeddingModel: 'unsaved-model',
    embeddingKeyEnv: 'FISH_TEST_UNUSED_KEY',
    embeddingProtocol: 'openai',
    embeddingDimensions: 3,
    embeddingApiKey: 'fixture-unsaved-key',
  }
  const snapshot = () =>
    [
      'meta',
      'memories',
      'sources',
      'states',
      'vectors',
      'audit',
      'jobs',
      'traits',
      'recall_uses',
    ].map((table) => [table, store.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()])
  const before = snapshot()
  async function probe(body = connection, requestToken = token) {
    const response = await fetch(origin + '/api/embedding-test', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-yuwen-token': requestToken },
      body: JSON.stringify(body),
    })
    return { status: response.status, body: (await response.json()) as Record<string, unknown> }
  }
  assert.equal((await probe(connection, 'invalid')).status, 403)
  assert.equal(calls, 0)
  const success = await probe()
  assert.equal(success.status, 200)
  assert.deepEqual(Object.keys(success.body).sort(), ['dimensions', 'elapsedMs', 'ok'])
  assert.equal(success.body.dimensions, 3)
  assert.equal(received.model, 'unsaved-model')
  assert.equal(received.input, '这是一条文本向量连接测试。')
  assert.equal(authorization, 'Bearer fixture-unsaved-key')
  assert.equal(secrets.size, 0)
  assert.equal(calls, 1)
  assert.deepEqual(snapshot(), before)
  status = 401
  payload = { error: 'provider secret details must not be echoed' }
  const denied = await probe()
  assert.equal(denied.status, 400)
  assert.match(String(denied.body.error), /401/)
  assert.doesNotMatch(String(denied.body.error), /secret/)
  status = 200
  payload = { choices: [{ message: { content: 'chat endpoint' } }] }
  assert.match(String((await probe()).body.error), /无效向量/)
  payload = { data: [{ embedding: [1, 2] }] }
  assert.match(String((await probe()).body.error), /不一致/)
  assert.equal((await probe({ ...connection, embeddingUrl: '' })).status, 400)
  assert.deepEqual(snapshot(), before)
  payload = { data: [{ embedding: [0.1, 0.5, 0.7] }] }
  const save = await fetch(origin + '/api/settings', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-yuwen-token': token },
    body: JSON.stringify({ ...connection, retrievalMode: 'semantic' }),
  })
  assert.equal(save.status, 200)
  assert.doesNotMatch(await save.text(), /fixture-unsaved-key|embeddingApiKey/)
  assert.equal(secrets.get(embeddingKeyReference(connection.embeddingUrl)), 'fixture-unsaved-key')
  assert.doesNotMatch(JSON.stringify(snapshot()), /fixture-unsaved-key/)
  const savedState = (await (await fetch(origin + '/api/state')).json()) as {
    vector: { apiKeyConfigured: boolean }
  }
  assert.equal(savedState.vector.apiKeyConfigured, true)
  assert.doesNotMatch(JSON.stringify(savedState), /fixture-unsaved-key/)
  const savedSnapshot = snapshot()
  assert.equal((await probe({ ...connection, embeddingApiKey: '' })).status, 200)
  assert.equal(authorization, 'Bearer fixture-unsaved-key')
  const restartedEngine = new Engine(store, undefined, credentials)
  await restartedEngine.embedder()!.embed('验证已保存的密钥用于实际检索')
  assert.equal(authorization, 'Bearer fixture-unsaved-key')
  await probe({
    ...connection,
    embeddingApiKey: '',
    embeddingUrl: connection.embeddingUrl + '/different',
  })
  assert.equal(authorization, undefined, 'an unsaved endpoint change must not reuse the saved key')
  assert.deepEqual(snapshot(), savedSnapshot)
})
