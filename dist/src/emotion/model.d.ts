import { z } from 'zod';
import type { Scope } from '../memory/index.js';
/** steady is the pre-0.2.15 name of calm; it stays readable so stored states keep working. */
export declare const Mood: z.ZodEnum<{
    calm: "calm";
    happy: "happy";
    hopeful: "hopeful";
    concerned: "concerned";
    discouraged: "discouraged";
    annoyed: "annoyed";
    shy: "shy";
    relieved: "relieved";
    steady: "steady";
}>;
export type Mood = z.infer<typeof Mood>;
export declare const StateInput: z.ZodObject<{
    mood: z.ZodEnum<{
        calm: "calm";
        happy: "happy";
        hopeful: "hopeful";
        concerned: "concerned";
        discouraged: "discouraged";
        annoyed: "annoyed";
        shy: "shy";
        relieved: "relieved";
        steady: "steady";
    }>;
    reason: z.ZodString;
    behavior: z.ZodString;
    intensity: z.ZodNumber;
    sources: z.ZodArray<z.ZodString>;
    topic: z.ZodString;
    appraisal: z.ZodOptional<z.ZodString>;
    displayReason: z.ZodOptional<z.ZodString>;
    confidence: z.ZodOptional<z.ZodNumber>;
    target: z.ZodOptional<z.ZodString>;
    layer: z.ZodOptional<z.ZodEnum<{
        relationship: "relationship";
        task: "task";
    }>>;
}, z.core.$strict>;
export type StateInput = z.infer<typeof StateInput>;
export interface State extends StateInput {
    id: string;
    scope: Scope;
    updatedAt: string;
    onsetAt?: string;
    resolvedAt?: string;
    effectiveIntensity: number;
}
