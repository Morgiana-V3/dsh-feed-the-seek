import type { Source } from '../memory/index.js';
/** Redact before persistence and before any background-model request. Never log credential bodies. */
export declare function redactSecrets(text: string): string;
export declare function safeSource(source: Source): Source;
export declare function redactJsonText(text: string): string;
