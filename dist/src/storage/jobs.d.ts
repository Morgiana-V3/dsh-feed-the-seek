import type { DatabaseSync } from 'node:sqlite';
import type { Scope } from '../memory/index.js';
/** Attempts per job before it waits for a manual retry. */
export declare const MAX_JOB_ATTEMPTS = 3;
export interface LearningJobRow {
    id: string;
    payload: string;
    status: string;
    attempts: number;
    error: string;
    updated_at: string;
}
/** Uses the Store's connection so completion participates in the memory transaction. */
export declare class LearningJobs {
    private database;
    constructor(database: DatabaseSync);
    recover(): void;
    enqueue(id: string, payload: string): void;
    pending(): LearningJobRow[];
    start(id: string): void;
    complete(id: string): void;
    /**
     * A failure with attempts left goes back to pending (keeping its error, so the page can say a
     * retry is coming); after the last attempt it stays failed until the user retries.
     */
    fail(id: string, message: string): void;
    /** A job that can never run (for example, it lacks the model to organize with). */
    giveUp(id: string, message: string): void;
    /** Manual retry of one owner's failed jobs, with a fresh attempt budget. */
    retry(scope: Scope): void;
    /** Changes whenever one of the owner's listed jobs changes status, attempts or time. */
    changeKey(scope: Scope, limit?: number): string;
    list(scope: Scope, limit?: number): Omit<LearningJobRow, 'payload'>[];
}
