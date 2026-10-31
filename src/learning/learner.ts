import { Engine } from '../companion/index.js'
import { isLowInformation, type Memory, type Scope } from '../memory/index.js'
import {
  consolidateSelf,
  isPersonaEvidence,
  notePersonaObservation,
  synthesizePersona,
} from '../persona/index.js'
import { redactJsonText, safeSource } from '../privacy/index.js'
import type { Generator, LearningJob } from './model.js'
import { LEARNING_PROMPT } from './prompts/organizer.js'
import { generateProposal } from './proposal.js'
export { LEARNING_PROMPT } from './prompts/organizer.js'

/** Maps "c3" / 3 / "3" (or a known uuid) to a candidate id. Anything else is left for apply() to reject. */
export function resolveCandidateRef(value: unknown, ids: string[]): unknown {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return ids[value] ?? value
  }
  if (typeof value !== 'string') {
    return value
  }
  const text = value.trim()
  const match = /^c?(\d+)$/i.exec(text)
  if (match) {
    return ids[Number(match[1])] ?? text
  }
  return text
}

/** Each model call gets its own budget; reasoning models can need well over a minute. */
export const LEARNING_CALL_TIMEOUT_MS = 180_000
const LEARNING_JOB_TIMEOUT_MS = 420_000
/** A failed job is not retried in the same pass; the next pass comes with new work or after this delay. */
export const LEARNING_RETRY_DELAY_MS = 60_000
export class Learner {
  running = false
  controller = new AbortController()
  private retryTimer: ReturnType<typeof setTimeout> | undefined
  constructor(
    public engine: Engine,
    public generate?: (job: LearningJob) => Generator | undefined,
  ) {
    engine.store.jobs.recover()
  }
  enqueue(job: LearningJob) {
    const settings = this.engine.store.settings()
    if (!settings.enabled || !settings.learning) {
      return
    }
    const human = [...(job.context || []), ...job.sources].filter(
      (candidateSource) => candidateSource.role === 'user',
    )
    if (
      human.length &&
      human.every((candidateSource) => isLowInformation(candidateSource.text)) &&
      !job.sources.some((candidateSource) => candidateSource.role === 'tool')
    ) {
      return
    }
    job = { ...job, sources: job.sources.map(safeSource), context: job.context?.map(safeSource) }
    for (const source of [...job.sources, ...(job.context || [])]) {
      this.engine.store.source(source)
    }
    this.engine.store.jobs.enqueue(job.id, JSON.stringify(job))
    void this.drain()
  }
  async drain() {
    if (this.running || this.controller.signal.aborted) {
      return
    }
    this.running = true
    try {
      const skipped = new Set<string>()
      while (!this.controller.signal.aborted) {
        if (!this.engine.store.settings().enabled || !this.engine.store.settings().learning) {
          break
        }
        const row = this.engine.store.jobs.pending().find((row) => !skipped.has(String(row.id)))
        if (!row) {
          break
        }
        const stored = JSON.parse(String(row.payload)) as LearningJob
        const job = {
          ...stored,
          sources: stored.sources.map(safeSource),
          context: stored.context?.map(safeSource),
        }
        const generator = this.generate?.(job)
        if (!generator) {
          // Without the conversation's model the job can never run; waiting would only keep the
          // page saying "organizing" forever.
          this.engine.store.jobs.giveUp(job.id, '这段对话没有可用的模型信息，无法整理')
          continue
        }
        if (!this.engine.store.sessionEnabled(job.sources[0]?.session || '')) {
          skipped.add(job.id)
          continue
        }
        this.engine.store.jobs.start(job.id)
        try {
          const signal = AbortSignal.any([
            this.controller.signal,
            AbortSignal.timeout(LEARNING_JOB_TIMEOUT_MS),
          ])
          const context = job.context || []
          const turnEvents = [...context, ...job.sources]
          const candidates = await this.engine.candidates(
            job.scope,
            turnEvents
              .filter((candidateSource) => candidateSource.role === 'user')
              .map((candidateSource) => candidateSource.text)
              .join('\n'),
            signal,
            { sessions: turnEvents.map((candidateSource) => candidateSource.session) },
          )
          const sources = [...turnEvents]
          for (const candidateMemory of candidates) {
            for (const id of candidateMemory.sources) {
              const candidateSource = this.engine.store.getSource(id)
              if (
                candidateSource &&
                !sources.some((candidateSource) => candidateSource.id === id)
              ) {
                sources.push(candidateSource)
              }
            }
          }
          const freshIds = new Set(job.sources.map((source) => source.id))
          const contextIds = new Set(context.map((source) => source.id))
          const historicalEvidence = sources.filter(
            (source) => !freshIds.has(source.id) && !contextIds.has(source.id),
          )
          // Candidates are shown by short reference (c0, c1 ...) instead of uuid: copying a uuid is
          // error-prone and costs tokens. References are mapped back before anything is applied.
          const candidateView = candidates.map((candidateMemory, index) => ({
            ref: `c${index}`,
            kind: candidateMemory.kind,
            text: candidateMemory.text,
            version: candidateMemory.version,
            knowledge: candidateMemory.knowledge,
            tags: candidateMemory.tags,
            evidence: candidateMemory.evidence,
            retention: candidateMemory.retention,
            importance: Math.round(candidateMemory.importance * 10),
            confidence: candidateMemory.confidence,
            ...(candidateMemory.durability ? { durability: candidateMemory.durability } : {}),
            ...(candidateMemory.selfKind ? { selfKind: candidateMemory.selfKind } : {}),
            ...(candidateMemory.alias ? { alias: candidateMemory.alias } : {}),
          }))
          // Active candidates alone lose the fact that a standing rule was withdrawn. Keep a
          // bounded transition log for the organizer only; never inject it into the chat profile.
          const recentSelfChanges = this.engine.store
            .history(job.scope)
            .filter(
              (entry) =>
                entry.before?.kind === 'self' &&
                (entry.action === 'DELETE' ||
                  (entry.action === 'UPDATE' && entry.before.text !== entry.after?.text)),
            )
            .slice(0, 8)
            .reverse()
            .map((entry) => ({
              before: entry.before!.text,
              after: entry.after?.status === 'active' ? entry.after.text : null,
              reason: entry.reason,
            }))
          const safeGenerator: Generator = (system, user, inner) =>
            generator(system, redactJsonText(user), inner)
          const generated = await generateProposal(
            safeGenerator,
            LEARNING_PROMPT,
            {
              workspace: job.workspace || '',
              events: job.sources,
              earlierInTurn: context,
              historicalEvidence,
              candidates: candidateView,
              recentSelfChanges,
              growthEnabled: this.engine.store.settings().growth,
            },
            signal,
            LEARNING_CALL_TIMEOUT_MS,
          )
          const parsed = generated.proposal
          const resolveRef = (value: unknown) =>
            resolveCandidateRef(
              value,
              candidates.map((candidateMemory) => candidateMemory.id),
            )
          const kept = parsed.operations
            .map((operation, index) => ({ operation, index }))
            .filter(
              ({ operation }) =>
                operation.action === 'NONE' || operation.sources.some((id) => freshIds.has(id)),
            )
          const rawOperations = generated.raw.operations || []
          const operations = kept.map(({ index }) => {
            const raw = { ...rawOperations[index] }
            if (raw.target !== undefined) {
              raw.target = resolveRef(raw.target)
            }
            return raw
          })
          const rawState = parsed.state?.sources.some((id) => freshIds.has(id))
            ? { ...generated.raw.state }
            : null
          if (
            rawState &&
            typeof rawState.target === 'string' &&
            !rawState.target.startsWith('op:')
          ) {
            rawState.target = resolveRef(rawState.target)
          }
          const state = rawState
          if (signal.aborted) {
            throw new Error('整理已取消')
          }
          if (!this.engine.store.sessionEnabled(job.sources[0]?.session || '')) {
            throw new Error('会话已关闭记忆')
          }
          // Operation commit and job settlement are atomic: restarting cannot replay an applied batch.
          let changed: Memory[] = []
          this.engine.store.transaction(() => {
            if (generated.repaired) {
              this.engine.store.audit('NONE', '记忆整理格式校正成功；未放宽来源或结构校验')
            }
            for (const operation of parsed.operations.filter(
              (_operation, index) => !kept.some((entry) => entry.index === index),
            )) {
              this.engine.store.audit(
                'NONE',
                '忽略仅引用历史资料、没有本轮新证据的记忆变更：' + operation.reason,
              )
            }
            changed = this.engine.apply(
              { operations, state },
              job.scope,
              candidates.map((candidateMemory) => candidateMemory.id),
              sources.map((candidateSource) => candidateSource.id),
              { strict: true, retentionPolicy: true },
            )
            this.engine.store.jobs.complete(job.id)
          })
          if (this.engine.embedder()) {
            try {
              await this.engine.index(job.scope, signal)
            } catch {
              /* Retrieval falls back; indexing can be retried separately. */
            }
          }
          await this.maintain(job.scope, changed, safeGenerator, signal)
          this.engine.store.releaseLearningPayload(job.id)
          this.engine.store.pruneAudit()
        } catch (error) {
          // Shutting down is not a failure: the job stays running and is recovered on the next start.
          if (this.controller.signal.aborted) {
            break
          }
          let message = error instanceof Error ? error.message : String(error)
          if (error instanceof Error && error.name === 'TimeoutError') {
            message = `整理超时：单次模型调用超过 ${LEARNING_CALL_TIMEOUT_MS / 1000} 秒或整体超过 ${LEARNING_JOB_TIMEOUT_MS / 1000} 秒`
          }
          this.engine.store.jobs.fail(job.id, message)
          skipped.add(job.id)
        }
      }
    } finally {
      this.running = false
    }
    // Failed jobs with attempts left wait for the next pass instead of retrying back to back.
    if (!this.controller.signal.aborted && this.engine.store.jobs.pending().length > 0) {
      this.scheduleRetry()
    }
  }
  private scheduleRetry() {
    clearTimeout(this.retryTimer)
    this.retryTimer = setTimeout(() => void this.drain(), LEARNING_RETRY_DELAY_MS)
    this.retryTimer.unref?.()
  }
  /**
   * Low-frequency upkeep after a committed job: persona synthesis when enough new evidence has
   * accumulated. Failures here never fail the job; the pending count stays for the next run.
   */
  async maintain(scope: Scope, changed: Memory[], generator: Generator, signal: AbortSignal) {
    if (!this.engine.store.settings().growth) {
      return
    }
    const evidence = changed.filter(
      (memory) => memory.status === 'active' && memory.version === 1 && isPersonaEvidence(memory),
    ).length
    if (evidence) {
      notePersonaObservation(this.engine.store, scope.persona, evidence)
    }
    try {
      await consolidateSelf(
        this.engine.store,
        scope,
        (system, user, inner) =>
          generator(
            system,
            user,
            AbortSignal.any([inner, AbortSignal.timeout(LEARNING_CALL_TIMEOUT_MS)]),
          ),
        signal,
      )
    } catch (error) {
      if (signal.aborted) {
        return
      }
      this.engine.store.audit(
        'NONE',
        '自我观察精炼未完成，将在下次整理后重试：' + String(error).slice(0, 200),
      )
    }
    try {
      await synthesizePersona(
        this.engine.store,
        scope,
        (system, user, inner) =>
          generator(
            system,
            user,
            AbortSignal.any([inner, AbortSignal.timeout(LEARNING_CALL_TIMEOUT_MS)]),
          ),
        signal,
      )
    } catch (error) {
      if (signal.aborted) {
        return
      }
      this.engine.store.audit(
        'NONE',
        '人格合成未完成，将在下次整理后重试：' + String(error).slice(0, 200),
      )
    }
  }
  // A manual retry is an explicit user request, so it starts a fresh attempt budget.
  // Without this, jobs that failed three times could never run again while the UI offered "retry".
  retry(scope: Scope) {
    this.engine.store.jobs.retry(scope)
    void this.drain()
  }
  async close() {
    clearTimeout(this.retryTimer)
    this.controller.abort()
    while (this.running) {
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
  }
}
