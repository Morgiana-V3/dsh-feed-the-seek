import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/store.js';
import { Engine } from '../src/engine.js';
import { Learner } from '../src/learning.js';
import { usedItems } from '../src/dsh.js';
import { memoryStrength, normalizeImportance } from '../src/strength.js';
import { applyPersonaEdits, emptyPersona, loadPersona, notePersonaObservation, resolveIndexes, synthesizePersona, type PersonaDoc } from '../src/persona.js';
import { consolidateSelf, selfObservations } from '../src/self-consolidation.js';
import type { Memory, Scope, Source } from '../src/types.js';

// 0.2.15: strength & forgetting, the three injection layers, naming facts, persona synthesis,
// self consolidation and organizer robustness (ported from the earlier bot, adapted to DSH).
const scope: Scope = { user: 'owner', persona: 'yuwen', project: 'd:/work/site' };
const DAY = 86_400_000;
const NOW = Date.parse('2026-10-30T04:00:00Z');
function setup() { const store = new Store(':memory:'); return { store, engine: new Engine(store) }; }
let counter = 0;
function say(store: Store, text: string, role: Source['role'] = 'user', session = 'session-old', at = NOW - 30 * DAY): Source {
  const record: Source = { id: `src-${++counter}`, session, event: `${session}:turn`, role, text, scope, at: new Date(at).toISOString() };
  store.source(record); return record;
}
function add(engine: Engine, op: Record<string, unknown>, session = 'session-old', strict = false): Memory {
  const source = say(engine.store, String(op.quote ?? op.text), 'user', session);
  const { quote: _quote, ...rest } = op;
  return engine.apply({ operations: [{ action: 'ADD', global: true, sources: [source.id], reason: 'x', ...rest }] }, scope, [], [source.id], { strict })[0];
}
function age(store: Store, memory: Memory, days: number) {
  const at = new Date(NOW - days * DAY).toISOString();
  store.put({ ...store.memory(memory.id)!, updatedAt: at, createdAt: at });
  return store.memory(memory.id)!;
}

test('importance accepts 1–10 and older 0–1 values', t => {
  const { store, engine } = setup(); t.after(() => store.close());
  assert.equal(add(engine, { kind: 'cognition', text: '用户喜欢猫', knowledge: { category: 'preference' }, importance: 8 }).importance, 0.8);
  assert.equal(normalizeImportance(0.3), 0.3);
});

test('trivial memories fade from automatic injection; important ones, rules and real use keep them', async t => {
  const { store, engine } = setup(); t.after(() => store.close());
  const trivial = age(store, add(engine, { kind: 'experience', text: '某次白屏问题顺手修好了', knowledge: { category: 'event' }, importance: 4 }), 90);
  const milestone = age(store, add(engine, { kind: 'experience', text: '第一次见面时用户给她起名，白屏问题那天', knowledge: { category: 'event' }, importance: 9 }), 365);
  const rule = age(store, add(engine, { kind: 'cognition', text: '雾港1.0回声戒指让普通技能再触发', knowledge: { category: 'rule', domain: '雾港' }, importance: 3 }), 365);
  const auto = await engine.recall(scope, '白屏问题', undefined, { now: NOW });
  assert.ok(!auto.items.some(i => i.memory.id === trivial.id), 'a 90-day-old trivial experience is out of automatic injection');
  assert.ok(auto.items.some(i => i.memory.id === milestone.id), 'importance 9 never fades below the line');
  assert.ok((await engine.recall(scope, '白屏问题', undefined, { deliberate: true, now: NOW })).items.some(i => i.memory.id === trivial.id), 'a deliberate recall still finds it');
  assert.equal(memoryStrength(rule, [], NOW), memoryStrength(rule, [], NOW - 300 * DAY), 'objective rules do not fade');
  store.use([trivial], 'turn-recalled');
  assert.ok(memoryStrength(store.memory(trivial.id)!, store.uses(trivial.id)) > 0.15, 'a real use brings it back');
});

test('the stable layer is deterministic, dateless and never reinforces by being shown', async t => {
  const { store, engine } = setup(); t.after(() => store.close());
  for (const [text, importance] of [['用户是前端开发工程师', 6], ['用户养了只叫年糕的橘猫', 5], ['用户周末喜欢打雾港', 4]] as const) add(engine, { kind: 'cognition', text, knowledge: { category: 'person' }, importance });
  add(engine, { kind: 'resonance', text: '用户难过时希望先被听完', knowledge: { category: 'relationship' }, importance: 9 });
  const first = engine.stableContext(scope, NOW);
  assert.equal(engine.stableContext(scope, NOW + 3 * DAY).text, first.text);
  assert.doesNotMatch(first.text, /\d{4}-\d{2}-\d{2}|天前/);
  assert.ok(first.text.indexOf('前端') < first.text.indexOf('年糕'), 'ordered by importance');
  for (let turn = 0; turn < 30; turn++) {
    const snapshot = await engine.recall(scope, '嗯', undefined, { excludeIds: first.ids, now: NOW });
    store.use(usedItems(snapshot), `turn-${turn}`);
    engine.stableContext(scope, NOW);
  }
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM recall_uses').get()?.n, 0);
  assert.equal((await engine.recall(scope, '前端工程', undefined, { excludeIds: first.ids, now: NOW })).items.length, 0, 'turn layer never repeats the stable layer');
});

test('memories learned in this session are not re-injected into it', async t => {
  const { store, engine } = setup(); t.after(() => store.close());
  const memory = add(engine, { kind: 'experience', text: '刚才一起排查了构建失败', knowledge: { category: 'event' } }, 'session-now');
  assert.equal((await engine.recall(scope, '构建失败', undefined, { excludeSessions: new Set(['session-now']) })).items.length, 0);
  assert.equal((await engine.recall(scope, '构建失败', undefined, { excludeSessions: new Set(['session-other']) })).items[0].memory.id, memory.id);
});

test('recent self changes appear regardless of topic', async t => {
  const { store, engine } = setup(); t.after(() => store.close());
  add(engine, { kind: 'self', text: '最近说话更直接了', knowledge: { category: 'tendency' } });
  assert.match((await engine.recall(scope, '帮我看下这个正则')).context, /最近的变化：[\s\S]*说话更直接/);
});

test('naming: a new preferred address replaces the old, nicknames stay, names are never invented', t => {
  const { store, engine } = setup(); t.after(() => store.close());
  add(engine, { kind: 'cognition', text: '用户希望被称为“测试用户甲”', quote: '以后叫我测试用户甲', knowledge: { category: 'person' }, alias: { kind: 'user_preferred', value: '测试用户甲' } }, 's1', true);
  add(engine, { kind: 'cognition', text: '用户希望被称为“小林”', quote: '以后叫我小林', knowledge: { category: 'person' }, alias: { kind: 'user_preferred', value: '小林' } }, 's1', true);
  add(engine, { kind: 'cognition', text: '朋友叫用户“小米”', quote: '朋友都叫我小米', knowledge: { category: 'person' }, alias: { kind: 'user_nickname', value: '小米' } }, 's1', true);
  add(engine, { kind: 'cognition', text: '用户正式姓名是林小明', quote: '道歉的时候用我大名', knowledge: { category: 'person' }, alias: { kind: 'user_preferred', value: '林小明' } }, 's1', true);
  const preferred = store.memories(scope).filter(m => m.alias?.kind === 'user_preferred');
  assert.deepEqual(preferred.map(m => m.alias!.value), ['小林']);
  assert.ok(store.memories(scope).some(m => m.text.includes('林小明') && !m.alias), 'an invented name is not stored as a naming fact');
  assert.match(engine.stableContext(scope).text, /我叫你：小林；你也被叫作：小米/);
});

function observation(id: string, project: string, daysAgo: number, selfKind: Memory['selfKind'] = 'behavior'): Memory {
  const at = new Date(NOW - daysAgo * DAY).toISOString();
  return { id, kind: 'self', text: id, tags: [], scope: { ...scope, project }, evidence: 'inferred', importance: 0.5, status: 'active', version: 1, sources: [], createdAt: at, updatedAt: at, knowledge: { category: 'tendency', domain: '', edition: '', conditions: '' }, confidence: 0.5, selfKind };
}

test('persona edits are admitted by counted evidence, not by the model\'s word', () => {
  const twoScenes = [observation('a', 'p1', 9), observation('b', 'p2', 8)];
  const oneSceneThreeDays = [observation('c', 'p1', 9), observation('d', 'p1', 7), observation('e', 'p1', 5)];
  const add = (section: 'self' | 'scenes', evidenceIndexes: unknown[], obs: Memory[]) => applyPersonaEdits(emptyPersona(), [{ op: 'add', section, text: '被质疑时先核对证据', evidenceIndexes, reason: '' }], obs, NOW);
  assert.equal(add('self', [0, 1], twoScenes).diff.added.length, 1, 'two scenes may describe who she is');
  assert.equal(add('self', [0, 1, 2], oneSceneThreeDays).diff.added.length, 0, 'one scene over three days is conditional only');
  assert.equal(add('scenes', [0, 1, 2], oneSceneThreeDays).diff.added.length, 1);
  assert.equal(add('scenes', [0], oneSceneThreeDays).diff.added.length, 0);
  assert.deepEqual(resolveIndexes([null, '1', 'x', 99, 0, 1.5], 3), [1, 0], 'null never becomes index 0');
  const doc: PersonaDoc = { ...emptyPersona(), sections: { self: [{ text: '说话直接', evidence: ['a', 'b', 'c', 'd'], since: new Date(NOW - 3 * DAY).toISOString() }], scenes: [], values: [] } };
  assert.equal(applyPersonaEdits(doc, [{ op: 'update', section: 'self', targetIndex: 0, text: '说话直接但会顾及情绪', evidenceIndexes: [0], reason: '' }], twoScenes, NOW).diff.rejected.length, 1, 'rewriting needs half as much new evidence');
  assert.equal(applyPersonaEdits(doc, [{ op: 'remove', section: 'self', targetIndex: 0, evidenceIndexes: [], reason: '' }], [], NOW).diff.removed.length, 0, 'a fresh evidenced line cannot be removed');
});

test('persona synthesis runs only when due, counts only real evidence and keeps a version', async t => {
  const { store, engine } = setup(); t.after(() => store.close());
  const ids = [['p1', 9, 'behavior'], ['p2', 8, 'feedback'], ['p1', 7, 'claim']].map(([project, days, kind], index) => {
    const memory = observation(`obs-${index}`, project as string, days as number, kind as Memory['selfKind']); store.put(memory); return memory.id;
  });
  let input = '';
  const generate = async (_system: string, user: string) => { input = user; return JSON.stringify({ edits: [{ op: 'add', section: 'self', text: '被质疑时先核对证据再回应', evidenceIndexes: [0, 1], reason: 'x' }] }); };
  const signal = new AbortController().signal;
  notePersonaObservation(store, scope.persona, 2);
  assert.equal(await synthesizePersona(store, scope, generate, signal, NOW), undefined, 'below the pending threshold');
  notePersonaObservation(store, scope.persona, 3);
  const result = await synthesizePersona(store, scope, generate, signal, NOW);
  assert.equal(result?.doc.version, 1);
  assert.equal(JSON.parse(input).observations.length, 2, 'assistant self-descriptions are not evidence');
  assert.ok(!input.includes(ids[2]));
  assert.equal(loadPersona(store, scope.persona).pending, 0);
  assert.match(engine.stableContext(scope).text, /我是什么样的人：\n- 被质疑时先核对证据再回应/);
  notePersonaObservation(store, scope.persona, 5);
  await assert.rejects(synthesizePersona(store, scope, async () => 'not json', signal, NOW + DAY));
  assert.equal(loadPersona(store, scope.persona).pending, 5, 'a failed run keeps the pending count');
});

test('self consolidation merges by index, adds before retiring, and keeps the weakest evidence kind', async t => {
  const { store } = setup(); t.after(() => store.close());
  for (let index = 0; index < 22; index++) store.put(observation(`s${String(index).padStart(2, '0')}`, 'p1', 30 - index, index === 1 ? 'claim' : 'behavior'));
  const result = await consolidateSelf(store, scope, async () => JSON.stringify({ merged: [{ text: '回应前会先核对', sourceIndexes: [0, '1', null, 99] }] }), new AbortController().signal);
  assert.deepEqual([result?.before, result?.after], [22, 21]);
  const merged = selfObservations(store, scope).find(m => m.text === '回应前会先核对')!;
  assert.equal(merged.selfKind, 'claim');
  assert.equal(store.memory('s00')!.status, 'inactive');
});

test('organizer: UPDATE keeps omitted fields through the learner, refs map to ids, bad targets degrade safely', async t => {
  const { store, engine } = setup();
  const memory = add(engine, { kind: 'resonance', text: '聊雾港时直接给结论', knowledge: { category: 'relationship', domain: '雾港', conditions: '讨论雾港时' }, tags: ['雾港'], importance: 7, durability: 'habit' });
  const fresh = say(store, '对，雾港相关的直接说结论就行', 'user', 'session-new', NOW);
  let call = 0;
  const learner = new Learner(engine, () => async (_system, user) => {
    call++;
    const ref = JSON.parse(user).candidates.find((c: { text: string }) => c.text === memory.text).ref;
    if (call === 1) return JSON.stringify({ operations: [{ action: 'UPDATE', target: ref, expectedVersion: 1, sources: [fresh.id], reason: '新证据' }], state: null });
    const current = JSON.parse(user).events[0].id;
    return JSON.stringify({ operations: [
      { action: 'UPDATE', target: 'c999', kind: 'cognition', text: '用户偏好简短结论', knowledge: { category: 'preference' }, durability: 'habit', sources: [current], reason: '目标抄错' },
      { action: 'DELETE', target: 'not-a-memory', sources: [current], reason: '目标抄错' },
    ], state: null });
  });
  t.after(async () => { await learner.close(); store.close(); });
  learner.enqueue({ id: 'j1', scope, sources: [fresh], provider: 'p', model: 'm' });
  while (learner.running) await new Promise(r => setTimeout(r, 5));
  const updated = store.memory(memory.id)!;
  assert.equal(updated.version, 2);
  assert.equal(updated.knowledge.conditions, '讨论雾港时');
  assert.deepEqual(updated.tags, ['雾港']);
  assert.equal(updated.importance, 0.7);
  learner.enqueue({ id: 'j2', scope, sources: [say(store, '再说一次：简短结论', 'user', 'session-new', NOW)], provider: 'p', model: 'm' });
  while (learner.running) await new Promise(r => setTimeout(r, 5));
  assert.equal(store.db.prepare("SELECT status FROM jobs WHERE id='j2'").get()?.status, 'done');
  assert.ok(store.memories(scope).some(m => m.text === '用户偏好简短结论'), 'an UPDATE with a bad target is kept as new');
  assert.equal(store.memory(memory.id)!.status, 'active', 'a DELETE with a bad target deletes nothing');
});


test('self maintenance respects the growth switch', async t => {
  const { store, engine } = setup();
  const learner = new Learner(engine);
  t.after(async () => { await learner.close(); store.close(); });
  for (let index = 0; index < 22; index++) store.put(observation(`disabled-${index}`, 'same', index));
  notePersonaObservation(store, scope.persona, 5);
  store.saveSettings({ ...store.settings(), growth: false });
  let calls = 0;
  await learner.maintain(scope, [], async () => { calls++; return '{}'; }, new AbortController().signal);
  assert.equal(calls, 0);
  assert.equal(selfObservations(store, scope).length, 22);
  assert.equal(loadPersona(store, scope.persona).pending, 5);
});

test('self merging preserves project and condition boundaries and cannot boost evidence', async t => {
  const { store } = setup();
  t.after(() => store.close());
  for (let index = 0; index < 22; index++) {
    const memory = observation(`merge-${index}`, index % 2 ? 'b' : 'a', 30 - index);
    memory.confidence = index === 2 ? 0.2 : 0.8;
    memory.selfKind = index === 2 ? 'claim' : 'verified';
    store.put(memory);
  }
  const signal = new AbortController().signal;
  const rejected = await consolidateSelf(store, scope, async () => JSON.stringify({ merged: [{ text: '跨项目误融合', sourceIndexes: [0, 1] }] }), signal);
  assert.equal(rejected?.merged, 0);
  const accepted = await consolidateSelf(store, scope, async () => JSON.stringify({ merged: [{ text: '同一项目的重复观察', sourceIndexes: [0, 2], selfKind: 'verified' }] }), signal);
  assert.equal(accepted?.merged, 1);
  assert.equal(accepted?.after, 21);
  const result = store.memories().find(memory => memory.text === '同一项目的重复观察')!;
  assert.equal(result.scope.project, 'a');
  assert.equal(result.selfKind, 'claim');
  assert.equal(result.confidence, 0.2);
});

test('persona revisions require new evidence, including after the removal age threshold', () => {
  const original = observation('original', 'p1', 25);
  const fresh = observation('fresh', 'p1', 0);
  const doc: PersonaDoc = { ...emptyPersona(), sections: { self: [{ text: '原倾向', evidence: ['original'], since: new Date(NOW - 25 * DAY).toISOString() }], scenes: [], values: [] } };
  const update = { op: 'update' as const, section: 'self' as const, targetIndex: 0, text: '修正后的倾向', evidenceIndexes: [0], reason: '' };
  assert.equal(applyPersonaEdits(doc, [update], [original], NOW).diff.updated.length, 0);
  assert.equal(applyPersonaEdits(doc, [update], [fresh], NOW).diff.updated.length, 1);
  const remove = { op: 'remove' as const, section: 'self' as const, targetIndex: 0, evidenceIndexes: [] as number[], reason: '' };
  assert.equal(applyPersonaEdits(doc, [remove], [], NOW).diff.removed.length, 0);
  assert.equal(applyPersonaEdits(doc, [{ ...remove, evidenceIndexes: [0] }], [fresh], NOW).diff.removed.length, 1);
});
