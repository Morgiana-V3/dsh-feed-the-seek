import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Store } from '../src/store.js'
import { Engine } from '../src/engine.js'
import { associateMemories } from '../src/associations.js'
import type { Memory } from '../src/types.js'

const scope = { user: 'owner', persona: 'yuwen', project: 'project-a' }

function memory(id: string, overrides: Partial<Memory> = {}): Memory {
  return {
    id,
    kind: 'cognition',
    text: '回声戒指属于雾港装备',
    tags: ['雾港装备'],
    scope,
    evidence: 'explicit',
    importance: 0.5,
    status: 'active',
    version: 1,
    sources: [`source-${id}`],
    createdAt: '2026-10-29T00:00:00Z',
    updatedAt: '2026-10-29T00:00:00Z',
    knowledge: { category: 'fact', domain: '', edition: '', conditions: '' },
    confidence: 0.8,
    ...overrides,
  }
}

test('local recall follows one evidence-based association without widening project/persona scope', async (context) => {
  const store = new Store(':memory:')
  context.after(() => store.close())
  const engine = new Engine(store)
  store.put(memory('ring'))
  store.put(memory('effect', { text: '满能量时额外触发一次', kind: 'experience' }))
  store.put(
    memory('other-project', { text: '项目隔离', scope: { ...scope, project: 'project-b' } }),
  )
  store.put(memory('other-persona', { text: '实例隔离', scope: { ...scope, persona: 'other' } }))
  store.put(memory('unrelated', { text: '天气晴朗', tags: ['天气'] }))
  const recalled = await engine.recall(scope, '回声戒指')
  assert.equal(recalled.mode, 'keyword')
  assert.deepEqual(
    recalled.items.map((item) => item.memory.id),
    ['ring', 'effect'],
  )
  assert.ok(recalled.items[1].reasons.includes('关联记忆'))

  store.put({ ...store.memory('effect')!, status: 'inactive', version: 2 })
  assert.deepEqual(
    (await engine.recall(scope, '回声戒指')).items.map((item) => item.memory.id),
    ['ring'],
  )
  assert.equal((await engine.recall(scope, '完全无关的音乐')).items.length, 0)
})

test('associations do not cross editions or infer links from generic labels; updates remove obsolete edges', () => {
  const first = memory('first', {
    knowledge: { category: 'rule', domain: '雾港', edition: '1.0', conditions: '' },
  })
  const second = memory('second', { knowledge: { ...first.knowledge, edition: '2.0' } })
  assert.equal(associateMemories([first, second]).length, 0)
  assert.equal(
    associateMemories([
      memory('a', { tags: ['用户', '工作'] }),
      memory('b', { tags: ['用户', '工作'] }),
    ]).length,
    0,
  )
  const related = memory('related')
  assert.equal(associateMemories([memory('a'), related]).length, 2)
  assert.equal(
    associateMemories([memory('a'), { ...related, tags: ['另一主题'], version: 2 }]).length,
    0,
  )
})

test('switching to local stops all embedding calls but preserves connection, vectors and memory', async (context) => {
  const store = new Store(':memory:')
  context.after(() => store.close())
  let embeddingCalls = 0
  const engine = new Engine(store, {
    key: 'test-space',
    async embed() {
      embeddingCalls++
      return [1, 0]
    },
  })
  store.put(memory('ring'))
  store.saveSettings({
    ...store.settings(),
    embeddingUrl: 'http://127.0.0.1:1/embeddings',
    embeddingModel: 'test',
    retrievalMode: 'semantic',
  })
  await engine.index(scope)
  assert.equal((await engine.recall(scope, '含义相近的表达')).mode, 'hybrid')
  const callsBeforeLocal = embeddingCalls
  store.saveSettings({ ...store.settings(), retrievalMode: 'local' })
  await engine.recall(scope, '回声戒指')
  await assert.rejects(() => engine.index(scope))
  assert.equal(embeddingCalls, callsBeforeLocal)
  assert.equal(store.vectorVersion('ring', 'test-space'), 1)
  assert.equal(store.settings().embeddingModel, 'test')
  assert.equal(store.memories().length, 1)
  store.saveSettings({ ...store.settings(), retrievalMode: 'semantic' })
  assert.equal((await engine.recall(scope, '含义相近的表达')).mode, 'hybrid')
})

test('semantic failure falls back to local associations and existing configured installations retain their mode', async (context) => {
  const store = new Store(':memory:')
  context.after(() => store.close())
  assert.equal(store.settings().retrievalMode, 'local')
  store.setMeta('settings', {
    embeddingUrl: 'http://127.0.0.1:1/embeddings',
    embeddingModel: 'old-model',
  })
  assert.equal(store.settings().retrievalMode, 'semantic')
  store.put(memory('ring'))
  store.put(memory('effect', { text: '满能量时额外触发一次' }))
  const engine = new Engine(store, {
    key: 'offline',
    async embed() {
      throw new Error('offline')
    },
  })
  const recalled = await engine.recall(scope, '回声戒指')
  assert.equal(recalled.mode, 'keyword')
  assert.deepEqual(
    recalled.items.map((item) => item.memory.id),
    ['ring', 'effect'],
  )
  assert.match(recalled.note, /暂不可用/)
})
