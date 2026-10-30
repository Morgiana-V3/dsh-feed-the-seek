import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import * as sqliteVec from 'sqlite-vec';
import { memoryStrength, strengthCap } from './strength.js';
import { Settings, DEFAULT_SCOPE, Knowledge, type Persona, type Trait, type Scope, type Memory, type Source, type State, type StateInput, visible, sameOwner } from './types.js';

export class Store {
  db: DatabaseSync;
  vectorAvailable = false;
  vectorError = '';
  private transactionDepth = 0;
  constructor(public path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path, { allowExtension: true });
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
    `);
    this.migrate();
    try { sqliteVec.load(this.db); this.vectorAvailable = true; } catch (e) { this.vectorError = String(e); }
  }
  close() { this.db.close(); }
  private migrate() {
    if (this.getMeta('schemaVersion', 1) >= 2) return;
    this.transaction(() => {
      const mapping = {habit:'cognition',episode:'experience',goal:'experience',growth:'self'} as const;
      for (const row of this.db.prepare('SELECT document FROM memories').all()) {
        const old = JSON.parse(String(row.document));
        const kind = mapping[old.kind as keyof typeof mapping] || old.kind;
        const memory: Memory = {...old, kind, knowledge: Knowledge.parse({category:old.kind==='habit'?'preference':kind==='self'?'tendency':kind==='experience'?'event':'fact'}), confidence:old.evidence==='explicit'?.8:.4};
        this.put(memory); this.audit('MIGRATE','迁移到四维记忆；旧成长保留为观察，不自动形成稳定倾向',old,memory);
      }
      // Pending v1 proposals use a different vocabulary. Retain payloads for inspection.
      this.db.prepare("UPDATE jobs SET status='obsolete',error='旧版本整理任务已保留，请由后续对话重新学习' WHERE status IN ('pending','running','failed')").run();
      this.setMeta('schemaVersion',2);
    });
  }
  personas(): Persona[] { return this.getMeta('personas',[{id:DEFAULT_SCOPE.persona,name:'初始伙伴',createdAt:new Date(0).toISOString()}]); }
  activePersona() { return this.getMeta('activePersona',DEFAULT_SCOPE.persona); }
  createPersona(name: string) {
    const persona = {id:randomUUID(),name,createdAt:new Date().toISOString()};
    this.transaction(() => { this.setMeta('personas',[...this.personas(),persona]); this.setMeta('activePersona',persona.id); this.bump(); });
    return persona;
  }
  bindSession(session: string) {
    const key = `persona:session:${session}`;
    const bound = this.getMeta(key,'');
    if (bound) return bound;  // Read-only after the first binding; the settings page polls this.
    const persona = this.activePersona();
    this.setMeta(key,persona); return persona;
  }
  traits(scope: Scope, allProjects=false): Trait[] {
    return this.db.prepare('SELECT document FROM traits').all().map(r=>JSON.parse(String(r.document)) as Trait).filter(t=>allProjects?sameOwner(t.scope,scope):visible(t.scope,scope));
  }
  trait(id: string): Trait | undefined { const r = this.db.prepare('SELECT document FROM traits WHERE id=?').get(id); return r ? JSON.parse(String(r.document)) : undefined; }
  putTrait(memory: Memory, formed = true) {
    const trait: Trait = {id:memory.id,text:memory.text,scope:memory.scope,sources:memory.sources,version:memory.version,updatedAt:memory.updatedAt};
    this.db.prepare('INSERT OR REPLACE INTO traits VALUES (?,?)').run(trait.id,JSON.stringify(trait)); this.bump();
    if (formed) this.audit('CONSOLIDATE','独立反馈跨越至少 72 小时，形成有来源的稳定倾向',undefined,memory);
  }
  use(memories: Memory[], event: string) {
    for (const memory of memories) this.db.prepare('INSERT OR IGNORE INTO recall_uses VALUES (?,?,?)').run(memory.id,event,new Date().toISOString());
  }
  /** Timestamps of the most recent real uses (deliberate recall or topical injection). */
  uses(memoryId: string, limit = 20): string[] {
    return this.db.prepare('SELECT at FROM recall_uses WHERE memory_id=? ORDER BY at DESC LIMIT ?').all(memoryId, limit).map(r => String(r.at));
  }
  strength(memory: Memory, now=Date.now()) { return memoryStrength(memory, this.uses(memory.id), now); }
  /** 0–1 freshness relative to the memory's own ceiling; shown as the activity meter. */
  activation(memory: Memory, now=Date.now()) { const cap = strengthCap(memory); return cap ? this.strength(memory, now) / cap : 0; }
  transaction<T>(fn: () => T): T {
    const level = this.transactionDepth++;
    const savepoint = `nested_${level}`;
    this.db.exec(level ? `SAVEPOINT ${savepoint}` : 'BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec(level ? `RELEASE ${savepoint}` : 'COMMIT'); return result; }
    catch (e) { this.db.exec(level ? `ROLLBACK TO ${savepoint}; RELEASE ${savepoint}` : 'ROLLBACK'); throw e; }
    finally { this.transactionDepth--; }
  }
  get revision() { return Number(this.getMeta('revision', '0')); }
  bump() { this.setMeta('revision', String(this.revision + 1)); }
  getMeta<T>(key: string, fallback: T): T {
    const row = this.db.prepare('SELECT value FROM meta WHERE key=?').get(key);
    return row ? JSON.parse(String(row.value)) as T : fallback;
  }
  setMeta(key: string, value: unknown) { this.db.prepare('INSERT OR REPLACE INTO meta VALUES (?,?)').run(key, JSON.stringify(value)); }
  settings() {
    const saved = this.getMeta<Record<string, unknown>>('settings', {});
    const retrievalMode = saved.retrievalMode ?? (saved.embeddingUrl && saved.embeddingModel ? 'semantic' : 'local');
    return Settings.parse({ ...saved, retrievalMode });
  }
  saveSettings(value: unknown) { const parsed = Settings.parse(value); this.setMeta('settings', parsed); this.bump(); return parsed; }
  sessionEnabled(id: string) { return this.settings().enabled && this.getMeta(`session:${id}`, true); }
  toggleSession(id: string, enabled: boolean) { this.setMeta(`session:${id}`, enabled); this.bump(); }
  source(source: Source) {
    const old = this.getSource(source.id);
    if (old && JSON.stringify(old) !== JSON.stringify(source)) throw new Error('来源编号已存在，不能覆盖原始证据');
    this.db.prepare('INSERT OR IGNORE INTO sources VALUES (?,?)').run(source.id, JSON.stringify(source));
  }
  getSource(id: string): Source | undefined { const r = this.db.prepare('SELECT document FROM sources WHERE id=?').get(id); return r ? JSON.parse(String(r.document)) : undefined; }
  memories(scope?: Scope, all = false): Memory[] {
    return this.db.prepare('SELECT document FROM memories').all().map(r => JSON.parse(String(r.document)) as Memory)
      .filter(m => (all || m.status === 'active') && (!scope || visible(m.scope, scope)));
  }
  memory(id: string): Memory | undefined { const r = this.db.prepare('SELECT document FROM memories WHERE id=?').get(id); return r ? JSON.parse(String(r.document)) : undefined; }
  put(m: Memory) {
    this.db.prepare('INSERT OR REPLACE INTO memories VALUES (?,?)').run(m.id, JSON.stringify(m));
    this.db.prepare('DELETE FROM vectors WHERE memory_id=?').run(m.id);
    this.db.prepare('DELETE FROM traits WHERE id=?').run(m.id);
    this.bump();
  }
  audit(action: string, reason: string, before?: Memory, after?: Memory) {
    this.db.prepare('INSERT INTO audit VALUES (?,?,?,?,?,?,?)').run(randomUUID(), new Date().toISOString(), action, after?.id || before?.id || '', reason, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null);
  }
  history(scope?: Scope) { return this.db.prepare('SELECT * FROM audit ORDER BY at DESC').all().map(r => ({ ...r, action:String(r.action), at:String(r.at), reason:String(r.reason), before: r.before_json ? JSON.parse(String(r.before_json)) : null, after: r.after_json ? JSON.parse(String(r.after_json)) : null, before_json: undefined, after_json: undefined })).filter(r=>!scope || (r.after||r.before) && sameOwner((r.after||r.before).scope,scope)).slice(0,100); }
  /**
   * States are keyed by the event they react to (target memory) so rewording the topic does
   * not create a second state for the same incident. Retelling never extends a state's life.
   */
  setState(scope: Scope, input: StateInput, now = Date.now()) {
    const project = input.layer === 'relationship' ? '' : scope.project;
    const stateScope = { ...scope, project };
    const id = JSON.stringify([scope.user, scope.persona, project, input.target ? `memory:${input.target}` : input.topic]);
    const oldRow = this.db.prepare('SELECT document FROM states WHERE id=?').get(id);
    const old: State | undefined = oldRow ? JSON.parse(String(oldRow.document)) : undefined;
    if (old && input.sources.every(source=>old.sources.includes(source))) return;
    const at = new Date(now).toISOString();
    const sources = [...new Set([...(old?.sources || []), ...input.sources])].slice(-12);
    const ongoing = old && !old.resolvedAt && old.mood === input.mood;
    let state: Omit<State, 'effectiveIntensity'>;
    if (ongoing && input.intensity <= old.intensity) {
      // Same feeling about the same thing, not stronger than before: keep its clock and strength.
      state = { ...old, sources };
    } else {
      // A stronger recurrence or a different feeling takes effect immediately.
      const { effectiveIntensity: _drop, resolvedAt: _resolved, ...previous } = (old || {}) as State;
      state = { ...(ongoing ? previous : {}), ...input, scope: stateScope, id, sources, updatedAt: at, onsetAt: ongoing ? old.onsetAt || old.updatedAt : at };
    }
    this.db.prepare('INSERT OR REPLACE INTO states VALUES (?,?)').run(id, JSON.stringify(state)); this.bump();
  }
  /** The event behind these states is no longer valid, so the feeling about it ends now. */
  resolveStates(memoryId: string, now = Date.now()) {
    for (const row of this.db.prepare('SELECT document FROM states').all()) {
      const state = JSON.parse(String(row.document)) as State;
      if (state.target === memoryId && !state.resolvedAt) {
        this.db.prepare('UPDATE states SET document=? WHERE id=?').run(JSON.stringify({ ...state, resolvedAt: new Date(now).toISOString() }), state.id);
        this.bump();
      }
    }
  }
  /** Every unresolved state above the floor, strongest first. */
  activeStates(scope: Scope, now = Date.now(), allProjects = false): State[] {
    return this.db.prepare('SELECT document FROM states').all().map(r => JSON.parse(String(r.document)) as State)
      .filter(s => !s.resolvedAt && (allProjects?sameOwner(s.scope,scope):visible(s.scope, scope)))
      .map(s => ({ ...s, effectiveIntensity: s.intensity * Math.pow(0.5, Math.max(0, now - Date.parse(s.updatedAt)) / 86400000) }))
      .filter(s => s.effectiveIntensity >= 0.06).sort((a,b) => b.effectiveIntensity - a.effectiveIntensity);
  }
  states(scope: Scope, now = Date.now(), allProjects=false): State[] {
    return this.activeStates(scope, now, allProjects).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3);
  }
  vector(m: Memory, model: string, values: number[]) {
    const latest = this.memory(m.id);
    if (!latest || latest.status !== 'active' || latest.version !== m.version) return;
    this.db.prepare('INSERT OR REPLACE INTO vectors VALUES (?,?,?,?,?)').run(m.id, m.version, model, values.length, new Uint8Array(new Float32Array(values).buffer));
  }
  vectorVersion(id: string, model: string): number | undefined { return this.db.prepare('SELECT version FROM vectors WHERE memory_id=? AND model=?').get(id, model)?.version as number | undefined; }
  vectorScores(scope: Scope, model: string, values: number[]) {
    if (!this.vectorAvailable) return new Map<string, number>();
    const valid = new Set(this.memories(scope).map(m => `${m.id}:${m.version}`));
    const rows = this.db.prepare('SELECT memory_id,version,vec_distance_cosine(embedding,?) AS distance FROM vectors WHERE model=? AND dimensions=?').all(new Uint8Array(new Float32Array(values).buffer), model, values.length);
    return new Map(rows.filter(r => valid.has(`${r.memory_id}:${r.version}`)).map(r => [String(r.memory_id), 1 - Number(r.distance)]));
  }
}

