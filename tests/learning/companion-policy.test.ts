import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Engine } from '../../src/companion/index.js'
import { Learner } from '../../src/learning/index.js'
import { isLowInformation, DEFAULT_SCOPE as scope, type Source } from '../../src/memory/index.js'
import { redactJsonText, redactSecrets } from '../../src/privacy/index.js'
import { Store } from '../../src/storage/index.js'

const source = (id: string, text: string, role = 'user'): Source => ({
  id,
  text,
  role,
  scope,
  session: 'session-' + id,
  event: 'turn-' + id,
  at: new Date().toISOString(),
})
const settle = async (learner: Learner) => {
  while (learner.running) {
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

test('obvious low-information turns incur no model call, job or source copy; feedback is not skipped', async (t) => {
  const store = new Store(':memory:')
  let calls = 0
  const learner = new Learner(new Engine(store), () => async () => {
    calls++
    return '{"operations":[],"state":null}'
  })
  t.after(async () => {
    await learner.close()
    store.close()
  })
  for (const [index, text] of [
    '你好，只回复“你好”。',
    '好的，谢谢，先这样。',
    '17乘23等于多少？只给数字。',
    'OK, thanks!',
  ].entries()) {
    assert.ok(isLowInformation(text), text)
    learner.enqueue({
      id: 'quiet' + index,
      scope,
      sources: [source('u' + index, text), source('a' + index, '收到', 'assistant')],
    })
  }
  await settle(learner)
  assert.equal(calls, 0)
  assert.equal(store.db.prepare('SELECT count(*) n FROM jobs').get()?.n, 0)
  assert.equal(store.db.prepare('SELECT count(*) n FROM sources').get()?.n, 0)
  assert.equal(isLowInformation('谢谢，但你又提前宣布完成了，这让我很困扰'), false)
  assert.equal(isLowInformation('以后请叫我小禾'), false)
  learner.enqueue({
    id: 'feedback',
    scope,
    sources: [source('feedback', '你又提前宣布完成了，这让我很困扰')],
  })
  await settle(learner)
  assert.equal(calls, 1)
})

test('routine reports, promises and future statements cannot pass the retention policy with a tool source', (testContext) => {
  const store = new Store(':memory:')
  testContext.after(() => store.close())
  const engine = new Engine(store)
  store.source(source('u', '这次把配置改回官方路径，完成后告诉我'))
  store.source(source('t', '读取配置成功；重启成功', 'tool'))
  const options = { strict: true, retentionPolicy: true }
  engine.apply(
    {
      operations: [
        {
          action: 'ADD',
          kind: 'experience',
          text: '重置配置，重启成功',
          sources: ['u', 't'],
          reason: '日常流程',
          userQuote: '把配置改回官方路径',
          retention: { basis: 'knowledge', reason: '工作结果' },
        },
        {
          action: 'ADD',
          kind: 'self',
          selfKind: 'intention',
          text: '我以后会复查配置',
          sources: ['u', 't'],
          reason: '承诺',
          userQuote: '把配置改回官方路径',
          retention: { basis: 'feedback', reason: '以后更好' },
        },
        {
          action: 'ADD',
          kind: 'self',
          selfKind: 'behavior',
          text: '重置后，我会重启并复查配置',
          sources: ['u', 't'],
          reason: '错误升级意图',
          userQuote: '把配置改回官方路径',
          retention: { basis: 'feedback', reason: '以后更好' },
        },
      ],
    },
    scope,
    [],
    ['u', 't'],
    options,
  )
  assert.equal(store.memories().length, 0)
  assert.equal(store.history().filter((x) => x.action === 'NONE').length, 3)
})

test('valuable knowledge, explicit feedback and a meaningful milestone survive; later corrections still work', async (testContext) => {
  const store = new Store(':memory:')
  testContext.after(() => store.close())
  const engine = new Engine(store)
  const lines = [
    '雾港1.0的回声戒指冷却是17秒',
    '你提前宣布完成，我分不清哪些经过验证',
    '这是我们第一个一起完成的作品，对我很重要',
  ]
  lines.forEach((text, i) => store.source(source('u' + i, text)))
  const operations = [
    {
      action: 'ADD',
      kind: 'cognition',
      text: lines[0],
      retention: { basis: 'knowledge', reason: '游戏版本规则' },
    },
    {
      action: 'ADD',
      kind: 'self',
      selfKind: 'feedback',
      text: lines[1],
      retention: { basis: 'feedback', reason: '具体反馈，尚未形成性格' },
    },
    {
      action: 'ADD',
      kind: 'experience',
      text: lines[2],
      retention: { basis: 'milestone', reason: '用户明确重视共同作品' },
    },
  ].map((operation, i) => ({
    ...operation,
    userQuote: lines[i],
    sources: ['u' + i],
    reason: '原话支持',
  }))
  engine.apply({ operations }, scope, [], ['u0', 'u1', 'u2'], {
    strict: true,
    retentionPolicy: true,
  })
  assert.equal(store.memories().length, 3)
  assert.equal(store.traits(scope).length, 0)
  assert.doesNotMatch((await engine.recall(scope, '帮我计算圆的面积')).context, /提前宣布完成/)
  assert.match((await engine.recall(scope, '提前宣布完成')).context, /哪些经过验证/)
  const memory = store.memories().find((candidateMemory) => candidateMemory.kind === 'cognition')!
  store.source(source('correct', '纠正：回声戒指冷却23秒'))
  engine.apply(
    {
      operations: [
        {
          action: 'UPDATE',
          target: memory.id,
          expectedVersion: 1,
          text: '雾港1.0的回声戒指冷却23秒',
          userQuote: '回声戒指冷却23秒',
          retention: { basis: 'knowledge', reason: '修正规则' },
          sources: ['correct'],
          reason: '更正',
        },
      ],
    },
    scope,
    [memory.id],
    ['correct'],
    { strict: true, retentionPolicy: true },
  )
  assert.equal(store.memory(memory.id)?.version, 2)
  engine.apply(
    {
      operations: [
        {
          action: 'DELETE',
          target: memory.id,
          expectedVersion: 2,
          sources: ['correct'],
          reason: '撤销',
        },
      ],
    },
    scope,
    [memory.id],
    ['correct'],
    { strict: true, retentionPolicy: true },
  )
  assert.equal(store.memory(memory.id)?.status, 'inactive')
})

test('credentials are redacted before storage and generation; discarded work leaves no source or completed payload', async (t) => {
  const store = new Store(':memory:')
  let input = ''
  // Split so the release scan does not mistake the fixture for a real key.
  const key = 'sk-' + 'TEST-NOT-A-REAL-KEY-7d91'
  const learner = new Learner(new Engine(store), () => async (_system, user) => {
    input = user
    return '{"operations":[],"state":null}'
  })
  t.after(async () => {
    await learner.close()
    store.close()
  })
  learner.enqueue({
    id: 'private',
    scope,
    sources: [source('u', '仅用于一次测试的 API Key: ' + key)],
  })
  assert.ok(!String(store.db.prepare('SELECT payload FROM jobs').get()?.payload).includes(key))
  assert.ok(!store.getSource('u')?.text.includes(key))
  await settle(learner)
  assert.ok(!input.includes(key))
  assert.match(input, /凭据已隐藏/)
  assert.equal(store.db.prepare('SELECT count(*) n FROM sources').get()?.n, 0)
  assert.deepEqual(
    JSON.parse(String(store.db.prepare('SELECT payload FROM jobs').get()?.payload)).sources,
    [],
  )
  assert.ok(!redactSecrets('Authorization: Bearer abcdefghijklmnop').includes('abcdefghijklmnop'))
  const nested = JSON.parse(
    redactJsonText(
      JSON.stringify({ text: '配置 {"password":"my-secret-password"}，接着引用“偏好”' }),
    ),
  )
  assert.ok(!nested.text.includes('my-secret-password'))
  assert.match(nested.text, /偏好/)
})

test('provider error credentials never enter new job errors or the dashboard, including legacy errors', (t) => {
  const store = new Store(':memory:')
  t.after(() => store.close())
  const credential = 'pst-' + 'SYNTHETIC-ERROR-CREDENTIAL-ONLY'
  const message = `Provider rejected Authorization: Bearer ${credential}`
  for (const id of ['retryable', 'terminal', 'legacy']) {
    store.jobs.enqueue(id, JSON.stringify({ scope, sources: [] }))
  }
  store.jobs.fail('retryable', message)
  store.jobs.giveUp('terminal', message)
  for (const id of ['retryable', 'terminal']) {
    const row = store.db.prepare('SELECT error FROM jobs WHERE id=?').get(id)
    assert.ok(!String(row?.error).includes(credential))
    assert.match(String(row?.error), /凭据已隐藏/)
  }
  store.db.prepare("UPDATE jobs SET error=?,status='failed' WHERE id='legacy'").run(message)
  assert.ok(!JSON.stringify(store.jobs.list(scope)).includes(credential))
})

test('source cleanup protects referenced history and unfinished jobs; failed jobs keep retry evidence', async (testContext) => {
  const store = new Store(':memory:')
  testContext.after(() => store.close())
  const engine = new Engine(store)
  const keep = source('keep', '项目长期使用 pnpm')
  const pending = source('pending', '新的反馈')
  const drop = source('drop', '普通经过')
  ;[keep, pending, drop].forEach((candidateSource) => store.source(candidateSource))
  engine.apply(
    {
      operations: [
        { action: 'ADD', kind: 'cognition', text: keep.text, sources: ['keep'], reason: '约定' },
      ],
    },
    scope,
    [],
    ['keep'],
  )
  const insert = (id: string, status: string, sources: Source[]) =>
    store.db
      .prepare('INSERT INTO jobs(id,payload,status,updated_at) VALUES (?,?,?,?)')
      .run(id, JSON.stringify({ id, scope, sources }), status, new Date().toISOString())
  insert('done', 'done', [keep, pending, drop])
  insert('retry', 'failed', [pending])
  store.releaseLearningPayload('done')
  assert.ok(store.getSource('keep'))
  assert.ok(store.getSource('pending'))
  assert.equal(store.getSource('drop'), undefined)
  assert.equal(
    JSON.parse(String(store.db.prepare("SELECT payload FROM jobs WHERE id='retry'").get()?.payload))
      .sources.length,
    1,
  )
})

test('background token ledger is scoped to the current owner/persona and includes failed calls', (testContext) => {
  const store = new Store(':memory:')
  testContext.after(() => store.close())
  store.recordLearningUsage(
    scope,
    { inputTokens: 100, cacheReadTokens: 200, outputTokens: 30 },
    true,
  )
  store.recordLearningUsage(scope, { inputTokens: NaN, outputTokens: -1 }, false)
  assert.deepEqual(
    { ...store.learningUsage(scope), since: '' },
    {
      calls: 2,
      failedCalls: 1,
      inputTokens: 100,
      cacheReadTokens: 200,
      outputTokens: 30,
      since: '',
    },
  )
  assert.equal(store.learningUsage({ ...scope, persona: 'other' }).calls, 0)
})
