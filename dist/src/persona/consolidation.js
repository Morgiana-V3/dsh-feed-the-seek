import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sameOwner } from '../memory/index.js';
import { SELF_CONSOLIDATION_PROMPT } from './prompts/consolidation.js';
import { remapPersonaEvidence, resolveIndexes } from './synthesis.js';
export { SELF_CONSOLIDATION_PROMPT } from './prompts/consolidation.js';
/**
 * Self observations barely fade, so they need their own compaction (from the earlier bot's
 * "self 精炼"). Above the limit the model proposes merges by index; the code adds the merged
 * observation first and retires the originals after, then checks the count really went down.
 */
export const SELF_LIMIT = 20;
const Merge = z.object({
    merged: z
        .array(z.object({
        text: z.string().trim().min(1).max(200),
        sourceIndexes: z.array(z.unknown()).max(20),
        selfKind: z.string().optional(),
    }))
        .max(10),
});
const STRENGTH = {
    claim: 0,
    intention: 0,
    feedback: 1,
    behavior: 2,
    verified: 3,
};
/** The merged observation can only claim what its sources jointly support. */
function weakestKind(sources) {
    return sources
        .map((memory) => memory.selfKind || 'claim')
        .sort((leftSelfKind, rightSelfKind) => STRENGTH[leftSelfKind] - STRENGTH[rightSelfKind])[0];
}
export function selfObservations(store, scope) {
    return store
        .memories()
        .filter((memory) => memory.kind === 'self' && sameOwner(memory.scope, scope))
        .sort((leftMemory, rightMemory) => leftMemory.createdAt.localeCompare(rightMemory.createdAt));
}
export async function consolidateSelf(store, scope, generate, signal) {
    const all = selfObservations(store, scope);
    if (all.length <= SELF_LIMIT) {
        return undefined;
    }
    // Observations behind a formed tendency are left alone; merging them would withdraw it.
    const items = all.filter((memory) => !memory.alias && !store.trait(memory.id)).slice(-200);
    const raw = await generate(SELF_CONSOLIDATION_PROMPT, JSON.stringify(items.map((memory, index) => ({
        index,
        text: memory.text,
        scope: memory.scope,
        knowledge: memory.knowledge,
        selfKind: memory.selfKind || 'claim',
        date: memory.createdAt.slice(0, 10),
    }))), signal);
    const proposal = Merge.parse(JSON.parse(raw
        .trim()
        .replace(/^```(?:json)?\s*/, '')
        .replace(/\s*```$/, '')));
    const used = new Set();
    const now = new Date().toISOString();
    let merged = 0;
    const remapped = new Map();
    store.transaction(() => {
        for (const entry of proposal.merged) {
            const indexes = resolveIndexes(entry.sourceIndexes, items.length).filter((index) => !used.has(index));
            if (indexes.length < 2 || [...entry.text].length > 60) {
                continue;
            }
            const originals = indexes.map((index) => items[index]);
            const first = originals[0];
            // The situation is what the observation is limited to (conditions, edition). The domain is a
            // free-written topic label: two spellings of one topic must not block a merge forever.
            const sameContext = originals.every((memory) => memory.knowledge.edition === first.knowledge.edition &&
                memory.knowledge.conditions.trim() === first.knowledge.conditions.trim());
            // A self description without evidence would drag an evidenced observation down to "record".
            const unverified = originals.filter((memory) => !memory.selfKind || memory.selfKind === 'claim' || memory.selfKind === 'intention').length;
            if (!sameContext || (unverified > 0 && unverified < originals.length)) {
                continue;
            }
            indexes.forEach((index) => used.add(index));
            const next = {
                id: randomUUID(),
                kind: 'self',
                text: entry.text,
                tags: [...new Set(originals.flatMap((memory) => memory.tags))].slice(0, 8),
                scope: { ...originals[0].scope, project: '' },
                evidence: originals.every((memory) => memory.evidence === 'explicit')
                    ? 'explicit'
                    : 'inferred',
                importance: Math.max(...originals.map((memory) => memory.importance)),
                status: 'active',
                version: 1,
                sources: [...new Set(originals.flatMap((memory) => memory.sources))],
                createdAt: originals.map((memory) => memory.createdAt).sort()[0],
                updatedAt: now,
                knowledge: first.knowledge,
                durability: first.durability,
                ...(originals.every((memory) => memory.retention?.basis === 'feedback')
                    ? { retention: first.retention }
                    : {}),
                confidence: Math.min(...originals.map((memory) => memory.confidence)),
                selfKind: weakestKind(originals),
            };
            // Add first, retire after: if anything fails the worst case is one extra observation.
            store.put(next);
            store.audit('MERGE', `自我观察精炼：合并 ${originals.length} 条`, undefined, next);
            for (const original of originals) {
                const retired = {
                    ...original,
                    status: 'inactive',
                    version: original.version + 1,
                    updatedAt: now,
                };
                store.put(retired);
                store.audit('MERGE', '已并入新的自我观察', original, retired);
            }
            merged++;
            for (const original of originals) {
                remapped.set(original.id, next.id);
            }
        }
        remapPersonaEvidence(store, scope.persona, remapped);
    });
    const after = selfObservations(store, scope).length;
    if (merged > 0 && after >= all.length) {
        store.audit('NONE', `自我观察精炼后条目数没有减少（${all.length} → ${after}），请检查合并结果`);
    }
    return { before: all.length, after, merged };
}
//# sourceMappingURL=consolidation.js.map