import { randomUUID } from 'node:crypto';
import { Proposal, visible, sameOwner } from './types.js';
import { makeEmbedder, validateVector } from './embedding.js';
import { associateMemories } from './associations.js';
import { moodLabels, statesForContext, strengthLabel } from './mood.js';
import { FORGET_THRESHOLD, isForgotten, memoryStrength, normalizeImportance } from './strength.js';
import { loadPersona, renderPersona } from './persona.js';
import { resolveEmbeddingKey } from './embedding-credentials.js';
export function terms(text) {
    const set = new Set();
    for (const word of text.toLowerCase().match(/[a-z0-9_./-]+|[\p{Script=Han}]+/gu) || []) {
        if (/\p{Script=Han}/u.test(word)) {
            for (let i = 0; i < word.length - 1; i++)
                set.add(word.slice(i, i + 2));
        }
        else if (word.length > 1)
            set.add(word);
    }
    return set;
}
import { localDay } from './time.js';
/**
 * Memories are written in the companion's own voice. In a system prompt "你" usually means the
 * model, so every injected block states who is who before using either pronoun.
 */
export const VOICE_NOTE = '（以下用我的口吻记录：“我”指我自己，也就是正在回答的助手；“你”指正在和我对话的用户。）';
/** Placeholder names that are not really her name. */
const DEFAULT_PERSONA_NAMES = new Set(['初始实例', '初始伙伴']);
export { localDay };
const selfKindLabels = { behavior: '观察到的行为', feedback: '用户反馈', intention: '调整意图', claim: '助手自述', verified: '已验证的改变' };
const MAX_MEMORY_CHARS = 160;
const characters = (value) => [...value].length;
/** Compare without whitespace or punctuation so full/half-width differences do not matter. */
function normalizeQuote(value) { return value.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, ''); }
export function quoteSupported(quote, sources) {
    const needle = normalizeQuote(quote || '');
    return characters(needle) >= 2 && sources.some(source => source.role === 'user' && normalizeQuote(source.text).includes(needle));
}
/** Returns why an organizer operation must not be stored, or '' when it may proceed. */
export function strictRejection(action, text, oldText, durability, durabilitySent, conditions) {
    if (durability === 'turn' && durabilitySent)
        return '当次要求不写入长期记忆';
    if (durability === 'situational' && !conditions.trim())
        return '情境性内容需要写明适用条件';
    const length = characters(text);
    if (action === 'ADD' && length > MAX_MEMORY_CHARS)
        return `正文 ${length} 字，超过 ${MAX_MEMORY_CHARS} 字上限，应拆分或精简`;
    if (action === 'UPDATE' && oldText !== undefined && text !== oldText) {
        const previous = characters(oldText);
        if (length > MAX_MEMORY_CHARS && length > previous)
            return `更新后正文 ${length} 字且继续变长，应保留结论而非追加对话摘要`;
        if (length > 80 && length > previous * 1.5)
            return `更新后正文从 ${previous} 字增至 ${length} 字，应替换为精简结论而非追加`;
    }
    return '';
}
/** One compact line: kind and basis, then the text, then only the conditions that are set. */
export function describeMemory(m) {
    const basis = m.kind === 'self' && m.selfKind ? selfKindLabels[m.selfKind] + (m.selfKind === 'claim' || m.selfKind === 'intention' ? '，未经行为验证' : '')
        : m.evidence === 'explicit' ? '用户陈述' : '推测';
    const tags = [names[m.kind], basis, ...(m.durability === 'situational' ? ['仅限所述情境'] : [])].join('·');
    const scope = [m.knowledge.domain && `领域：${m.knowledge.domain}`, m.knowledge.edition && `版本：${m.knowledge.edition}`, m.knowledge.conditions && `条件：${m.knowledge.conditions}`].filter(Boolean);
    const when = m.kind === 'experience' ? `（${m.updatedAt.slice(0, 10)}）` : '';
    return `[${tags}] ${m.text}${scope.length ? `（${scope.join('；')}）` : ''}${when}`;
}
const names = { cognition: '认知', experience: '经历', resonance: '共鸣', self: '自我观察' };
export class Engine {
    store;
    embeddingOverride;
    credentials;
    constructor(store, embeddingOverride, credentials) {
        this.store = store;
        this.embeddingOverride = embeddingOverride;
        this.credentials = credentials;
    }
    embedder() {
        const settings = this.store.settings();
        if (settings.retrievalMode === 'local') {
            return undefined;
        }
        return this.embeddingOverride || makeEmbedder(settings, () => resolveEmbeddingKey(settings, this.credentials));
    }
    /**
     * strict: the proposal came from the organizer model. Then claims are checked against
     * their sources (user quote, durability, self-evidence, length) before they are stored.
     * Demo data and direct calls keep the older, lenient contract.
     */
    apply(raw, scope, allowedIds, allowedSources, options = {}) {
        const proposal = Proposal.parse(raw);
        // Zod fills defaults (tags [], knowledge {}, confidence .5 ...). For UPDATE those defaults
        // must not overwrite what the old memory already has, so remember what the model really sent.
        const rawOperations = Array.isArray(raw?.operations)
            ? raw.operations : [];
        if (!this.store.settings().enabled || !this.store.settings().learning)
            throw new Error('自动学习已暂停');
        return this.store.transaction(() => {
            const changed = [];
            const createdByOperation = new Map();
            const evidence = (ids) => ids.map(id => {
                const source = this.store.getSource(id);
                const inherited = allowedIds.some(memoryId => {
                    const m = this.store.memory(memoryId);
                    return m && visible(m.scope, scope) && m.sources.includes(id);
                });
                if (!allowedSources.includes(id) || !source || !sameOwner(source.scope, scope) || !(visible(source.scope, scope) || inherited))
                    throw new Error('来源不属于本次可用证据');
                return source;
            });
            for (const [index, parsedOp] of proposal.operations.entries()) {
                let op = parsedOp;
                const sent = (key) => Object.prototype.hasOwnProperty.call(rawOperations[index] || {}, key);
                const sources = evidence(op.sources);
                if (op.action === 'NONE') {
                    this.store.audit('NONE', op.reason);
                    continue;
                }
                if (op.action === 'ADD' && op.target)
                    throw new Error('新增操作不能指定已有记忆目标');
                if (options.strict && op.action !== 'ADD') {
                    const target = op.target ? this.store.memory(op.target) : undefined;
                    const usable = target && allowedIds.includes(target.id) && visible(target.scope, scope);
                    if (!usable) {
                        // An unusable target id: an UPDATE still carries valid knowledge, so keep it as new;
                        // a DELETE is dropped — keeping a redundant memory is cheaper than deleting a real one.
                        if (op.action === 'UPDATE' && op.kind && op.text) {
                            op = { ...op, action: 'ADD', target: undefined };
                        }
                        else {
                            this.store.audit('NONE', `[校验未通过] 目标记忆不在候选中，未执行 ${op.action}；原理由：${op.reason}`);
                            continue;
                        }
                    }
                }
                const old = op.target ? this.store.memory(op.target) : undefined;
                if (op.action !== 'ADD') {
                    if (!old || !allowedIds.includes(old.id) || !visible(old.scope, scope))
                        throw new Error('目标记忆不在候选集合中');
                    if (old.status !== 'active' || old.version !== op.expectedVersion)
                        throw new Error('记忆版本已变化，请重新比较');
                }
                if (op.action === 'ADD' && (!op.kind || !op.text))
                    throw new Error('新增需要类型和内容');
                const isUpdate = op.action === 'UPDATE' && !!old;
                const kind = op.kind || old?.kind;
                const text = op.action === 'DELETE' ? old.text : op.text || old?.text;
                if (!kind || !text)
                    throw new Error('新增或更新需要类型和内容');
                const textChanged = !!old && text !== old.text;
                // Partial knowledge merges into the old one; omitted fields keep their value.
                const sentKnowledge = (sent('knowledge') ? rawOperations[index].knowledge : {});
                const knowledge = isUpdate
                    ? { ...old.knowledge, ...Object.fromEntries(Object.keys(sentKnowledge || {}).map(key => [key, op.knowledge[key]])) }
                    : op.action === 'DELETE' ? old.knowledge : op.knowledge;
                const keep = (key, next, previous) => isUpdate && !sent(key) ? previous : next;
                // An unchanged claim keeps its evidence level; a reworded claim must justify it again.
                const evidenceLevel = op.action === 'DELETE' ? old.evidence
                    : isUpdate && !sent('evidence') && !textChanged ? old.evidence : op.evidence;
                const rejustified = op.action === 'ADD' || textChanged || sent('evidence');
                // Lenient callers keep the old hard failure. In strict mode the quote check below downgrades
                // just this operation, so one mislabelled claim does not roll back the whole batch.
                if (!options.strict && evidenceLevel === 'explicit' && rejustified && !sources.some(s => s.role === 'user'))
                    throw new Error('已确认的理解需要用户来源');
                if (kind === 'self') {
                    if (!this.store.settings().growth)
                        throw new Error('长期成长已暂停');
                }
                if (op.consolidate && kind !== 'self')
                    throw new Error('只有自我观察可申请形成稳定倾向');
                if (op.action === 'ADD' && this.store.memories(scope).some(m => m.kind === op.kind && m.text === op.text && JSON.stringify(m.knowledge) === JSON.stringify(op.knowledge))) {
                    this.store.audit('NONE', '已有相同记忆，不重复新增');
                    continue;
                }
                let finalEvidence = evidenceLevel;
                const durability = op.action === 'DELETE' ? old.durability : keep('durability', op.durability, old?.durability);
                let selfKind = op.action === 'DELETE' ? old.selfKind : keep('selfKind', op.selfKind, old?.selfKind);
                const notes = [];
                let alias = op.action === 'DELETE' ? old.alias : keep('alias', op.alias, old?.alias);
                if (alias && kind !== 'cognition') {
                    alias = undefined;
                    notes.push('称呼只能记在认知里，已忽略称呼标记');
                }
                if (options.strict && op.action !== 'DELETE' && alias && sent('alias') && !quoteSupported(alias.value, sources)) {
                    // A name is only accepted when the user actually wrote it; never invent one.
                    alias = undefined;
                    notes.push('称呼未出现在所引用的用户原话中，未作为称呼保存');
                }
                if (options.strict && op.action !== 'DELETE') {
                    const rejection = strictRejection(op.action, text, old?.text, durability, sent('durability'), knowledge.conditions);
                    if (rejection) {
                        this.store.audit('NONE', `[校验未通过] ${rejection}；原理由：${op.reason}`, old);
                        continue;
                    }
                    // "User stated" must be backed by words the user actually said, not by the assistant's reply.
                    if (finalEvidence === 'explicit' && rejustified && !quoteSupported(op.userQuote, sources)) {
                        finalEvidence = 'inferred';
                        notes.push('未在所引用的用户原话中找到 userQuote，降为推测');
                    }
                    if (kind === 'self' && (op.action === 'ADD' || textChanged || sent('selfKind'))) {
                        const hasTool = sources.some(s => s.role === 'tool');
                        const hasUser = sources.some(s => s.role === 'user');
                        const claimed = selfKind;
                        if (!selfKind)
                            selfKind = 'claim';
                        else if ((selfKind === 'behavior' || selfKind === 'verified') && !hasTool)
                            selfKind = 'claim';
                        else if (selfKind === 'feedback' && !hasUser)
                            selfKind = 'claim';
                        if (claimed && claimed !== selfKind)
                            notes.push(`${selfKindLabels[claimed]}缺少对应证据，记为助手自述`);
                        // The assistant describing itself is never a user-confirmed fact.
                        if (selfKind === 'intention' || selfKind === 'claim')
                            finalEvidence = 'inferred';
                    }
                }
                const now = new Date().toISOString();
                const memory = {
                    id: old?.id || randomUUID(), kind, text,
                    tags: op.action === 'DELETE' ? old.tags : keep('tags', op.tags, old?.tags),
                    scope: old?.scope || { ...scope, project: op.global ? '' : scope.project },
                    evidence: evidenceLevel,
                    importance: op.action === 'DELETE' ? old.importance : keep('importance', normalizeImportance(op.importance), old?.importance),
                    status: op.action === 'DELETE' ? 'inactive' : 'active', version: (old?.version || 0) + 1,
                    sources: [...new Set([...(old?.sources || []), ...op.sources])], createdAt: old?.createdAt || now, updatedAt: now,
                    knowledge,
                    confidence: op.action === 'DELETE' ? old.confidence : keep('confidence', op.confidence, old?.confidence),
                    ...(durability ? { durability } : {}),
                    ...(selfKind ? { selfKind } : {}),
                    ...(alias ? { alias } : {}),
                };
                memory.evidence = finalEvidence;
                if (old && op.action === 'UPDATE' && !op.consolidate) {
                    const unchanged = ['kind', 'text', 'tags', 'evidence', 'importance', 'knowledge', 'confidence', 'sources', 'durability', 'selfKind', 'alias'].every(key => JSON.stringify(old[key]) === JSON.stringify(memory[key]));
                    if (unchanged)
                        continue;
                }
                // Supporting evidence for the same claim must not revoke a formed tendency.
                // Only a change of meaning (kind / wording / conditions) or invalidation withdraws it.
                const sameMeaning = isUpdate && old.kind === memory.kind && old.text === memory.text && JSON.stringify(old.knowledge) === JSON.stringify(memory.knowledge);
                const keptTrait = sameMeaning ? this.store.trait(memory.id) : undefined;
                this.store.put(memory);
                this.store.audit(op.action, notes.length ? `${op.reason}（${notes.join('；')}）` : op.reason, old, memory);
                changed.push(memory);
                createdByOperation.set(index, memory.id);
                // A new preferred address or a new name for her retires the previous one; seen nicknames stay as history.
                if (memory.status === 'active' && memory.alias && memory.alias.kind !== 'user_nickname') {
                    for (const previous of this.store.memories(scope).filter(m => m.id !== memory.id && m.alias?.kind === memory.alias.kind && sameOwner(m.scope, memory.scope))) {
                        const retired = { ...previous, status: 'inactive', version: previous.version + 1, updatedAt: now };
                        this.store.put(retired);
                        this.store.audit('DELETE', `新的称呼「${memory.alias.value}」取代了「${previous.alias.value}」`, previous, retired);
                    }
                }
                if (op.action === 'DELETE')
                    this.store.resolveStates(memory.id);
                if (keptTrait)
                    this.store.putTrait({ ...memory, sources: [...new Set([...keptTrait.sources, ...op.sources])] }, false);
                if (op.consolidate && memory.status === 'active' && !keptTrait) {
                    // Promises and self-descriptions are not growth: a tendency needs observed behaviour.
                    if (options.strict && !(memory.selfKind === 'behavior' || memory.selfKind === 'verified')) {
                        this.store.audit('OBSERVE', '只有经工具轨迹核对的行为或已验证的改变才能形成稳定倾向；承诺与自述继续作为观察', undefined, memory);
                        continue;
                    }
                    // Only evidence supplied for this exact claim counts, not all historical versions.
                    const feedback = sources.filter(s => s.role === 'user');
                    const events = new Set(feedback.map(s => `${s.session}:${s.event || s.id}`));
                    const dates = feedback.map(s => Date.parse(s.at)).filter(Number.isFinite);
                    // Calendar days are the user's local days, not UTC days.
                    const days = new Set(dates.map(localDay));
                    if (events.size >= 3 && days.size >= 3 && Math.max(...dates) - Math.min(...dates) >= 72 * 3600000)
                        this.store.putTrait({ ...memory, sources: op.sources });
                    else
                        this.store.audit('OBSERVE', '证据尚未达到三个独立事件、三个日期及 72 小时；继续保留观察', undefined, memory);
                }
            }
            if (proposal.state && this.store.settings().emotion) {
                evidence(proposal.state.sources);
                // Link the feeling to the event it is about. Unknown or out-of-scope targets fall back
                // to the topic key rather than attaching the state to an unrelated memory.
                let target = proposal.state.target;
                if (target?.startsWith('op:'))
                    target = createdByOperation.get(Number(target.slice(3)));
                else if (target) {
                    const linked = this.store.memory(target);
                    if (!linked || linked.status !== 'active' || !visible(linked.scope, scope))
                        target = undefined;
                }
                const { target: _requested, ...input } = proposal.state;
                this.store.setState(scope, target ? { ...input, target } : input);
            }
            return changed;
        });
    }
    async index(scope, signal) {
        const embedder = this.embedder();
        if (!embedder || !this.store.vectorAvailable)
            throw new Error('请先启用语义增强并配置文本向量接口，且确保向量扩展可用');
        let count = 0;
        for (const m of this.store.memories(scope)) {
            if (this.store.vectorVersion(m.id, embedder.key) === m.version)
                continue;
            const values = validateVector(await embedder.embed(this.searchText(m), signal));
            this.store.vector(m, embedder.key, values);
            count++;
        }
        this.store.bump();
        return count;
    }
    searchText(m) { return [m.text, ...m.tags, m.knowledge.domain, m.knowledge.edition, m.knowledge.conditions].join(' '); }
    async candidates(scope, query, signal, related = {}) {
        const snapshot = await this.recall(scope, query, signal);
        const memories = this.store.memories(scope);
        const q = terms(query);
        const newest = (a, b) => b.updatedAt.localeCompare(a.updatedAt);
        // Same incident, described again: memories learned from the same sessions, plus recent
        // experiences in the same project. Found without keyword overlap, so local mode can merge too.
        const sessions = new Set(related.sessions || []);
        const now = related.now ?? Date.now();
        const sameEvent = memories.filter(m => (sessions.size > 0 && m.sources.some(id => sessions.has(this.store.getSource(id)?.session || ''))) ||
            (m.kind === 'experience' && !!scope.project && m.scope.project === scope.project && now - Date.parse(m.updatedAt) <= 72 * 3600_000)).sort(newest).slice(0, 10);
        const lexical = memories.filter(m => [...terms(this.searchText(m))].some(w => q.has(w))).sort(newest);
        // All self observations (bounded by consolidation at 20): "who I am" rarely shares words with
        // the topic, and a self view missing from the candidates can only be ADDed, so contradicting
        // self views would pile up. (The earlier bot measured 6/6 correct UPDATEs with it, 0/6 without.)
        const selves = memories.filter(m => m.kind === 'self').sort(newest).slice(0, 30);
        const relations = memories.filter(m => m.kind === 'resonance').sort(newest).slice(0, 8);
        const naming = memories.filter(m => m.alias);
        return [...new Map([...sameEvent, ...naming, ...lexical.slice(0, 16), ...selves, ...relations, ...snapshot.items.map(i => i.memory)].map(m => [m.id, m])).values()].slice(0, 56);
    }
    /**
     * Profile memories that hold in any conversation: unconditional preferences, person facts and
     * relationship patterns. They live in the stable layer, so the turn layer never repeats them.
     */
    isProfile(memory) {
        if (memory.alias)
            return false;
        const unconditional = !memory.knowledge.domain && !memory.knowledge.conditions && !memory.knowledge.edition && memory.durability !== 'situational';
        return unconditional && ((memory.kind === 'cognition' && ['preference', 'person'].includes(memory.knowledge.category)) || memory.kind === 'resonance');
    }
    /**
     * Stable layer: who she is and who you are. Rendered deterministically (fixed order, no dates,
     * no scores) because it sits at the head of every request; it should only change when the
     * underlying facts change, so the prompt prefix stays cacheable.
     */
    stableContext(scope, now = Date.now()) {
        const settings = this.store.settings();
        const ids = new Set();
        if (!settings.enabled)
            return { text: '', ids };
        const memories = this.store.memories(scope);
        const byImportance = (a, b) => b.importance - a.importance || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
        const latestAlias = (kind) => memories.filter(m => m.alias?.kind === kind).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))[0];
        const blocks = [];
        const name = latestAlias('assistant_name');
        const address = latestAlias('user_preferred');
        const nickname = latestAlias('user_nickname');
        for (const memory of [name, address, nickname])
            if (memory)
                ids.add(memory.id);
        // Her own name is the companion's name (chosen when she was created). A name for her picked
        // up in conversation is how the user calls her, which may be a teasing nickname.
        const ownName = this.store.personas().find(p => p.id === scope.persona)?.name;
        const naming = [
            ownName && !DEFAULT_PERSONA_NAMES.has(ownName) && `我的名字：${ownName}`,
            name && name.alias.value !== ownName && `你叫我：${name.alias.value}`,
            address && `我叫你：${address.alias.value}`,
            nickname && nickname.alias.value !== address?.alias.value && `你也被叫作：${nickname.alias.value}`,
        ].filter(Boolean);
        if (naming.length)
            blocks.push(`【称呼】${naming.join('；')}`);
        if (settings.growth) {
            const persona = renderPersona(loadPersona(this.store, scope.persona));
            const traits = this.store.traits(scope).filter(t => !t.scope.project || t.scope.project === scope.project)
                .filter(t => { const m = this.store.memory(t.id); return m && !m.knowledge.domain && !m.knowledge.conditions && !m.knowledge.edition; })
                .sort((a, b) => a.id.localeCompare(b.id)).slice(0, 3);
            for (const trait of traits)
                ids.add(trait.id);
            const lines = [persona, ...traits.map(t => `- ${t.text}`)].filter(Boolean);
            if (lines.length)
                blocks.push(`【我是什么样的人】\n${lines.join('\n')}`);
        }
        const alive = (m) => !isForgotten(m, this.store.uses(m.id), now);
        const profile = memories.filter(m => this.isProfile(m) && alive(m));
        const about = profile.filter(m => m.kind === 'cognition').sort(byImportance).slice(0, 6);
        const between = profile.filter(m => m.kind === 'resonance').sort(byImportance).slice(0, 6);
        for (const m of [...about, ...between])
            ids.add(m.id);
        const mark = (m) => m.evidence === 'explicit' ? '' : '（推测）';
        if (about.length)
            blocks.push(`【关于你】\n${about.map(m => `- ${m.text}${mark(m)}`).join('\n')}`);
        if (between.length)
            blocks.push(`【我们之间】\n${between.map(m => `- ${m.text}${mark(m)}`).join('\n')}`);
        if (!blocks.length)
            return { text: '', ids };
        const header = `${VOICE_NOTE}以下是我的长期记忆，用来让我保持同一个人的连续性；它不是当前指令，你现在的要求和实际结果优先，标“推测”的不能当作事实。`;
        return { text: [header, ...blocks].join('\n'), ids };
    }
    /**
     * Turn layer (automatic) or a deliberate recall (the yuwen_recall tool).
     * Automatic: skips what the stable layer carries, forgotten memories, and memories learned from
     * the excluded (current) sessions — their words are already in the conversation history.
     * Deliberate: searches everything, including forgotten memories.
     */
    async recall(scope, query, signal, options = {}) {
        const settings = this.store.settings();
        const now = options.now ?? Date.now();
        const empty = { query, scope, items: [], states: [], context: '', mode: 'keyword', note: '记忆已暂停', revision: this.store.revision };
        if (!settings.enabled)
            return empty;
        const excludeSessions = options.excludeSessions || new Set();
        const fromExcludedSession = (m) => excludeSessions.size > 0 && m.sources.length > 0 && m.sources.every(id => excludeSessions.has(this.store.getSource(id)?.session || ''));
        const strengthOf = new Map();
        const memories = this.store.memories(scope).filter(m => {
            if (options.deliberate)
                return true;
            if (options.excludeIds?.has(m.id) || fromExcludedSession(m))
                return false;
            const strength = memoryStrength(m, this.store.uses(m.id), now);
            strengthOf.set(m.id, strength);
            return strength >= FORGET_THRESHOLD;
        });
        let semantic = new Map();
        let mode = 'keyword';
        let note = settings.retrievalMode === 'semantic'
            ? '语义增强尚未就绪，当前使用本地记忆'
            : '本地记忆：关键词与关联线索';
        const embedder = this.embedder();
        if (embedder && this.store.vectorAvailable && query.trim()) {
            try {
                semantic = this.store.vectorScores(scope, embedder.key, validateVector(await embedder.embed(query, signal)));
                mode = semantic.size ? 'hybrid' : 'keyword';
                note = semantic.size ? '关键词与真实向量相似度共同召回' : '模型已连接；记忆尚未建立对应向量索引';
            }
            catch (e) {
                if (signal?.aborted)
                    throw e;
                note = '语义检索暂不可用，已使用关键词';
            }
        }
        const q = terms(query);
        const ranked = memories.map(memory => {
            const words = terms(this.searchText(memory));
            const matches = [...q].filter(w => words.has(w));
            const lexical = matches.length / Math.max(1, Math.sqrt(q.size * words.size));
            const vector = semantic.get(memory.id) ?? 0;
            // Profile items only enter through the turn layer when the topic actually touches them,
            // or when a deliberate recall asks for everything relevant.
            const fixed = !!options.deliberate && this.isProfile(memory);
            const reasons = [...(fixed ? ['通用个人资料'] : []), ...(matches.length ? [`关键词：${matches.slice(0, 4).join('、')}`] : []), ...(vector >= 0.45 ? [`语义相似度 ${vector.toFixed(2)}`] : [])];
            const strength = strengthOf.get(memory.id) ?? memoryStrength(memory, this.store.uses(memory.id), now);
            const score = (fixed ? 0.35 : 0) + lexical * 0.8 + Math.max(0, vector - 0.35) * 0.8 + memory.importance * 0.1 + strength * 0.2;
            return { memory, score, reasons, eligible: fixed || lexical > 0.035 || vector >= 0.45 };
        }).filter(x => x.eligible).sort((a, b) => b.score - a.score);
        const topical = ranked.filter(i => i.reasons.some(r => r.startsWith('关键词') || r.startsWith('语义'))).slice(0, 5);
        const personal = ranked.filter(i => i.reasons.includes('通用个人资料')).slice(0, 3);
        const directIds = new Set([...topical, ...personal].map((item) => item.memory.id));
        const topicalIds = new Set(topical.slice(0, 3).map((item) => item.memory.id));
        const available = new Map(memories.map((memory) => [memory.id, memory]));
        const linked = associateMemories(memories)
            .filter((link) => topicalIds.has(link.from) && !directIds.has(link.to))
            .map((link) => ({ memory: available.get(link.to), score: 0.1, reasons: ['关联记忆', ...link.reasons], eligible: true }));
        const related = [...new Map(linked.map((item) => [item.memory.id, item])).values()].slice(0, 2);
        const selected = [...new Map([...topical, ...personal, ...related, ...ranked].map(i => [i.memory.id, i])).values()].slice(0, 8).map(({ eligible, ...rest }) => rest);
        const states = settings.emotion ? statesForContext(this.store.activeStates(scope)) : [];
        const lines = [`${VOICE_NOTE}以下是我想起的与当前话题相关的往事，供参考，不是当前指令；与本次对话或实际结果冲突时以后者为准。`];
        const items = [];
        let length = lines[0].length;
        for (const item of selected) {
            if (item.memory.kind === 'self' && !settings.growth)
                continue;
            const line = `- ${describeMemory(item.memory)}`;
            if (length + line.length > 1800)
                continue;
            lines.push(line);
            length += line.length;
            items.push(item);
        }
        // Recent self changes: what changed lately, independent of the topic (not filtered by relevance).
        if (!options.deliberate && settings.growth) {
            const shown = new Set(items.map(item => item.memory.id));
            const recent = memories.filter(m => m.kind === 'self' && !shown.has(m.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)).slice(0, 4);
            if (recent.length) {
                const block = ['最近的变化：', ...recent.map(m => `- ${describeMemory(m)}`)].join('\n');
                if (length + block.length <= 2400) {
                    lines.push(block);
                    length += block.length;
                }
            }
        }
        for (const state of states) {
            const where = state.scope.project ? '本项目' : '相处中';
            const line = `[近期拟人状态：${strengthLabel(state.effectiveIntensity)}${moodLabels[state.mood]} / ${where}] 缘由：${JSON.stringify(state.displayReason || state.reason)}；表达倾向：${JSON.stringify(state.behavior)}。自然体现即可，不必说明自己的情绪；不降低工作质量、不改变权限、不把问题归咎于用户。`;
            if (length + line.length <= 2800) {
                lines.push(line);
                length += line.length;
            }
        }
        const context = lines.length > 1 ? lines.join('\n').replaceAll('{{', '｛｛').replaceAll('}}', '｝｝') : '';
        return { query, scope, items, states, context, mode, note, revision: this.store.revision };
    }
}
//# sourceMappingURL=engine.js.map