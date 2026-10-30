import * as React from 'react';
export declare function SettingsSection(): React.JSX.Element;
interface Slots {
    inject(name: string, setup: () => unknown): unknown;
    register(spec: {
        name: string;
        id: string;
        order: number;
        label: () => string;
    }, render: () => React.ReactNode): unknown;
}
export declare const inject: string[];
export declare function apply(context: {
    get(name: 'slots'): Slots | undefined;
}): void;
export {};
