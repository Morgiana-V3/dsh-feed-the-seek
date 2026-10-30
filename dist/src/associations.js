import { sameOwner } from './types.js';
const genericTags = new Set(['用户', '记忆', '工作', '项目', '知识', '对话', '偏好', '情绪']);
function anchors(memory) {
    const tags = memory.tags
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length >= 2 && !genericTags.has(tag))
        .map((tag) => `共同标签：${tag}`);
    const domain = memory.knowledge.domain.trim().toLowerCase();
    if (domain.length >= 2) {
        tags.push(`共同对象：${domain}`);
    }
    return [...new Set([...tags, ...memory.sources.map((source) => `共同来源：${source}`)])];
}
function canAssociate(left, right) {
    if (left.id === right.id || !sameOwner(left.scope, right.scope)) {
        return false;
    }
    if (left.scope.project && right.scope.project && left.scope.project !== right.scope.project) {
        return false;
    }
    const leftEdition = left.knowledge.edition;
    const rightEdition = right.knowledge.edition;
    return !leftEdition || !rightEdition || leftEdition === rightEdition;
}
// Relationships are derived from persisted evidence. They are navigation hints,
// never additional facts. Rebuilding makes updates and invalidation take effect immediately.
export function associateMemories(memories) {
    const activeMemories = memories
        .filter((memory) => memory.status === 'active')
        .slice()
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    const invertedIndex = new Map();
    for (const memory of activeMemories) {
        for (const anchor of anchors(memory)) {
            const bucket = invertedIndex.get(anchor) || [];
            // Very common anchors are not useful links; bound work for large archives.
            if (bucket.length < 41) {
                bucket.push(memory);
                invertedIndex.set(anchor, bucket);
            }
        }
    }
    const associations = [];
    for (const memory of activeMemories) {
        const candidates = new Map();
        for (const anchor of anchors(memory)) {
            const bucket = invertedIndex.get(anchor) || [];
            if (bucket.length > 40) {
                continue;
            }
            for (const neighbor of bucket) {
                if (!canAssociate(memory, neighbor)) {
                    continue;
                }
                const reasons = candidates.get(neighbor.id) || [];
                reasons.push(anchor);
                candidates.set(neighbor.id, reasons);
            }
        }
        const nearest = [...candidates.entries()]
            .sort((left, right) => right[1].length - left[1].length)
            .slice(0, 4);
        for (const [targetId, reasons] of nearest) {
            associations.push({ from: memory.id, to: targetId, reasons: reasons.slice(0, 3) });
        }
    }
    return associations;
}
//# sourceMappingURL=associations.js.map