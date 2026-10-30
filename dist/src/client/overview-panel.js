import * as React from 'react';
import { projectLabel } from './api.js';
import { EmptyState, MemoryCard, PixelIcon, displayName, memoryKindLabels } from './components.js';
export function OverviewPanel({ state, isBusy, newMemoryIds, onOpenMemories, onRetry, }) {
    const persona = state.personas.find((entry) => entry.id === state.scope.persona);
    const memories = state.memories.filter((memory) => memory.status === 'active');
    const latestMemories = memories
        .slice()
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .slice(0, 3);
    const mood = state.mood;
    const activeAliases = state.memories.filter((memory) => memory.status === 'active' && memory.alias);
    const latestAlias = (kind) => activeAliases.filter((memory) => memory.alias.kind === kind).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]?.alias.value;
    const naming = { address: latestAlias('user_preferred'), name: latestAlias('assistant_name') };
    // A placeholder companion name gives way to the name she was given in conversation.
    const hasOwnName = displayName(persona?.name) === persona?.name;
    const personaLines = state.persona
        ? Object.values(state.persona.sections).reduce((sum, lines) => sum + lines.length, 0) + state.traits.length
        : state.traits.length;
    let moodText = '情绪表达已关闭';
    if (mood)
        moodText = mood.strength ? `${mood.strength}${mood.label}` : mood.label;
    const failedJobs = state.jobs.filter((job) => job.status === 'failed').length;
    const runningJobs = state.jobs.filter((job) => job.status === 'pending' || job.status === 'running').length;
    let learningStatus = '等待下一次对话';
    let learningTone = 'idle';
    if (!state.settings.learning) {
        learningStatus = '暂时不记新的事';
        learningTone = 'paused';
    }
    else if (runningJobs > 0) {
        learningStatus = '正在回想刚才的事';
        learningTone = 'running';
    }
    else if (failedJobs > 0) {
        learningStatus = `有 ${failedJobs} 段对话没记下来`;
        learningTone = 'failed';
    }
    else if (state.jobs.length > 0) {
        learningStatus = '刚才的事都记下了';
    }
    return (React.createElement("div", null,
        React.createElement("div", { className: "fish-profile" },
            React.createElement("div", { className: "fish-portrait-frame", "data-mood": mood?.asset || 'calm' }, portraitMoods.map((asset) => (React.createElement("img", { key: asset, className: "fish-portrait", "data-active": asset === (mood?.asset || 'calm') || undefined, src: `/fish-brain/assets/portrait-${asset}.png`, alt: asset === (mood?.asset || 'calm') ? portraitAlt[asset] : '', "aria-hidden": asset === (mood?.asset || 'calm') ? undefined : true, width: "296", height: "364", decoding: "async" })))),
            React.createElement("div", { className: "fish-profile-info" },
                React.createElement("div", { className: "fish-eyebrow" }, state.scope.persona === state.activePersona ? '正在陪你' : '以前的她'),
                React.createElement("h2", null, hasOwnName ? persona.name : naming.name || displayName(undefined)),
                React.createElement("span", { className: "fish-status", "data-off": !state.settings.enabled || undefined },
                    React.createElement("i", { "aria-hidden": "true" }),
                    state.settings.enabled ? '记得你' : '暂时不用记忆'),
                React.createElement("div", { className: "fish-profile-divider" }),
                React.createElement("dl", null,
                    React.createElement("div", null,
                        React.createElement("dt", null, "\u5FC3\u60C5"),
                        React.createElement("dd", { className: "fish-mood", "data-mood": mood?.asset, "data-off": !mood || undefined }, moodText)),
                    mood?.reason && (React.createElement("p", { className: "fish-mood-reason" },
                        mood.reason,
                        mood.layer === 'task' && mood.project && (React.createElement("small", { title: mood.project },
                            " \u00B7 ",
                            projectLabel(mood.project))))),
                    hasOwnName && naming.name && naming.name !== persona?.name && (React.createElement("div", null,
                        React.createElement("dt", null, "\u4F60\u53EB\u6211"),
                        React.createElement("dd", null, naming.name))),
                    naming.address && (React.createElement("div", null,
                        React.createElement("dt", null, "\u6211\u53EB\u4F60"),
                        React.createElement("dd", null, naming.address))),
                    React.createElement("div", null,
                        React.createElement("dt", null, "\u6027\u683C"),
                        React.createElement("dd", null,
                            personaLines,
                            " \u6761")),
                    React.createElement("div", null,
                        React.createElement("dt", { title: "\u73B0\u5728\u6253\u5F00\u7740\u3001\u7531\u6211\u966A\u7740\u7684\u5BF9\u8BDD" }, "\u6B63\u5728\u8FDB\u884C\u7684\u5BF9\u8BDD"),
                        React.createElement("dd", null,
                            state.sessions.length,
                            " \u4E2A")),
                    React.createElement("div", null,
                        React.createElement("dt", null, "\u56DE\u60F3"),
                        React.createElement("dd", { className: "fish-learning", "data-tone": learningTone },
                            React.createElement("i", { "aria-hidden": "true" }),
                            learningStatus,
                            learningTone === 'failed' && (React.createElement("button", { type: "button", className: "fish-text-button", disabled: isBusy, onClick: onRetry }, "\u518D\u60F3\u60F3"))))))),
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
const portraitMoods = ['calm', 'happy', 'discouraged', 'annoyed'];
const portraitAlt = {
    calm: '蓝发鲸鱼娘女仆，抱着笔记本微笑',
    happy: '蓝发鲸鱼娘女仆，笑着挥手',
    discouraged: '蓝发鲸鱼娘女仆，抱着尾巴有些低落',
    annoyed: '蓝发鲸鱼娘女仆，抱着手臂有点不满',
};
const sectionTitles = { self: '我是什么样的人', scenes: '我在不同场合', values: '我在意的事' };
/** "Who she is", with how much evidence stands behind each line and progress to the next synthesis. */
function PersonaFold({ state }) {
    const persona = state.persona;
    const sections = persona ? Object.entries(persona.sections) : [];
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
                lines.map((line, index) => (React.createElement("p", { key: index, className: "fish-trait" },
                    line.text,
                    React.createElement("small", null, line.evidence.length ? `${line.evidence.length} 次观察` : '初始设定'))))))),
            state.traits.length > 0 && (React.createElement("section", { className: "fish-persona-section" },
                React.createElement("h4", null, "\u7A33\u5B9A\u503E\u5411"),
                state.traits.map((trait) => (React.createElement("p", { key: trait.id, className: "fish-trait" }, trait.text))))),
            total === 0 && (React.createElement("p", { className: "fish-muted" }, "\u8FD8\u6CA1\u6709\u5F62\u6210\u3002\u6211\u7684\u8868\u73B0\u548C\u4F60\u7684\u53CD\u9988\u4F1A\u5148\u6512\u6210\u5370\u8C61\uFF0C\u5728\u4E0D\u540C\u573A\u5408\u6216\u597D\u51E0\u5929\u91CC\u90FD\u662F\u8FD9\u6837\uFF0C\u624D\u4F1A\u5199\u8FDB\u8FD9\u91CC\u3002")),
            persona && (React.createElement("p", { className: "fish-muted fish-persona-progress" },
                "\u6512\u7740\u7684\u65B0\u5370\u8C61 ",
                persona.pending,
                " / ",
                persona.threshold,
                persona.lastSynthesisAt ? ` · 上次回想 ${persona.lastSynthesisAt.slice(0, 10)}` : ' · 还没回想过',
                typeof state.selfCount === 'number' && ` · 对自己的观察 ${state.selfCount}/${state.selfLimit}`)),
            latest && (latest.diff.added.length > 0 || latest.diff.updated.length > 0) && (React.createElement("p", { className: "fish-muted" },
                "\u6700\u8FD1\u7684\u53D8\u5316\uFF1A",
                [...latest.diff.added.map((text) => `新增「${text}」`), ...latest.diff.updated.map((entry) => `「${entry.from}」→「${entry.to}」`)].join('；'))))));
}
//# sourceMappingURL=overview-panel.js.map