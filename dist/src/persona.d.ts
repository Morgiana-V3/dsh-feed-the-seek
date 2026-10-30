import { z } from 'zod';
import type { Store } from './store.js';
import type { Memory, Scope } from './types.js';
/**
 * "Who she is", synthesized from self observations — adapted from the earlier bot's persona.md.
 * The model only proposes edits and points at evidence by index; the code counts scenes and days
 * and decides whether an edit may be written. Every synthesis keeps a version with its diff.
 */
export type PersonaSection = 'self' | 'scenes' | 'values';
export declare const personaSectionTitles: Record<PersonaSection, string>;
export interface PersonaLine {
    text: string;
    /** Ids of the self observations that support this line. Empty for a hand-written baseline. */
    evidence: string[];
    since: string;
}
export interface PersonaDoc {
    version: number;
    sections: Record<PersonaSection, PersonaLine[]>;
    updatedAt: string;
    /** Qualifying observations added since the last synthesis. */
    pending: number;
    lastSynthesisAt?: string;
}
export interface PersonaDiff {
    added: string[];
    updated: {
        from: string;
        to: string;
    }[];
    removed: string[];
    rejected: {
        op: string;
        text: string;
        reason: string;
    }[];
}
export declare const PERSONA: {
    readonly minScenes: 2;
    readonly minObservations: 3;
    readonly minSpanDays: 3;
    readonly unconditionalSingleSceneObservations: 4;
    readonly unconditionalSingleSceneSpanDays: 7;
    readonly updateEvidenceRatio: 0.5;
    readonly removeMinDays: 14;
    readonly maxLinesPerSection: 8;
    readonly maxLineChars: 60;
    readonly pendingThreshold: 5;
    readonly minIntervalHours: 12;
    readonly maxIntervalDays: 7;
    readonly inputMaxObservations: 40;
};
export declare function emptyPersona(): PersonaDoc;
export declare function loadPersona(store: Store, persona: string): PersonaDoc;
export declare function personaHistory(store: Store, persona: string): {
    version: number;
    at: string;
    diff: PersonaDiff;
}[];
/** Only observed behaviour, user feedback and verified change are evidence; promises and self-descriptions are not. */
export declare function isPersonaEvidence(memory: Memory): boolean;
export declare const sceneOf: (memory: Memory) => string;
/** Called after each committed observation so the trigger can count without rescanning. */
export declare function notePersonaObservation(store: Store, persona: string, count?: number): void;
export declare function shouldSynthesize(doc: PersonaDoc, now?: number): boolean;
export declare const PersonaEdit: z.ZodObject<{
    op: z.ZodEnum<{
        add: "add";
        update: "update";
        remove: "remove";
    }>;
    section: z.ZodEnum<{
        self: "self";
        values: "values";
        scenes: "scenes";
    }>;
    targetIndex: z.ZodOptional<z.ZodNumber>;
    text: z.ZodOptional<z.ZodString>;
    evidenceIndexes: z.ZodDefault<z.ZodArray<z.ZodUnknown>>;
    reason: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
export type PersonaEdit = z.infer<typeof PersonaEdit>;
export declare const PersonaProposal: z.ZodObject<{
    edits: z.ZodArray<z.ZodObject<{
        op: z.ZodEnum<{
            add: "add";
            update: "update";
            remove: "remove";
        }>;
        section: z.ZodEnum<{
            self: "self";
            values: "values";
            scenes: "scenes";
        }>;
        targetIndex: z.ZodOptional<z.ZodNumber>;
        text: z.ZodOptional<z.ZodString>;
        evidenceIndexes: z.ZodDefault<z.ZodArray<z.ZodUnknown>>;
        reason: z.ZodDefault<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
/** Only real numbers or digit strings are indexes; Number(null) would silently become 0. */
export declare function resolveIndexes(values: unknown[], length: number): number[];
/** Whether the evidence may enter a section; returns the reason when it may not. */
export declare function admission(section: PersonaSection, observations: Memory[]): string;
/**
 * Pure: applies proposed edits against numbered observations. Never trusts the model's claim
 * that evidence is sufficient — it counts scenes and days itself.
 */
export declare function applyPersonaEdits(doc: PersonaDoc, edits: PersonaEdit[], observations: Memory[], now?: number): {
    doc: PersonaDoc;
    diff: PersonaDiff;
};
/** Per scene: newest ∪ most important ∪ earliest, so time span is visible; scenes rotate when trimming. */
export declare function personaInput(store: Store, scope: Scope): Memory[];
export declare const PERSONA_PROMPT = "\u4F60\u5728\u6574\u7406\u89D2\u8272\u201C\u5979\u662F\u8C01\u201D\u7684\u81EA\u6211\u8BA4\u77E5\u3002\u8F93\u5165\u662F\u5F53\u524D\u4EBA\u683C\uFF08\u4E09\u6BB5\uFF0C\u5E26\u5E8F\u53F7\uFF09\u4E0E\u7F16\u53F7\u7684\u81EA\u6211\u89C2\u5BDF\uFF08\u53EA\u542B\u89C2\u5BDF\u5230\u7684\u884C\u4E3A\u3001\u7528\u6237\u53CD\u9988\u4E0E\u5DF2\u9A8C\u8BC1\u7684\u6539\u53D8\uFF09\u3002\u53EA\u8F93\u51FA JSON\uFF1A{\"edits\":[{\"op\":\"add|update|remove\",\"section\":\"self|scenes|values\",\"targetIndex\":0,\"text\":\"\u4E00\u53E5\u8BDD\uFF0C60\u5B57\u4EE5\u5185\",\"evidenceIndexes\":[0,3],\"reason\":\"\u4F9D\u636E\"}]}\u3002\nself=\u65E0\u6761\u4EF6\u7684\u6027\u683C\u503E\u5411\u3001\u80FD\u529B\u81EA\u8BC4\u3001\u53CD\u5E94\u6A21\u5F0F\uFF1Bscenes=\u5728\u4EC0\u4E48\u60C5\u51B5\u4E0B\u4F1A\u600E\u6837\uFF08\u5FC5\u987B\u5199\u51FA\u60C5\u5883\uFF09\uFF1Bvalues=\u5728\u610F\u4EC0\u4E48\u3001\u5FCC\u8BB3\u4EC0\u4E48\u3002\n\u53EA\u5728\u591A\u6761\u89C2\u5BDF\u5171\u540C\u652F\u6301\u65F6\u63D0\u51FA\uFF1BevidenceIndexes \u7CBE\u786E\u5217\u51FA\u652F\u6301\u8FD9\u53E5\u8BDD\u7684\u89C2\u5BDF\u5E8F\u53F7\uFF0C\u4E0D\u8981\u5F15\u7528\u4E0D\u652F\u6301\u7684\u89C2\u5BDF\u3002\u7A0B\u5E8F\u4F1A\u6570\u573A\u5408\u4E0E\u5929\u6570\u51B3\u5B9A\u80FD\u5426\u5199\u5165\uFF0C\u8BC1\u636E\u4E0D\u8DB3\u7684\u63D0\u8BAE\u4F1A\u88AB\u62D2\u7EDD\u3002\ntext \u7528\u89D2\u8272\u81EA\u5DF1\u7684\u53E3\u543B\u5199\uFF0C\u201C\u6211\u201D\u6307\u89D2\u8272\uFF0C\u201C\u4F60\u201D\u6307\u7528\u6237\uFF0C\u4F8B\u5982\u201C\u88AB\u8D28\u7591\u65F6\u6211\u4F1A\u5148\u6838\u5BF9\u8BC1\u636E\u518D\u56DE\u5E94\u201D\u201C\u4F60\u96BE\u8FC7\u7684\u65F6\u5019\uFF0C\u6211\u4F1A\u5148\u5B89\u9759\u542C\u4F60\u8BF4\u5B8C\u201D\uFF1B\u4E0D\u8981\u5199\u201C\u5979\u201D\u201C\u7528\u6237\u201D\u201C\u52A9\u624B\u201D\u3002\n\u4F18\u5148\u6539\u5199\u5DF2\u6709\u6761\u76EE\u800C\u4E0D\u662F\u65B0\u589E\u8FD1\u4E49\u53E5\uFF1B\u540C\u4E00\u503E\u5411\u53EA\u7559\u4E00\u6761\u3002\u4E0D\u8981\u5199\u65E5\u671F\u3001\u5177\u4F53\u4E8B\u4EF6\u6216\u4EBA\u540D\uFF1B\u4E0D\u8981\u4ECE\u4E00\u6B21\u60C5\u7EEA\u63A8\u51FA\u6027\u683C\uFF1B\u4E0D\u8981\u628A\u7528\u6237\u5BF9\u89D2\u8272\u7684\u8981\u6C42\u5199\u6210\u89D2\u8272\u7684\u6027\u683C\uFF0C\u9664\u975E\u89C2\u5BDF\u663E\u793A\u89D2\u8272\u786E\u5B9E\u8FD9\u6837\u505A\u3002\u6CA1\u6709\u9700\u8981\u7684\u6539\u52A8\u65F6\u8FD4\u56DE {\"edits\":[]}\uFF0C\u8FD9\u662F\u6700\u5E38\u89C1\u7684\u7ED3\u679C\u3002";
export type PersonaGenerator = (system: string, user: string, signal: AbortSignal) => Promise<string>;
/** Runs one synthesis when due. Model failure leaves the document and pending count untouched. */
export declare function synthesizePersona(store: Store, scope: Scope, generate: PersonaGenerator, signal: AbortSignal, now?: number): Promise<{
    doc: PersonaDoc;
    diff: PersonaDiff;
} | undefined>;
/** Deterministic text for the stable layer: no dates, fixed order. */
export declare function renderPersona(doc: PersonaDoc, maxChars?: number): string;
