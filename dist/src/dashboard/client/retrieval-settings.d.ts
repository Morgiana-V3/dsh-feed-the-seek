import * as React from 'react';
import { type SettingsState, type SubmitAction } from '../contracts.js';
/** What retrieval actually runs on, for the status line. A saved semantic mode alone is not enough. */
export declare function retrievalStatus(state: SettingsState): string;
export declare function RetrievalSettings({ state, isBusy, submitAction, notify, }: {
    state: SettingsState;
    isBusy: boolean;
    submitAction: SubmitAction;
    notify: (message: string) => void;
}): React.JSX.Element;
