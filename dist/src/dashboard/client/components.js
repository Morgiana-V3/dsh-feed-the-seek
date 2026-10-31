import * as React from 'react';
import { dateLabel } from './api.js';
export const memoryKindLabels = {
    cognition: '认知',
    experience: '经历',
    resonance: '共鸣',
    self: '自我',
};
export const selfKindLabels = {
    behavior: '观察到的行为',
    feedback: '你的反馈',
    intention: '我的打算 · 还没做到',
    claim: '我自己说的 · 未验证',
    verified: '已验证的改变',
};
export { moodLabels } from '../../emotion/index.js';
/** Placeholder names from older versions are shown as "not named yet" rather than as a code-ish label. */
export function displayName(name) {
    return !name || name === '初始实例' || name === '初始伙伴' ? '还没有名字的她' : name;
}
// 12×12 pixel glyphs. Drawn as crisp rectangles so they match the Zpix font
// at every zoom level instead of depending on which fallback font has ◈ / ⚙.
const pixelGlyphs = {
    fish: [
        '............',
        '...####.....',
        '..######..##',
        '.########.##',
        '##.#######.#',
        '##########..',
        '##########..',
        '.##########.',
        '..######..##',
        '...####...##',
        '............',
        '............',
    ],
    overview: [
        '............',
        '.####..####.',
        '.####..####.',
        '.####..####.',
        '.####..####.',
        '............',
        '............',
        '.####..####.',
        '.####..####.',
        '.####..####.',
        '.####..####.',
        '............',
    ],
    memories: [
        '............',
        '.#########..',
        '.#.......#..',
        '.#.#####.#..',
        '.#.......#..',
        '.#.#####.#..',
        '.#.......#..',
        '.#.###...#..',
        '.#.......#..',
        '.#########..',
        '..#########.',
        '............',
    ],
    settings: [
        '.....##.....',
        '..#.####.#..',
        '.##########.',
        '..###..###..',
        '.###....###.',
        '####....####',
        '####....####',
        '.###....###.',
        '..###..###..',
        '.##########.',
        '..#.####.#..',
        '.....##.....',
    ],
    refresh: [
        '............',
        '....####.#..',
        '..##....##..',
        '.#.....###..',
        '.#..........',
        '#...........',
        '#...........',
        '.#.......#..',
        '.#.......#..',
        '..##....#...',
        '....####....',
        '............',
    ],
    cognition: [
        '.....##.....',
        '....#..#....',
        '...#....#...',
        '..#......#..',
        '.#........#.',
        '#....##....#',
        '#....##....#',
        '.#........#.',
        '..#......#..',
        '...#....#...',
        '....#..#....',
        '.....##.....',
    ],
    experience: [
        '............',
        '.##########.',
        '.#........#.',
        '.#.######.#.',
        '.#........#.',
        '.#.######.#.',
        '.#........#.',
        '.#.####...#.',
        '.#........#.',
        '.##########.',
        '............',
        '............',
    ],
    resonance: [
        '............',
        '.###...###..',
        '#####.#####.',
        '###########.',
        '###########.',
        '.#########..',
        '..#######...',
        '...#####....',
        '....###.....',
        '.....#......',
        '............',
        '............',
    ],
    self: [
        '.....#......',
        '.....#......',
        '....###.....',
        '....###.....',
        '.#########..',
        '...#####....',
        '....###.....',
        '....#.#.....',
        '...#...#....',
        '..#.....#...',
        '............',
        '............',
    ],
    search: [
        '............',
        '..####......',
        '.#....#.....',
        '#......#....',
        '#......#....',
        '#......#....',
        '#......#....',
        '.#....#.....',
        '..#####.....',
        '......###...',
        '.......###..',
        '........##..',
    ],
    download: [
        '.....##.....',
        '.....##.....',
        '.....##.....',
        '.....##.....',
        '..########..',
        '...######...',
        '....####....',
        '.....##.....',
        '............',
        '#..........#',
        '#..........#',
        '############',
    ],
    close: [
        '............',
        '.##......##.',
        '..##....##..',
        '...##..##...',
        '....####....',
        '.....##.....',
        '....####....',
        '...##..##...',
        '..##....##..',
        '.##......##.',
        '............',
        '............',
    ],
};
const glyphPaths = Object.fromEntries(Object.entries(pixelGlyphs).map(([name, rows]) => [
    name,
    rows
        .flatMap((row, y) => [...row].map((cell, x) => (cell === '#' ? `M${x} ${y}h1v1h-1z` : '')))
        .join(''),
]));
export function PixelIcon({ name, size = 12, className, }) {
    return (React.createElement("svg", { className: 'fish-icon' + (className ? ' ' + className : ''), width: size, height: size, viewBox: "0 0 12 12", shapeRendering: "crispEdges", "aria-hidden": "true", focusable: "false" },
        React.createElement("path", { d: glyphPaths[name], fill: "currentColor" })));
}
export function EmptyState({ title, children }) {
    return (React.createElement("div", { className: "fish-empty" },
        React.createElement(PixelIcon, { name: "cognition", size: 36, className: "fish-empty-icon" }),
        React.createElement("strong", null, title),
        children && React.createElement("p", null, children)));
}
export function Toggle({ label, description, checked, disabled, pending, inactive, className, onChange, }) {
    return (React.createElement("label", { className: 'fish-toggle-row' + (className ? ' ' + className : ''), "data-checked": checked, "data-inactive": inactive || undefined, "aria-busy": pending || undefined },
        React.createElement("span", null,
            React.createElement("strong", null, label),
            description && React.createElement("small", null, description)),
        React.createElement("span", { className: "fish-switch" },
            React.createElement("input", { type: "checkbox", role: "switch", checked: checked, disabled: disabled, onChange: (event) => onChange(event.target.checked) }),
            React.createElement("span", { className: "fish-switch-track", "aria-hidden": "true" }))));
}
/**
 * One answer to "will this memory affect a conversation?", in place of the old
 * stated/guessed, precious and clarity marks that each described an internal field.
 */
/**
 * What background organizing is doing. A pending job that already carries an error failed once
 * and waits for its automatic retry; only "failed" needs the user.
 */
export function learningActivity(jobs) {
    const working = jobs.filter((job) => job.status === 'running' || (job.status === 'pending' && !job.error));
    const retrying = jobs.filter((job) => job.status === 'pending' && !!job.error);
    const failed = jobs.filter((job) => job.status === 'failed');
    // Jobs are newest first; the latest reason is the one worth showing.
    const reason = (failed[0] || retrying[0])?.error?.replace(/^\w*Error:\s*/, '') || '';
    return { working: working.length, retrying: retrying.length, failed: failed.length, reason };
}
export const presenceLabels = {
    pinned: { label: '常驻', hint: '每次对话都会带上：称呼、性格、你的长期要求和最近的自我变化。' },
    topical: { label: '相关时想起', hint: '话题相关时自动想起。' },
    faded: { label: '已淡忘', hint: '很久没用到，不再自动想起；主动回忆时仍能找到。' },
    record: { label: '仅作记录', hint: '未经验证的自我描述，只保留记录，不参与对话。' },
};
export function PresenceTag({ presence }) {
    if (!presence) {
        return null;
    }
    const { label, hint } = presenceLabels[presence];
    return (React.createElement("span", { className: "fish-presence", "data-presence": presence, title: hint },
        React.createElement("i", { "aria-hidden": "true" }),
        label));
}
export function MemoryCard({ memory, compact = false, isNew = false, index = 0, footer, }) {
    // Edition and conditions are real limits; the free-written topic label is not shown.
    const limits = [
        memory.knowledge.edition && `版本 ${memory.knowledge.edition}`,
        memory.knowledge.conditions,
    ]
        .filter(Boolean)
        .join('；');
    return (React.createElement("article", { className: `fish-memory-card fish-kind-border-${memory.kind}` + (isNew ? ' is-new' : ''), style: { '--fish-index': Math.min(index, 8) } },
        React.createElement("div", { className: "fish-record-meta" },
            React.createElement("span", { className: `fish-kind fish-kind-${memory.kind}` }, memoryKindLabels[memory.kind]),
            React.createElement(PresenceTag, { presence: memory.presence }),
            memory.kind !== 'self' && memory.evidence === 'inferred' && (React.createElement("span", { className: "fish-inferred", title: "\u6839\u636E\u5BF9\u8BDD\u63A8\u6D4B\uFF0C\u4E0D\u662F\u4F60\u76F4\u63A5\u8BF4\u7684\uFF1B\u4E0D\u5BF9\u7684\u8BDD\u5728\u5BF9\u8BDD\u91CC\u7EA0\u6B63\u5373\u53EF\u3002" }, "\u63A8\u6D4B")),
            memory.kind === 'self' && memory.selfKind && (React.createElement("span", { className: "fish-self-basis", "data-unverified": memory.selfKind === 'claim' || memory.selfKind === 'intention' || undefined }, selfKindLabels[memory.selfKind])),
            isNew && React.createElement("span", { className: "fish-new-badge" }, "\u65B0"),
            React.createElement("span", { className: "fish-record-meta-end" },
                React.createElement("time", { dateTime: memory.updatedAt }, dateLabel(memory.updatedAt)))),
        React.createElement("p", null, memory.text),
        !compact && React.createElement(React.Fragment, null, limits && React.createElement("p", { className: "fish-muted" },
            "\u9002\u7528\u6761\u4EF6\uFF1A",
            limits)),
        footer));
}
/**
 * Remembers which memory ids were present on the previous snapshot so newly
 * learned memories can flash once. Nothing is "new" on the first render.
 */
export function useNewMemoryIds(state) {
    const seenRef = React.useRef(null);
    const timerRef = React.useRef(undefined);
    const [fresh, setFresh] = React.useState(() => new Set());
    const ids = state.memories.map((memory) => `${memory.id}:${memory.version}`).join('|');
    React.useEffect(() => {
        const current = new Set(state.memories.map((memory) => `${memory.id}:${memory.version}`));
        const seen = seenRef.current;
        seenRef.current = { persona: state.scope.persona, ids: current };
        if (!seen || seen.persona !== state.scope.persona) {
            return;
        }
        const added = [...current]
            .filter((key) => !seen.ids.has(key))
            .map((key) => key.slice(0, key.lastIndexOf(':')));
        if (added.length > 0) {
            clearTimeout(timerRef.current);
            setFresh(new Set(added));
            timerRef.current = setTimeout(() => setFresh(new Set()), 6000);
        }
    }, [ids, state.scope.persona]);
    React.useEffect(() => () => clearTimeout(timerRef.current), []);
    return fresh;
}
//# sourceMappingURL=components.js.map