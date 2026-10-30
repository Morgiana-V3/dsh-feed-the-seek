import { z } from 'zod';
import { sameOwner } from './types.js';
import { localDay } from './time.js';
export const personaSectionTitles = {
    self: '我是什么样的人',
    scenes: '我在不同场合',
    values: '我在意的事',
};
// Thresholds. A "scene" is a project (or everyday chat when no project is set).
export const PERSONA = {
    minScenes: 2, // path 1: the same tendency observed in two different scenes
    minObservations: 3, // path 2: repeated in one scene ...
    minSpanDays: 3, // ... across at least three local days → conditional section only
    // A single user often works in one project; a long, steady pattern there may still describe
    // who she is. Stricter than path 2, so a mood that lasted an evening never qualifies.
    unconditionalSingleSceneObservations: 4,
    unconditionalSingleSceneSpanDays: 7,
    updateEvidenceRatio: 0.5,
    removeMinDays: 14,
    maxLinesPerSection: 8,
    maxLineChars: 60,
    pendingThreshold: 5,
    minIntervalHours: 12,
    maxIntervalDays: 7,
    inputMaxObservations: 40,
};
const EVIDENCE_KINDS = new Set(['behavior', 'feedback', 'verified']);
const DAY = 86_400_000;
export function emptyPersona() {
    return { version: 0, sections: { self: [], scenes: [], values: [] }, updatedAt: new Date(0).toISOString(), pending: 0 };
}
const key = (persona) => `persona:doc:${persona}`;
const historyKey = (persona) => `persona:history:${persona}`;
export function loadPersona(store, persona) {
    return store.getMeta(key(persona), emptyPersona());
}
export function personaHistory(store, persona) {
    return store.getMeta(historyKey(persona), []);
}
/** Only observed behaviour, user feedback and verified change are evidence; promises and self-descriptions are not. */
export function isPersonaEvidence(memory) {
    return memory.kind === 'self' && !!memory.selfKind && EVIDENCE_KINDS.has(memory.selfKind);
}
export const sceneOf = (memory) => memory.scope.project || '日常';
/** Called after each committed observation so the trigger can count without rescanning. */
export function notePersonaObservation(store, persona, count = 1) {
    const doc = loadPersona(store, persona);
    store.setMeta(key(persona), { ...doc, pending: doc.pending + count });
}
export function shouldSynthesize(doc, now = Date.now()) {
    if (doc.pending <= 0)
        return false;
    const last = doc.lastSynthesisAt ? Date.parse(doc.lastSynthesisAt) : undefined;
    if (last !== undefined && now - last < PERSONA.minIntervalHours * 3_600_000)
        return false;
    if (doc.pending >= PERSONA.pendingThreshold)
        return true;
    return last !== undefined && now - last >= PERSONA.maxIntervalDays * DAY;
}
export const PersonaEdit = z.object({
    op: z.enum(['add', 'update', 'remove']),
    section: z.enum(['self', 'scenes', 'values']),
    targetIndex: z.number().int().min(0).optional(),
    text: z.string().trim().max(200).optional(),
    evidenceIndexes: z.array(z.unknown()).max(40).default([]),
    reason: z.string().trim().max(300).default(''),
});
export const PersonaProposal = z.object({ edits: z.array(PersonaEdit).max(12) });
/** Only real numbers or digit strings are indexes; Number(null) would silently become 0. */
export function resolveIndexes(values, length) {
    const out = new Set();
    for (const value of values) {
        const index = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value) : NaN;
        if (Number.isInteger(index) && index >= 0 && index < length)
            out.add(index);
    }
    return [...out];
}
function sceneStats(observations) {
    const byScene = new Map();
    for (const memory of observations)
        byScene.set(sceneOf(memory), [...(byScene.get(sceneOf(memory)) || []), memory]);
    return [...byScene.values()].map((list) => {
        const times = list.map((memory) => Date.parse(memory.createdAt));
        return { count: list.length, days: new Set(times.map(localDay)).size, spanDays: (Math.max(...times) - Math.min(...times)) / DAY };
    });
}
/** Whether the evidence may enter a section; returns the reason when it may not. */
export function admission(section, observations) {
    if (!observations.length)
        return '没有可核对的观察证据';
    const scenes = sceneStats(observations);
    const crossScene = scenes.length >= PERSONA.minScenes;
    const repeated = scenes.some((scene) => scene.count >= PERSONA.minObservations && scene.days >= PERSONA.minSpanDays);
    if (section === 'scenes')
        return crossScene || repeated ? '' : `证据不足：需要 ${PERSONA.minScenes} 个场合，或同一场合 ${PERSONA.minObservations} 次且跨 ${PERSONA.minSpanDays} 天`;
    const steady = scenes.some((scene) => scene.count >= PERSONA.unconditionalSingleSceneObservations && scene.days >= PERSONA.minSpanDays && scene.spanDays >= PERSONA.unconditionalSingleSceneSpanDays);
    return crossScene || steady ? '' : `「${personaSectionTitles[section]}」是无条件描述，需要跨 ${PERSONA.minScenes} 个场合，或同一场合 ${PERSONA.unconditionalSingleSceneObservations} 次且跨 ${PERSONA.unconditionalSingleSceneSpanDays} 天；单一场合的规律请写进「我在不同场合」`;
}
/**
 * Pure: applies proposed edits against numbered observations. Never trusts the model's claim
 * that evidence is sufficient — it counts scenes and days itself.
 */
export function applyPersonaEdits(doc, edits, observations, now = Date.now()) {
    const sections = { self: [...doc.sections.self], scenes: [...doc.sections.scenes], values: [...doc.sections.values] };
    const diff = { added: [], updated: [], removed: [], rejected: [] };
    const removals = [];
    const reject = (edit, reason) => diff.rejected.push({ op: edit.op, text: edit.text || '', reason });
    for (const edit of edits) {
        const evidence = resolveIndexes(edit.evidenceIndexes, observations.length).map((index) => observations[index]);
        const list = sections[edit.section];
        const target = edit.targetIndex === undefined ? undefined : list[edit.targetIndex];
        if (edit.op !== 'remove') {
            const text = (edit.text || '').trim();
            if (!text) {
                reject(edit, '缺少正文');
                continue;
            }
            if ([...text].length > PERSONA.maxLineChars) {
                reject(edit, `超过 ${PERSONA.maxLineChars} 字`);
                continue;
            }
        }
        if (edit.op === 'add') {
            const why = admission(edit.section, evidence);
            if (why) {
                reject(edit, why);
                continue;
            }
            if (list.length >= PERSONA.maxLinesPerSection) {
                reject(edit, '该段条目已满，应改写或合并已有条目');
                continue;
            }
            list.push({ text: edit.text.trim(), evidence: evidence.map((memory) => memory.id), since: new Date(now).toISOString() });
            diff.added.push(edit.text.trim());
        }
        else if (edit.op === 'update') {
            if (!target) {
                reject(edit, '目标条目不存在');
                continue;
            }
            if (target.evidence.length === 0) {
                const why = admission(edit.section, evidence); // a baseline line enters with fresh evidence
                if (why) {
                    reject(edit, why);
                    continue;
                }
            }
            else {
                const needed = Math.max(1, Math.ceil(target.evidence.length * PERSONA.updateEvidenceRatio));
                const freshEvidence = evidence.filter((memory) => !target.evidence.includes(memory.id));
                if (freshEvidence.length < needed) {
                    reject(edit, `改写需要至少 ${needed} 条新证据`);
                    continue;
                }
            }
            list[edit.targetIndex] = { text: edit.text.trim(), evidence: [...new Set([...target.evidence, ...evidence.map((memory) => memory.id)])], since: target.since };
            diff.updated.push({ from: target.text, to: edit.text.trim() });
        }
        else {
            if (!target) {
                reject(edit, '目标条目不存在');
                continue;
            }
            if (!evidence.some((memory) => !target.evidence.includes(memory.id))) {
                reject(edit, '移除需要新的观察证据');
                continue;
            }
            if (target.evidence.length > 0 && now - Date.parse(target.since) < PERSONA.removeMinDays * DAY) {
                reject(edit, `有证据的条目需形成满 ${PERSONA.removeMinDays} 天才能移除`);
                continue;
            }
            removals.push({ section: edit.section, index: edit.targetIndex });
            diff.removed.push(target.text);
        }
    }
    for (const { section, index } of removals.sort((a, b) => b.index - a.index))
        sections[section].splice(index, 1);
    return { doc: { ...doc, sections }, diff };
}
/** Per scene: newest ∪ most important ∪ earliest, so time span is visible; scenes rotate when trimming. */
export function personaInput(store, scope) {
    // Active only: observations merged by consolidation are represented by their merged successor.
    const all = store.memories().filter((memory) => sameOwner(memory.scope, scope) && isPersonaEvidence(memory));
    const byScene = new Map();
    for (const memory of all)
        byScene.set(sceneOf(memory), [...(byScene.get(sceneOf(memory)) || []), memory]);
    const picked = [];
    for (const list of byScene.values()) {
        const newest = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
        const important = [...list].sort((a, b) => b.importance - a.importance).slice(0, 4);
        const earliest = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, 3);
        picked.push([...new Map([...newest, ...important, ...earliest].map((memory) => [memory.id, memory])).values()]);
    }
    const result = [];
    for (let round = 0; result.length < PERSONA.inputMaxObservations && picked.some((list) => list[round]); round++) {
        for (const list of picked)
            if (list[round] && result.length < PERSONA.inputMaxObservations)
                result.push(list[round]);
    }
    return result;
}
export const PERSONA_PROMPT = `你在整理角色“她是谁”的自我认知。输入是当前人格（三段，带序号）与编号的自我观察（只含观察到的行为、用户反馈与已验证的改变）。只输出 JSON：{"edits":[{"op":"add|update|remove","section":"self|scenes|values","targetIndex":0,"text":"一句话，60字以内","evidenceIndexes":[0,3],"reason":"依据"}]}。
self=无条件的性格倾向、能力自评、反应模式；scenes=在什么情况下会怎样（必须写出情境）；values=在意什么、忌讳什么。
只在多条观察共同支持时提出；evidenceIndexes 精确列出支持这句话的观察序号，不要引用不支持的观察。程序会数场合与天数决定能否写入，证据不足的提议会被拒绝。
text 用角色自己的口吻写，“我”指角色，“你”指用户，例如“被质疑时我会先核对证据再回应”“你难过的时候，我会先安静听你说完”；不要写“她”“用户”“助手”。
优先改写已有条目而不是新增近义句；同一倾向只留一条。不要写日期、具体事件或人名；不要从一次情绪推出性格；不要把用户对角色的要求写成角色的性格，除非观察显示角色确实这样做。没有需要的改动时返回 {"edits":[]}，这是最常见的结果。`;
/** Runs one synthesis when due. Model failure leaves the document and pending count untouched. */
export async function synthesizePersona(store, scope, generate, signal, now = Date.now()) {
    const doc = loadPersona(store, scope.persona);
    if (!shouldSynthesize(doc, now))
        return undefined;
    const observations = personaInput(store, scope);
    if (!observations.length)
        return undefined;
    const numbered = (lines) => lines.map((line, index) => ({ index, text: line.text, evidenceCount: line.evidence.length }));
    const input = {
        persona: { self: numbered(doc.sections.self), scenes: numbered(doc.sections.scenes), values: numbered(doc.sections.values) },
        observations: observations.map((memory, index) => ({ index, text: memory.text, kind: memory.selfKind, scene: sceneOf(memory), date: localDay(Date.parse(memory.createdAt)) })),
    };
    const raw = await generate(PERSONA_PROMPT, JSON.stringify(input), signal);
    const proposal = PersonaProposal.parse(JSON.parse(raw.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')));
    const { doc: next, diff } = applyPersonaEdits(doc, proposal.edits, observations, now);
    const changed = diff.added.length + diff.updated.length + diff.removed.length > 0;
    const at = new Date(now).toISOString();
    // Settle pending only after the result is written, so failed runs are retried later.
    const saved = { ...next, version: changed ? doc.version + 1 : doc.version, updatedAt: changed ? at : doc.updatedAt, pending: 0, lastSynthesisAt: at };
    store.transaction(() => {
        store.setMeta(key(scope.persona), saved);
        if (changed || diff.rejected.length) {
            store.setMeta(historyKey(scope.persona), [{ version: saved.version, at, diff }, ...personaHistory(store, scope.persona)].slice(0, 30));
        }
        if (changed)
            store.bump();
    });
    return { doc: saved, diff };
}
/** Deterministic text for the stable layer: no dates, fixed order. */
export function renderPersona(doc, maxChars = 600) {
    const parts = [];
    let used = 0;
    for (const section of ['self', 'scenes', 'values']) {
        const lines = doc.sections[section].map((line) => `- ${line.text}`);
        if (!lines.length)
            continue;
        const block = [`${personaSectionTitles[section]}：`, ...lines].join('\n');
        if (used + block.length > maxChars)
            break;
        parts.push(block);
        used += block.length;
    }
    return parts.join('\n');
}
//# sourceMappingURL=persona.js.map