import * as React from 'react';
import type { Persona, Settings } from '../types.js';
import { type SettingsState, type SubmitAction } from './api.js';
declare const settingOptions: readonly [{
    readonly key: "enabled";
    readonly label: "记得你";
    readonly description: "聊天时想起以前的事";
}, {
    readonly key: "learning";
    readonly label: "记住新的事";
    readonly description: "从聊天里学，也会改正记错的";
}, {
    readonly key: "emotion";
    readonly label: "心情";
    readonly description: "最近的经历会影响我的语气";
}, {
    readonly key: "growth";
    readonly label: "慢慢长大";
    readonly description: "把你的反馈和我的表现慢慢变成性格";
}];
export declare function SettingsPanel({ state, isBusy, pendingSettings, submitAction, updateSetting, notify, onPersonaCreated, }: {
    state: SettingsState;
    isBusy: boolean;
    pendingSettings: Partial<Settings>;
    submitAction: SubmitAction;
    updateSetting: (key: (typeof settingOptions)[number]['key'], value: boolean) => Promise<void>;
    notify: (message: string) => void;
    onPersonaCreated: (persona: Persona) => void;
}): React.JSX.Element;
export {};
