import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/store.js';
import { Engine } from '../src/engine.js';
import { createDashboard } from '../src/server.js';
import { moodAsset, moodLabels, pickDisplayedMood, MIN_DWELL_MS } from '../src/mood.js';
import type { Mood, Scope, Source, State, StateInput } from '../src/types.js';

// Acceptance cases from the memory/emotion rework brief (section 7), emotion layer.
const scope: Scope = { user: 'owner', persona: 'yuwen', project: 'd:/work/site' };
const HOUR = 3600_000;
const T0 = Date.parse('2026-10-20T04:00:00Z');
function setup() { const store = new Store(':memory:'); return { store, engine: new Engine(store) }; }
function say(store: Store, id: string, text = '事件 ' + id, role: Source['role'] = 'user', at = T0): Source {
  const record: Source = { id, session: 'session-a', event: 'session-a:turn', role, text, scope, at: new Date(at).toISOString() };
  store.source(record); return record;
}
function experience(store: Store, engine: Engine, text = '项目目录为空，终端返回 0xC0000142') {
  say(store, 'exp');
  return engine.apply({ operations: [{ action: 'ADD', kind: 'experience', knowledge: { category: 'event' }, text, sources: ['exp'], reason: 'x' }] }, scope, [], ['exp'])[0];
}
const feeling = (mood: Mood, intensity: number, sources: string[], extra: Partial<StateInput> = {}): StateInput =>
  ({ mood, intensity, sources, reason: '工具故障导致无法开工', behavior: '先排查环境', topic: '工具故障', ...extra });

test('retelling the same incident neither extends nor strengthens the feeling', t => {
  const { store, engine } = setup(); t.after(() => store.close());
  const event = experience(store, engine);
  store.setState(scope, feeling('discouraged', 0.3, ['s1'], { target: event.id }), T0);
  store.setState(scope, feeling('discouraged', 0.3, ['s2'], { target: event.id, topic: '终端报错 0xC0000142' }), T0 + 12 * HOUR);
  const [state] = store.activeStates(scope, T0 + 12 * HOUR);
  assert.equal(store.activeStates(scope, T0 + 12 * HOUR).length, 1, 'a reworded topic must not create a second state');
  assert.equal(state.updatedAt, new Date(T0).toISOString());
  assert.deepEqual(state.sources, ['s1', 's2']);

  // A stronger recurrence ("failed again") does take effect.
  store.setState(scope, feeling('discouraged', 0.5, ['s3'], { target: event.id }), T0 + 13 * HOUR);
  assert.equal(store.activeStates(scope, T0 + 13 * HOUR)[0].intensity, 0.5);
  assert.equal(store.activeStates(scope, T0 + 13 * HOUR)[0].onsetAt, new Date(T0).toISOString());
});

test('recovery replaces the negative state at once, even within the display dwell', t => {
  const { store, engine } = setup(); t.after(() => store.close());
  const event = experience(store, engine);
  store.setState(scope, feeling('discouraged', 0.4, ['s1'], { target: event.id }), T0);
  let shown = pickDisplayedMood(store.activeStates(scope, T0, true), undefined, T0);
  assert.equal(shown.displayed.mood, 'discouraged');
  store.setState(scope, feeling('relieved', 0.25, ['s2'], { target: event.id, reason: '工具恢复，任务完成' }), T0 + 60_000);
  shown = pickDisplayedMood(store.activeStates(scope, T0 + 60_000, true), shown.displayed, T0 + 60_000);
  assert.equal(shown.displayed.mood, 'relieved');
  assert.equal(store.activeStates(scope, T0 + 60_000).length, 1);
});

test('invalidating the event ends the feeling about it', t => {
  const { store, engine } = setup(); t.after(() => store.close());
  const event = experience(store, engine);
  store.setState(scope, feeling('concerned', 0.4, ['s1'], { target: event.id }), Date.now());
  say(store, 'fix', '目录问题是我看错路径了，不是故障');
  engine.apply({ operations: [{ action: 'DELETE', target: event.id, expectedVersion: 1, sources: ['fix'], reason: '误报' }] }, scope, [event.id], ['exp', 'fix']);
  assert.equal(store.activeStates(scope).length, 0);
});

test('a state can target a memory created in the same batch', t => {
  const { store, engine } = setup(); t.after(() => store.close());
  say(store, 'e1', '构建又挂了');
  engine.apply({ operations: [{ action: 'ADD', kind: 'experience', knowledge: { category: 'event' }, text: '构建失败', sources: ['e1'], reason: 'x' }],
    state: feeling('discouraged', 0.3, ['e1'], { target: 'op:0' }) }, scope, [], ['e1']);
  const memory = store.memories(scope)[0];
  assert.equal(store.activeStates(scope)[0].target, memory.id);
  // An unknown target does not attach the state to anything.
  say(store, 'e2', '另一件事');
  engine.apply({ operations: [], state: feeling('concerned', 0.3, ['e2'], { target: 'not-a-memory', topic: '另一件事' }) }, scope, [], ['e2']);
  assert.equal(store.activeStates(scope).find(state => state.topic === '另一件事')!.target, undefined);
});

test('another project keeps its own setbacks; the background mood travels', async t => {
  const { store, engine } = setup(); t.after(() => store.close());
  say(store, 'a'); say(store, 'b');
  store.setState(scope, feeling('discouraged', 0.4, ['a']));
  store.setState(scope, feeling('happy', 0.3, ['b'], { layer: 'relationship', topic: '被夸了', reason: '用户夸了这次的配合', behavior: '轻松一点' }));
  const here = await engine.recall(scope, '随便聊点别的');
  assert.deepEqual(here.states.map(state => state.mood).sort(), ['discouraged', 'happy']);
  const elsewhere = await engine.recall({ ...scope, project: 'd:/work/other' }, '随便聊点别的');
  assert.deepEqual(elsewhere.states.map(state => state.mood), ['happy']);
  assert.match(here.context, /明显沮丧 \/ 本项目/);
  assert.match(here.context, /开心 \/ 相处中/);
});

test('the shown mood resists flicker but yields to a clearly stronger cause or after the dwell', () => {
  const state = (id: string, mood: Mood, effectiveIntensity: number): State =>
    ({ id, mood, effectiveIntensity, intensity: effectiveIntensity, reason: '', behavior: '', topic: id, sources: ['x'], scope, updatedAt: new Date(T0).toISOString() });
  const first = pickDisplayedMood([state('a', 'concerned', 0.3)], undefined, T0).displayed;
  assert.equal(pickDisplayedMood([state('b', 'happy', 0.35), state('a', 'concerned', 0.3)], first, T0 + 60_000).displayed.mood, 'concerned');
  assert.equal(pickDisplayedMood([state('b', 'annoyed', 0.6), state('a', 'concerned', 0.3)], first, T0 + 60_000).displayed.mood, 'annoyed');
  assert.equal(pickDisplayedMood([state('b', 'happy', 0.35), state('a', 'concerned', 0.3)], first, T0 + MIN_DWELL_MS + 1).displayed.mood, 'happy');
  // A faint leftover reads as calm.
  assert.equal(pickDisplayedMood([state('a', 'discouraged', 0.07)], undefined, T0).displayed.mood, 'calm');
});

test('turning emotion off hides any feeling still in effect', async t => {
  const { store, engine } = setup();
  const app = createDashboard(engine, { demo: false, port: 0 });
  await app.listen();
  t.after(async () => { await new Promise<void>(resolve => app.server.close(() => resolve())); store.close(); });
  say(store, 's1');
  store.setState({ ...scope, project: '' }, feeling('discouraged', 0.5, ['s1'], { layer: 'relationship' }));
  const address = app.server.address() as { port: number };
  const read = async () => (await fetch(`http://127.0.0.1:${address.port}/api/state`)).json() as Promise<{ mood: { mood: string } | null; states: unknown[] }>;
  assert.equal((await read()).mood?.mood, 'discouraged');
  store.saveSettings({ ...store.settings(), emotion: false });
  const hidden = await read();
  assert.equal(hidden.mood, null);
  assert.equal(hidden.states.length, 0);
  assert.equal((await engine.recall({ ...scope, project: '' }, '随便')).states.length, 0);
});

test('every mood has a label and one of the four first-batch animation sets', () => {
  const moods: Mood[] = ['calm', 'happy', 'hopeful', 'concerned', 'discouraged', 'annoyed', 'shy', 'relieved', 'steady'];
  for (const mood of moods) {
    assert.ok(moodLabels[mood]);
    assert.ok(['calm', 'happy', 'discouraged', 'annoyed'].includes(moodAsset(mood)));
  }
  assert.equal(moodLabels.steady, '平静');
  assert.equal(moodAsset(undefined), 'calm');
});
