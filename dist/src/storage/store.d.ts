import { DatabaseSync } from 'node:sqlite';
import { type State, type StateInput } from '../emotion/index.js';
import { type Memory, type Scope, type Source } from '../memory/index.js';
import { type Persona, type Trait } from '../persona/index.js';
import { LearningJobs } from './jobs.js';
export interface LearningUsage {
    calls: number;
    failedCalls: number;
    inputTokens: number;
    cacheReadTokens: number;
    outputTokens: number;
    since: string;
}
/** How long "nothing to change" judgments stay in the audit table. */
export declare const AUDIT_JUDGMENT_DAYS = 30;
export declare class Store {
    path: string;
    db: DatabaseSync;
    readonly jobs: LearningJobs;
    vectorAvailable: boolean;
    vectorError: string;
    private transactionDepth;
    constructor(path: string);
    close(): void;
    private migrate;
    /**
     * Growth is no longer a user-facing switch; it follows automatic learning. An installation
     * that had turned it off would otherwise stay off with no way to see or change it.
     */
    private retireGrowthSwitch;
    personas(): Persona[];
    activePersona(): string;
    createPersona(name: string): {
        id: `${string}-${string}-${string}-${string}-${string}`;
        name: string;
        createdAt: string;
    };
    renamePersona(id: string, name: string): {
        name: string;
        id: string;
        createdAt: string;
    };
    bindSession(session: string): string;
    traits(scope: Scope, allProjects?: boolean): Trait[];
    trait(id: string): Trait | undefined;
    putTrait(memory: Memory, formed?: boolean): void;
    use(memories: Memory[], event: string): void;
    /** Timestamps of the most recent real uses (deliberate recall or topical injection). */
    uses(memoryId: string, limit?: number): string[];
    strength(memory: Memory, now?: number): number;
    /** 0–1 freshness relative to the memory's own ceiling; shown as the activity meter. */
    activation(memory: Memory, now?: number): number;
    transaction<T>(runTransaction: () => T): T;
    get revision(): number;
    bump(): void;
    getMeta<T>(key: string, fallback: T): T;
    setMeta(key: string, value: unknown): void;
    settings(): {
        enabled: boolean;
        learning: boolean;
        growth: boolean;
        emotion: boolean;
        retrievalMode: "local" | "semantic";
        embeddingUrl: string;
        embeddingModel: string;
        embeddingProtocol: "auto" | "openai" | "ollama" | "doubao";
        embeddingDimensions: number;
        embeddingKeyEnv: string;
    };
    saveSettings(value: unknown): {
        enabled: boolean;
        learning: boolean;
        growth: boolean;
        emotion: boolean;
        retrievalMode: "local" | "semantic";
        embeddingUrl: string;
        embeddingModel: string;
        embeddingProtocol: "auto" | "openai" | "ollama" | "doubao";
        embeddingDimensions: number;
        embeddingKeyEnv: string;
    };
    /** Memory applies to every conversation; there is no per-session switch (older per-session flags are ignored). */
    sessionEnabled(_id: string): boolean;
    source(source: Source): void;
    getSource(id: string): Source | undefined;
    learningUsage(scope: Scope): LearningUsage;
    recordLearningUsage(scope: Scope, usage: Partial<LearningUsage>, completed: boolean): void;
    /** Completed jobs retain status/scope, not another full copy of the conversation. */
    releaseLearningPayload(id: string): void;
    memories(scope?: Scope, all?: boolean): Memory[];
    memory(id: string): Memory | undefined;
    put(candidateMemory: Memory): void;
    /**
     * Every organizer pass leaves "nothing to change" judgments (NONE, OBSERVE). They explain recent
     * decisions but are never shown as changes, so older ones are dropped instead of growing forever.
     * Real changes (ADD, UPDATE, DELETE, MERGE, ...) are kept.
     */
    pruneAudit(now?: number): number;
    audit(action: string, reason: string, before?: Memory, after?: Memory): void;
    /**
     * Audit entries of one owner, newest first. changesOnly leaves out decisions that changed
     * nothing (NONE, OBSERVE). Filtering and limiting run in SQL, so the settings page does not
     * parse the whole, ever-growing audit table on every refresh.
     */
    history(scope?: Scope, options?: {
        limit?: number;
        offset?: number;
        changesOnly?: boolean;
        query?: string;
        action?: string;
        kind?: string;
        through?: number;
    }): {
        action: string;
        at: string;
        reason: string;
        before: Memory | null;
        after: Memory | null;
        before_json: undefined;
        after_json: undefined;
    }[];
    historyCount(scope?: Scope, options?: {
        changesOnly?: boolean;
        query?: string;
        action?: string;
        kind?: string;
        through?: number;
    }): number;
    historyRevision(): number;
    private historyFilter;
    /**
     * States are keyed by the event they react to (target memory) so rewording the topic does
     * not create a second state for the same incident. Retelling never extends a state's life.
     */
    setState(scope: Scope, input: StateInput, now?: number): void;
    /** The event behind these states is no longer valid, so the feeling about it ends now. */
    resolveStates(memoryId: string, now?: number): void;
    /** Every unresolved state above the floor, strongest first. */
    activeStates(scope: Scope, now?: number, allProjects?: boolean): State[];
    states(scope: Scope, now?: number, allProjects?: boolean): State[];
    vector(candidateMemory: Memory, model: string, values: number[]): void;
    /** Indexed version per memory for one model, in a single query. */
    vectorVersions(model: string): Map<string, number>;
    vectorVersion(id: string, model: string): number | undefined;
    vectorScores(scope: Scope, model: string, values: number[]): Map<string, number>;
}
