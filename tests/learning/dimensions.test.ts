import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Engine } from '../../src/companion/index.js'
import { Learner } from '../../src/learning/index.js'
import { DEFAULT_SCOPE as scope, type Source } from '../../src/memory/index.js'
import { Store } from '../../src/storage/index.js'

test('an organizer sees withdrawal history without putting the withdrawn text into the active profile', async (t) => {
  const store = new Store(':memory:')
  const engine = new Engine(store)
  const source = (id: string, text: string): Source => ({
    id,
    text,
    role: 'user',
    scope,
    session: 'revocation',
    at: new Date().toISOString(),
  })
  store.source(source('initial', '以后句末加晚安星星'))
  const [memory] = engine.apply(
    {
      operations: [
        {
          action: 'ADD',
          kind: 'self',
          selfKind: 'feedback',
          text: '我句末加晚安星星',
          durability: 'lasting',
          sources: ['initial'],
          reason: '表达约定',
        },
      ],
    },
    scope,
    [],
    ['initial'],
  )
  store.source(source('withdraw', '以后不用加了'))
  engine.apply(
    {
      operations: [
        {
          action: 'DELETE',
          target: memory.id,
          expectedVersion: 1,
          sources: ['withdraw'],
          reason: '用户撤销句末要求',
        },
      ],
    },
    scope,
    [memory.id],
    ['withdraw'],
  )
  let inspected = false
  const learner = new Learner(engine, () => async (_system, input) => {
    const payload = JSON.parse(input)
    assert.deepEqual(payload.recentSelfChanges, [
      { before: '我句末加晚安星星', after: null, reason: '用户撤销句末要求' },
    ])
    assert.equal(
      payload.candidates.some((entry: { text: string }) => entry.text.includes('晚安星星')),
      false,
    )
    assert.equal(payload.events[0].text, '你怎么还加')
    inspected = true
    return '{"operations":[],"state":null}'
  })
  t.after(async () => {
    await learner.close()
    store.close()
  })
  learner.enqueue({ id: 'follow-up', scope, sources: [source('follow-up', '你怎么还加')] })
  while (learner.running) {
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  assert.ok(inspected)
  assert.doesNotMatch(engine.stableContext(scope).text, /晚安星星/)
  assert.equal(store.memories(scope).length, 0)
})

test('event dates require user text evidence, not message timestamps or assistant assertions', (t) => {
  const cases = [
    {
      user: '作品发布后一个月了',
      assistant: '',
      text: '你作品发布后一个月仍很在意反馈',
      conditions: '2026-10-30 发布作品',
      accepted: false,
    },
    {
      user: '作品发布后一个月了',
      assistant: '你在2026-10-30发布作品',
      text: '你在2026-10-30发布作品',
      conditions: '',
      accepted: false,
    },
    {
      user: '作品发布后一个月了',
      assistant: '',
      text: '你作品发布后一个月仍很在意反馈',
      conditions: '',
      accepted: true,
    },
    {
      user: '我2026年10月1日发布作品',
      assistant: '',
      text: '你在2026-10-01发布作品',
      conditions: '',
      accepted: true,
    },
  ]
  for (const [index, entry] of cases.entries()) {
    const store = new Store(':memory:')
    t.after(() => store.close())
    const engine = new Engine(store)
    for (const [id, role, text] of [
      ['u', 'user', entry.user],
      ['a', 'assistant', entry.assistant],
    ]) {
      store.source({ id, role, text, scope, session: 'date-' + index, at: '2026-10-30T20:30:00Z' })
    }
    engine.apply(
      {
        operations: [
          {
            action: 'ADD',
            kind: 'experience',
            text: entry.text,
            knowledge: { category: 'event', conditions: entry.conditions },
            sources: ['u', 'a'],
            userQuote: entry.user,
            reason: '重要作品发布',
            retention: { basis: 'milestone', reason: '作品里程碑' },
          },
        ],
      },
      scope,
      [],
      ['u', 'a'],
      { strict: true, retentionPolicy: true },
    )
    assert.equal(store.memories(scope).length, entry.accepted ? 1 : 0, JSON.stringify(entry))
  }
})

// These exercise persistence and recall of valid proposals, not model classification accuracy.
test('a self name remains a usable alias; renaming retires the old identity but preserves its event', (t) => {
  const store = new Store(':memory:')
  t.after(() => store.close())
  const engine = new Engine(store)
  const options = { strict: true, retentionPolicy: true }
  const addSource = (id: string, text: string) => {
    const source: Source = {
      id,
      text,
      role: 'user',
      scope,
      session: 'naming',
      at: new Date().toISOString(),
    }
    store.source(source)
  }
  addSource('first', '你以后就叫大肥鱼，这次起名对我很重要')
  engine.apply(
    {
      operations: [
        {
          action: 'ADD',
          kind: 'self',
          selfKind: 'feedback',
          text: '我的名字叫大肥鱼。',
          alias: { kind: 'assistant_name', value: '大肥鱼' },
          durability: 'lasting',
          userQuote: '你以后就叫大肥鱼',
          sources: ['first'],
          reason: '明确命名',
          retention: { basis: 'feedback', reason: '当前身份' },
        },
        {
          action: 'ADD',
          kind: 'experience',
          text: '你给我起名“大肥鱼”，并说这次起名对你很重要。',
          userQuote: '这次起名对我很重要',
          sources: ['first'],
          reason: '重要命名经历',
          retention: { basis: 'milestone', reason: '用户明确重视的事件' },
        },
      ],
    },
    scope,
    [],
    ['first'],
    options,
  )
  const original = store.memories().find((memory) => memory.alias)!
  assert.equal(original.kind, 'self')
  assert.equal(original.alias?.value, '大肥鱼')
  assert.match(engine.stableContext(scope).text, /我的名字：大肥鱼/)
  addSource('rename', '以后改叫小鲸')
  engine.apply(
    {
      operations: [
        {
          action: 'ADD',
          kind: 'self',
          selfKind: 'feedback',
          text: '我的名字叫小鲸。',
          alias: { kind: 'assistant_name', value: '小鲸' },
          durability: 'lasting',
          userQuote: '以后改叫小鲸',
          sources: ['rename'],
          reason: '明确改名',
          retention: { basis: 'feedback', reason: '当前身份' },
        },
      ],
    },
    scope,
    [original.id],
    ['rename'],
    options,
  )
  assert.equal(store.memory(original.id)?.status, 'inactive')
  assert.match(engine.stableContext(scope).text, /我的名字：小鲸/)
  assert.doesNotMatch(engine.stableContext(scope).text, /大肥鱼/)
  assert.equal(store.memories().filter((memory) => memory.kind === 'experience').length, 1)
})

test('partial revocation preserves other self conventions; full revocation leaves the active profile', (t) => {
  const store = new Store(':memory:')
  t.after(() => store.close())
  const engine = new Engine(store)
  const options = { strict: true, retentionPolicy: true }
  for (const [id, text] of [
    ['style', '以后说话简洁、不用emoji、结尾加如你所愿'],
    ['partial', '不需要再加如你所愿了，其他不变'],
    ['full', '撤销之前简洁和不用emoji的要求'],
  ]) {
    store.source({ id, text, role: 'user', scope, session: 'style', at: new Date().toISOString() })
  }
  engine.apply(
    {
      operations: [
        {
          action: 'ADD',
          kind: 'self',
          selfKind: 'feedback',
          text: '我说话简洁，不用emoji，结尾加“如你所愿”。',
          durability: 'lasting',
          userQuote: '以后说话简洁、不用emoji、结尾加如你所愿',
          sources: ['style'],
          reason: '表达约定',
          retention: { basis: 'feedback', reason: '当前表达方式' },
        },
      ],
    },
    scope,
    [],
    ['style'],
    options,
  )
  const memory = store.memories()[0]
  engine.apply(
    {
      operations: [
        {
          action: 'UPDATE',
          target: memory.id,
          expectedVersion: 1,
          text: '我说话简洁，不用emoji。',
          userQuote: '不需要再加如你所愿了，其他不变',
          sources: ['partial'],
          reason: '移除被撤销部分',
          retention: { basis: 'feedback', reason: '保留其他表达约定' },
        },
      ],
    },
    scope,
    [memory.id],
    ['partial'],
    options,
  )
  assert.match(engine.stableContext(scope).text, /我说话简洁，不用emoji/)
  assert.doesNotMatch(engine.stableContext(scope).text, /如你所愿/)
  assert.deepEqual(store.memory(memory.id)?.sources, ['style', 'partial'])
  engine.apply(
    {
      operations: [
        {
          action: 'DELETE',
          target: memory.id,
          expectedVersion: 2,
          sources: ['full'],
          reason: '撤销剩余约定',
        },
      ],
    },
    scope,
    [memory.id],
    ['full'],
    options,
  )
  assert.equal(store.memory(memory.id)?.status, 'inactive')
  assert.doesNotMatch(engine.stableContext(scope).text, /不用emoji|如你所愿/)
  assert.ok(store.history().some((entry) => entry.action === 'DELETE'))
})
