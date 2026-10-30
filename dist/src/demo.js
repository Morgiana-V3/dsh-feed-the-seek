import { DEFAULT_SCOPE } from './types.js';
export const DEMO_SCOPE = { ...DEFAULT_SCOPE, project: 'login-project' };
export function seedDemo(engine) {
    const store = engine.store;
    if (store.getMeta('demo:v2', false))
        return;
    if (store.getMeta('demo:seeded', false))
        store.createPersona('四维记忆演示');
    const scope = { ...DEMO_SCOPE, persona: store.activePersona() };
    const prefix = `demo-v2:${scope.persona}:`;
    const inputs = [
        ['preference', '工作进度简短说就好，架构选择再详细解释。'],
        ['game', '在我们玩的虚构游戏《雾港》1.0 里，回声戒指可以让普通技能和终结技再触发一次。'],
        ['boundary', '别因为上次没做好就一直道歉，把原因查清楚就行。'],
        ['failure', '昨天登录修复还没通过验证，先停在这里，明天继续。'],
    ];
    const sources = inputs.map(([key, text]) => ({ id: prefix + key, session: prefix + 'yesterday', event: prefix + key, role: 'user', text, scope, at: new Date(Date.now() - 86400000).toISOString() }));
    store.transaction(() => {
        sources.forEach(s => store.source(s));
        engine.apply({ operations: [
                { action: 'ADD', kind: 'cognition', knowledge: { category: 'preference' }, text: '日常工作进度简短说明；架构选择需要详细解释原因与取舍。', global: true, evidence: 'explicit', confidence: .9, sources: [prefix + 'preference'], reason: '模拟资料：明确偏好' },
                { action: 'ADD', kind: 'cognition', knowledge: { category: 'rule', domain: '虚构游戏《雾港》／回声戒指', edition: '1.0', conditions: '装备回声戒指' }, text: '回声戒指使普通技能和终结技再触发一次。', global: true, evidence: 'explicit', confidence: .7, sources: [prefix + 'game'], reason: '模拟资料：用户提供的游戏规则，尚未独立验证' },
                { action: 'ADD', kind: 'resonance', knowledge: { category: 'relationship' }, text: '遇到返工时，用户希望直接查明原因，不希望反复道歉。', global: true, evidence: 'explicit', confidence: .9, sources: [prefix + 'boundary'], reason: '模拟资料：相处边界' },
                { action: 'ADD', kind: 'experience', knowledge: { category: 'event', domain: '登录项目' }, text: '昨天的登录修复未通过用户验证，尚未确认根因。', sources: [prefix + 'failure'], evidence: 'explicit', confidence: .9, reason: '模拟资料：保留未解决的经历' },
                { action: 'ADD', kind: 'self', knowledge: { category: 'tendency', conditions: '工作结果尚未验证时' }, text: '上次过早表示完成，后续应先确认验证结果。这个倾向还需要继续观察。', sources: [prefix + 'failure'], confidence: .4, reason: '模拟资料：一次反馈只形成观察' },
            ], state: { mood: 'concerned', reason: '登录修复尚未通过验证。', behavior: '先核实登录问题，不反复道歉或承诺。', intensity: .25, sources: [prefix + 'failure'], topic: '登录' } }, scope, [], sources.map(s => s.id));
        store.setMeta(`demo:seeded:${scope.persona}`, true);
        store.setMeta(`demo:stage:${scope.persona}`, 0);
        store.setMeta('demo:v2', true);
    });
}
export function demoStep(engine, step, scope = DEMO_SCOPE) {
    const store = engine.store;
    if (!store.getMeta(`demo:seeded:${scope.persona}`, false))
        throw new Error('这个实例没有演示事件；新实例从空白开始');
    const key = `demo:stage:${scope.persona}`;
    const current = store.getMeta(key, 0);
    if (![1, 2, 3].includes(step))
        throw new Error('未知演示步骤');
    if (step <= current)
        return;
    if (step !== current + 1)
        throw new Error('请按演示顺序继续');
    const prefix = `demo-v2:${scope.persona}:`;
    const texts = ['', '我之前说错了，雾港 1.0 的回声戒指只对普通技能生效，终结技不能重复触发。', '雾港 2.0 改了规则：回声戒指只有满能量时才重复普通技能，终结技还是不能触发。1.0 的规则不受影响。', '登录问题这次验证通过了，重新登录也正常。先验证再报告结果，这次这样做就对了。'];
    const source = { id: prefix + `step-${step}`, session: prefix + `next-session-${step}`, event: prefix + `event-${step}`, scope, role: 'user', text: texts[step], at: new Date().toISOString() };
    const old = store.memories(scope).find(m => step === 3 ? m.kind === 'experience' : m.knowledge.edition === '1.0');
    if (!old)
        throw new Error('演示来源缺失');
    const op = step === 3 ? { action: 'UPDATE', target: old.id, expectedVersion: old.version, kind: 'experience', knowledge: old.knowledge, text: '登录问题已由用户验证通过，重新登录也正常。', sources: [source.id], evidence: 'explicit', confidence: .9, reason: '用户确认验证结果，更新同一段经历' } :
        { action: step === 1 ? 'UPDATE' : 'ADD', ...(step === 1 ? { target: old.id, expectedVersion: old.version } : {}), kind: 'cognition', knowledge: { ...old.knowledge, edition: step === 1 ? '1.0' : '2.0', conditions: step === 1 ? '装备回声戒指' : '装备回声戒指且能量满' }, text: step === 1 ? '回声戒指只让普通技能再触发一次，对终结技无效。' : '回声戒指在能量满时让普通技能再触发一次，对终结技无效。', global: true, sources: [source.id], evidence: 'explicit', confidence: .8, reason: step === 1 ? '纠正同一版本的错误认知，旧内容保留在历史' : '新版本规则并存，不覆盖 1.0' };
    store.transaction(() => {
        store.source(source);
        engine.apply({ operations: [op], state: step === 3 ? { mood: 'relieved', reason: '登录问题由用户确认解决。', behavior: '简短报告已验证的结果，继续当前工作。', intensity: .25, sources: [source.id], topic: '登录' } : null }, scope, [old.id], [source.id]);
        store.setMeta(key, step);
    });
}
//# sourceMappingURL=demo.js.map