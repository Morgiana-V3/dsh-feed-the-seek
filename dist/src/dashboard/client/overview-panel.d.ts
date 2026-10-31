import * as React from 'react';
import type { Kind } from '../../memory/index.js';
import type { SettingsState } from '../contracts.js';
export declare function OverviewPanel({ state, isBusy, newMemoryIds, onOpenMemories, onRetry, }: {
    state: SettingsState;
    isBusy: boolean;
    newMemoryIds: Set<string>;
    onOpenMemories: (kind?: Kind | 'all') => void;
    onRetry: () => void;
}): React.JSX.Element;
