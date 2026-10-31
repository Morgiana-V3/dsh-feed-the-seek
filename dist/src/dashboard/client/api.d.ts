export type { CurrentMood, HistoryEntry, RecallResult, SettingsState, SubmitAction, } from '../contracts.js';
export declare function request<TResponse>(endpoint: string, body?: unknown, token?: string, signal?: AbortSignal): Promise<TResponse>;
export declare function projectLabel(projectPath: string): string;
export declare function dateLabel(value: string): string;
