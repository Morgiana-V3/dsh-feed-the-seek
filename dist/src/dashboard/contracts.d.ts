import type { MoodAsset, State } from '../emotion/index.js';
import type { Memory, Presence, Scope, Snapshot, Source } from '../memory/index.js';
import type { Persona, PersonaDiff, PersonaDoc, Trait } from '../persona/index.js';
import type { Settings } from '../settings/index.js';
import type { LearningUsage } from '../storage/index.js';
export interface HistoryEntry {
    id?: string;
    action?: string;
    at?: string;
    reason: string;
    before?: Memory | null;
    after?: Memory | null;
}
export interface HistoryPage {
    items: HistoryEntry[];
    total: number;
    page: number;
    pageSize: number;
    through: number;
}
/** Answer to a poll whose `since` key still matches: the page keeps what it shows. */
export interface UnchangedState {
    unchanged: true;
    stateKey: string;
}
export interface SettingsState {
    token: string;
    /** Pass back as `since`; the server answers with UnchangedState while nothing moved. */
    stateKey: string;
    demo: boolean;
    stage: number;
    demoReady: boolean;
    scope: Scope;
    activePersona: string;
    personas: Persona[];
    memories: (Memory & {
        presence?: Presence;
    })[];
    states: State[];
    traits: Trait[];
    sources: Record<string, Source | undefined>;
    /** The most recent changes only; historyCount is the full number. */
    history: HistoryEntry[];
    historyCount?: number;
    settings: Settings;
    jobs: {
        id: string;
        status: string;
        attempts?: number;
        updated_at: string;
        error?: string;
    }[];
    /** count: active memories indexed for the configured model; total: active memories. */
    vector: {
        available: boolean;
        configured: boolean;
        count: number;
        total?: number;
        apiKeyConfigured?: boolean;
    };
    revision: number;
    /** Aggregated mood shown on the overview; null when emotion is turned off. */
    mood: CurrentMood | null;
    persona?: PersonaDoc & {
        threshold: number;
        history: {
            version: number;
            at: string;
            diff: PersonaDiff;
        }[];
    };
    selfCount?: number;
    selfLimit?: number;
    learningUsage?: LearningUsage;
}
export interface CurrentMood {
    mood: string;
    label: string;
    asset: MoodAsset;
    since: string;
    strength: string;
    reason: string;
    layer: '' | 'task' | 'relationship';
}
export type RecallResult = Snapshot;
export type SubmitAction = (endpoint: string, body: unknown) => Promise<unknown>;
