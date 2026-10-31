import type { Mood, State } from './model.js';
export declare const moodLabels: Record<Mood, string>;
/** Each current mood has its own portrait; the legacy steady name shares calm. */
export type MoodAsset = Exclude<Mood, 'steady'>;
export declare function moodAsset(mood: Mood | undefined): MoodAsset;
/** Below this the character looks calm, even if a faint state still exists. */
export declare const DISPLAY_THRESHOLD = 0.1;
/** A shown mood stays at least this long unless its cause changes or ends. */
export declare const MIN_DWELL_MS: number;
export declare function strengthLabel(effective: number): string;
export interface DisplayedMood {
    stateId: string;
    mood: Mood;
    since: string;
}
/**
 * Picks the mood to show from active states (strongest first), with hysteresis so a single
 * remark does not flip the face. A changed or ended cause switches immediately.
 */
export declare function pickDisplayedMood(active: State[], previous: DisplayedMood | undefined, now?: number): {
    state?: State;
    displayed: DisplayedMood;
};
/**
 * States for the conversation context: those of this project plus the background mood.
 * Relevance comes from scope (same project / relationship), not from keyword overlap.
 */
export declare function statesForContext(active: State[], limit?: number): State[];
