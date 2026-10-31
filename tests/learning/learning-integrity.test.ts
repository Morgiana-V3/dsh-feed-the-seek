import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Engine } from '../../src/companion/index.js'
import { localDay } from '../../src/memory/index.js'
import { Learner } from '../../src/learning/index.js'
import type { Scope, Source } from '../../src/memory/index.js'
import { Store } from '../../src/storage/index.js'

// Regression tests for behaviours promised in the README that previously failed.
const scope: Scope = { user: 'owner', persona: 'default', project: 'project-a' }
const HOUR = 3600_000
const T0 = Date.parse('2026-10-01T04:00:00Z')
function setup() {
  const store = new Store(':memory:')
  return { store, engine: new Engine(store) }
}
function source(
  store: Store,
  id: string,
  at: number,
  session = 'session-' + id,
  role: Source['role'] = 'user',
): Source {
  const record: Source = {
    id,
    session,
    event: `${session}:turn`,
    role,
    text: '反馈 ' + id,
    scope,
    at: new Date(at).toISOString(),
  }
  store.source(record)
  return record
}

test('UPDATE keeps conditions, tags and confidence the model did not send', async (testContext) => {
  const { store, engine } = setup()
  testContext.after(() => store.close())
  source(store, 'a1', T0)
  source(store, 'a2', T0 + HOUR)
  engine.apply(
    {
      operations: [
        {
          action: 'ADD',
          kind: 'resonance',
          text: '聊雾港时直接给结论',
          knowledge: { category: 'relationship', domain: '雾港', conditions: '讨论雾港时' },
          tags: ['雾港'],
          evidence: 'explicit',
          confidence: 0.8,
          importance: 0.7,
          global: true,
          sources: ['a1'],
          reason: '用户说明',
        },
      ],
    },
    scope,
    [],
    ['a1'],
  )
  const memory = store.memories(scope)[0]
  engine.apply(
    {
      operations: [
        {
          action: 'UPDATE',
          target: memory.id,
          expectedVersion: 1,
          sources: ['a2'],
          reason: '同一偏好的新证据',
        },
      ],
    },
    scope,
    [memory.id],
    ['a1', 'a2'],
  )
  const updated = store.memory(memory.id)!
  assert.equal(updated.version, 2)
  assert.deepEqual(updated.knowledge, memory.knowledge)
  assert.deepEqual(updated.tags, ['雾港'])
  assert.equal(updated.confidence, 0.8)
  assert.equal(updated.importance, 0.7)
  assert.equal(updated.evidence, 'explicit')
  assert.deepEqual(updated.sources, ['a1', 'a2'])
  // Still conditional, so it must not leak into unrelated conversations as a general profile.
  assert.equal((await engine.recall(scope, '帮我修一下登录接口的报错')).items.length, 0)

  // A partial knowledge update merges instead of erasing the domain.
  engine.apply(
    {
      operations: [
        {
          action: 'UPDATE',
          target: memory.id,
          expectedVersion: 2,
          knowledge: { conditions: '讨论雾港或其续作时' },
          sources: ['a2'],
          reason: '扩大条件',
        },
      ],
    },
    scope,
    [memory.id],
    ['a1', 'a2'],
  )
  assert.equal(store.memory(memory.id)!.knowledge.domain, '雾港')
  assert.equal(store.memory(memory.id)!.knowledge.conditions, '讨论雾港或其续作时')
})

test('rewording an explicit memory still requires a user source', (testContext) => {
  const { store, engine } = setup()
  testContext.after(() => store.close())
  source(store, 'u1', T0)
  source(store, 'bot', T0 + HOUR, 'session-u1', 'assistant')
  engine.apply(
    {
      operations: [
        {
          action: 'ADD',
          kind: 'cognition',
          text: '进度简短汇报',
          knowledge: { category: 'preference' },
          evidence: 'explicit',
          sources: ['u1'],
          reason: 'x',
        },
      ],
    },
    scope,
    [],
    ['u1'],
  )
  const memory = store.memories(scope)[0]
  assert.throws(
    () =>
      engine.apply(
        {
          operations: [
            {
              action: 'UPDATE',
              target: memory.id,
              expectedVersion: 1,
              text: '进度只用一句话汇报',
              evidence: 'explicit',
              sources: ['bot'],
              reason: '助手自述',
            },
          ],
        },
        scope,
        [memory.id],
        ['u1', 'bot'],
      ),
    /用户来源/,
  )
  // Omitting evidence on a reworded claim falls back to "inferred" rather than inheriting "explicit".
  engine.apply(
    {
      operations: [
        {
          action: 'UPDATE',
          target: memory.id,
          expectedVersion: 1,
          text: '进度只用一句话汇报',
          sources: ['bot'],
          reason: '助手推测',
        },
      ],
    },
    scope,
    [memory.id],
    ['u1', 'bot'],
  )
  assert.equal(store.memory(memory.id)!.evidence, 'inferred')
})

function formTrait(store: Store, engine: Engine) {
  const ids = [0, 1, 2].map((i) => source(store, 'b' + i, T0 + i * 40 * HOUR).id)
  engine.apply(
    {
      operations: [
        {
          action: 'ADD',
          kind: 'self',
          text: '声称完成前先自行验证',
          knowledge: { category: 'tendency' },
          evidence: 'explicit',
          sources: [ids[0]],
          reason: 'x',
        },
      ],
    },
    scope,
    [],
    ids,
  )
  const memory = store.memories(scope)[0]
  engine.apply(
    {
      operations: [
        {
          action: 'UPDATE',
          target: memory.id,
          expectedVersion: 1,
          consolidate: true,
          sources: ids,
          reason: '三次独立反馈',
        },
      ],
    },
    scope,
    [memory.id],
    ids,
  )
  assert.equal(store.traits(scope).length, 1)
  return { memory: store.memory(memory.id)!, ids }
}

test('supporting evidence keeps a formed tendency; a change of meaning still withdraws it', (testContext) => {
  const { store, engine } = setup()
  testContext.after(() => store.close())
  const { memory, ids } = formTrait(store, engine)
  const extra = source(store, 'b3', T0 + 150 * HOUR).id
  engine.apply(
    {
      operations: [
        {
          action: 'UPDATE',
          target: memory.id,
          expectedVersion: memory.version,
          sources: [extra],
          reason: '同一倾向得到新证据',
        },
      ],
    },
    scope,
    [memory.id],
    [...ids, extra],
  )
  assert.equal(store.traits(scope).length, 1)
  assert.ok(store.traits(scope)[0].sources.includes(extra))
  assert.equal(store.history(scope).filter((entry) => entry.action === 'CONSOLIDATE').length, 1)

  const current = store.memory(memory.id)!
  engine.apply(
    {
      operations: [
        {
          action: 'UPDATE',
          target: memory.id,
          expectedVersion: current.version,
          text: '只在用户要求时才验证',
          sources: [extra],
          reason: '含义改变',
        },
      ],
    },
    scope,
    [memory.id],
    [...ids, extra],
  )
  assert.equal(store.traits(scope).length, 0)
})

test('tendency dates are local calendar days, not UTC days', (testContext) => {
  const { store, engine } = setup()
  testContext.after(() => store.close())
  // Two of these fall on the same local day in Asia/Shanghai but on different UTC days.
  const times = [
    Date.parse('2026-10-19T23:30:00Z'),
    Date.parse('2026-10-20T01:00:00Z'),
    Date.parse('2026-10-23T02:00:00Z'),
  ]
  if (new Set(times.map(localDay)).size !== 2) {
    testContext.skip('requires a UTC+8 style local zone (set FEED_THE_SEEK_TIMEZONE=Asia/Shanghai)')
    return
  }
  const ids = times.map((at, i) => source(store, 'c' + i, at).id)
  engine.apply(
    {
      operations: [
        {
          action: 'ADD',
          kind: 'self',
          text: '先验证再说完成',
          knowledge: { category: 'tendency' },
          evidence: 'explicit',
          sources: [ids[0]],
          reason: 'x',
        },
      ],
    },
    scope,
    [],
    ids,
  )
  const memory = store.memories(scope)[0]
  engine.apply(
    {
      operations: [
        {
          action: 'UPDATE',
          target: memory.id,
          expectedVersion: 1,
          consolidate: true,
          sources: ids,
          reason: 'x',
        },
      ],
    },
    scope,
    [memory.id],
    ids,
  )
  assert.equal(store.traits(scope).length, 0)
})

const settle = () => new Promise((resolve) => setTimeout(resolve, 30))

test('manual retry revives jobs that used up their automatic attempts', async (t) => {
  const { store, engine } = setup()
  let calls = 0
  const learner = new Learner(engine, () => async () => {
    calls++
    throw new Error('模型暂不可用')
  })
  t.after(async () => {
    await learner.close()
    store.close()
  })
  learner.enqueue({
    id: 'job',
    scope,
    sources: [source(store, 'd1', Date.now())],
    provider: 'p',
    model: 'm',
  })
  const job = () => store.db.prepare('SELECT status,attempts,error FROM jobs').get()
  await settle()
  assert.equal(job()?.status, 'pending', 'a failure with attempts left waits for the next pass')
  assert.equal(job()?.error, '模型暂不可用', 'the reason is kept for the page')
  for (let i = 0; i < 2; i++) {
    await learner.drain()
    await settle()
  }
  assert.deepEqual(
    [job()?.status, job()?.attempts],
    ['failed', 3],
    'three automatic attempts, then it waits for the user',
  )
  const exhausted = calls
  await learner.drain()
  assert.equal(calls, exhausted, 'no automatic attempt after the budget is used')
  learner.retry({ ...scope, persona: 'someone-else' })
  await settle()
  assert.equal(calls, exhausted, 'retrying another companion leaves this job alone')
  learner.retry(scope)
  await settle()
  assert.ok(calls > exhausted, 'a manual retry calls the model again')
  assert.deepEqual([job()?.status, job()?.attempts], ['pending', 1], 'with a fresh attempt budget')
})

test('closing the learner mid-job is not counted as a failure', async (t) => {
  const { store, engine } = setup()
  let release: () => void = () => {}
  const learner = new Learner(
    engine,
    () => (_system, _user, signal) =>
      new Promise((_resolve, reject) => {
        release = () => reject(new Error('aborted'))
        signal.addEventListener('abort', () => reject(signal.reason))
      }),
  )
  t.after(() => store.close())
  learner.enqueue({
    id: 'job',
    scope,
    sources: [source(store, 'c1', Date.now())],
    provider: 'p',
    model: 'm',
  })
  await settle()
  await learner.close()
  release()
  assert.equal(store.db.prepare('SELECT status FROM jobs').get()?.status, 'running')
  store.jobs.recover()
  assert.equal(
    store.db.prepare('SELECT status FROM jobs').get()?.status,
    'pending',
    'picked up again on the next start',
  )
})

test('earlier events of the same turn are context, not fresh evidence', async (t) => {
  const { store, engine } = setup()
  let input: Record<string, unknown> = {}
  const earlier = {
    id: 'e-user',
    session: 's',
    event: 's:turn',
    role: 'user' as const,
    text: '我喜欢简短回答',
    scope,
    at: new Date().toISOString(),
  }
  const fresh = {
    id: 'e-bot',
    session: 's',
    event: 's:turn',
    role: 'assistant' as const,
    text: '好的，之后简短回答',
    scope,
    at: new Date().toISOString(),
  }
  const learner = new Learner(engine, () => async (_system, user) => {
    input = JSON.parse(user)
    return JSON.stringify({
      operations: [
        {
          action: 'ADD',
          kind: 'cognition',
          text: '只凭旧事件新增',
          knowledge: { category: 'preference' },
          evidence: 'explicit',
          sources: ['e-user'],
          reason: '没有新证据',
        },
        {
          action: 'ADD',
          kind: 'cognition',
          text: '用户喜欢简短回答',
          knowledge: { category: 'preference' },
          evidence: 'explicit',
          userQuote: '我喜欢简短回答',
          retention: { basis: 'preference', reason: '稳定偏好' },
          sources: ['e-user', 'e-bot'],
          reason: '有新事件支持',
        },
      ],
      state: null,
    })
  })
  t.after(async () => {
    await learner.close()
    store.close()
  })
  learner.enqueue({
    id: 'turn-end',
    scope,
    sources: [fresh],
    context: [earlier],
    provider: 'p',
    model: 'm',
  })
  await settle()
  assert.deepEqual(
    (input.events as Source[]).map((candidateSource) => candidateSource.id),
    ['e-bot'],
  )
  assert.deepEqual(
    (input.earlierInTurn as Source[]).map((candidateSource) => candidateSource.id),
    ['e-user'],
  )
  assert.deepEqual(
    store.memories(scope).map((candidateMemory) => candidateMemory.text),
    ['用户喜欢简短回答'],
  )
})

test('binding a session is read-only after the first time', (testContext) => {
  const { store } = setup()
  testContext.after(() => store.close())
  const persona = store.bindSession('s1')
  store.createPersona('新实例')
  const original = store.setMeta.bind(store)
  let writes = 0
  store.setMeta = (key, value) => {
    if (key.startsWith('persona:session:')) {
      writes++
    }
    original(key, value)
  }
  assert.equal(store.bindSession('s1'), persona)
  assert.equal(writes, 0)
})
