import * as React from 'react';
import { type SettingsState, type SubmitAction } from './api.js';
export declare function RetrievalSettings({ state, isBusy, submitAction, notify, }: {
    state: SettingsState;
    isBusy: boolean;
    submitAction: SubmitAction;
    notify: (message: string) => void;
}): React.JSX.Element;
