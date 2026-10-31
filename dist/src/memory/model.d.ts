import { z } from 'zod';
import { type State } from '../emotion/index.js';
export declare const Kind: z.ZodEnum<{
    cognition: "cognition";
    experience: "experience";
    resonance: "resonance";
    self: "self";
}>;
export type Kind = z.infer<typeof Kind>;
export declare const Scope: z.ZodObject<{
    user: z.ZodString;
    persona: z.ZodString;
    project: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
export type Scope = z.infer<typeof Scope>;
export interface Source {
    id: string;
    session: string;
    event?: string;
    role: string;
    text: string;
    at: string;
    scope: Scope;
}
export declare const Knowledge: z.ZodObject<{
    category: z.ZodDefault<z.ZodEnum<{
        person: "person";
        fact: "fact";
        rule: "rule";
        convention: "convention";
        opinion: "opinion";
        preference: "preference";
        event: "event";
        relationship: "relationship";
        tendency: "tendency";
    }>>;
    domain: z.ZodDefault<z.ZodString>;
    edition: z.ZodDefault<z.ZodString>;
    conditions: z.ZodDefault<z.ZodString>;
}, z.core.$strict>;
export type Knowledge = z.infer<typeof Knowledge>;
/**
 * How a memory takes part in conversations, as the settings page shows it:
 * pinned – carried in every conversation (the stable layer);
 * topical – recalled when the topic touches it;
 * faded – no longer recalled automatically, still found by a deliberate recall;
 * record – kept as a record only (unverified self descriptions are never recalled).
 */
export type Presence = 'pinned' | 'topical' | 'faded' | 'record';
export interface Memory {
    id: string;
    kind: Kind;
    text: string;
    tags: string[];
    scope: Scope;
    evidence: 'explicit' | 'inferred';
    importance: number;
    status: 'active' | 'inactive';
    version: number;
    sources: string[];
    createdAt: string;
    updatedAt: string;
    knowledge: Knowledge;
    confidence: number;
    /** How long the statement is meant to hold. Absent on records written before 0.2.15. */
    durability?: Durability;
    /** For self observations: what kind of evidence backs it. Absent on older records. */
    selfKind?: SelfKind;
    /** Naming fact: one name, of one kind. Kept apart so it never competes with other profile items. */
    alias?: Alias;
    /** Why this information deserves long-term retention; absent on legacy records. */
    retention?: Retention;
}
/**
 * user_preferred: what the user wants to be called (a newer one replaces the older);
 * user_nickname: a nickname seen in use (kept as history);
 * assistant_name: the name the user gave her (a newer one replaces the older).
 */
export declare const Alias: z.ZodObject<{
    kind: z.ZodEnum<{
        user_preferred: "user_preferred";
        user_nickname: "user_nickname";
        assistant_name: "assistant_name";
    }>;
    value: z.ZodString;
}, z.core.$strict>;
export type Alias = z.infer<typeof Alias>;
export declare const Durability: z.ZodEnum<{
    turn: "turn";
    situational: "situational";
    habit: "habit";
    lasting: "lasting";
}>;
export type Durability = z.infer<typeof Durability>;
/** behavior/verified need the tool trace; feedback needs a user source; intention and claim never count as growth. */
export declare const SelfKind: z.ZodEnum<{
    behavior: "behavior";
    feedback: "feedback";
    intention: "intention";
    claim: "claim";
    verified: "verified";
}>;
export type SelfKind = z.infer<typeof SelfKind>;
export declare const Retention: z.ZodObject<{
    basis: z.ZodEnum<{
        preference: "preference";
        relationship: "relationship";
        feedback: "feedback";
        knowledge: "knowledge";
        milestone: "milestone";
    }>;
    reason: z.ZodString;
}, z.core.$strict>;
export type Retention = z.infer<typeof Retention>;
export declare const Operation: z.ZodObject<{
    action: z.ZodEnum<{
        ADD: "ADD";
        UPDATE: "UPDATE";
        DELETE: "DELETE";
        NONE: "NONE";
    }>;
    target: z.ZodOptional<z.ZodString>;
    expectedVersion: z.ZodOptional<z.ZodNumber>;
    kind: z.ZodOptional<z.ZodEnum<{
        cognition: "cognition";
        experience: "experience";
        resonance: "resonance";
        self: "self";
    }>>;
    text: z.ZodOptional<z.ZodString>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
    evidence: z.ZodDefault<z.ZodEnum<{
        explicit: "explicit";
        inferred: "inferred";
    }>>;
    importance: z.ZodDefault<z.ZodNumber>;
    confidence: z.ZodDefault<z.ZodNumber>;
    knowledge: z.ZodPrefault<z.ZodObject<{
        category: z.ZodDefault<z.ZodEnum<{
            person: "person";
            fact: "fact";
            rule: "rule";
            convention: "convention";
            opinion: "opinion";
            preference: "preference";
            event: "event";
            relationship: "relationship";
            tendency: "tendency";
        }>>;
        domain: z.ZodDefault<z.ZodString>;
        edition: z.ZodDefault<z.ZodString>;
        conditions: z.ZodDefault<z.ZodString>;
    }, z.core.$strict>>;
    consolidate: z.ZodDefault<z.ZodBoolean>;
    userQuote: z.ZodOptional<z.ZodString>;
    durability: z.ZodOptional<z.ZodEnum<{
        turn: "turn";
        situational: "situational";
        habit: "habit";
        lasting: "lasting";
    }>>;
    selfKind: z.ZodOptional<z.ZodEnum<{
        behavior: "behavior";
        feedback: "feedback";
        intention: "intention";
        claim: "claim";
        verified: "verified";
    }>>;
    alias: z.ZodOptional<z.ZodObject<{
        kind: z.ZodEnum<{
            user_preferred: "user_preferred";
            user_nickname: "user_nickname";
            assistant_name: "assistant_name";
        }>;
        value: z.ZodString;
    }, z.core.$strict>>;
    retention: z.ZodOptional<z.ZodObject<{
        basis: z.ZodEnum<{
            preference: "preference";
            relationship: "relationship";
            feedback: "feedback";
            knowledge: "knowledge";
            milestone: "milestone";
        }>;
        reason: z.ZodString;
    }, z.core.$strict>>;
    global: z.ZodDefault<z.ZodBoolean>;
    sources: z.ZodArray<z.ZodString>;
    reason: z.ZodString;
}, z.core.$strict>;
export type Operation = z.infer<typeof Operation>;
export declare const Proposal: z.ZodObject<{
    operations: z.ZodArray<z.ZodObject<{
        action: z.ZodEnum<{
            ADD: "ADD";
            UPDATE: "UPDATE";
            DELETE: "DELETE";
            NONE: "NONE";
        }>;
        target: z.ZodOptional<z.ZodString>;
        expectedVersion: z.ZodOptional<z.ZodNumber>;
        kind: z.ZodOptional<z.ZodEnum<{
            cognition: "cognition";
            experience: "experience";
            resonance: "resonance";
            self: "self";
        }>>;
        text: z.ZodOptional<z.ZodString>;
        tags: z.ZodDefault<z.ZodArray<z.ZodString>>;
        evidence: z.ZodDefault<z.ZodEnum<{
            explicit: "explicit";
            inferred: "inferred";
        }>>;
        importance: z.ZodDefault<z.ZodNumber>;
        confidence: z.ZodDefault<z.ZodNumber>;
        knowledge: z.ZodPrefault<z.ZodObject<{
            category: z.ZodDefault<z.ZodEnum<{
                person: "person";
                fact: "fact";
                rule: "rule";
                convention: "convention";
                opinion: "opinion";
                preference: "preference";
                event: "event";
                relationship: "relationship";
                tendency: "tendency";
            }>>;
            domain: z.ZodDefault<z.ZodString>;
            edition: z.ZodDefault<z.ZodString>;
            conditions: z.ZodDefault<z.ZodString>;
        }, z.core.$strict>>;
        consolidate: z.ZodDefault<z.ZodBoolean>;
        userQuote: z.ZodOptional<z.ZodString>;
        durability: z.ZodOptional<z.ZodEnum<{
            turn: "turn";
            situational: "situational";
            habit: "habit";
            lasting: "lasting";
        }>>;
        selfKind: z.ZodOptional<z.ZodEnum<{
            behavior: "behavior";
            feedback: "feedback";
            intention: "intention";
            claim: "claim";
            verified: "verified";
        }>>;
        alias: z.ZodOptional<z.ZodObject<{
            kind: z.ZodEnum<{
                user_preferred: "user_preferred";
                user_nickname: "user_nickname";
                assistant_name: "assistant_name";
            }>;
            value: z.ZodString;
        }, z.core.$strict>>;
        retention: z.ZodOptional<z.ZodObject<{
            basis: z.ZodEnum<{
                preference: "preference";
                relationship: "relationship";
                feedback: "feedback";
                knowledge: "knowledge";
                milestone: "milestone";
            }>;
            reason: z.ZodString;
        }, z.core.$strict>>;
        global: z.ZodDefault<z.ZodBoolean>;
        sources: z.ZodArray<z.ZodString>;
        reason: z.ZodString;
    }, z.core.$strict>>;
    state: z.ZodOptional<z.ZodNullable<z.ZodObject<{
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
    }, z.core.$strict>>>;
}, z.core.$strict>;
export type Proposal = z.infer<typeof Proposal>;
export interface RecallItem {
    memory: Memory;
    score: number;
    reasons: string[];
}
export interface Snapshot {
    query: string;
    scope: Scope;
    items: RecallItem[];
    states: State[];
    context: string;
    mode: 'keyword' | 'hybrid';
    note: string;
    revision: number;
}
export declare const DEFAULT_SCOPE: Scope;
export declare function sameOwner(leftScope: Scope, rightScope: Scope): boolean;
/**
 * One companion, one memory: nothing is split by project or session. The project
 * field stays readable on older records but no longer limits where a memory applies.
 */
export declare function visible(leftScope: Scope, rightScope: Scope): boolean;
