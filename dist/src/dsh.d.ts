import { type Snapshot } from './types.js';
type Host = any;
export declare const name = "yuwen";
export declare const inject: string[];
export interface Config {
    dataDir?: string;
    dashboardPort?: number;
    checkpointsEvery?: number;
}
export declare function contentText(content: unknown): string;
export declare function traceLine(event: {
    type: string;
    seq: number;
    data?: any;
}, names: Map<string, string>): string;
export declare function usedItems(snapshot: Snapshot): import("./types.js").Memory[];
export declare function apply(ctx: Host, config?: Config): Promise<void>;
export {};
