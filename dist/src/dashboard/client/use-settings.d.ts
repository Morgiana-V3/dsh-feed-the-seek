import * as React from 'react';
import { type SettingsState } from '../contracts.js';
export interface Notice {
    id: number;
    message: string;
    tone: 'success' | 'info';
}
type BooleanSettingKey = 'enabled' | 'learning' | 'emotion';
export declare function useSettings(): {
    state: SettingsState | null;
    errorMessage: string;
    dismissError: () => void;
    isBusy: boolean;
    isRefreshing: boolean;
    pendingSettings: Partial<{
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
    }>;
    notice: Notice | null;
    notify: (message: string, tone?: Notice["tone"]) => void;
    setViewedPersonaId: React.Dispatch<React.SetStateAction<string>>;
    refreshSettings: () => Promise<void>;
    submitAction: (endpoint: string, body: unknown) => Promise<unknown>;
    updateSetting: (key: BooleanSettingKey, value: boolean) => Promise<void>;
};
export {};
