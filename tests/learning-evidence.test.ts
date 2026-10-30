import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Store } from '../src/store.js'
import { Engine } from '../src/engine.js'
import { Learner } from '../src/learning.js'
import type { Source } from '../src/types.js'

test('historical evidence cannot resurrect corrected facts or trigger fresh changes alone', async () => {
  const store = new Store(':memory:')
  const engine = new Engine(store)
  const scope = { user: 'owner', persona: 'yuwen', project: 'test' }
  const source = (id: string, text: string): Source => ({
    id,
    text,
    scope,
    session: 'test',
    role: 'user',
    at: new Date().toISOString(),
  })
  store.source(source('old', '回声戒指冷却 17 秒'))
  const [memory] = engine.apply(
    {
      operations: [
        {
          action: 'ADD',
          kind: 'cognition',
          text: '回声戒指冷却 17 秒',
          sources: ['old'],
          reason: '初次陈述',
        },
      ],
    },
    scope,
    [],
    ['old'],
  )
  store.source(source('correction', '纠正：回声戒指冷却 23 秒'))
  engine.apply(
    {
      operations: [
        {
          action: 'UPDATE',
          target: memory.id,
          expectedVersion: 1,
          kind: 'cognition',
          text: '回声戒指冷却 23 秒',
          sources: ['correction'],
          reason: '用户纠正',
        },
      ],
    },
    scope,
    [memory.id],
    ['correction'],
  )
  const learner = new Learner(engine, () => async (_system, input) => {
    const payload = JSON.parse(input)
    assert.deepEqual(
      payload.events.map((event: Source) => event.id),
      ['fresh'],
    )
    assert.ok(payload.historicalEvidence.some((event: Source) => event.id === 'old'))
    return JSON.stringify({
      operations: [
        {
          action: 'ADD',
          kind: 'cognition',
          text: '回声戒指的冷却为 17 秒',
          sources: ['old'],
          reason: '错误重放旧原话',
        },
        {
          action: 'UPDATE',
          target: memory.id,
          expectedVersion: 2,
          kind: 'cognition',
          text: '冷却 17 秒',
          sources: ['old'],
          reason: '错误回滚',
        },
        {
          action: 'DELETE',
          target: memory.id,
          expectedVersion: 2,
          sources: ['old'],
          reason: '无新证据失效',
        },
        {
          action: 'ADD',
          kind: 'cognition',
          text: '演练代号蓝鲸纸风车',
          sources: ['fresh'],
          reason: '新事件',
        },
      ],
      state: {
        mood: 'concerned',
        reason: '旧事件',
        behavior: '继续检查',
        intensity: 0.4,
        sources: ['old'],
        topic: '回声戒指',
      },
    })
  })
  try {
    learner.enqueue({
      id: 'fresh-job',
      scope,
      sources: [source('fresh', '回声戒指先不聊；项目演练代号蓝鲸纸风车')],
    })
    while (learner.running) await new Promise((resolve) => setTimeout(resolve, 5))
    assert.equal(store.memory(memory.id)?.text, '回声戒指冷却 23 秒')
    assert.equal(store.memories(scope).length, 2)
    assert.equal(
      store.memories(scope).some((entry) => /17/.test(entry.text)),
      false,
    )
    assert.equal(store.states(scope).length, 0)
    assert.equal(store.db.prepare('SELECT status FROM jobs').get()?.status, 'done')
  } finally {
    await learner.close()
    store.close()
  }
})
