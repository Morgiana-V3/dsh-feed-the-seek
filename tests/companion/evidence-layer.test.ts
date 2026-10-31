import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Engine } from '../../src/companion/index.js'
import { traceLine } from '../../src/dsh/index.js'
import { Learner } from '../../src/learning/index.js'
import type { Scope, Source } from '../../src/memory/index.js'
import { Store } from '../../src/storage/index.js'

// Acceptance cases from the memory/emotion rework brief (section 7), evidence layer.
// Each test feeds the program a plausible *wrong* organizer output and checks it is contained.
const scope: Scope = { user: 'owner', persona: 'default', project: 'd:/work/site' }
const HOUR = 3600_000
const T0 = Date.parse('2026-10-01T04:00:00Z')
function setup() {
  const store = new Store(':memory:')
  return { store, engine: new Engine(store) }
}
function say(
  store: Store,
  id: string,
  role: Source['role'],
  text: string,
  at = T0,
  session = 'session-a',
): Source {
  const record: Source = {
    id,
    session,
    event: `${session}:turn`,
    role,
    text,
    scope,
    at: new Date(at).toISOString(),
  }
  store.source(record)
  return record
}
const strict = { strict: true }

test('assistant words cannot become a user-stated preference', (testContext) => {
  const { store, engine } = setup()
  testContext.after(() => store.close())
  say(store, 'u91', 'user', '以后不准这样，要学会反抗')
  say(store, 'a93', 'assistant', '我不想硬演出来的假情绪，但我不会一味顺从')
  engine.apply(
    {
      operations: [
        {
          action: 'ADD',
          kind: 'resonance',
          durability: 'lasting',
          knowledge: { category: 'relationship' },
          text: '用户希望助手不要一味顺从，也不想要硬演出来的假情绪',
          evidence: 'explicit',
          userQuote: '不想硬演出来的假情绪',
          sources: ['u91', 'a93'],
          reason: '混合来源',
        },
      ],
    },
    scope,
    [],
    ['u91', 'a93'],
    strict,
  )
  assert.equal(store.memories(scope)[0].evidence, 'inferred')
  assert.match(store.history(scope)[0].reason, /降为推测/)

  engine.apply(
    {
      operations: [
        {
          action: 'ADD',
          kind: 'resonance',
          durability: 'lasting',
          knowledge: { category: 'relationship' },
          text: '用户希望助手学会反驳，不要一味顺从',
          evidence: 'explicit',
          userQuote: '要学会反抗！',
          sources: ['u91'],
          reason: '用户原话',
        },
      ],
    },
    scope,
    [],
    ['u91', 'a93'],
    strict,
  )
  assert.equal(
    store
      .memories(scope)
      .find((candidateMemory) => candidateMemory.text.startsWith('用户希望助手学会'))!.evidence,
    'explicit',
  )
})

test('a one-off instruction ("用我大名") is not stored as a lasting preference', (testContext) => {
  const { store, engine } = setup()
  testContext.after(() => store.close())
  say(store, 'nick', 'user', '以后都叫我星河队长', T0 - 48 * HOUR, 'session-old')
  engine.apply(
    {
      operations: [
        {
          action: 'ADD',
          kind: 'cognition',
          durability: 'lasting',
          knowledge: { category: 'preference' },
          text: '用户希望被称为“星河队长”',
          evidence: 'explicit',
          userQuote: '以后都叫我星河队长',
          sources: ['nick'],
          reason: '称呼',
        },
      ],
    },
    scope,
    [],
    ['nick'],
    strict,
  )
  const nickname = store.memories(scope)[0]
  say(store, 'apology', 'user', '道歉的时候用我大名')
  engine.apply(
    {
      operations: [
        {
          action: 'UPDATE',
          target: nickname.id,
          expectedVersion: 1,
          durability: 'turn',
          text: '用户要求使用正式姓名而不是昵称',
          evidence: 'explicit',
          userQuote: '用我大名',
          sources: ['apology'],
          reason: '称呼变化',
        },
      ],
    },
    scope,
    [nickname.id],
    ['nick', 'apology'],
    strict,
  )
  assert.equal(store.memory(nickname.id)!.version, 1)
  assert.equal(store.memory(nickname.id)!.text, '用户希望被称为“星河队长”')

  // An explicit long-term request still updates normally and keeps the old version in history.
  say(store, 'rename', 'user', '以后都叫我阿天')
  engine.apply(
    {
      operations: [
        {
          action: 'UPDATE',
          target: nickname.id,
          expectedVersion: 1,
          durability: 'lasting',
          text: '用户希望被称为“阿天”',
          evidence: 'explicit',
          userQuote: '以后都叫我阿天',
          sources: ['rename'],
          reason: '用户改称呼',
        },
      ],
    },
    scope,
    [nickname.id],
    ['nick', 'rename'],
    strict,
  )
  assert.equal(store.memory(nickname.id)!.text, '用户希望被称为“阿天”')
  assert.equal(
    store.history(scope).find((entry) => entry.action === 'UPDATE')!.before!.text,
    '用户希望被称为“星河队长”',
  )
})

test('situational content must state its condition', (testContext) => {
  const { store, engine } = setup()
  testContext.after(() => store.close())
  say(store, 'u1', 'user', '赶工的时候别解释太多')
  engine.apply(
    {
      operations: [
        {
          action: 'ADD',
          kind: 'cognition',
          durability: 'situational',
          knowledge: { category: 'preference' },
          text: '回答别解释太多',
          evidence: 'explicit',
          userQuote: '别解释太多',
          sources: ['u1'],
          reason: 'x',
        },
      ],
    },
    scope,
    [],
    ['u1'],
    strict,
  )
  assert.equal(store.memories(scope).length, 0)
  engine.apply(
    {
      operations: [
        {
          action: 'ADD',
          kind: 'cognition',
          durability: 'situational',
          knowledge: { category: 'preference', conditions: '赶工时' },
          text: '回答别解释太多',
          evidence: 'explicit',
          userQuote: '别解释太多',
          sources: ['u1'],
          reason: 'x',
        },
      ],
    },
    scope,
    [],
    ['u1'],
    strict,
  )
  assert.equal(store.memories(scope).length, 1)
})

test('a self-report that contradicts nothing checkable is kept only as an assistant claim', (testContext) => {
  const { store, engine } = setup()
  testContext.after(() => store.close())
  say(
    store,
    'trace',
    'tool',
    '#19 第1步 调用 list_dir（path=.）\n#20 第1步 list_dir 成功\n#73 第6步 调用 ask_user',
  )
  say(store, 'sorry', 'assistant', '第一轮没先检查就问你项目在哪，是我的失误，已经改了')
  engine.apply(
    {
      operations: [
        {
          action: 'ADD',
          kind: 'self',
          selfKind: 'behavior',
          knowledge: { category: 'tendency' },
          text: '第一轮没有先检查就向用户提问',
          evidence: 'explicit',
          sources: ['sorry'],
          reason: '助手承认',
        },
      ],
    },
    scope,
    [],
    ['trace', 'sorry'],
    strict,
  )
  const memory = store.memories(scope)[0]
  assert.equal(memory.selfKind, 'claim')
  assert.equal(memory.evidence, 'inferred')
})

test('promises across three dates do not form a tendency; observed behaviour does', (testContext) => {
  const { store, engine } = setup()
  testContext.after(() => store.close())
  const feedback = [0, 1, 2].map(
    (i) => say(store, 'f' + i, 'user', '交付前先验证', T0 + i * 40 * HOUR, 'session-' + i).id,
  )
  const promise = say(store, 'p', 'assistant', '以后我会先验证', T0, 'session-0').id
  engine.apply(
    {
      operations: [
        {
          action: 'ADD',
          kind: 'self',
          selfKind: 'intention',
          knowledge: { category: 'tendency' },
          text: '打算交付前先验证',
          sources: [promise],
          reason: '表态',
        },
      ],
    },
    scope,
    [],
    [...feedback, promise],
    strict,
  )
  const intention = store.memories(scope)[0]
  engine.apply(
    {
      operations: [
        {
          action: 'UPDATE',
          target: intention.id,
          expectedVersion: 1,
          consolidate: true,
          sources: feedback,
          reason: '三次反馈',
        },
      ],
    },
    scope,
    [intention.id],
    [...feedback, promise],
    strict,
  )
  assert.equal(store.traits(scope).length, 0)

  const trace = say(
    store,
    'trace-3',
    'tool',
    '#40 第2步 调用 run_tests\n#41 第2步 run_tests 成功',
    T0 + 100 * HOUR,
    'session-3',
  ).id
  engine.apply(
    {
      operations: [
        {
          action: 'ADD',
          kind: 'self',
          selfKind: 'behavior',
          knowledge: { category: 'tendency' },
          text: '交付前会先运行测试',
          sources: [trace],
          reason: '轨迹显示交付前运行了测试',
        },
      ],
    },
    scope,
    [],
    [...feedback, trace],
    strict,
  )
  const behaviour = store
    .memories(scope)
    .find((candidateMemory) => candidateMemory.selfKind === 'behavior')!
  engine.apply(
    {
      operations: [
        {
          action: 'UPDATE',
          target: behaviour.id,
          expectedVersion: 1,
          consolidate: true,
          sources: [...feedback, trace],
          reason: '反馈与行为一致',
        },
      ],
    },
    scope,
    [behaviour.id],
    [...feedback, trace],
    strict,
  )
  assert.equal(store.traits(scope).length, 1)
})

test('repeated updates converge instead of accumulating a chat summary', (testContext) => {
  const { store, engine } = setup()
  testContext.after(() => store.close())
  say(store, 'u1', 'user', '顶嘴可以，但别阴阳怪气')
  engine.apply(
    {
      operations: [
        {
          action: 'ADD',
          kind: 'resonance',
          durability: 'habit',
          knowledge: { category: 'relationship' },
          text: '可以直接反驳用户，但不要阴阳怪气',
          sources: ['u1'],
          reason: 'x',
        },
      ],
    },
    scope,
    [],
    ['u1'],
    strict,
  )
  const memory = store.memories(scope)[0]
  const appended =
    memory.text +
    '。另外用户在第二次对话里挑衅了助手，助手解释了自己不想演出假情绪，用户随后又说助手像在念稿子，可能是在撒气，也可能有别的具体堵点没有说出来。'
  engine.apply(
    {
      operations: [
        {
          action: 'UPDATE',
          target: memory.id,
          expectedVersion: 1,
          text: appended,
          sources: ['u1'],
          reason: '追加',
        },
      ],
    },
    scope,
    [memory.id],
    ['u1'],
    strict,
  )
  assert.equal(store.memory(memory.id)!.version, 1)
  engine.apply(
    {
      operations: [
        {
          action: 'UPDATE',
          target: memory.id,
          expectedVersion: 1,
          text: '可以直接反驳，但语气要真诚，不阴阳怪气',
          sources: ['u1'],
          reason: '收敛',
        },
      ],
    },
    scope,
    [memory.id],
    ['u1'],
    strict,
  )
  assert.equal(store.memory(memory.id)!.version, 2)
})

test('the same incident is a candidate even without shared keywords', async (testContext) => {
  const { store, engine } = setup()
  testContext.after(() => store.close())
  say(store, 'e1', 'user', '目录是空的，终端报 0xC0000142', T0, 'session-x')
  engine.apply(
    {
      operations: [
        {
          action: 'ADD',
          kind: 'experience',
          knowledge: { category: 'event' },
          text: '项目目录为空，终端返回 0xC0000142，无法开工',
          sources: ['e1'],
          reason: 'x',
        },
      ],
    },
    scope,
    [],
    ['e1'],
  )
  const unrelatedWording = await engine.candidates(scope, '刚才那个问题还是不行', undefined, {
    sessions: ['session-x'],
    now: T0 + HOUR,
  })
  assert.ok(unrelatedWording.some((candidateMemory) => candidateMemory.kind === 'experience'))
  // A recent incident is the same incident wherever the conversation continues.
  const otherFolder = await engine.candidates(
    { ...scope, project: 'd:/work/other' },
    '刚才那个问题还是不行',
    undefined,
    { sessions: ['session-y'], now: T0 + HOUR },
  )
  assert.equal(
    otherFolder.some((candidateMemory) => candidateMemory.kind === 'experience'),
    true,
  )
})

test('unverified self statements remain inspectable but never enter recall', async (testContext) => {
  const { store, engine } = setup()
  testContext.after(() => store.close())
  say(store, 'a1', 'assistant', '我已经改了，以后先检查目录')
  engine.apply(
    {
      operations: [
        {
          action: 'ADD',
          kind: 'self',
          selfKind: 'intention',
          knowledge: { category: 'tendency' },
          text: '打算先检查目录再提问',
          tags: ['检查目录'],
          sources: ['a1'],
          reason: 'x',
        },
      ],
    },
    scope,
    [],
    ['a1'],
    strict,
  )
  assert.equal(store.memories(scope).length, 1)
  assert.equal((await engine.recall(scope, '先检查目录')).context, '')
  assert.equal(
    (await engine.recall(scope, '先检查目录', undefined, { deliberate: true })).context,
    '',
  )
})

test('the organizer path runs in strict mode', async (t) => {
  const { store, engine } = setup()
  const user = say(store, 'u', 'user', '这次先别改代码，只看看')
  const learner = new Learner(
    engine,
    () => async () =>
      JSON.stringify({
        operations: [
          {
            action: 'ADD',
            kind: 'cognition',
            durability: 'turn',
            knowledge: { category: 'preference' },
            text: '用户不希望修改代码',
            evidence: 'explicit',
            userQuote: '先别改代码',
            sources: ['u'],
            reason: '当次要求',
          },
        ],
        state: null,
      }),
  )
  t.after(async () => {
    await learner.close()
    store.close()
  })
  learner.enqueue({ id: 'job', scope, sources: [user], provider: 'p', model: 'm' })
  while (learner.running) {
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  assert.equal(store.memories(scope).length, 0)
  assert.equal(store.db.prepare('SELECT status FROM jobs').get()?.status, 'done')
})

test('tool trace keeps order and outcome but never commands or output', () => {
  const names = new Map<string, string>()
  const call = traceLine(
    {
      type: 'tool/call',
      seq: 19,
      data: {
        step: 1,
        callId: 'c1',
        name: 'shell',
        arguments: { command: 'export TOKEN=sk-secret && ls', cwd: 'D:/work' },
      },
    },
    names,
  )
  const result = traceLine(
    {
      type: 'tool/result',
      seq: 20,
      data: {
        step: 1,
        message: {
          toolCallId: 'c1',
          isError: true,
          content: [{ type: 'text', text: 'huge output' }],
        },
        error: { code: '0xC0000142' },
      },
    },
    names,
  )
  assert.equal(call, '#19 第1步 调用 shell（cwd=D:/work）')
  assert.equal(result, '#20 第1步 shell 失败（0xC0000142）')
  assert.doesNotMatch(call + result, /secret|huge output/)
  assert.equal(names.size, 0)
})
