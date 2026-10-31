import * as React from 'react';
import type { Kind } from '../../memory/index.js';
import { type SettingsState } from '../contracts.js';
export declare function MemoryPanel({ state, selectedKind, onSelectKind, newMemoryIds, notify, }: {
    state: SettingsState;
    selectedKind: Kind | 'all';
    onSelectKind: (kind: Kind | 'all') => void;
    newMemoryIds: Set<string>;
    notify: (message: string) => void;
}): React.JSX.Element;
