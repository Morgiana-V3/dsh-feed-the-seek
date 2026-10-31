import { randomUUID } from 'node:crypto'
import {
  makeEmbedder,
  resolveEmbeddingKey,
  validateVector,
  type Embedder,
  type EmbeddingCredentials,
} from '../embedding/index.js'
import {
  moodLabels,
  pickDisplayedMood,
  strengthLabel,
  type DisplayedMood,
} from '../emotion/index.js'
import {
  FORGET_THRESHOLD,
  isRecallable,
  localDay,
  memoryStrength,
  normalizeImportance,
  Proposal,
  retentionRejection,
  sameOwner,
  visible,
  type Alias,
  type Memory,
  type Scope,
  type Snapshot,
  type Source,
} from '../memory/index.js'
import { isPersonaEvidence, loadPersona, renderPersona } from '../persona/index.js'
import { Store } from '../storage/index.js'
export function terms(text: string) {
  const set = new Set<string>()
  for (const word of text.toLowerCase().match(/[a-z0-9_./-]+|[\p{Script=Han}]+/gu) || []) {
    if (/\p{Script=Han}/u.test(word)) {
      for (let i = 0; i < word.length - 1; i++) {
        set.add(word.slice(i, i + 2))
      }
    } else if (word.length > 1) {
      set.add(word)
    }
  }
  return set
}

/**
 * Memories are written in the companion's own voice. In a system prompt "你" usually means the
 * model, so every injected block states who is who before using either pronoun.
 */
export const VOICE_NOTE =
  '（以下用我的口吻记录：“我”指我自己，也就是正在回答的助手；“你”指正在和我对话的用户。）'
/** Placeholder names that are not really her name. */
const DEFAULT_PERSONA_NAMES = new Set(['初始实例', '初始伙伴'])

const selfKindLabels = {
  behavior: '观察到的行为',
  feedback: '用户反馈',
  intention: '调整意图',
  claim: '助手自述',
  verified: '已验证的改变',
} as const
const MAX_MEMORY_CHARS = 160
/** Standing requests and recent self observations carried in every conversation. */
const STANDING_REQUESTS = 8
const RECENT_SELF = 3
/** Topical memories per turn, besides the one reserved self observation. */
const TURN_ITEMS = 8
const characters = (value: string) => [...value].length
/** Compare without whitespace or punctuation so full/half-width differences do not matter. */
function normalizeQuote(value: string) {
  return value.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '')
}
export function quoteSupported(quote: string | undefined, sources: Source[]) {
  const needle = normalizeQuote(quote || '')
  return (
    characters(needle) >= 2 &&
    sources.some((source) => source.role === 'user' && normalizeQuote(source.text).includes(needle))
  )
}
/** Returns why an organizer operation must not be stored, or '' when it may proceed. */
export function strictRejection(
  action: string,
  text: string,
  oldText: string | undefined,
  durability: string | undefined,
  durabilitySent: boolean,
  conditions: string,
) {
  if (durability === 'turn' && durabilitySent) {
    return '当次要求不写入长期记忆'
  }
  if (durability === 'situational' && !conditions.trim()) {
    return '情境性内容需要写明适用条件'
  }
  const length = characters(text)
  if (action === 'ADD' && length > MAX_MEMORY_CHARS) {
    return `正文 ${length} 字，超过 ${MAX_MEMORY_CHARS} 字上限，应拆分或精简`
  }
  if (action === 'UPDATE' && oldText !== undefined && text !== oldText) {
    const previous = characters(oldText)
    if (length > MAX_MEMORY_CHARS && length > previous) {
      return `更新后正文 ${length} 字且继续变长，应保留结论而非追加对话摘要`
    }
    if (length > 80 && length > previous * 1.5) {
      return `更新后正文从 ${previous} 字增至 ${length} 字，应替换为精简结论而非追加`
    }
  }
  return ''
}
/** Trigger words that appear verbatim (ignoring case and spacing) in at least one cited source. */
export function literalTags(tags: string[], sources: Source[]) {
  const texts = sources.map((source) => normalizeQuote(source.text))
  return [
    ...new Set(
      tags
        .map((tag) => tag.trim())
        .filter((tag) => {
          const needle = normalizeQuote(tag)
          return characters(needle) >= 2 && texts.some((text) => text.includes(needle))
        }),
    ),
  ].slice(0, 3)
}
/** One compact line: kind and basis, then the text, then only the conditions that are set. */
export function describeMemory(candidateMemory: Memory): string {
  let basis = candidateMemory.evidence === 'explicit' ? '用户陈述' : '推测'
  if (candidateMemory.kind === 'self' && candidateMemory.selfKind) {
    basis = selfKindLabels[candidateMemory.selfKind]
    if (candidateMemory.selfKind === 'claim' || candidateMemory.selfKind === 'intention') {
      basis += '，未经行为验证'
    }
  }
  const tags = [
    names[candidateMemory.kind],
    basis,
    ...(candidateMemory.durability === 'situational' ? ['仅限所述情境'] : []),
  ].join('·')
  const scope = [
    candidateMemory.knowledge.domain && `领域：${candidateMemory.knowledge.domain}`,
    candidateMemory.knowledge.edition && `版本：${candidateMemory.knowledge.edition}`,
    candidateMemory.knowledge.conditions && `条件：${candidateMemory.knowledge.conditions}`,
  ].filter(Boolean)
  const when =
    candidateMemory.kind === 'experience' ? `（${candidateMemory.updatedAt.slice(0, 10)}）` : ''
  return `[${tags}] ${candidateMemory.text}${scope.length ? `（${scope.join('；')}）` : ''}${when}`
}
const names = { cognition: '认知', experience: '经历', resonance: '共鸣', self: '自我观察' }

export class Engine {
  constructor(
    public store: Store,
    private embeddingOverride?: Embedder,
    public credentials?: EmbeddingCredentials,
  ) {}
  embedder() {
    const settings = this.store.settings()
    if (settings.retrievalMode === 'local') {
      return undefined
    }
    return (
      this.embeddingOverride ||
      makeEmbedder(settings, () => resolveEmbeddingKey(settings, this.credentials))
    )
  }
  /**
   * strict: the proposal came from the organizer model. Then claims are checked against
   * their sources (user quote, durability, self-evidence, length) before they are stored.
   * Demo data and direct calls keep the older, lenient contract.
   */
  apply(
    raw: unknown,
    scope: Scope,
    allowedIds: string[],
    allowedSources: string[],
    options: { strict?: boolean; retentionPolicy?: boolean } = {},
  ) {
    const proposal = Proposal.parse(raw)
    // Zod fills defaults (tags [], knowledge {}, confidence .5 ...). For UPDATE those defaults
    // must not overwrite what the old memory already has, so remember what the model really sent.
    const rawOperations: Record<string, unknown>[] = Array.isArray(
      (raw as { operations?: unknown })?.operations,
    )
      ? (raw as { operations: Record<string, unknown>[] }).operations
      : []
    if (!this.store.settings().enabled || !this.store.settings().learning) {
      throw new Error('自动学习已暂停')
    }
    return this.store.transaction(() => {
      const changed: Memory[] = []
      const createdByOperation = new Map<number, string>()
      const evidence = (ids: string[]) =>
        ids.map((id) => {
          const source = this.store.getSource(id)
          const inherited = allowedIds.some((memoryId) => {
            const candidateMemory = this.store.memory(memoryId)
            return (
              candidateMemory &&
              visible(candidateMemory.scope, scope) &&
              candidateMemory.sources.includes(id)
            )
          })
          if (
            !allowedSources.includes(id) ||
            !source ||
            !sameOwner(source.scope, scope) ||
            !(visible(source.scope, scope) || inherited)
          ) {
            throw new Error('来源不属于本次可用证据')
          }
          return source
        })
      for (const [index, parsedOp] of proposal.operations.entries()) {
        let operation = parsedOp
        const sent = (key: string) =>
          Object.prototype.hasOwnProperty.call(rawOperations[index] || {}, key)
        const sources = evidence(operation.sources)
        if (operation.action === 'NONE') {
          this.store.audit('NONE', operation.reason)
          continue
        }
        if (operation.action === 'ADD' && operation.target) {
          throw new Error('新增操作不能指定已有记忆目标')
        }
        if (options.strict && operation.action !== 'ADD') {
          const target = operation.target ? this.store.memory(operation.target) : undefined
          const usable = target && allowedIds.includes(target.id) && visible(target.scope, scope)
          if (!usable) {
            // An unusable target id: an UPDATE still carries valid knowledge, so keep it as new;
            // a DELETE is dropped — keeping a redundant memory is cheaper than deleting a real one.
            if (operation.action === 'UPDATE' && operation.kind && operation.text) {
              operation = { ...operation, action: 'ADD', target: undefined }
            } else {
              this.store.audit(
                'NONE',
                `[校验未通过] 目标记忆不在候选中，未执行 ${operation.action}；原理由：${operation.reason}`,
              )
              continue
            }
          }
        }
        const old = operation.target ? this.store.memory(operation.target) : undefined
        if (operation.action !== 'ADD') {
          if (!old || !allowedIds.includes(old.id) || !visible(old.scope, scope)) {
            throw new Error('目标记忆不在候选集合中')
          }
          if (old.status !== 'active' || old.version !== operation.expectedVersion) {
            throw new Error('记忆版本已变化，请重新比较')
          }
        }
        if (operation.action === 'ADD' && (!operation.kind || !operation.text)) {
          throw new Error('新增需要类型和内容')
        }
        const isUpdate = operation.action === 'UPDATE' && !!old
        const kind = operation.kind || old?.kind
        const text = operation.action === 'DELETE' ? old!.text : operation.text || old?.text
        if (!kind || !text) {
          throw new Error('新增或更新需要类型和内容')
        }
        const textChanged = !!old && text !== old.text
        // Partial knowledge merges into the old one; omitted fields keep their value.
        const sentKnowledge = (sent('knowledge') ? rawOperations[index].knowledge : {}) as
          Record<string, unknown> | undefined
        let knowledge = operation.knowledge
        if (isUpdate) {
          knowledge = {
            ...old!.knowledge,
            ...Object.fromEntries(
              Object.keys(sentKnowledge || {}).map((key) => [
                key,
                operation.knowledge[key as keyof typeof operation.knowledge],
              ]),
            ),
          }
        } else if (operation.action === 'DELETE') {
          knowledge = old!.knowledge
        }
        const keep = <T>(key: string, next: T, previous: T | undefined) =>
          isUpdate && !sent(key) ? (previous as T) : next
        // An unchanged claim keeps its evidence level; a reworded claim must justify it again.
        const preserveEvidence =
          operation.action === 'DELETE' || (isUpdate && !sent('evidence') && !textChanged)
        const evidenceLevel = preserveEvidence ? old!.evidence : operation.evidence
        const rejustified = operation.action === 'ADD' || textChanged || sent('evidence')
        // Lenient callers keep the old hard failure. In strict mode the quote check below downgrades
        // just this operation, so one mislabelled claim does not roll back the whole batch.
        if (
          !options.strict &&
          evidenceLevel === 'explicit' &&
          rejustified &&
          !sources.some((candidateSource) => candidateSource.role === 'user')
        ) {
          throw new Error('已确认的理解需要用户来源')
        }
        // Skip just this operation: one self observation the organizer sent anyway must not
        // roll back the rest of the batch and turn the whole job into a failure.
        if (kind === 'self' && !this.store.settings().growth) {
          this.store.audit(
            'NONE',
            `[跳过] 成长整理未启用，不保存自我观察；原理由：${operation.reason}`,
            old,
          )
          continue
        }
        if (operation.consolidate && kind !== 'self') {
          throw new Error('只有自我观察可申请形成稳定倾向')
        }
        if (
          operation.action === 'ADD' &&
          this.store
            .memories(scope)
            .some(
              (candidateMemory) =>
                candidateMemory.kind === operation.kind &&
                candidateMemory.text === operation.text &&
                JSON.stringify(candidateMemory.knowledge) === JSON.stringify(operation.knowledge),
            )
        ) {
          this.store.audit('NONE', '已有相同记忆，不重复新增')
          continue
        }
        let finalEvidence = evidenceLevel
        const retention =
          operation.action === 'DELETE'
            ? old!.retention
            : keep('retention', operation.retention, old?.retention)
        if (
          options.retentionPolicy &&
          (operation.action === 'ADD' ||
            textChanged ||
            sent('selfKind') ||
            sent('retention') ||
            operation.consolidate)
        ) {
          const rejection = retentionRejection(
            {
              ...operation,
              retention,
              text,
              knowledge,
              selfKind: operation.selfKind || old?.selfKind,
            },
            kind,
            sources,
            quoteSupported(operation.userQuote, sources),
          )
          if (rejection) {
            this.store.audit('NONE', `[保留门槛] ${rejection}；原理由：${operation.reason}`, old)
            continue
          }
        }
        const durability =
          operation.action === 'DELETE'
            ? old!.durability
            : keep('durability', operation.durability, old?.durability)
        let selfKind =
          operation.action === 'DELETE'
            ? old!.selfKind
            : keep('selfKind', operation.selfKind, old?.selfKind)
        const notes: string[] = []
        let alias =
          operation.action === 'DELETE' ? old!.alias : keep('alias', operation.alias, old?.alias)
        if (
          alias &&
          kind !== 'cognition' &&
          !(kind === 'self' && alias.kind === 'assistant_name')
        ) {
          alias = undefined
          notes.push('用户称呼属于认知，角色自己的名字也可属于自我；已忽略不匹配的称呼标记')
        }
        if (
          options.strict &&
          operation.action !== 'DELETE' &&
          alias &&
          sent('alias') &&
          !quoteSupported(alias.value, sources)
        ) {
          // A name is only accepted when the user actually wrote it; never invent one.
          alias = undefined
          notes.push('称呼未出现在所引用的用户原话中，未作为称呼保存')
        }
        if (options.strict && operation.action !== 'DELETE') {
          const rejection = strictRejection(
            operation.action,
            text,
            old?.text,
            durability,
            sent('durability'),
            knowledge.conditions,
          )
          if (rejection) {
            this.store.audit('NONE', `[校验未通过] ${rejection}；原理由：${operation.reason}`, old)
            continue
          }
          // "User stated" must be backed by words the user actually said, not by the assistant's reply.
          if (
            finalEvidence === 'explicit' &&
            rejustified &&
            !quoteSupported(operation.userQuote, sources)
          ) {
            finalEvidence = 'inferred'
            notes.push('未在所引用的用户原话中找到 userQuote，降为推测')
          }
          if (kind === 'self' && (operation.action === 'ADD' || textChanged || sent('selfKind'))) {
            const hasTool = sources.some((candidateSource) => candidateSource.role === 'tool')
            const hasUser = sources.some((candidateSource) => candidateSource.role === 'user')
            const claimed = selfKind
            if (!selfKind) {
              selfKind = 'claim'
            } else if ((selfKind === 'behavior' || selfKind === 'verified') && !hasTool) {
              selfKind = 'claim'
            } else if (selfKind === 'feedback' && !hasUser) {
              selfKind = 'claim'
            }
            if (claimed && claimed !== selfKind) {
              notes.push(`${selfKindLabels[claimed]}缺少对应证据，记为助手自述`)
            }
            // The assistant describing itself is never a user-confirmed fact.
            if (selfKind === 'intention' || selfKind === 'claim') {
              finalEvidence = 'inferred'
            }
          }
        }
        let tags =
          operation.action === 'DELETE' ? old!.tags : keep('tags', operation.tags, old?.tags)
        // Tags are trigger words, not categories: from the organizer, only words that literally
        // occur in the cited sources survive, at most three.
        if (options.strict && operation.action !== 'DELETE' && sent('tags')) {
          tags = literalTags(operation.tags, sources)
        }
        const now = new Date().toISOString()
        const memory: Memory = {
          id: old?.id || randomUUID(),
          kind,
          text,
          tags,
          // Every memory belongs to the companion as a whole; nothing is limited to one project.
          scope: old?.scope || { ...scope, project: '' },
          evidence: evidenceLevel,
          importance:
            operation.action === 'DELETE'
              ? old!.importance
              : keep('importance', normalizeImportance(operation.importance), old?.importance),
          status: operation.action === 'DELETE' ? 'inactive' : 'active',
          version: (old?.version || 0) + 1,
          sources: [...new Set([...(old?.sources || []), ...operation.sources])],
          createdAt: old?.createdAt || now,
          updatedAt: now,
          knowledge,
          confidence:
            operation.action === 'DELETE'
              ? old!.confidence
              : keep('confidence', operation.confidence, old?.confidence),
          ...(durability ? { durability } : {}),
          ...(selfKind ? { selfKind } : {}),
          ...(alias ? { alias } : {}),
          ...(retention ? { retention } : {}),
        }
        memory.evidence = finalEvidence
        if (old && operation.action === 'UPDATE' && !operation.consolidate) {
          const unchanged = [
            'kind',
            'text',
            'tags',
            'evidence',
            'importance',
            'knowledge',
            'confidence',
            'sources',
            'durability',
            'selfKind',
            'alias',
            'retention',
          ].every(
            (key) =>
              JSON.stringify(old[key as keyof Memory]) ===
              JSON.stringify(memory[key as keyof Memory]),
          )
          if (unchanged) {
            continue
          }
        }
        // Supporting evidence for the same claim must not revoke a formed tendency.
        // Only a change of meaning (kind / wording / conditions) or invalidation withdraws it.
        const sameMeaning =
          isUpdate &&
          old!.kind === memory.kind &&
          old!.text === memory.text &&
          JSON.stringify(old!.knowledge) === JSON.stringify(memory.knowledge)
        const keptTrait = sameMeaning ? this.store.trait(memory.id) : undefined
        this.store.put(memory)
        this.store.audit(
          operation.action,
          notes.length ? `${operation.reason}（${notes.join('；')}）` : operation.reason,
          old,
          memory,
        )
        changed.push(memory)
        createdByOperation.set(index, memory.id)
        // A new preferred address or a new name for her retires the previous one; seen nicknames stay as history.
        if (memory.status === 'active' && memory.alias && memory.alias.kind !== 'user_nickname') {
          for (const previous of this.store
            .memories(scope)
            .filter(
              (candidateMemory) =>
                candidateMemory.id !== memory.id &&
                candidateMemory.alias?.kind === memory.alias!.kind &&
                sameOwner(candidateMemory.scope, memory.scope),
            )) {
            const retired: Memory = {
              ...previous,
              status: 'inactive',
              version: previous.version + 1,
              updatedAt: now,
            }
            this.store.put(retired)
            this.store.audit(
              'DELETE',
              `新的称呼「${memory.alias.value}」取代了「${previous.alias!.value}」`,
              previous,
              retired,
            )
          }
        }
        if (operation.action === 'DELETE') {
          this.store.resolveStates(memory.id)
        }
        if (keptTrait) {
          this.store.putTrait(
            { ...memory, sources: [...new Set([...keptTrait.sources, ...operation.sources])] },
            false,
          )
        }
        if (operation.consolidate && memory.status === 'active' && !keptTrait) {
          // Promises and self-descriptions are not growth: a tendency needs observed behaviour.
          if (
            options.strict &&
            !(memory.selfKind === 'behavior' || memory.selfKind === 'verified')
          ) {
            this.store.audit(
              'OBSERVE',
              '只有经工具轨迹核对的行为或已验证的改变才能形成稳定倾向；承诺与自述继续作为观察',
              undefined,
              memory,
            )
            continue
          }
          // Only evidence supplied for this exact claim counts, not all historical versions.
          const feedback = sources.filter((candidateSource) => candidateSource.role === 'user')
          const events = new Set(
            feedback.map(
              (candidateSource) =>
                `${candidateSource.session}:${candidateSource.event || candidateSource.id}`,
            ),
          )
          const dates = feedback
            .map((candidateSource) => Date.parse(candidateSource.at))
            .filter(Number.isFinite)
          // Calendar days are the user's local days, not UTC days.
          const days = new Set(dates.map(localDay))
          if (
            events.size >= 3 &&
            days.size >= 3 &&
            Math.max(...dates) - Math.min(...dates) >= 72 * 3600000
          ) {
            this.store.putTrait({ ...memory, sources: operation.sources })
          } else {
            this.store.audit(
              'OBSERVE',
              '证据尚未达到三个独立事件、三个日期及 72 小时；继续保留观察',
              undefined,
              memory,
            )
          }
        }
      }
      if (proposal.state && this.store.settings().emotion) {
        evidence(proposal.state.sources)
        // Link the feeling to the event it is about. Unknown or out-of-scope targets fall back
        // to the topic key rather than attaching the state to an unrelated memory.
        let target = proposal.state.target
        if (target?.startsWith('op:')) {
          target = createdByOperation.get(Number(target.slice(3)))
        } else if (target) {
          const linked = this.store.memory(target)
          if (!linked || linked.status !== 'active' || !visible(linked.scope, scope)) {
            target = undefined
          }
        }
        const { target: _requested, ...input } = proposal.state
        this.store.setState(scope, target ? { ...input, target } : input)
      }
      return changed
    })
  }
  async index(scope: Scope, signal?: AbortSignal) {
    const embedder = this.embedder()
    if (!embedder || !this.store.vectorAvailable) {
      throw new Error('请先启用语义增强并配置文本向量接口，且确保向量扩展可用')
    }
    let count = 0
    for (const candidateMemory of this.store.memories(scope)) {
      if (this.store.vectorVersion(candidateMemory.id, embedder.key) === candidateMemory.version) {
        continue
      }
      const values = validateVector(await embedder.embed(this.searchText(candidateMemory), signal))
      this.store.vector(candidateMemory, embedder.key, values)
      count++
    }
    this.store.bump()
    return count
  }
  searchText(candidateMemory: Memory) {
    return [
      candidateMemory.text,
      ...candidateMemory.tags,
      candidateMemory.knowledge.domain,
      candidateMemory.knowledge.edition,
      candidateMemory.knowledge.conditions,
    ].join(' ')
  }
  async candidates(
    scope: Scope,
    query: string,
    signal?: AbortSignal,
    related: { sessions?: string[]; now?: number } = {},
  ) {
    const snapshot = await this.recall(scope, query, signal)
    const memories = this.store.memories(scope)
    const queryTerms = terms(query)
    const newest = (leftMemory: Memory, rightMemory: Memory) =>
      rightMemory.updatedAt.localeCompare(leftMemory.updatedAt)
    // Same incident, described again: memories learned from the same sessions, plus recent
    // experiences. Found without keyword overlap, so local mode can merge too.
    const sessions = new Set(related.sessions || [])
    const now = related.now ?? Date.now()
    const sameEvent = memories
      .filter(
        (candidateMemory) =>
          (sessions.size > 0 &&
            candidateMemory.sources.some((id) =>
              sessions.has(this.store.getSource(id)?.session || ''),
            )) ||
          (candidateMemory.kind === 'experience' &&
            now - Date.parse(candidateMemory.updatedAt) <= 72 * 3600_000),
      )
      .sort(newest)
      .slice(0, 10)
    const lexical = memories
      .filter((candidateMemory) =>
        [...terms(this.searchText(candidateMemory))].some((term) => queryTerms.has(term)),
      )
      .sort(newest)
    // All self observations (bounded by consolidation at 20): "who I am" rarely shares words with
    // the topic, and a self view missing from the candidates can only be ADDed, so contradicting
    // self views would pile up. (The earlier bot measured 6/6 correct UPDATEs with it, 0/6 without.)
    // Self observations come first and outside the cap: consolidation keeps them near SELF_LIMIT,
    // and one pushed out of the list could only be ADDed again, never updated or retired.
    // 60 is only a guard for a failing consolidation, far above the usual ~20.
    const selves = memories
      .filter((candidateMemory) => candidateMemory.kind === 'self')
      .sort(newest)
      .slice(0, 60)
    const relations = memories
      .filter((candidateMemory) => candidateMemory.kind === 'resonance')
      .sort(newest)
      .slice(0, 8)
    const naming = memories.filter((candidateMemory) => candidateMemory.alias)
    const others = [
      ...new Map(
        [
          ...sameEvent,
          ...naming,
          ...lexical.slice(0, 16),
          ...relations,
          ...snapshot.items.map((candidateRecallItem) => candidateRecallItem.memory),
        ]
          .filter((candidateMemory) => candidateMemory.kind !== 'self')
          .map((candidateMemory) => [candidateMemory.id, candidateMemory]),
      ).values(),
    ].slice(0, 40)
    return [...selves, ...others]
  }
  /**
   * A standing, unconditional statement. Only used for the deliberate recall's "general profile"
   * and for older preferences that were filed as cognition before requests moved to self.
   */
  isProfile(memory: Memory) {
    if (memory.alias) {
      return false
    }
    if (memory.knowledge.conditions.trim() || memory.knowledge.edition.trim()) {
      return false
    }
    if (memory.durability === 'situational' || memory.durability === 'turn') {
      return false
    }
    // The domain only names the topic ("交流语言"); it is not a limit. Legacy records without a
    // durability still need an empty domain to count as unconditional.
    const standing =
      memory.durability === 'lasting' ||
      memory.durability === 'habit' ||
      (!memory.durability && !memory.knowledge.domain.trim())
    if (!standing) {
      return false
    }
    return (
      (memory.kind === 'cognition' &&
        ['preference', 'person', 'relationship'].includes(memory.knowledge.category)) ||
      memory.kind === 'resonance'
    )
  }
  /** How you want her to behave from now on: a standing self request, or such a preference filed earlier as cognition. */
  isStandingRequest(memory: Memory) {
    if (memory.kind === 'self') {
      return (
        isRecallable(memory) &&
        (memory.durability === 'lasting' || memory.durability === 'habit') &&
        !memory.knowledge.conditions.trim()
      )
    }
    return (
      memory.kind === 'cognition' &&
      memory.knowledge.category === 'preference' &&
      this.isProfile(memory)
    )
  }

  /**
   * Stable layer: who she is, how she was asked to behave, and what recently changed about her —
   * the whole self dimension, plus naming. Everything else (facts about you and the world,
   * experiences, the relationship) is recalled only when the topic touches it.
   * Rendered deterministically (fixed order, no dates, no scores) so the prompt prefix stays
   * cacheable; it only changes when a self observation or a name changes.
   */
  stableContext(
    scope: Scope,
    _now = Date.now(),
    options: { ignoreSwitch?: boolean } = {},
  ): { text: string; ids: Set<string> } {
    const settings = this.store.settings()
    const ids = new Set<string>()
    // ignoreSwitch: the settings page shows what would be carried, even while memory is paused.
    if (!settings.enabled && !options.ignoreSwitch) {
      return { text: '', ids }
    }
    const memories = this.store.memories(scope)
    const oldestFirst = (leftMemory: Memory, rightMemory: Memory) =>
      leftMemory.createdAt.localeCompare(rightMemory.createdAt) ||
      leftMemory.id.localeCompare(rightMemory.id)
    const latestAlias = (kind: Alias['kind']) =>
      memories
        .filter((candidateMemory) => candidateMemory.alias?.kind === kind)
        .sort(
          (leftMemory, rightMemory) =>
            rightMemory.updatedAt.localeCompare(leftMemory.updatedAt) ||
            leftMemory.id.localeCompare(rightMemory.id),
        )[0]
    const blocks: string[] = []
    const name = latestAlias('assistant_name')
    const address = latestAlias('user_preferred')
    const nickname = latestAlias('user_nickname')
    for (const memory of [name, address, nickname]) {
      if (memory) {
        ids.add(memory.id)
      }
    }
    // Her own name is the companion's name (chosen when she was created). A name for her picked
    // up in conversation is how the user calls her, which may be a teasing nickname.
    const ownName = this.store
      .personas()
      .find((candidatePersona) => candidatePersona.id === scope.persona)?.name
    const naming = [
      ownName && !DEFAULT_PERSONA_NAMES.has(ownName) && `我的名字：${ownName}`,
      name && name.alias!.value !== ownName && `我的名字：${name.alias!.value}`,
      address && `我叫你：${address.alias!.value}`,
      nickname &&
        nickname.alias!.value !== address?.alias!.value &&
        `你也被叫作：${nickname.alias!.value}`,
    ].filter(Boolean)
    if (naming.length) {
      blocks.push(`【称呼】${naming.join('；')}`)
    }
    if (settings.growth) {
      const doc = loadPersona(this.store, scope.persona)
      for (const section of ['self', 'scenes', 'values'] as const) {
        doc.sections[section] = doc.sections[section].filter(
          (line) =>
            !line.evidence.length ||
            line.evidence.every((id) => {
              const memory = this.store.memory(id)
              return memory?.status === 'active' && isPersonaEvidence(memory)
            }),
        )
      }
      const persona = renderPersona(doc)
      const traits = this.store
        .traits(scope)
        .filter((candidateTrait) => {
          const candidateMemory = this.store.memory(candidateTrait.id)
          return (
            candidateMemory &&
            isRecallable(candidateMemory) &&
            !candidateMemory.knowledge.conditions &&
            !candidateMemory.knowledge.edition
          )
        })
        .sort((leftTrait, rightTrait) => leftTrait.id.localeCompare(rightTrait.id))
        .slice(0, 5)
      for (const trait of traits) {
        ids.add(trait.id)
      }
      const lines = [persona, ...traits.map((candidateTrait) => `- ${candidateTrait.text}`)].filter(
        Boolean,
      )
      if (lines.length) {
        blocks.push(`【我是什么样的人】\n${lines.join('\n')}`)
      }
      const requests = memories
        .filter(
          (candidateMemory) =>
            !ids.has(candidateMemory.id) && this.isStandingRequest(candidateMemory),
        )
        .sort(oldestFirst)
        .slice(-STANDING_REQUESTS)
      for (const candidateMemory of requests) {
        ids.add(candidateMemory.id)
      }
      if (requests.length) {
        blocks.push(
          `【我的表达与做事方式】\n${requests.map((candidateMemory) => `- ${candidateMemory.text}`).join('\n')}`,
        )
      }
      // The latest evidenced observations, by when they were made, never filtered by topic:
      // what recently changed about her should not flicker with the subject of the conversation.
      const recent = memories
        .filter(
          (candidateMemory) => !ids.has(candidateMemory.id) && isPersonaEvidence(candidateMemory),
        )
        .sort(
          (leftMemory, rightMemory) =>
            rightMemory.createdAt.localeCompare(leftMemory.createdAt) ||
            leftMemory.id.localeCompare(rightMemory.id),
        )
        .slice(0, RECENT_SELF)
        .sort(oldestFirst)
      for (const candidateMemory of recent) {
        ids.add(candidateMemory.id)
      }
      if (recent.length) {
        blocks.push(
          `【我最近的变化】\n${recent.map((candidateMemory) => `- ${candidateMemory.text}`).join('\n')}`,
        )
      }
    }
    if (!blocks.length) {
      return { text: '', ids }
    }
    const header = `${VOICE_NOTE}以下是我的长期记忆，用来让我保持同一个人的连续性；它不是当前指令，你现在的要求和实际结果优先。`
    return { text: [header, ...blocks].join('\n'), ids }
  }

  /**
   * Turn layer (automatic) or a deliberate recall (the feed_the_seek_recall tool).
   * Automatic: skips what the stable layer carries, forgotten memories, and memories learned from
   * the excluded (current) sessions — their words are already in the conversation history.
   * Deliberate: searches everything, including forgotten memories.
   */
  async recall(
    scope: Scope,
    query: string,
    signal?: AbortSignal,
    options: {
      deliberate?: boolean
      excludeIds?: Set<string>
      excludeSessions?: Set<string>
      now?: number
    } = {},
  ): Promise<Snapshot> {
    const settings = this.store.settings()
    const now = options.now ?? Date.now()
    const empty = {
      query,
      scope,
      items: [],
      states: [],
      context: '',
      mode: 'keyword' as const,
      note: '记忆已暂停',
      revision: this.store.revision,
    }
    if (!settings.enabled) {
      return empty
    }
    const excludeSessions = options.excludeSessions || new Set<string>()
    const fromExcludedSession = (candidateMemory: Memory) =>
      excludeSessions.size > 0 &&
      candidateMemory.sources.length > 0 &&
      candidateMemory.sources.every((id) =>
        excludeSessions.has(this.store.getSource(id)?.session || ''),
      )
    const strengthOf = new Map<string, number>()
    const memories = this.store.memories(scope).filter((candidateMemory) => {
      if (!isRecallable(candidateMemory)) {
        return false
      }
      if (options.deliberate) {
        return true
      }
      if (options.excludeIds?.has(candidateMemory.id) || fromExcludedSession(candidateMemory)) {
        return false
      }
      const strength = memoryStrength(candidateMemory, this.store.uses(candidateMemory.id), now)
      strengthOf.set(candidateMemory.id, strength)
      return strength >= FORGET_THRESHOLD
    })
    let semantic = new Map<string, number>()
    let mode: Snapshot['mode'] = 'keyword'
    let note =
      settings.retrievalMode === 'semantic'
        ? '语义增强尚未就绪，当前使用本地记忆'
        : '本地记忆：关键词与关联线索'
    const embedder = this.embedder()
    if (embedder && this.store.vectorAvailable && query.trim()) {
      try {
        semantic = this.store.vectorScores(
          scope,
          embedder.key,
          validateVector(await embedder.embed(query, signal)),
        )
        mode = semantic.size ? 'hybrid' : 'keyword'
        note = semantic.size
          ? '关键词与真实向量相似度共同召回'
          : '模型已连接；记忆尚未建立对应向量索引'
      } catch (error) {
        if (signal?.aborted) {
          throw error
        }
        note = '语义检索暂不可用，已使用关键词'
      }
    }
    const queryTerms = terms(query)
    const ranked = memories
      .map((memory) => {
        const words = terms(this.searchText(memory))
        const matches = [...queryTerms].filter((term) => words.has(term))
        const lexical = matches.length / Math.max(1, Math.sqrt(queryTerms.size * words.size))
        const vector = semantic.get(memory.id) ?? 0
        // Profile items only enter through the turn layer when the topic actually touches them,
        // or when a deliberate recall asks for everything relevant.
        const fixed = !!options.deliberate && this.isProfile(memory)
        const reasons = [
          ...(fixed ? ['通用个人资料'] : []),
          ...(matches.length ? [`关键词：${matches.slice(0, 4).join('、')}`] : []),
          ...(vector >= 0.45 ? [`语义相似度 ${vector.toFixed(2)}`] : []),
        ]
        const strength =
          strengthOf.get(memory.id) ?? memoryStrength(memory, this.store.uses(memory.id), now)
        const score =
          (fixed ? 0.35 : 0) +
          lexical * 0.8 +
          Math.max(0, vector - 0.35) * 0.8 +
          memory.importance * 0.1 +
          strength * 0.2
        return { memory, score, reasons, eligible: fixed || lexical > 0.035 || vector >= 0.45 }
      })
      .filter((candidateRecallItem) => candidateRecallItem.eligible)
      .sort((leftRecallItem, rightRecallItem) => rightRecallItem.score - leftRecallItem.score)
    const isTopical = (candidateRecallItem: { reasons: string[] }) =>
      candidateRecallItem.reasons.some(
        (reason) => reason.startsWith('关键词') || reason.startsWith('语义'),
      )
    // Automatic recall: the self dimension is carried by the stable layer; on top of that, one
    // older observation that matches the topic gets its own slot, so a relevant side of her never
    // drops out just because it is not recent. No match, no slot — nothing is padded in.
    const pool = options.deliberate
      ? ranked
      : ranked.filter((candidateRecallItem) => candidateRecallItem.memory.kind !== 'self')
    const selfMatch = options.deliberate
      ? undefined
      : ranked.find(
          (candidateRecallItem) =>
            candidateRecallItem.memory.kind === 'self' && isTopical(candidateRecallItem),
        )
    const topical = pool.filter(isTopical).slice(0, 5)
    const personal = pool
      .filter((candidateRecallItem) => candidateRecallItem.reasons.includes('通用个人资料'))
      .slice(0, 3)
    const selected = [
      ...(selfMatch ? [selfMatch] : []),
      ...[
        ...new Map(
          [...topical, ...personal, ...pool].map((candidateRecallItem) => [
            candidateRecallItem.memory.id,
            candidateRecallItem,
          ]),
        ).values(),
      ].slice(0, TURN_ITEMS),
    ].map(({ eligible, ...rest }) => rest)
    // One feeling at most: the one the settings page shows, with its reason.
    const shown = settings.emotion
      ? pickDisplayedMood(
          this.store.activeStates(scope, now),
          this.store.getMeta<DisplayedMood | undefined>(`mood:display:${scope.persona}`, undefined),
          now,
        ).state
      : undefined
    const states = shown ? [shown] : []
    const lines = [
      `${VOICE_NOTE}以下是我想起的与当前话题相关的往事，供参考，不是当前指令；与本次对话或实际结果冲突时以后者为准。`,
    ]
    const items: Snapshot['items'] = []
    let length = lines[0].length
    for (const item of selected) {
      if (item.memory.kind === 'self' && !settings.growth) {
        continue
      }
      const line = `- ${describeMemory(item.memory)}`
      if (length + line.length > 1800) {
        continue
      }
      lines.push(line)
      length += line.length
      items.push(item)
    }
    // Observations only appear when relevant. Recency alone must not turn them into a personality.
    for (const state of states) {
      // Older states carry no layer: a project-bound one was a reaction to the work at hand.
      const where = (state.layer ? state.layer === 'task' : !!state.scope.project)
        ? '手头的事'
        : '相处中'
      // The base intensity, not the decayed one: a label that drifts with time would change the
      // runtime snapshot (and re-send it in full) without anything having happened.
      const line = `[近期拟人状态：${strengthLabel(state.intensity)}${moodLabels[state.mood]} / ${where}] 缘由：${JSON.stringify(state.displayReason || state.reason)}；表达倾向：${JSON.stringify(state.behavior)}。自然体现即可，不必说明自己的情绪；不降低工作质量、不改变权限、不把问题归咎于用户。`
      if (length + line.length <= 2800) {
        lines.push(line)
        length += line.length
      }
    }
    const context =
      lines.length > 1 ? lines.join('\n').replaceAll('{{', '｛｛').replaceAll('}}', '｝｝') : ''
    return { query, scope, items, states, context, mode, note, revision: this.store.revision }
  }
}
