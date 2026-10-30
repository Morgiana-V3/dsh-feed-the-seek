import * as React from 'react';
import { dateLabel, projectLabel } from './api.js';
export const memoryKindLabels = {
    cognition: '知道的事',
    experience: '一起经历的',
    resonance: '我们之间',
    self: '关于我自己',
};
export const selfKindLabels = {
    behavior: '观察到的行为',
    feedback: '你的反馈',
    intention: '我的打算 · 还没做到',
    claim: '我自己说的 · 未验证',
    verified: '已验证的改变',
};
export const durabilityLabels = {
    situational: '仅限情境',
    habit: '习惯',
    lasting: '长期',
};
export { moodLabels } from '../mood.js';
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
export function Toggle({ label, description, checked, disabled, pending, onChange, }) {
    return (React.createElement("label", { className: "fish-toggle-row", "data-checked": checked, "aria-busy": pending || undefined },
        React.createElement("span", null,
            React.createElement("strong", null, label),
            description && React.createElement("small", null, description)),
        React.createElement("span", { className: "fish-switch" },
            React.createElement("input", { type: "checkbox", role: "switch", checked: checked, disabled: disabled, onChange: (event) => onChange(event.target.checked) }),
            React.createElement("span", { className: "fish-switch-track", "aria-hidden": "true" }))));
}
/** Five-cell pixel meter; used for activation (recency decay). */
export function PixelMeter({ value, label }) {
    const filled = Math.max(0, Math.min(5, Math.round(value * 5)));
    return (React.createElement("span", { className: "fish-meter", role: "img", "aria-label": `${label} ${Math.round(value * 100)}%`, title: `${label} ${Math.round(value * 100)}%` }, Array.from({ length: 5 }, (_, index) => (React.createElement("i", { key: index, "data-on": index < filled })))));
}
export function MemoryCard({ memory, state, compact = false, isNew = false, index = 0, footer, }) {
    const related = (state.associations || [])
        .filter((association) => association.from === memory.id)
        .map((association) => ({
        association,
        memory: state.memories.find((candidate) => candidate.id === association.to),
    }))
        .filter((entry) => entry.memory?.status === 'active');
    return (React.createElement("article", { className: `fish-memory-card fish-kind-border-${memory.kind}` + (isNew ? ' is-new' : ''), style: { '--fish-index': Math.min(index, 8) } },
        React.createElement("div", { className: "fish-record-meta" },
            React.createElement("span", { className: `fish-kind fish-kind-${memory.kind}` }, memoryKindLabels[memory.kind]),
            React.createElement("span", null, memory.evidence === 'explicit' ? '你亲口说的' : '我猜的'),
            isNew && React.createElement("span", { className: "fish-new-badge" }, "\u65B0"),
            React.createElement("span", { className: "fish-record-meta-end" },
                typeof memory.activation === 'number' && (React.createElement(PixelMeter, { value: memory.activation, label: "\u5370\u8C61\u6DF1\u6D45" })),
                React.createElement("time", { dateTime: memory.updatedAt }, dateLabel(memory.updatedAt)))),
        React.createElement("p", null, memory.text),
        !compact && (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "fish-tags" },
                memory.knowledge.domain && React.createElement("span", null, memory.knowledge.domain),
                memory.knowledge.edition && React.createElement("span", null,
                    "\u7248\u672C ",
                    memory.knowledge.edition),
                memory.scope.project && (React.createElement("span", { title: memory.scope.project }, projectLabel(memory.scope.project))),
                memory.kind === 'self' && memory.selfKind && (React.createElement("span", { "data-unverified": memory.selfKind === 'claim' || memory.selfKind === 'intention' || undefined }, selfKindLabels[memory.selfKind])),
                memory.durability && memory.durability !== 'turn' && (React.createElement("span", null, durabilityLabels[memory.durability])),
                typeof memory.confidence === 'number' && (React.createElement("span", null,
                    "\u628A\u63E1 ",
                    Math.round(memory.confidence * 100),
                    "%"))),
            memory.knowledge.conditions && (React.createElement("p", { className: "fish-muted" },
                "\u9002\u7528\u6761\u4EF6\uFF1A",
                memory.knowledge.conditions)),
            related.length > 0 && (React.createElement("details", { className: "fish-source fish-related" },
                React.createElement("summary", null,
                    "\u76F8\u5173\u7684\u8BB0\u5FC6 \u00B7 ",
                    related.length),
                React.createElement("div", { className: "fish-fold-body" }, related.map((entry) => (React.createElement("blockquote", { key: entry.association.to },
                    React.createElement("p", null, entry.memory.text),
                    React.createElement("small", null, entry.association.reasons
                        .map((reason) => reason.startsWith('共同来源：') ? '同一条对话来源' : reason)
                        .join(' · ')))))))),
            React.createElement("details", { className: "fish-source" },
                React.createElement("summary", null,
                    "\u5F53\u65F6\u7684\u539F\u8BDD",
                    memory.version > 1 ? ` · 改过 ${memory.version - 1} 次` : ''),
                React.createElement("div", { className: "fish-fold-body" }, memory.sources.map((sourceId) => {
                    const source = state.sources[sourceId];
                    if (!source) {
                        return null;
                    }
                    return (React.createElement("blockquote", { key: sourceId },
                        React.createElement("p", null, source.text),
                        React.createElement("small", null,
                            dateLabel(source.at),
                            " \u00B7 ",
                            source.session)));
                }))))),
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
        const added = [...current].filter((key) => !seen.ids.has(key)).map((key) => key.slice(0, key.lastIndexOf(':')));
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