import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Engine } from '../../src/companion/index.js'
import { usedItems } from '../../src/dsh/index.js'
import { Learner } from '../../src/learning/index.js'
import type { Memory, Scope, Source } from '../../src/memory/index.js'
import { memoryStrength, normalizeImportance } from '../../src/memory/index.js'
import {
  applyPersonaEdits,
  consolidateSelf,
  emptyPersona,
  loadPersona,
  notePersonaObservation,
  resolveIndexes,
  selfObservations,
  sessionScenes,
  synthesizePersona,
  type PersonaDoc,
} from '../../src/persona/index.js'
import { Store } from '../../src/storage/index.js'

// 0.2.15: strength & forgetting, the three injection layers, naming facts, persona synthesis,
// self consolidation and organizer robustness (ported from the earlier bot, adapted to DSH).
const scope: Scope = { user: 'owner', persona: 'default', project: 'd:/work/site' }
const DAY = 86_400_000
const NOW = Date.parse('2026-10-30T04:00:00Z')
function setup() {
  const store = new Store(':memory:')
  return { store, engine: new Engine(store) }
}
let counter = 0
function say(
  store: Store,
  text: string,
  role: Source['role'] = 'user',
  session = 'session-old',
  at = NOW - 30 * DAY,
): Source {
  const record: Source = {
    id: `src-${++counter}`,
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
function add(
  engine: Engine,
  operation: Record<string, unknown>,
  session = 'session-old',
  strict = false,
): Memory {
  const source = say(engine.store, String(operation.quote ?? operation.text), 'user', session)
  const { quote: _quote, ...rest } = operation
  return engine.apply(
    { operations: [{ action: 'ADD', global: true, sources: [source.id], reason: 'x', ...rest }] },
    scope,
    [],
    [source.id],
    { strict },
  )[0]
}
function age(store: Store, memory: Memory, days: number) {
  const at = new Date(NOW - days * DAY).toISOString()
  store.put({ ...store.memory(memory.id)!, updatedAt: at, createdAt: at })
  return store.memory(memory.id)!
}

test('importance accepts 1–10 and older 0–1 values', (testContext) => {
  const { store, engine } = setup()
  testContext.after(() => store.close())
  assert.equal(
    add(engine, {
      kind: 'cognition',
      text: '用户喜欢猫',
      knowledge: { category: 'preference' },
      importance: 8,
    }).importance,
    0.8,
  )
  assert.equal(normalizeImportance(0.3), 0.3)
})

test('trivial memories fade from automatic injection; important ones, rules and real use keep them', async (testContext) => {
  const { store, engine } = setup()
  testContext.after(() => store.close())
  const trivial = age(
    store,
    add(engine, {
      kind: 'experience',
      text: '某次白屏问题顺手修好了',
      knowledge: { category: 'event' },
      importance: 4,
    }),
    90,
  )
  const milestone = age(
    store,
    add(engine, {
      kind: 'experience',
      text: '第一次见面时用户给她起名，白屏问题那天',
      knowledge: { category: 'event' },
      importance: 9,
    }),
    365,
  )
  const rule = age(
    store,
    add(engine, {
      kind: 'cognition',
      text: '雾港1.0回声戒指让普通技能再触发',
      knowledge: { category: 'rule', domain: '雾港' },
      importance: 3,
    }),
    365,
  )
  const auto = await engine.recall(scope, '白屏问题', undefined, { now: NOW })
  assert.ok(
    !auto.items.some((candidateRecallItem) => candidateRecallItem.memory.id === trivial.id),
    'a 90-day-old trivial experience is out of automatic injection',
  )
  assert.ok(
    auto.items.some((candidateRecallItem) => candidateRecallItem.memory.id === milestone.id),
    'importance 9 never fades below the line',
  )
  assert.ok(
    (await engine.recall(scope, '白屏问题', undefined, { deliberate: true, now: NOW })).items.some(
      (candidateRecallItem) => candidateRecallItem.memory.id === trivial.id,
    ),
    'a deliberate recall still finds it',
  )
  assert.equal(
    memoryStrength(rule, [], NOW),
    memoryStrength(rule, [], NOW - 300 * DAY),
    'objective rules do not fade',
  )
  store.use([trivial], 'turn-recalled')
  assert.ok(
    memoryStrength(store.memory(trivial.id)!, store.uses(trivial.id)) > 0.15,
    'a real use brings it back',
  )
})

test('the stable layer carries the self dimension only; facts, relationship and experiences wait for the topic', async (testContext) => {
  const { store, engine } = setup()
  testContext.after(() => store.close())
  add(engine, {
    kind: 'cognition',
    text: '用户是前端开发工程师',
    knowledge: { category: 'person' },
    durability: 'lasting',
    importance: 6,
  })
  add(engine, {
    kind: 'resonance',
    text: '你愿意和我聊工作上的烦恼',
    knowledge: { category: 'relationship' },
    durability: 'lasting',
    importance: 9,
  })
  const request = add(engine, {
    kind: 'self',
    selfKind: 'feedback',
    durability: 'lasting',
    text: '你希望我回答先给结论',
    knowledge: { category: 'tendency' },
    retention: { basis: 'feedback', reason: '长期要求' },
  })
  const first = engine.stableContext(scope, NOW)
  assert.match(first.text, /【我的表达与做事方式】\n- 你希望我回答先给结论/)
  assert.doesNotMatch(
    first.text,
    /前端|烦恼/,
    'facts about you and the relationship are recalled by topic',
  )
  assert.ok(first.ids.has(request.id))
  assert.equal(engine.stableContext(scope, NOW + 3 * DAY).text, first.text)
  assert.doesNotMatch(first.text, /\d{4}-\d{2}-\d{2}|天前/)
  for (let turn = 0; turn < 30; turn++) {
    const snapshot = await engine.recall(scope, '嗯', undefined, {
      excludeIds: first.ids,
      now: NOW,
    })
    store.use(usedItems(snapshot), `turn-${turn}`)
    engine.stableContext(scope, NOW)
  }
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM recall_uses').get()?.n, 0)
  assert.equal(
    (await engine.recall(scope, '前端工程', undefined, { excludeIds: first.ids, now: NOW }))
      .items[0]?.memory.text,
    '用户是前端开发工程师',
  )
  assert.ok(
    !(
      await engine.recall(scope, '回答结论', undefined, { excludeIds: first.ids, now: NOW })
    ).items.some((candidateRecallItem) => candidateRecallItem.memory.id === request.id),
    'turn layer never repeats the stable layer',
  )
})

test('memories learned in this session are not re-injected into it', async (testContext) => {
  const { store, engine } = setup()
  testContext.after(() => store.close())
  const memory = add(
    engine,
    { kind: 'experience', text: '刚才一起排查了构建失败', knowledge: { category: 'event' } },
    'session-now',
  )
  assert.equal(
    (
      await engine.recall(scope, '构建失败', undefined, {
        excludeSessions: new Set(['session-now']),
      })
    ).items.length,
    0,
  )
  assert.equal(
    (
      await engine.recall(scope, '构建失败', undefined, {
        excludeSessions: new Set(['session-other']),
      })
    ).items[0].memory.id,
    memory.id,
  )
})

test('self: the latest observations are always carried; one older one joins only when the topic matches', async (testContext) => {
  const { store, engine } = setup()
  testContext.after(() => store.close())
  const feedback = (text: string, days: number) =>
    age(
      store,
      add(engine, {
        kind: 'self',
        selfKind: 'feedback',
        text,
        knowledge: { category: 'tendency' },
        retention: { basis: 'feedback', reason: '反馈' },
      }),
      days,
    )
  const old = [feedback('你说我解释正则时太啰嗦', 40), feedback('你说我排查报错时先看日志很好', 39)]
  const recent = [
    feedback('你说我最近更愿意先问清需求', 3),
    feedback('你说我给的方案太保守', 2),
    feedback('你说我说话更直接了', 1),
  ]
  const stable = engine.stableContext(scope, NOW)
  assert.deepEqual(
    recent.map((candidateMemory) => stable.ids.has(candidateMemory.id)),
    [true, true, true],
  )
  assert.ok(old.every((candidateMemory) => !stable.ids.has(candidateMemory.id)))
  const options = { excludeIds: stable.ids, now: NOW }
  const regex = await engine.recall(scope, '帮我写个正则，解释一下', undefined, options)
  assert.deepEqual(
    regex.items
      .filter((candidateRecallItem) => candidateRecallItem.memory.kind === 'self')
      .map((candidateRecallItem) => candidateRecallItem.memory.id),
    [old[0].id],
    'one relevant self observation',
  )
  const unrelated = await engine.recall(scope, '今天天气怎么样', undefined, options)
  assert.equal(
    unrelated.items.filter((candidateRecallItem) => candidateRecallItem.memory.kind === 'self')
      .length,
    0,
    'none when nothing matches',
  )
  const both = await engine.recall(scope, '正则报错日志', undefined, options)
  assert.equal(
    both.items.filter((candidateRecallItem) => candidateRecallItem.memory.kind === 'self').length,
    1,
    'at most one slot, never padded',
  )
})

test('naming: a new preferred address replaces the old, nicknames stay, names are never invented', (testContext) => {
  const { store, engine } = setup()
  testContext.after(() => store.close())
  add(
    engine,
    {
      kind: 'cognition',
      text: '用户希望被称为“测试用户甲”',
      quote: '以后叫我测试用户甲',
      knowledge: { category: 'person' },
      alias: { kind: 'user_preferred', value: '测试用户甲' },
    },
    's1',
    true,
  )
  add(
    engine,
    {
      kind: 'cognition',
      text: '用户希望被称为“小林”',
      quote: '以后叫我小林',
      knowledge: { category: 'person' },
      alias: { kind: 'user_preferred', value: '小林' },
    },
    's1',
    true,
  )
  add(
    engine,
    {
      kind: 'cognition',
      text: '朋友叫用户“小米”',
      quote: '朋友都叫我小米',
      knowledge: { category: 'person' },
      alias: { kind: 'user_nickname', value: '小米' },
    },
    's1',
    true,
  )
  add(
    engine,
    {
      kind: 'cognition',
      text: '用户正式姓名是林小明',
      quote: '道歉的时候用我大名',
      knowledge: { category: 'person' },
      alias: { kind: 'user_preferred', value: '林小明' },
    },
    's1',
    true,
  )
  const preferred = store
    .memories(scope)
    .filter((candidateMemory) => candidateMemory.alias?.kind === 'user_preferred')
  assert.deepEqual(
    preferred.map((candidateMemory) => candidateMemory.alias!.value),
    ['小林'],
  )
  assert.ok(
    store
      .memories(scope)
      .some((candidateMemory) => candidateMemory.text.includes('林小明') && !candidateMemory.alias),
    'an invented name is not stored as a naming fact',
  )
  assert.match(engine.stableContext(scope).text, /我叫你：小林；你也被叫作：小米/)
})

/** A scene is the situation an observation is about (its domain); projects no longer split memory. */
function observation(
  id: string,
  scene: string,
  daysAgo: number,
  selfKind: Memory['selfKind'] = 'behavior',
): Memory {
  const at = new Date(NOW - daysAgo * DAY).toISOString()
  return {
    id,
    kind: 'self',
    text: id,
    tags: [],
    scope: { ...scope, project: '' },
    evidence: 'inferred',
    importance: 0.5,
    status: 'active',
    version: 1,
    sources: [],
    createdAt: at,
    updatedAt: at,
    knowledge: { category: 'tendency', domain: scene, edition: '', conditions: '' },
    confidence: 0.5,
    selfKind,
    retention: { basis: 'feedback', reason: '独立反馈支持的观察' },
  }
}

test("persona edits are admitted by counted evidence, not by the model's word", () => {
  const twoScenes = [observation('a', 'p1', 9), observation('b', 'p2', 8)]
  const oneSceneThreeDays = [
    observation('c', 'p1', 9),
    observation('d', 'p1', 7),
    observation('e', 'p1', 5),
  ]
  const add = (section: 'self' | 'scenes', evidenceIndexes: unknown[], obs: Memory[]) =>
    applyPersonaEdits(
      emptyPersona(),
      [{ op: 'add', section, text: '被质疑时先核对证据', evidenceIndexes, reason: '' }],
      obs,
      NOW,
    )
  assert.equal(
    add('self', [0, 1], twoScenes).diff.added.length,
    1,
    'two scenes may describe who she is',
  )
  assert.equal(
    add('self', [0, 1, 2], oneSceneThreeDays).diff.added.length,
    0,
    'one scene over three days is conditional only',
  )
  assert.equal(add('scenes', [0, 1, 2], oneSceneThreeDays).diff.added.length, 1)
  assert.equal(add('scenes', [0], oneSceneThreeDays).diff.added.length, 0)
  assert.deepEqual(
    resolveIndexes([null, '1', 'x', 99, 0, 1.5], 3),
    [1, 0],
    'null never becomes index 0',
  )
  const doc: PersonaDoc = {
    ...emptyPersona(),
    sections: {
      self: [
        {
          text: '说话直接',
          evidence: ['a', 'b', 'c', 'd'],
          since: new Date(NOW - 3 * DAY).toISOString(),
        },
      ],
      scenes: [],
      values: [],
    },
  }
  assert.equal(
    applyPersonaEdits(
      doc,
      [
        {
          op: 'update',
          section: 'self',
          targetIndex: 0,
          text: '说话直接但会顾及情绪',
          evidenceIndexes: [0],
          reason: '',
        },
      ],
      twoScenes,
      NOW,
    ).diff.rejected.length,
    1,
    'rewriting needs half as much new evidence',
  )
  assert.equal(
    applyPersonaEdits(
      doc,
      [{ op: 'remove', section: 'self', targetIndex: 0, evidenceIndexes: [], reason: '' }],
      [],
      NOW,
    ).diff.removed.length,
    0,
    'a fresh evidenced line cannot be removed',
  )
})

test('persona synthesis runs only when due, counts only real evidence and keeps a version', async (testContext) => {
  const { store, engine } = setup()
  testContext.after(() => store.close())
  const ids = [
    ['p1', 9, 'behavior'],
    ['p2', 8, 'feedback'],
    ['p1', 7, 'claim'],
  ].map(([project, days, kind], index) => {
    const memory = observation(
      `obs-${index}`,
      project as string,
      days as number,
      kind as Memory['selfKind'],
    )
    store.put(memory)
    return memory.id
  })
  let input = ''
  const generate = async (_system: string, user: string) => {
    input = user
    return JSON.stringify({
      edits: [
        {
          op: 'add',
          section: 'self',
          text: '被质疑时先核对证据再回应',
          evidenceIndexes: [0, 1],
          reason: 'x',
        },
      ],
    })
  }
  const signal = new AbortController().signal
  notePersonaObservation(store, scope.persona, 2)
  assert.equal(
    await synthesizePersona(store, scope, generate, signal, NOW),
    undefined,
    'below the pending threshold',
  )
  notePersonaObservation(store, scope.persona, 3)
  const result = await synthesizePersona(store, scope, generate, signal, NOW)
  assert.equal(result?.doc.version, 1)
  assert.equal(
    JSON.parse(input).observations.length,
    2,
    'assistant self-descriptions are not evidence',
  )
  assert.ok(!input.includes(ids[2]))
  assert.equal(loadPersona(store, scope.persona).pending, 0)
  assert.match(engine.stableContext(scope).text, /我是什么样的人：\n- 被质疑时先核对证据再回应/)
  notePersonaObservation(store, scope.persona, 5)
  await assert.rejects(synthesizePersona(store, scope, async () => 'not json', signal, NOW + DAY))
  assert.equal(loadPersona(store, scope.persona).pending, 5, 'a failed run keeps the pending count')
})

test('self consolidation merges by index, adds before retiring, and keeps the weakest evidence kind', async (testContext) => {
  const { store } = setup()
  testContext.after(() => store.close())
  for (let index = 0; index < 22; index++) {
    store.put(
      observation(
        `s${String(index).padStart(2, '0')}`,
        'p1',
        30 - index,
        ({ 1: 'feedback', 2: 'claim' } as const)[index as 1 | 2] || 'behavior',
      ),
    )
  }
  const result = await consolidateSelf(
    store,
    scope,
    async () =>
      JSON.stringify({
        merged: [
          { text: '回应前会先核对', sourceIndexes: [0, '1', null, 99] },
          { text: '自述混进证据', sourceIndexes: [3, 2] },
        ],
      }),
    new AbortController().signal,
  )
  assert.deepEqual([result?.before, result?.after], [22, 21])
  const merged = selfObservations(store, scope).find(
    (candidateMemory) => candidateMemory.text === '回应前会先核对',
  )!
  assert.equal(merged.selfKind, 'feedback')
  assert.equal(store.memory('s00')!.status, 'inactive')
  assert.equal(
    store.memory('s02')!.status,
    'active',
    'a self description never drags an evidenced observation down',
  )
})

test('merging self observations keeps the persona lines they supported in every conversation', async (testContext) => {
  const { store, engine } = setup()
  testContext.after(() => store.close())
  for (let index = 0; index < 22; index++) {
    store.put(
      observation(
        `k${String(index).padStart(2, '0')}`,
        index < 2 ? '工作汇报' : `场景${index}`,
        30 - index,
      ),
    )
  }
  store.setMeta(`persona:doc:${scope.persona}`, {
    ...emptyPersona(),
    sections: {
      self: [
        {
          text: '汇报前会先核对结果',
          evidence: ['k00', 'k01', 'k05'],
          since: new Date(NOW).toISOString(),
        },
      ],
      scenes: [],
      values: [],
    },
  })
  assert.match(engine.stableContext(scope, NOW).text, /汇报前会先核对结果/)
  // Two spellings of one topic no longer block a merge; the persona line follows the merged id.
  store.put({
    ...store.memory('k01')!,
    knowledge: { ...store.memory('k01')!.knowledge, domain: '任务汇报' },
  })
  const result = await consolidateSelf(
    store,
    scope,
    async () => JSON.stringify({ merged: [{ text: '汇报前我会先核对', sourceIndexes: [0, 1] }] }),
    new AbortController().signal,
  )
  assert.equal(result?.merged, 1)
  const mergedId = selfObservations(store, scope).find(
    (candidateMemory) => candidateMemory.text === '汇报前我会先核对',
  )!.id
  assert.deepEqual(loadPersona(store, scope.persona).sections.self[0].evidence, [mergedId, 'k05'])
  assert.match(engine.stableContext(scope, NOW).text, /汇报前会先核对结果/)
})

test('scenes are the conversations evidence came from, not the topic label the model wrote', () => {
  const { store } = setup()
  const fromSession = (id: string, session: string, domain: string, daysAgo: number) => {
    const source = say(store, `反馈 ${id}`, 'user', session, NOW - daysAgo * DAY)
    return { ...observation(id, domain, daysAgo), sources: [source.id] }
  }
  const sameTalkTwoLabels = [
    fromSession('x1', 'chat-1', '工作汇报', 2),
    fromSession('x2', 'chat-1', '任务汇报', 1),
  ]
  const twoTalks = [
    fromSession('y1', 'chat-1', '工作汇报', 2),
    fromSession('y2', 'chat-2', '工作汇报', 1),
  ]
  const scenes = sessionScenes(store)
  const add = (obs: Memory[]) =>
    applyPersonaEdits(
      emptyPersona(),
      [{ op: 'add', section: 'self', text: '汇报前先核对', evidenceIndexes: [0, 1], reason: '' }],
      obs,
      NOW,
      scenes,
    )
  assert.equal(
    add(sameTalkTwoLabels).diff.added.length,
    0,
    'two labels in one conversation are one scene',
  )
  assert.equal(add(twoTalks).diff.added.length, 1, 'two conversations are two scenes')
  store.close()
})

test('the organizer sees every self observation even when the candidate list is crowded', async (testContext) => {
  const { store, engine } = setup()
  testContext.after(() => store.close())
  for (let index = 0; index < 20; index++) {
    store.put({
      ...observation(`self-${index}`, 'p', 40 - index, 'feedback'),
      text: `自我观察 ${index}`,
    })
  }
  for (let index = 0; index < 12; index++) {
    add(engine, {
      kind: 'cognition',
      text: `朋友叫你昵称${index}号`,
      knowledge: { category: 'person' },
      alias: { kind: 'user_nickname', value: `昵称${index}号` },
    })
  }
  for (let index = 0; index < 30; index++) {
    add(engine, {
      kind: 'cognition',
      text: `雾港道具 ${index} 的效果`,
      knowledge: { category: 'fact' },
    })
  }
  const candidates = await engine.candidates(scope, '雾港道具的效果', undefined, { now: NOW })
  assert.equal(candidates.filter((candidateMemory) => candidateMemory.kind === 'self').length, 20)
})

test('organizer: UPDATE keeps omitted fields through the learner, refs map to ids, bad targets degrade safely', async (t) => {
  const { store, engine } = setup()
  const memory = add(engine, {
    kind: 'resonance',
    text: '聊雾港时直接给结论',
    knowledge: { category: 'relationship', domain: '雾港', conditions: '讨论雾港时' },
    tags: ['雾港'],
    importance: 7,
    durability: 'habit',
  })
  const fresh = say(store, '对，雾港相关的直接说结论就行', 'user', 'session-new', NOW)
  let call = 0
  const learner = new Learner(engine, () => async (_system, user) => {
    call++
    const ref = JSON.parse(user).candidates.find(
      (c: { text: string }) => c.text === memory.text,
    ).ref
    if (call === 1) {
      return JSON.stringify({
        operations: [
          {
            action: 'UPDATE',
            target: ref,
            expectedVersion: 1,
            sources: [fresh.id],
            reason: '新证据',
          },
        ],
        state: null,
      })
    }
    const current = JSON.parse(user).events[0].id
    return JSON.stringify({
      operations: [
        {
          action: 'UPDATE',
          target: 'c999',
          kind: 'cognition',
          text: '用户偏好简短结论',
          knowledge: { category: 'preference' },
          durability: 'habit',
          userQuote: '简短结论',
          retention: { basis: 'preference', reason: '稳定偏好' },
          sources: [current],
          reason: '目标抄错',
        },
        { action: 'DELETE', target: 'not-a-memory', sources: [current], reason: '目标抄错' },
      ],
      state: null,
    })
  })
  t.after(async () => {
    await learner.close()
    store.close()
  })
  learner.enqueue({ id: 'j1', scope, sources: [fresh], provider: 'p', model: 'm' })
  while (learner.running) {
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  const updated = store.memory(memory.id)!
  assert.equal(updated.version, 2)
  assert.equal(updated.knowledge.conditions, '讨论雾港时')
  assert.deepEqual(updated.tags, ['雾港'])
  assert.equal(updated.importance, 0.7)
  learner.enqueue({
    id: 'j2',
    scope,
    sources: [say(store, '再说一次：简短结论', 'user', 'session-new', NOW)],
    provider: 'p',
    model: 'm',
  })
  while (learner.running) {
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  assert.equal(store.db.prepare("SELECT status FROM jobs WHERE id='j2'").get()?.status, 'done')
  assert.ok(
    store.memories(scope).some((candidateMemory) => candidateMemory.text === '用户偏好简短结论'),
    'an UPDATE with a bad target is kept as new',
  )
  assert.equal(
    store.memory(memory.id)!.status,
    'active',
    'a DELETE with a bad target deletes nothing',
  )
})

test('self maintenance respects the growth switch', async (testContext) => {
  const { store, engine } = setup()
  const learner = new Learner(engine)
  testContext.after(async () => {
    await learner.close()
    store.close()
  })
  for (let index = 0; index < 22; index++) {
    store.put(observation(`disabled-${index}`, 'same', index))
  }
  notePersonaObservation(store, scope.persona, 5)
  store.saveSettings({ ...store.settings(), growth: false })
  let calls = 0
  await learner.maintain(
    scope,
    [],
    async () => {
      calls++
      return '{}'
    },
    new AbortController().signal,
  )
  assert.equal(calls, 0)
  assert.equal(selfObservations(store, scope).length, 22)
  assert.equal(loadPersona(store, scope.persona).pending, 5)
})

test('self merging preserves situation boundaries and cannot boost evidence', async (testContext) => {
  const { store } = setup()
  testContext.after(() => store.close())
  for (let index = 0; index < 22; index++) {
    const memory = observation(`merge-${index}`, 'a', 30 - index)
    memory.knowledge.conditions = index % 2 ? '在情境 b' : '在情境 a'
    memory.confidence = index === 2 ? 0.2 : 0.8
    memory.selfKind = index === 2 ? 'feedback' : 'verified'
    store.put(memory)
  }
  const signal = new AbortController().signal
  const rejected = await consolidateSelf(
    store,
    scope,
    async () => JSON.stringify({ merged: [{ text: '跨情境误融合', sourceIndexes: [0, 1] }] }),
    signal,
  )
  assert.equal(rejected?.merged, 0)
  const accepted = await consolidateSelf(
    store,
    scope,
    async () =>
      JSON.stringify({
        merged: [{ text: '同一情境的重复观察', sourceIndexes: [0, 2], selfKind: 'verified' }],
      }),
    signal,
  )
  assert.equal(accepted?.merged, 1)
  assert.equal(accepted?.after, 21)
  const result = store.memories().find((memory) => memory.text === '同一情境的重复观察')!
  assert.equal(result.knowledge.domain, 'a')
  assert.equal(result.scope.project, '')
  assert.equal(
    result.selfKind,
    'feedback',
    'the merged observation claims only its weakest evidence',
  )
  assert.equal(result.confidence, 0.2)
})

test('persona revisions require new evidence, including after the removal age threshold', () => {
  const original = observation('original', 'p1', 25)
  const fresh = observation('fresh', 'p1', 0)
  const doc: PersonaDoc = {
    ...emptyPersona(),
    sections: {
      self: [
        { text: '原倾向', evidence: ['original'], since: new Date(NOW - 25 * DAY).toISOString() },
      ],
      scenes: [],
      values: [],
    },
  }
  const update = {
    op: 'update' as const,
    section: 'self' as const,
    targetIndex: 0,
    text: '修正后的倾向',
    evidenceIndexes: [0],
    reason: '',
  }
  assert.equal(applyPersonaEdits(doc, [update], [original], NOW).diff.updated.length, 0)
  assert.equal(applyPersonaEdits(doc, [update], [fresh], NOW).diff.updated.length, 1)
  const remove = {
    op: 'remove' as const,
    section: 'self' as const,
    targetIndex: 0,
    evidenceIndexes: [] as number[],
    reason: '',
  }
  assert.equal(applyPersonaEdits(doc, [remove], [], NOW).diff.removed.length, 0)
  assert.equal(
    applyPersonaEdits(doc, [{ ...remove, evidenceIndexes: [0] }], [fresh], NOW).diff.removed.length,
    1,
  )
})

// One companion, one memory. Standing preferences reach every conversation even when the
// organizer names a topic domain (it almost always does), and they do not fade with disuse.
test('a lasting preference with a topic domain is part of the stable layer in any folder', (testContext) => {
  const { store, engine } = setup()
  testContext.after(() => store.close())
  const memory = add(
    engine,
    {
      kind: 'cognition',
      text: '你希望我以后都用简体中文回复你',
      evidence: 'explicit',
      durability: 'lasting',
      importance: 7,
      knowledge: { category: 'preference', domain: '交流语言' },
      global: false,
    },
    'session-old',
    true,
  )
  assert.equal(
    memory.scope.project,
    '',
    'global:false from the organizer no longer binds a memory to a project',
  )
  for (const project of ['d:/work/site', 'd:/elsewhere', '']) {
    assert.match(engine.stableContext({ ...scope, project }, NOW).text, /以后都用简体中文/)
  }
  age(store, memory, 400)
  assert.match(
    engine.stableContext(scope, NOW).text,
    /以后都用简体中文/,
    'a lasting statement is never forgotten',
  )
})

test('situational or conditional preferences stay in topical recall, not in the stable layer', (testContext) => {
  const { store, engine } = setup()
  testContext.after(() => store.close())
  add(engine, {
    kind: 'cognition',
    text: '写周报时你希望先列结论',
    durability: 'situational',
    knowledge: { category: 'preference', domain: '周报', conditions: '写周报时' },
  })
  assert.doesNotMatch(engine.stableContext(scope, NOW).text, /周报/)
})

test('even milestones are recalled by topic, not carried into every conversation', async (testContext) => {
  const { store, engine } = setup()
  testContext.after(() => store.close())
  const milestone = add(engine, {
    kind: 'experience',
    text: '我们一起完成了第一本鲸鱼绘本，你说这对你很重要',
    importance: 9,
    knowledge: { category: 'event' },
  })
  assert.doesNotMatch(engine.stableContext(scope, NOW).text, /绘本/)
  assert.equal((await engine.recall(scope, '那本鲸鱼绘本')).items[0]?.memory.id, milestone.id)
})

test('experiences need a relationship or milestone reason; work reports are refused', (testContext) => {
  const { store, engine } = setup()
  testContext.after(() => store.close())
  const organize = (said: string, operation: Record<string, unknown>) => {
    const source = say(store, said)
    return engine.apply(
      {
        operations: [
          {
            action: 'ADD',
            kind: 'experience',
            evidence: 'explicit',
            knowledge: { category: 'event' },
            sources: [source.id],
            reason: 'x',
            ...operation,
          },
        ],
      },
      scope,
      [],
      [source.id],
      { strict: true, retentionPolicy: true },
    )[0]
  }
  const shared = organize('我拿到 offer 了，第一个就想告诉你', {
    text: '你拿到 offer 后第一个告诉了我',
    userQuote: '第一个就想告诉你',
    importance: 8,
    retention: { basis: 'relationship', reason: '你愿意先和我分享好消息' },
  })
  assert.ok(shared, 'a relationship-shaping event is kept')
  const report = organize('白屏修好了', {
    text: '修复白屏并验证通过',
    userQuote: '白屏修好了',
    retention: { basis: 'knowledge', reason: '记录工作结果' },
  })
  assert.equal(report, undefined, 'a work report is not an experience')
  assert.equal(store.memories().length, 1)
})
