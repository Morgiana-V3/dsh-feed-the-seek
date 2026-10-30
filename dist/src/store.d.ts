import { DatabaseSync } from 'node:sqlite';
import { type Persona, type Trait, type Scope, type Memory, type Source, type State, type StateInput } from './types.js';
export declare class Store {
    path: string;
    db: DatabaseSync;
    vectorAvailable: boolean;
    vectorError: string;
    private transactionDepth;
    constructor(path: string);
    close(): void;
    private migrate;
    personas(): Persona[];
    activePersona(): string;
    createPersona(name: string): {
        id: `${string}-${string}-${string}-${string}-${string}`;
        name: string;
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
    transaction<T>(fn: () => T): T;
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
    sessionEnabled(id: string): boolean;
    toggleSession(id: string, enabled: boolean): void;
    source(source: Source): void;
    getSource(id: string): Source | undefined;
    memories(scope?: Scope, all?: boolean): Memory[];
    memory(id: string): Memory | undefined;
    put(m: Memory): void;
    audit(action: string, reason: string, before?: Memory, after?: Memory): void;
    history(scope?: Scope): {
        action: string;
        at: string;
        reason: string;
        before: any;
        after: any;
        before_json: undefined;
        after_json: undefined;
    }[];
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
    vector(m: Memory, model: string, values: number[]): void;
    vectorVersion(id: string, model: string): number | undefined;
    vectorScores(scope: Scope, model: string, values: number[]): Map<string, number>;
}
