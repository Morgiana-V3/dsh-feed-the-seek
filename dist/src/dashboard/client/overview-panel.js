import * as React from 'react';
import { EmptyState, MemoryCard, PixelIcon, displayName, memoryKindLabels, learningActivity, } from './components.js';
export function OverviewPanel({ state, isBusy, newMemoryIds, onOpenMemories, onRetry, }) {
    const persona = state.personas.find((entry) => entry.id === state.scope.persona);
    const memories = state.memories.filter((memory) => memory.status === 'active');
    const latestMemories = memories
        .slice()
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .slice(0, 3);
    const mood = state.mood;
    const activeAliases = state.memories.filter((memory) => memory.status === 'active' && memory.alias);
    const latestAlias = (kind) => activeAliases
        .filter((memory) => memory.alias.kind === kind)
        .sort((leftMemory, rightMemory) => rightMemory.updatedAt.localeCompare(leftMemory.updatedAt))[0]?.alias.value;
    const naming = { address: latestAlias('user_preferred'), name: latestAlias('assistant_name') };
    // A placeholder companion name gives way to the name she was given in conversation.
    const hasOwnName = displayName(persona?.name) === persona?.name;
    let moodText = '情绪表达已关闭';
    if (mood) {
        moodText = mood.strength ? `${mood.strength}${mood.label}` : mood.label;
    }
    const activity = learningActivity(state.jobs);
    let learningStatus = '等待下一次对话';
    let learningTone = 'idle';
    if (!state.settings.enabled || !state.settings.learning) {
        learningStatus = '暂时不记新的事';
        learningTone = 'paused';
    }
    else if (activity.working > 0) {
        learningStatus = '正在回想刚才的事';
        learningTone = 'running';
    }
    else if (activity.failed > 0) {
        learningStatus = `有 ${activity.failed} 段对话没记下来`;
        learningTone = 'failed';
    }
    else if (activity.retrying > 0) {
        learningStatus = '刚才没整理好，稍后会自动再试';
        learningTone = 'retrying';
    }
    else if (state.jobs.length > 0) {
        learningStatus = '已整理，只留下值得记的';
    }
    return (React.createElement("div", null,
        React.createElement("div", { className: "fish-profile" },
            React.createElement("div", { className: "fish-portrait-frame", "data-mood": mood?.asset || 'calm' }, portraitMoods.map((asset) => (React.createElement("picture", { key: asset },
                React.createElement("source", { media: "(prefers-reduced-motion: reduce)", srcSet: `/fish-brain/assets/portrait-${asset}.png` }),
                React.createElement("img", { className: "fish-portrait", "data-active": asset === (mood?.asset || 'calm') || undefined, src: `/fish-brain/assets/portrait-${asset}.${asset === (mood?.asset || 'calm') ? 'webp' : 'png'}?v=5`, alt: asset === (mood?.asset || 'calm') ? portraitAlt[asset] : '', "aria-hidden": asset === (mood?.asset || 'calm') ? undefined : true, width: "296", height: "364", decoding: "async" }))))),
            React.createElement("div", { className: "fish-profile-info" },
                React.createElement("div", { className: "fish-eyebrow" }, state.scope.persona === state.activePersona ? '陪伴新对话' : '休息中'),
                React.createElement("h2", null, hasOwnName ? persona.name : naming.name || displayName(undefined)),
                React.createElement("span", { className: "fish-status", "data-off": !state.settings.enabled || undefined },
                    React.createElement("i", { "aria-hidden": "true" }),
                    state.settings.enabled ? '记得你' : '暂时不用记忆'),
                React.createElement("div", { className: "fish-profile-divider" }),
                React.createElement("dl", null,
                    React.createElement("div", null,
                        React.createElement("dt", null, "\u5FC3\u60C5"),
                        React.createElement("dd", { className: "fish-mood", "data-mood": mood?.asset, "data-off": !mood || undefined }, moodText)),
                    mood?.reason && React.createElement("p", { className: "fish-mood-reason" }, mood.reason),
                    hasOwnName && naming.name && naming.name !== persona?.name && (React.createElement("div", null,
                        React.createElement("dt", null, "\u4F60\u53EB\u6211"),
                        React.createElement("dd", null, naming.name))),
                    naming.address && (React.createElement("div", null,
                        React.createElement("dt", null, "\u6211\u53EB\u4F60"),
                        React.createElement("dd", null, naming.address))),
                    React.createElement("div", null,
                        React.createElement("dt", null, "\u56DE\u60F3"),
                        React.createElement("dd", { className: "fish-learning", "data-tone": learningTone },
                            React.createElement("i", { "aria-hidden": "true" }),
                            learningStatus,
                            learningTone === 'failed' && (React.createElement("button", { type: "button", className: "fish-text-button", disabled: isBusy, onClick: onRetry }, "\u518D\u60F3\u60F3")),
                            (learningTone === 'failed' || learningTone === 'retrying') && activity.reason && (React.createElement("small", { className: "fish-learning-reason", title: activity.reason },
                                "\u539F\u56E0\uFF1A",
                                activity.reason))))))),
        React.createElement("div", { className: "fish-memory-counts", "aria-label": "\u8BB0\u5FC6\u6570\u91CF" }, Object.entries(memoryKindLabels).map(([kind, label]) => {
            const count = memories.filter((memory) => memory.kind === kind).length;
            return (React.createElement("button", { key: kind, type: "button", className: `fish-counter fish-counter-${kind}`, onClick: () => onOpenMemories(kind), "aria-label": `${label} ${count} 条，查看` },
                React.createElement("span", { className: "fish-counter-label" },
                    React.createElement(PixelIcon, { name: kind }),
                    label),
                React.createElement("strong", { key: count }, count)));
        })),
        React.createElement("div", { className: "fish-section-heading" },
            React.createElement("h3", null, "\u6700\u8FD1\u8BB0\u4F4F\u7684"),
            React.createElement("button", { type: "button", className: "fish-text-button", onClick: () => onOpenMemories('all') },
                "\u5168\u90E8\u8BB0\u5FC6 ",
                React.createElement("span", { "aria-hidden": "true" }, "\u2192"))),
        latestMemories.length > 0 ? (latestMemories.map((memory, index) => (React.createElement(MemoryCard, { key: memory.id, memory: memory, state: state, compact: true, index: index, isNew: newMemoryIds.has(memory.id) })))) : (React.createElement(EmptyState, { title: "\u8FD8\u6CA1\u6709\u8BB0\u4F4F\u4EC0\u4E48" }, "\u804A\u8FC7\u51E0\u6B21\u4E4B\u540E\uFF0C\u6211\u8BB0\u4F4F\u7684\u4E8B\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC\u3002")),
        React.createElement(PersonaFold, { state: state })));
}
const portraitMoods = [
    'calm',
    'happy',
    'discouraged',
    'annoyed',
    'concerned',
    'relieved',
    'hopeful',
    'shy',
];
const portraitAlt = {
    calm: '蓝发鲸鱼娘女仆，抱着笔记本微笑',
    happy: '蓝发鲸鱼娘女仆，笑着挥手',
    discouraged: '蓝发鲸鱼娘女仆，抱着尾巴有些低落',
    annoyed: '蓝发鲸鱼娘女仆，抱着手臂有点不满',
    concerned: '蓝发鲸鱼娘女仆，前倾攥着围裙，担心地望向你',
    relieved: '蓝发鲸鱼娘女仆，双手轻合，露出安心的微笑',
    hopeful: '蓝发鲸鱼娘女仆，举起双拳，满怀期待',
    shy: '蓝发鲸鱼娘女仆，侧身回望，用尾鳍遮住害羞的脸',
};
const sectionTitles = {
    self: '我是什么样的人',
    scenes: '我在不同场合',
    values: '我在意的事',
};
/** "Who she is", with how much evidence stands behind each line and progress to the next synthesis. */
function PersonaFold({ state }) {
    const persona = state.persona;
    const sections = persona
        ? Object.entries(persona.sections)
        : [];
    const filled = sections.filter(([, lines]) => lines.length > 0);
    const total = filled.reduce((sum, [, lines]) => sum + lines.length, 0) + state.traits.length;
    const latest = persona?.history[0];
    return (React.createElement("details", { className: "fish-fold fish-persona" },
        React.createElement("summary", null,
            "\u6211\u662F\u4EC0\u4E48\u6837\u7684\u4EBA ",
            React.createElement("span", null,
                total,
                " \u6761")),
        React.createElement("div", { className: "fish-fold-body" },
            filled.map(([section, lines]) => (React.createElement("section", { key: section, className: "fish-persona-section" },
                React.createElement("h4", null, sectionTitles[section]),
                lines.map((line, index) => (React.createElement("p", { key: index, className: "fish-trait" }, line.text)))))),
            state.traits.length > 0 && (React.createElement("section", { className: "fish-persona-section" },
                React.createElement("h4", null, "\u7A33\u5B9A\u503E\u5411"),
                state.traits.map((trait) => (React.createElement("p", { key: trait.id, className: "fish-trait" }, trait.text))))),
            total === 0 && (React.createElement("p", { className: "fish-muted" }, "\u8FD8\u6CA1\u6709\u5F62\u6210\u3002\u4F60\u7684\u53CD\u9988\u548C\u6211\u7684\u8868\u73B0\u5728\u4E0D\u540C\u573A\u5408\u6216\u597D\u51E0\u5929\u91CC\u90FD\u4E00\u81F4\uFF0C\u624D\u4F1A\u5199\u8FDB\u8FD9\u91CC\u3002")),
            latest && (latest.diff.added.length > 0 || latest.diff.updated.length > 0) && (React.createElement("p", { className: "fish-muted" },
                "\u6700\u8FD1\u7684\u53D8\u5316\uFF1A",
                [
                    ...latest.diff.added.map((text) => `新增「${text}」`),
                    ...latest.diff.updated.map((entry) => `「${entry.from}」→「${entry.to}」`),
                ].join('；'))))));
}
//# sourceMappingURL=overview-panel.js.map