import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Engine } from '../../src/companion/index.js'
import { createDashboard } from '../../src/dashboard/index.js'
import { DEFAULT_SCOPE as scope, type Memory } from '../../src/memory/index.js'
import { Store } from '../../src/storage/index.js'

async function fixture(t: { after: (callback: () => Promise<void>) => void }) {
  const store = new Store(':memory:')
  const engine = new Engine(store)
  const dashboard = createDashboard(engine, { demo: false, port: 0 })
  await dashboard.listen()
  t.after(async () => {
    await new Promise<void>((resolve) => dashboard.server.close(() => resolve()))
    store.close()
  })
  const origin = `http://127.0.0.1:${(dashboard.server.address() as { port: number }).port}`
  const state = await (await fetch(origin + '/api/state')).json()
  const post = (endpoint: string, body: unknown, token = state.token) =>
    fetch(origin + '/api/' + endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-feed-the-seek-token': token },
      body: JSON.stringify(body),
    })
  return { store, engine, post, origin }
}

test('rename works for the original companion, keeps sessions and evidence, and rejects invalid requests', async (t) => {
  const { store, engine, post, origin } = await fixture(t)
  store.source({
    id: 'name',
    scope,
    session: 'session',
    role: 'user',
    text: '你叫旧名字',
    at: new Date().toISOString(),
  })
  const [name] = engine.apply(
    {
      operations: [
        {
          action: 'ADD',
          kind: 'cognition',
          text: '你叫我旧名字',
          alias: { kind: 'assistant_name', value: '旧名字' },
          sources: ['name'],
          reason: '命名',
        },
      ],
    },
    scope,
    [],
    ['name'],
  )
  store.bindSession('existing')
  assert.equal((await post('persona/rename', { scope, name: '小鲸' }, '')).status, 403)
  assert.equal((await post('persona/rename', { scope, name: '  ' })).status, 400)
  assert.equal(
    (await post('persona/rename', { scope: { ...scope, persona: 'missing' }, name: '小鲸' }))
      .status,
    400,
  )
  assert.equal((await post('persona/rename', { scope, name: ' 小鲸 ' })).status, 200)
  assert.equal(store.personas()[0].name, '小鲸')
  assert.equal(store.activePersona(), 'default')
  assert.equal(store.bindSession('existing'), 'default')
  assert.equal(store.memory(name.id)?.status, 'inactive')
  assert.match(engine.stableContext(scope).text, /我的名字：小鲸/)
  assert.doesNotMatch(engine.stableContext(scope).text, /旧名字/)
  const state = await (await fetch(origin + '/api/state')).json()
  assert.deepEqual(state.sources, {})
  const exported = await (await post('export', { scope })).json()
  assert.equal(exported.sources.name.text, '你叫旧名字')
  assert.equal(exported.memories.length, 1)
})

test('history pages query all records, isolate companions and stay stable when new changes arrive', async (t) => {
  const { store, post } = await fixture(t)
  const memory = (i: number): Memory => ({
    id: 'm' + i,
    kind: 'self',
    text: '记录 ' + i,
    scope,
    tags: [],
    sources: [],
    evidence: 'explicit',
    importance: 0.5,
    confidence: 0.8,
    version: 1,
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    knowledge: { category: 'preference', domain: '', edition: '', conditions: '' },
  })
  store.transaction(() => {
    for (let i = 0; i < 1003; i++) {
      store.audit('ADD', i === 0 ? '查找独特词' : '保存', undefined, memory(i))
    }
    store.audit('NONE', '不应显示', undefined, memory(9000))
    store.audit('ADD', '别人的记录', undefined, {
      ...memory(9001),
      scope: { ...scope, persona: 'other' },
    })
  })
  const first = await (await post('history', { scope })).json()
  assert.equal(first.total, 1003)
  assert.equal(first.items.length, 20)
  store.audit('ADD', '后来新增', undefined, memory(1004))
  const second = await (await post('history', { scope, page: 2, through: first.through })).json()
  assert.equal(second.total, 1003)
  assert.ok(
    second.items.every(
      (item: { id: string }) =>
        !first.items.some((previous: { id: string }) => previous.id === item.id),
    ),
  )
  const last = await (await post('history', { scope, page: 999, through: first.through })).json()
  assert.equal(last.page, 51)
  assert.equal(last.items.length, 3)
  const match = await (
    await post('history', { scope, query: '独特词', kind: 'self', action: 'ADD' })
  ).json()
  assert.equal(match.total, 1)
  assert.equal(match.items[0].after.text, '记录 0')
  assert.equal((await (await post('history', { scope, query: "%_'" })).json()).total, 0)
  assert.equal((await post('history', { scope, page: -1 })).status, 400)
})
