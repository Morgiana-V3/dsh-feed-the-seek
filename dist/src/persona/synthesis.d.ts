import { z } from 'zod';
import type { Memory, Scope } from '../memory/index.js';
import type { Store } from '../storage/index.js';
export { PERSONA_PROMPT } from './prompts/synthesis.js';
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
/** Scenes of one observation; a merged observation can span several conversations. */
export type SceneKeys = (memory: Memory) => string[];
/** Without a store (pure tests, records whose sources are gone) the domain stands in for the scene. */
export declare const domainScenes: SceneKeys;
export declare function sessionScenes(store: Store): SceneKeys;
/**
 * Consolidation replaces observations with a merged one. Persona lines and the stable layer
 * check that every piece of evidence is still active, so the old ids must point to the new one,
 * or each merge would silently drop the lines it supported.
 */
export declare function remapPersonaEvidence(store: Store, persona: string, mapping: Map<string, string>): void;
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
        values: "values";
        self: "self";
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
            values: "values";
            self: "self";
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
export declare function admission(section: PersonaSection, observations: Memory[], sceneKeys?: SceneKeys): string;
/**
 * Pure: applies proposed edits against numbered observations. Never trusts the model's claim
 * that evidence is sufficient — it counts scenes and days itself.
 */
export declare function applyPersonaEdits(doc: PersonaDoc, edits: PersonaEdit[], observations: Memory[], now?: number, sceneKeys?: SceneKeys): {
    doc: PersonaDoc;
    diff: PersonaDiff;
};
/** Per scene: newest ∪ most important ∪ earliest, so time span is visible; scenes rotate when trimming. */
export declare function personaInput(store: Store, scope: Scope, sceneKeys?: SceneKeys): Memory[];
export type PersonaGenerator = (system: string, user: string, signal: AbortSignal) => Promise<string>;
/** Runs one synthesis when due. Model failure leaves the document and pending count untouched. */
export declare function synthesizePersona(store: Store, scope: Scope, generate: PersonaGenerator, signal: AbortSignal, now?: number): Promise<{
    doc: PersonaDoc;
    diff: PersonaDiff;
} | undefined>;
/** Deterministic text for the stable layer: no dates, fixed order. */
export declare function renderPersona(doc: PersonaDoc, maxChars?: number): string;
