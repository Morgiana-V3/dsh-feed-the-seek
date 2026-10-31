import * as React from 'react';
import type { Persona } from '../../persona/index.js';
import type { Settings } from '../../settings/index.js';
import { type SettingsState, type SubmitAction } from '../contracts.js';
declare const masterSetting: {
    readonly key: "enabled";
    readonly label: "记忆功能";
    readonly description: "在对话中使用已保存的记忆。关闭后既不读取，也不记录新内容。";
};
declare const featureSettings: readonly [{
    readonly key: "learning";
    readonly label: "自动记录";
    readonly description: "对话结束后整理值得保留的内容，也会修正记错的。会调用当前对话模型，产生额外用量。";
}, {
    readonly key: "emotion";
    readonly label: "情绪表达";
    readonly description: "近期经历会影响回复的语气。";
}];
type ToggleKey = typeof masterSetting.key | (typeof featureSettings)[number]['key'];
export declare function SettingsPanel({ state, isBusy, pendingSettings, submitAction, updateSetting, notify, onPersonaCreated, }: {
    state: SettingsState;
    isBusy: boolean;
    pendingSettings: Partial<Settings>;
    submitAction: SubmitAction;
    updateSetting: (key: ToggleKey, value: boolean) => Promise<void>;
    notify: (message: string) => void;
    onPersonaCreated: (persona: Persona) => void;
}): React.JSX.Element;
export {};
