import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import * as sqliteVec from 'sqlite-vec'
import { type State, type StateInput } from '../emotion/index.js'
import {
  DEFAULT_SCOPE,
  Knowledge,
  type Memory,
  memoryStrength,
  sameOwner,
  type Scope,
  type Source,
  strengthCap,
  visible,
} from '../memory/index.js'
import { type Persona, type Trait } from '../persona/index.js'
import { safeSource } from '../privacy/index.js'
import { Settings } from '../settings/index.js'
import { LearningJobs } from './jobs.js'

export interface LearningUsage {
  calls: number
  failedCalls: number
  inputTokens: number
  cacheReadTokens: number
  outputTokens: number
  since: string
}

/** How long "nothing to change" judgments stay in the audit table. */
export const AUDIT_JUDGMENT_DAYS = 30

export class Store {
  db: DatabaseSync
  readonly jobs: LearningJobs
  vectorAvailable = false
  vectorError = ''
  private transactionDepth = 0
  constructor(public path: string) {
    if (path !== ':memory:') {
      mkdirSync(dirname(path), { recursive: true })
    }
    this.db = new DatabaseSync(path, { allowExtension: true })
    this.jobs = new LearningJobs(this.db)
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT OR IGNORE INTO meta VALUES ('revision','0');
      CREATE TABLE IF NOT EXISTS memories(id TEXT PRIMARY KEY, document TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sources(id TEXT PRIMARY KEY, document TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS states(id TEXT PRIMARY KEY, document TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS vectors(memory_id TEXT PRIMARY KEY REFERENCES memories(id) ON DELETE CASCADE, version INTEGER, model TEXT, dimensions INTEGER, embedding BLOB);
      CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY, at TEXT, action TEXT, memory_id TEXT, reason TEXT, before_json TEXT, after_json TEXT);
      CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, payload TEXT, status TEXT, attempts INTEGER DEFAULT 0, error TEXT DEFAULT '', updated_at TEXT);
      CREATE TABLE IF NOT EXISTS traits(id TEXT PRIMARY KEY, document TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS recall_uses(memory_id TEXT, event_id TEXT, at TEXT, PRIMARY KEY(memory_id,event_id));
    `)
    this.db.exec('CREATE INDEX IF NOT EXISTS audit_action_at ON audit(action, at)')
    this.migrate()
    this.retireGrowthSwitch()
    this.pruneAudit()
    try {
      sqliteVec.load(this.db)
      this.vectorAvailable = true
    } catch (error) {
      this.vectorError = String(error)
    }
  }
  close() {
    this.db.close()
  }
  private migrate() {
    if (this.getMeta('schemaVersion', 1) >= 2) {
      return
    }
    this.transaction(() => {
      const mapping = {
        habit: 'cognition',
        episode: 'experience',
        goal: 'experience',
        growth: 'self',
      } as const
      for (const row of this.db.prepare('SELECT document FROM memories').all()) {
        const old = JSON.parse(String(row.document))
        const kind = mapping[old.kind as keyof typeof mapping] || old.kind
        let category = 'fact'
        if (old.kind === 'habit') {
          category = 'preference'
        } else if (kind === 'self') {
          category = 'tendency'
        } else if (kind === 'experience') {
          category = 'event'
        }
        const memory: Memory = {
          ...old,
          kind,
          knowledge: Knowledge.parse({ category }),
          confidence: old.evidence === 'explicit' ? 0.8 : 0.4,
        }
        this.put(memory)
        this.audit('MIGRATE', '迁移到四维记忆；旧成长保留为观察，不自动形成稳定倾向', old, memory)
      }
      // Pending v1 proposals use a different vocabulary. Retain payloads for inspection.
      this.db
        .prepare(
          "UPDATE jobs SET status='obsolete',error='旧版本整理任务已保留，请由后续对话重新学习' WHERE status IN ('pending','running','failed')",
        )
        .run()
      this.setMeta('schemaVersion', 2)
    })
  }
  /**
   * Growth is no longer a user-facing switch; it follows automatic learning. An installation
   * that had turned it off would otherwise stay off with no way to see or change it.
   */
  private retireGrowthSwitch() {
    if (this.getMeta('growthSwitchRetired', false)) {
      return
    }
    const saved = this.getMeta<Record<string, unknown> | undefined>('settings', undefined)
    if (saved && saved.growth === false) {
      this.setMeta('settings', { ...saved, growth: true })
    }
    this.setMeta('growthSwitchRetired', true)
  }
  personas(): Persona[] {
    return this.getMeta('personas', [
      { id: DEFAULT_SCOPE.persona, name: '初始伙伴', createdAt: new Date(0).toISOString() },
    ])
  }
  activePersona() {
    return this.getMeta('activePersona', DEFAULT_SCOPE.persona)
  }
  createPersona(name: string) {
    const persona = { id: randomUUID(), name, createdAt: new Date().toISOString() }
    this.transaction(() => {
      this.setMeta('personas', [...this.personas(), persona])
      this.setMeta('activePersona', persona.id)
      this.bump()
    })
    return persona
  }
  renamePersona(id: string, name: string) {
    name = name.trim()
    if (!name || name.length > 40) {
      throw new Error('名字需要 1–40 个字符')
    }
    const personas = this.personas()
    const persona = personas.find((entry) => entry.id === id)
    if (!persona) {
      throw new Error('伙伴不存在')
    }
    const renamed = { ...persona, name }
    this.transaction(() => {
      this.setMeta(
        'personas',
        personas.map((entry) => (entry.id === id ? renamed : entry)),
      )
      for (const memory of this.memories({ ...DEFAULT_SCOPE, persona: id })) {
        if (memory.alias?.kind === 'assistant_name' && memory.alias.value !== name) {
          const retired: Memory = {
            ...memory,
            status: 'inactive',
            version: memory.version + 1,
            updatedAt: new Date().toISOString(),
          }
          this.put(retired)
          this.audit('DELETE', '伙伴已手动改名，旧名字不再作为当前身份', memory, retired)
        }
      }
      this.bump()
    })
    return renamed
  }
  bindSession(session: string) {
    const key = `persona:session:${session}`
    const bound = this.getMeta(key, '')
    if (bound) {
      return bound
    } // Read-only after the first binding; the settings page polls this.
    const persona = this.activePersona()
    this.setMeta(key, persona)
    return persona
  }
  traits(scope: Scope, allProjects = false): Trait[] {
    return this.db
      .prepare('SELECT document FROM traits')
      .all()
      .map((row) => JSON.parse(String(row.document)) as Trait)
      .filter((candidateTrait) =>
        allProjects ? sameOwner(candidateTrait.scope, scope) : visible(candidateTrait.scope, scope),
      )
  }
  trait(id: string): Trait | undefined {
    const row = this.db.prepare('SELECT document FROM traits WHERE id=?').get(id)
    return row ? JSON.parse(String(row.document)) : undefined
  }
  putTrait(memory: Memory, formed = true) {
    const trait: Trait = {
      id: memory.id,
      text: memory.text,
      scope: memory.scope,
      sources: memory.sources,
      version: memory.version,
      updatedAt: memory.updatedAt,
    }
    this.db
      .prepare('INSERT OR REPLACE INTO traits VALUES (?,?)')
      .run(trait.id, JSON.stringify(trait))
    this.bump()
    if (formed) {
      this.audit('CONSOLIDATE', '独立反馈跨越至少 72 小时，形成有来源的稳定倾向', undefined, memory)
    }
  }
  use(memories: Memory[], event: string) {
    for (const memory of memories) {
      this.db
        .prepare('INSERT OR IGNORE INTO recall_uses VALUES (?,?,?)')
        .run(memory.id, event, new Date().toISOString())
    }
  }
  /** Timestamps of the most recent real uses (deliberate recall or topical injection). */
  uses(memoryId: string, limit = 20): string[] {
    return this.db
      .prepare('SELECT at FROM recall_uses WHERE memory_id=? ORDER BY at DESC LIMIT ?')
      .all(memoryId, limit)
      .map((row) => String(row.at))
  }
  strength(memory: Memory, now = Date.now()) {
    return memoryStrength(memory, this.uses(memory.id), now)
  }
  /** 0–1 freshness relative to the memory's own ceiling; shown as the activity meter. */
  activation(memory: Memory, now = Date.now()) {
    const cap = strengthCap(memory)
    return cap ? this.strength(memory, now) / cap : 0
  }
  transaction<T>(runTransaction: () => T): T {
    const level = this.transactionDepth++
    const savepoint = `nested_${level}`
    this.db.exec(level ? `SAVEPOINT ${savepoint}` : 'BEGIN IMMEDIATE')
    try {
      const result = runTransaction()
      this.db.exec(level ? `RELEASE ${savepoint}` : 'COMMIT')
      return result
    } catch (error) {
      this.db.exec(level ? `ROLLBACK TO ${savepoint}; RELEASE ${savepoint}` : 'ROLLBACK')
      throw error
    } finally {
      this.transactionDepth--
    }
  }
  get revision() {
    return Number(this.getMeta('revision', '0'))
  }
  bump() {
    this.setMeta('revision', String(this.revision + 1))
  }
  getMeta<T>(key: string, fallback: T): T {
    const row = this.db.prepare('SELECT value FROM meta WHERE key=?').get(key)
    return row ? (JSON.parse(String(row.value)) as T) : fallback
  }
  setMeta(key: string, value: unknown) {
    this.db.prepare('INSERT OR REPLACE INTO meta VALUES (?,?)').run(key, JSON.stringify(value))
  }
  settings() {
    const saved = this.getMeta<Record<string, unknown>>('settings', {})
    const retrievalMode =
      saved.retrievalMode ?? (saved.embeddingUrl && saved.embeddingModel ? 'semantic' : 'local')
    return Settings.parse({ ...saved, retrievalMode })
  }
  saveSettings(value: unknown) {
    const parsed = Settings.parse(value)
    this.setMeta('settings', parsed)
    this.bump()
    return parsed
  }
  /** Memory applies to every conversation; there is no per-session switch (older per-session flags are ignored). */
  sessionEnabled(_id: string) {
    return this.settings().enabled
  }
  source(source: Source) {
    source = safeSource(source)
    const old = this.getSource(source.id)
    if (old && JSON.stringify(old) !== JSON.stringify(source)) {
      throw new Error('来源编号已存在，不能覆盖原始证据')
    }
    this.db
      .prepare('INSERT OR IGNORE INTO sources VALUES (?,?)')
      .run(source.id, JSON.stringify(source))
  }
  getSource(id: string): Source | undefined {
    const row = this.db.prepare('SELECT document FROM sources WHERE id=?').get(id)
    return row ? safeSource(JSON.parse(String(row.document))) : undefined
  }
  learningUsage(scope: Scope): LearningUsage {
    return this.getMeta(`learning:usage:${scope.user}:${scope.persona}`, {
      calls: 0,
      failedCalls: 0,
      inputTokens: 0,
      cacheReadTokens: 0,
      outputTokens: 0,
      since: '',
    })
  }
  recordLearningUsage(scope: Scope, usage: Partial<LearningUsage>, completed: boolean) {
    this.transaction(() => {
      const previous = this.learningUsage(scope)
      const amount = (key: 'inputTokens' | 'cacheReadTokens' | 'outputTokens') =>
        Number.isFinite(usage[key]) ? Math.max(0, usage[key]!) : 0
      this.setMeta(`learning:usage:${scope.user}:${scope.persona}`, {
        calls: previous.calls + 1,
        failedCalls: previous.failedCalls + (completed ? 0 : 1),
        inputTokens: previous.inputTokens + amount('inputTokens'),
        cacheReadTokens: previous.cacheReadTokens + amount('cacheReadTokens'),
        outputTokens: previous.outputTokens + amount('outputTokens'),
        since: previous.since || new Date().toISOString(),
      })
      this.bump()
    })
  }
  /** Completed jobs retain status/scope, not another full copy of the conversation. */
  releaseLearningPayload(id: string) {
    this.transaction(() => {
      const row = this.db.prepare("SELECT payload FROM jobs WHERE id=? AND status='done'").get(id)
      if (!row) {
        return
      }
      const payload = JSON.parse(String(row.payload))
      const sourceIds: string[] = [...(payload.sources || []), ...(payload.context || [])].map(
        (candidateSource: Source) => candidateSource.id,
      )
      this.db
        .prepare('UPDATE jobs SET payload=? WHERE id=?')
        .run(JSON.stringify({ ...payload, sources: [], context: [] }), id)
      const needed = new Set<string>()
      for (const table of ['memories', 'states', 'traits']) {
        for (const entry of this.db.prepare(`SELECT document FROM ${table}`).all()) {
          for (const source of JSON.parse(String(entry.document)).sources || []) {
            needed.add(source)
          }
        }
      }
      // History can reference earlier source sets, including replaced/merged observations.
      for (const entry of this.db.prepare('SELECT before_json,after_json FROM audit').all()) {
        for (const doc of [entry.before_json, entry.after_json]) {
          if (doc) {
            for (const source of JSON.parse(String(doc)).sources || []) {
              needed.add(source)
            }
          }
        }
      }
      for (const entry of this.db
        .prepare("SELECT payload FROM jobs WHERE status IN ('pending','running','failed')")
        .all()) {
        const waiting = JSON.parse(String(entry.payload))
        for (const source of [...(waiting.sources || []), ...(waiting.context || [])]) {
          needed.add(source.id)
        }
      }
      for (const source of sourceIds) {
        if (!needed.has(source)) {
          this.db.prepare('DELETE FROM sources WHERE id=?').run(source)
        }
      }
    })
  }
  memories(scope?: Scope, all = false): Memory[] {
    return this.db
      .prepare('SELECT document FROM memories')
      .all()
      .map((row) => JSON.parse(String(row.document)) as Memory)
      .filter(
        (candidateMemory) =>
          (all || candidateMemory.status === 'active') &&
          (!scope || visible(candidateMemory.scope, scope)),
      )
  }
  memory(id: string): Memory | undefined {
    const row = this.db.prepare('SELECT document FROM memories WHERE id=?').get(id)
    return row ? JSON.parse(String(row.document)) : undefined
  }
  put(candidateMemory: Memory) {
    this.db
      .prepare('INSERT OR REPLACE INTO memories VALUES (?,?)')
      .run(candidateMemory.id, JSON.stringify(candidateMemory))
    this.db.prepare('DELETE FROM vectors WHERE memory_id=?').run(candidateMemory.id)
    this.db.prepare('DELETE FROM traits WHERE id=?').run(candidateMemory.id)
    this.bump()
  }
  /**
   * Every organizer pass leaves "nothing to change" judgments (NONE, OBSERVE). They explain recent
   * decisions but are never shown as changes, so older ones are dropped instead of growing forever.
   * Real changes (ADD, UPDATE, DELETE, MERGE, ...) are kept.
   */
  pruneAudit(now = Date.now()) {
    const cutoff = new Date(now - AUDIT_JUDGMENT_DAYS * 86_400_000).toISOString()
    return Number(
      this.db.prepare("DELETE FROM audit WHERE action IN ('NONE','OBSERVE') AND at < ?").run(cutoff)
        .changes,
    )
  }
  audit(action: string, reason: string, before?: Memory, after?: Memory) {
    this.db
      .prepare('INSERT INTO audit VALUES (?,?,?,?,?,?,?)')
      .run(
        randomUUID(),
        new Date().toISOString(),
        action,
        after?.id || before?.id || '',
        reason,
        before ? JSON.stringify(before) : null,
        after ? JSON.stringify(after) : null,
      )
  }
  /**
   * Audit entries of one owner, newest first. changesOnly leaves out decisions that changed
   * nothing (NONE, OBSERVE). Filtering and limiting run in SQL, so the settings page does not
   * parse the whole, ever-growing audit table on every refresh.
   */
  history(
    scope?: Scope,
    options: {
      limit?: number
      offset?: number
      changesOnly?: boolean
      query?: string
      action?: string
      kind?: string
      through?: number
    } = {},
  ) {
    const { limit = 100 } = options
    const { where, params } = this.historyFilter(scope, options)
    const bounded = Number.isFinite(limit)
      ? ` LIMIT ${Math.max(0, Math.floor(limit))} OFFSET ${Math.max(0, Math.floor(options.offset || 0))}`
      : ''
    return this.db
      .prepare(`SELECT * FROM audit${where} ORDER BY at DESC, rowid DESC${bounded}`)
      .all(...params)
      .map((row) => ({
        ...row,
        action: String(row.action),
        at: String(row.at),
        reason: String(row.reason),
        before: row.before_json ? (JSON.parse(String(row.before_json)) as Memory) : null,
        after: row.after_json ? (JSON.parse(String(row.after_json)) as Memory) : null,
        before_json: undefined,
        after_json: undefined,
      }))
  }
  historyCount(
    scope?: Scope,
    options: {
      changesOnly?: boolean
      query?: string
      action?: string
      kind?: string
      through?: number
    } = {},
  ) {
    const { where, params } = this.historyFilter(scope, options)
    return Number(this.db.prepare(`SELECT COUNT(*) AS n FROM audit${where}`).get(...params)?.n ?? 0)
  }
  historyRevision() {
    return Number(this.db.prepare('SELECT coalesce(max(rowid),0) n FROM audit').get()!.n)
  }
  private historyFilter(
    scope?: Scope,
    options: {
      changesOnly?: boolean
      query?: string
      action?: string
      kind?: string
      through?: number
    } = {},
  ) {
    const clauses: string[] = []
    const params: (string | number)[] = []
    if (options.changesOnly) {
      clauses.push("action NOT IN ('NONE','OBSERVE')")
    }
    if (options.through !== undefined) {
      clauses.push('rowid <= ?')
      params.push(options.through)
    }
    if (options.action) {
      clauses.push('action = ?')
      params.push(options.action)
    }
    if (options.kind) {
      clauses.push("json_extract(coalesce(after_json,before_json),'$.kind') = ?")
      params.push(options.kind)
    }
    if (options.query?.trim()) {
      clauses.push(
        "instr(lower(coalesce(json_extract(before_json,'$.text'),'') || ' ' || coalesce(json_extract(after_json,'$.text'),'') || ' ' || reason), lower(?)) > 0",
      )
      params.push(options.query.trim())
    }
    if (scope) {
      // Entries without a memory (plain NONE notes) belong to no owner, as before.
      clauses.push(
        "json_extract(coalesce(after_json,before_json),'$.scope.user')=? AND json_extract(coalesce(after_json,before_json),'$.scope.persona')=?",
      )
      params.push(scope.user, scope.persona)
    }
    return { where: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '', params }
  }
  /**
   * States are keyed by the event they react to (target memory) so rewording the topic does
   * not create a second state for the same incident. Retelling never extends a state's life.
   */
  setState(scope: Scope, input: StateInput, now = Date.now()) {
    const project = ''
    const stateScope = { ...scope, project }
    const id = JSON.stringify([
      scope.user,
      scope.persona,
      project,
      input.target ? `memory:${input.target}` : input.topic,
    ])
    const oldRow = this.db.prepare('SELECT document FROM states WHERE id=?').get(id)
    const old: State | undefined = oldRow ? JSON.parse(String(oldRow.document)) : undefined
    if (old && input.sources.every((source) => old.sources.includes(source))) {
      return
    }
    const at = new Date(now).toISOString()
    const sources = [...new Set([...(old?.sources || []), ...input.sources])].slice(-12)
    const ongoing = old && !old.resolvedAt && old.mood === input.mood
    let state: Omit<State, 'effectiveIntensity'>
    if (ongoing && input.intensity <= old.intensity) {
      // Same feeling about the same thing, not stronger than before: keep its clock and strength.
      state = { ...old, sources }
    } else {
      // A stronger recurrence or a different feeling takes effect immediately.
      const { effectiveIntensity: _drop, resolvedAt: _resolved, ...previous } = (old || {}) as State
      state = {
        ...(ongoing ? previous : {}),
        ...input,
        scope: stateScope,
        id,
        sources,
        updatedAt: at,
        onsetAt: ongoing ? old.onsetAt || old.updatedAt : at,
      }
    }
    this.db.prepare('INSERT OR REPLACE INTO states VALUES (?,?)').run(id, JSON.stringify(state))
    this.bump()
  }
  /** The event behind these states is no longer valid, so the feeling about it ends now. */
  resolveStates(memoryId: string, now = Date.now()) {
    for (const row of this.db.prepare('SELECT document FROM states').all()) {
      const state = JSON.parse(String(row.document)) as State
      if (state.target === memoryId && !state.resolvedAt) {
        this.db
          .prepare('UPDATE states SET document=? WHERE id=?')
          .run(JSON.stringify({ ...state, resolvedAt: new Date(now).toISOString() }), state.id)
        this.bump()
      }
    }
  }
  /** Every unresolved state above the floor, strongest first. */
  activeStates(scope: Scope, now = Date.now(), allProjects = false): State[] {
    return this.db
      .prepare('SELECT document FROM states')
      .all()
      .map((row) => JSON.parse(String(row.document)) as State)
      .filter(
        (candidateState) =>
          !candidateState.resolvedAt &&
          (allProjects
            ? sameOwner(candidateState.scope, scope)
            : visible(candidateState.scope, scope)),
      )
      .map((candidateState) => ({
        ...candidateState,
        effectiveIntensity:
          candidateState.intensity *
          Math.pow(0.5, Math.max(0, now - Date.parse(candidateState.updatedAt)) / 86400000),
      }))
      .filter((candidateState) => candidateState.effectiveIntensity >= 0.06)
      .sort((leftState, rightState) => rightState.effectiveIntensity - leftState.effectiveIntensity)
  }
  states(scope: Scope, now = Date.now(), allProjects = false): State[] {
    return this.activeStates(scope, now, allProjects)
      .sort((leftState, rightState) => rightState.updatedAt.localeCompare(leftState.updatedAt))
      .slice(0, 3)
  }
  vector(candidateMemory: Memory, model: string, values: number[]) {
    const latest = this.memory(candidateMemory.id)
    if (!latest || latest.status !== 'active' || latest.version !== candidateMemory.version) {
      return
    }
    this.db
      .prepare('INSERT OR REPLACE INTO vectors VALUES (?,?,?,?,?)')
      .run(
        candidateMemory.id,
        candidateMemory.version,
        model,
        values.length,
        new Uint8Array(new Float32Array(values).buffer),
      )
  }
  /** Indexed version per memory for one model, in a single query. */
  vectorVersions(model: string): Map<string, number> {
    const rows = this.db
      .prepare('SELECT memory_id, version FROM vectors WHERE model=?')
      .all(model) as { memory_id: string; version: number }[]
    return new Map(rows.map((row) => [String(row.memory_id), Number(row.version)]))
  }
  vectorVersion(id: string, model: string): number | undefined {
    return this.db
      .prepare('SELECT version FROM vectors WHERE memory_id=? AND model=?')
      .get(id, model)?.version as number | undefined
  }
  vectorScores(scope: Scope, model: string, values: number[]) {
    if (!this.vectorAvailable) {
      return new Map<string, number>()
    }
    const valid = new Set(
      this.memories(scope).map(
        (candidateMemory) => `${candidateMemory.id}:${candidateMemory.version}`,
      ),
    )
    const rows = this.db
      .prepare(
        'SELECT memory_id,version,vec_distance_cosine(embedding,?) AS distance FROM vectors WHERE model=? AND dimensions=?',
      )
      .all(new Uint8Array(new Float32Array(values).buffer), model, values.length)
    return new Map(
      rows
        .filter((row) => valid.has(`${row.memory_id}:${row.version}`))
        .map((row) => [String(row.memory_id), 1 - Number(row.distance)]),
    )
  }
}
