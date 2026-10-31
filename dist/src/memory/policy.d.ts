import type { Memory, Operation, Source } from './model.js';
/** Only obvious acknowledgements/arithmetic are skipped; ambiguous feedback still reaches the organizer. */
export declare function isLowInformation(text: string): boolean;
/** Eligibility for model-visible memory; legacy promises remain inspectable without steering replies. */
export declare function isRecallable(memory: Memory): boolean;
/** Semantic importance is model judged, but source/category requirements are enforced in code. */
export declare function retentionRejection(operation: Operation, kind: Memory['kind'], sources: Source[], quoteSupported: boolean): string;
