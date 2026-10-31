import { Engine } from '../companion/index.js';
import { type Memory, type Scope } from '../memory/index.js';
import type { Generator, LearningJob } from './model.js';
export { LEARNING_PROMPT } from './prompts/organizer.js';
/** Maps "c3" / 3 / "3" (or a known uuid) to a candidate id. Anything else is left for apply() to reject. */
export declare function resolveCandidateRef(value: unknown, ids: string[]): unknown;
/** Each model call gets its own budget; reasoning models can need well over a minute. */
export declare const LEARNING_CALL_TIMEOUT_MS = 180000;
/** A failed job is not retried in the same pass; the next pass comes with new work or after this delay. */
export declare const LEARNING_RETRY_DELAY_MS = 60000;
export declare class Learner {
    engine: Engine;
    generate?: ((job: LearningJob) => Generator | undefined) | undefined;
    running: boolean;
    controller: AbortController;
    private retryTimer;
    constructor(engine: Engine, generate?: ((job: LearningJob) => Generator | undefined) | undefined);
    enqueue(job: LearningJob): void;
    drain(): Promise<void>;
    private scheduleRetry;
    /**
     * Low-frequency upkeep after a committed job: persona synthesis when enough new evidence has
     * accumulated. Failures here never fail the job; the pending count stays for the next run.
     */
    maintain(scope: Scope, changed: Memory[], generator: Generator, signal: AbortSignal): Promise<void>;
    retry(scope: Scope): void;
    close(): Promise<void>;
}
