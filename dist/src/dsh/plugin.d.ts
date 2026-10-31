import { type Snapshot } from '../memory/index.js';
type Host = any;
export declare const name = "feed-the-seek";
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
/** Source kind of the profile message; DSH keeps it in history like its own AGENTS.md messages. */
export declare const PROFILE_SOURCE = "feed-the-seek-profile";
export declare const PROFILE_CLEARED = "\uFF08\u957F\u671F\u8BB0\u5FC6\uFF1A\u76EE\u524D\u6CA1\u6709\u9700\u8981\u5E38\u9A7B\u7684\u5185\u5BB9\uFF0C\u4E4B\u524D\u7684\u5E38\u9A7B\u8BB0\u5FC6\u4E0D\u518D\u9002\u7528\u3002\uFF09";
/** The newest profile message still on the session surface; undefined when none survives (or the host cannot tell). */
export declare function visibleProfile(agent: Host): string | undefined;
export declare function usedItems(snapshot: Snapshot): import("../memory/model.js").Memory[];
export declare function apply(context: Host, config?: Config): Promise<void>;
export {};
