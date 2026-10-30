import { type Memory } from './types.js';
export interface MemoryAssociation {
    from: string;
    to: string;
    reasons: string[];
}
export declare function associateMemories(memories: Memory[]): MemoryAssociation[];
