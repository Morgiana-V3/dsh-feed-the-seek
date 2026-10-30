import type { Memory, Persona, Scope, Settings, Snapshot, Source, State, Trait } from '../types.js';
import type { MemoryAssociation } from '../associations.js';
import type { PersonaDiff, PersonaDoc } from '../persona.js';
export interface SessionSummary {
    id: string;
    project: string;
    persona: string;
    enabled: boolean;
}
export interface HistoryEntry {
    action?: string;
    at?: string;
    reason: string;
    before?: Memory | null;
    after?: Memory | null;
}
export interface SettingsState {
    token: string;
    demo: boolean;
    scope: Scope;
    activePersona: string;
    personas: Persona[];
    memories: (Memory & {
        activation?: number;
    })[];
    associations: MemoryAssociation[];
    states: State[];
    traits: Trait[];
    sources: Record<string, Source | undefined>;
    history: HistoryEntry[];
    settings: Settings;
    sessions: SessionSummary[];
    jobs: {
        id: string;
        status: string;
        updated_at: string;
        error?: string;
    }[];
    vector: {
        available: boolean;
        configured: boolean;
        count: number;
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
}
export interface CurrentMood {
    mood: string;
    label: string;
    asset: 'calm' | 'happy' | 'discouraged' | 'annoyed';
    since: string;
    strength: string;
    reason: string;
    project: string;
    layer: '' | 'task' | 'relationship';
}
export declare function request<TResponse>(endpoint: string, body?: unknown, token?: string, signal?: AbortSignal): Promise<TResponse>;
export type RecallResult = Snapshot;
export type SubmitAction = (endpoint: string, body: unknown) => Promise<unknown>;
export declare function projectLabel(projectPath: string): string;
export declare function dateLabel(value: string): string;
