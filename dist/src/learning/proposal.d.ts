import type { Generator } from './model.js';
export declare function generateProposal(generate: Generator, system: string, input: Record<string, unknown>, signal: AbortSignal, callTimeoutMs?: number): Promise<{
    repaired: boolean;
    proposal: {
        operations: {
            action: "ADD" | "UPDATE" | "DELETE" | "NONE";
            tags: string[];
            evidence: "explicit" | "inferred";
            importance: number;
            confidence: number;
            knowledge: {
                category: "person" | "fact" | "rule" | "convention" | "opinion" | "preference" | "event" | "relationship" | "tendency";
                domain: string;
                edition: string;
                conditions: string;
            };
            consolidate: boolean;
            global: boolean;
            sources: string[];
            reason: string;
            target?: string | undefined;
            expectedVersion?: number | undefined;
            kind?: "cognition" | "experience" | "resonance" | "self" | undefined;
            text?: string | undefined;
            userQuote?: string | undefined;
            durability?: "turn" | "situational" | "habit" | "lasting" | undefined;
            selfKind?: "behavior" | "feedback" | "intention" | "claim" | "verified" | undefined;
            alias?: {
                kind: "user_preferred" | "user_nickname" | "assistant_name";
                value: string;
            } | undefined;
            retention?: {
                basis: "preference" | "relationship" | "feedback" | "knowledge" | "milestone";
                reason: string;
            } | undefined;
        }[];
        state?: {
            mood: "calm" | "happy" | "hopeful" | "concerned" | "discouraged" | "annoyed" | "shy" | "relieved" | "steady";
            reason: string;
            behavior: string;
            intensity: number;
            sources: string[];
            topic: string;
            appraisal?: string | undefined;
            displayReason?: string | undefined;
            confidence?: number | undefined;
            target?: string | undefined;
            layer?: "relationship" | "task" | undefined;
        } | null | undefined;
    };
    raw: {
        operations?: Record<string, unknown>[];
        state?: Record<string, unknown> | null;
    };
}>;
