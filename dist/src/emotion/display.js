export const moodLabels = {
    calm: '平静',
    steady: '平静',
    happy: '开心',
    hopeful: '期待',
    concerned: '担心',
    discouraged: '沮丧',
    annoyed: '不满',
    shy: '害羞',
    relieved: '释然',
};
const moodAssets = {
    calm: 'calm',
    steady: 'calm',
    hopeful: 'hopeful',
    concerned: 'concerned',
    happy: 'happy',
    relieved: 'relieved',
    shy: 'shy',
    discouraged: 'discouraged',
    annoyed: 'annoyed',
};
export function moodAsset(mood) {
    return (mood && moodAssets[mood]) || 'calm';
}
/** Below this the character looks calm, even if a faint state still exists. */
export const DISPLAY_THRESHOLD = 0.1;
/** A shown mood stays at least this long unless its cause changes or ends. */
export const MIN_DWELL_MS = 10 * 60_000;
/** A competing state must be clearly stronger to interrupt the dwell. */
const SWITCH_MARGIN = 0.15;
export function strengthLabel(effective) {
    if (effective < 0.2) {
        return '轻微';
    }
    if (effective < 0.4) {
        return '明显';
    }
    return '强烈';
}
/**
 * Picks the mood to show from active states (strongest first), with hysteresis so a single
 * remark does not flip the face. A changed or ended cause switches immediately.
 */
export function pickDisplayedMood(active, previous, now = Date.now()) {
    const shown = active.filter((state) => state.effectiveIntensity >= DISPLAY_THRESHOLD);
    const strongest = shown[0];
    const calm = (since) => ({ stateId: '', mood: 'calm', since });
    const prior = previous && shown.find((state) => state.id === previous.stateId);
    const priorStillValid = prior && prior.mood === previous.mood;
    if (priorStillValid) {
        const dwelling = now - Date.parse(previous.since) < MIN_DWELL_MS;
        const overtaken = strongest &&
            strongest.id !== prior.id &&
            (!dwelling || strongest.effectiveIntensity > prior.effectiveIntensity + SWITCH_MARGIN);
        if (!overtaken) {
            return { state: prior, displayed: previous };
        }
    }
    const at = new Date(now).toISOString();
    if (!strongest) {
        return { displayed: previous && !previous.stateId ? previous : calm(at) };
    }
    return { state: strongest, displayed: { stateId: strongest.id, mood: strongest.mood, since: at } };
}
/**
 * States for the conversation context: those of this project plus the background mood.
 * Relevance comes from scope (same project / relationship), not from keyword overlap.
 */
export function statesForContext(active, limit = 2) {
    return active.filter((state) => state.effectiveIntensity >= DISPLAY_THRESHOLD).slice(0, limit);
}
//# sourceMappingURL=display.js.map