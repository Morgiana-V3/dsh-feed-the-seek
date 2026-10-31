import * as React from 'react';
import type { SettingsState, SubmitAction } from '../contracts.js';
export declare function PersonaName({ state, isBusy, submitAction, notify, }: {
    state: SettingsState;
    isBusy: boolean;
    submitAction: SubmitAction;
    notify: (message: string) => void;
}): React.JSX.Element;
