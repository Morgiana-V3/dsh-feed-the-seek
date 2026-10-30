import * as React from 'react';
import { dateLabel, request, projectLabel, } from './api.js';
import { EmptyState, MemoryCard, PixelIcon, memoryKindLabels } from './components.js';
const PAGE_SIZE = 30;
const actionLabels = {
    ADD: '记住了',
    UPDATE: '更新了',
    DELETE: '不再作数',
    MIGRATE: '旧格式转换',
    CONSOLIDATE: '成为性格',
    MERGE: '合并',
};
export function MemoryPanel({ state, selectedKind, onSelectKind, newMemoryIds, notify, }) {
    const [filterText, setFilterText] = React.useState('');
    const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);
    const [query, setQuery] = React.useState('');
    const [project, setProject] = React.useState('');
    const [recallResult, setRecallResult] = React.useState(null);
    const [isSearching, setIsSearching] = React.useState(false);
    const [isExporting, setIsExporting] = React.useState(false);
    const [errorMessage, setErrorMessage] = React.useState('');
    const controllerRef = React.useRef(null);
    const memories = state.memories.filter((memory) => memory.status === 'active');
    const normalizedFilter = filterText.trim().toLowerCase();
    const filteredMemories = memories
        .filter((memory) => selectedKind === 'all' || memory.kind === selectedKind)
        .filter((memory) => !normalizedFilter ||
        [memory.text, memory.knowledge.domain, memory.knowledge.conditions, ...memory.tags]
            .join(' ')
            .toLowerCase()
            .includes(normalizedFilter))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    const projects = [
        ...new Set([
            '',
            ...state.sessions.map((session) => session.project),
            ...memories.map((memory) => memory.scope.project),
        ]),
    ];
    React.useEffect(() => {
        setRecallResult(null);
    }, [state.revision]);
    React.useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [selectedKind, normalizedFilter]);
    React.useEffect(() => () => {
        controllerRef.current?.abort();
    }, []);
    async function searchMemories(event) {
        event.preventDefault();
        controllerRef.current?.abort();
        const controller = new AbortController();
        controllerRef.current = controller;
        setIsSearching(true);
        setErrorMessage('');
        try {
            const result = await request('recall', {
                query,
                scope: { ...state.scope, project },
            }, state.token, controller.signal);
            if (!controller.signal.aborted) {
                setRecallResult(result);
            }
        }
        catch (error) {
            if (!controller.signal.aborted) {
                setErrorMessage(error instanceof Error ? error.message : '检索失败');
            }
        }
        finally {
            if (!controller.signal.aborted) {
                setIsSearching(false);
            }
        }
    }
    async function exportMemories() {
        setIsExporting(true);
        setErrorMessage('');
        try {
            const data = await request('export', { scope: state.scope }, state.token);
            const persona = state.personas.find((entry) => entry.id === state.scope.persona);
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `dsh-feed-the-seek-memory-${persona?.name || state.scope.persona}-${new Date()
                .toISOString()
                .slice(0, 10)}.json`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            notify('已导出记忆记录');
        }
        catch (error) {
            setErrorMessage(error instanceof Error ? error.message : '导出失败');
        }
        finally {
            setIsExporting(false);
        }
    }
    const kindCounts = Object.fromEntries(Object.keys(memoryKindLabels).map((kind) => [
        kind,
        memories.filter((memory) => memory.kind === kind).length,
    ]));
    return (React.createElement("div", null,
        React.createElement("div", { className: "fish-section-heading" },
            React.createElement("h3", null, "\u6211\u8BB0\u5F97\u7684\u4E8B"),
            React.createElement("div", { className: "fish-heading-actions" },
                React.createElement("span", { className: "fish-tag", title: "\u8FD9\u91CC\u53EA\u80FD\u770B\uFF1B\u60F3\u7EA0\u6B63\uFF0C\u76F4\u63A5\u5728\u5BF9\u8BDD\u91CC\u544A\u8BC9\u6211" }, "\u60F3\u6539\u5C31\u76F4\u63A5\u544A\u8BC9\u6211"),
                React.createElement("button", { type: "button", className: "fish-button fish-button-small", disabled: isExporting || memories.length === 0, onClick: () => void exportMemories() },
                    React.createElement(PixelIcon, { name: "download" }),
                    isExporting ? '导出中…' : '导出'))),
        React.createElement("div", { className: "fish-list-controls" },
            React.createElement("div", { className: "fish-filters", role: "group", "aria-label": "\u8BB0\u5FC6\u5206\u7C7B" },
                React.createElement("button", { type: "button", "aria-pressed": selectedKind === 'all', onClick: () => onSelectKind('all') },
                    "\u5168\u90E8 ",
                    memories.length),
                Object.entries(memoryKindLabels).map(([kind, label]) => (React.createElement("button", { key: kind, type: "button", className: `fish-filter-${kind}`, "aria-pressed": selectedKind === kind, onClick: () => onSelectKind(kind) },
                    label,
                    " ",
                    kindCounts[kind])))),
            React.createElement("label", { className: "fish-filter-input" },
                React.createElement(PixelIcon, { name: "search" }),
                React.createElement("input", { type: "search", value: filterText, placeholder: "\u7B5B\u9009\u6587\u5B57\u3001\u9886\u57DF\u3001\u6807\u7B7E", "aria-label": "\u7B5B\u9009\u8BB0\u5FC6", onChange: (event) => setFilterText(event.target.value) }))),
        filteredMemories.length === 0 &&
            (normalizedFilter ? (React.createElement(EmptyState, { title: "\u6CA1\u6709\u5339\u914D\u7684\u8BB0\u5FC6" }, "\u6362\u4E2A\u5173\u952E\u8BCD\uFF0C\u6216\u5728\u4E0B\u65B9\u7528\u8BED\u4E49\u68C0\u7D22\u8BD5\u8BD5\u3002")) : (React.createElement(EmptyState, { title: "\u8FD8\u6CA1\u6709\u8BB0\u4F4F\u4EC0\u4E48" }, "\u804A\u8FC7\u4E4B\u540E\uFF0C\u6211\u8BB0\u4F4F\u7684\u4E8B\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC\u3002"))),
        React.createElement("div", { className: "fish-record-list" }, filteredMemories.slice(0, visibleCount).map((memory, index) => (React.createElement(MemoryCard, { key: memory.id, memory: memory, state: state, index: index, isNew: newMemoryIds.has(memory.id) })))),
        filteredMemories.length > visibleCount && (React.createElement("button", { type: "button", className: "fish-button fish-load-more", onClick: () => setVisibleCount((count) => count + PAGE_SIZE) },
            "\u518D\u663E\u793A ",
            Math.min(PAGE_SIZE, filteredMemories.length - visibleCount),
            " \u6761 \u00B7 \u5269\u4F59",
            ' ',
            filteredMemories.length - visibleCount)),
        React.createElement("details", { className: "fish-fold" },
            React.createElement("summary", null,
                "\u6211\u4F1A\u60F3\u8D77\u4EC0\u4E48 ",
                React.createElement("span", null, "\u8BF4\u4E00\u53E5\u8BDD\u8BD5\u8BD5")),
            React.createElement("div", { className: "fish-fold-body" },
                React.createElement("form", { className: "fish-form fish-search-form", onSubmit: searchMemories },
                    React.createElement("label", null,
                        "\u8303\u56F4",
                        React.createElement("select", { value: project, onChange: (event) => setProject(event.target.value) }, projects.map((projectPath) => (React.createElement("option", { key: projectPath, value: projectPath }, projectPath ? projectLabel(projectPath) : '不限项目'))))),
                    React.createElement("label", null,
                        "\u5185\u5BB9",
                        React.createElement("input", { value: query, maxLength: 4000, required: true, placeholder: "\u4F8B\u5982\uFF1A\u56DE\u58F0\u6212\u6307\u6709\u4EC0\u4E48\u6548\u679C\uFF1F", onChange: (event) => setQuery(event.target.value) })),
                    React.createElement("button", { className: "fish-button fish-button-primary", disabled: isSearching, "aria-busy": isSearching || undefined, type: "submit" }, isSearching ? '检索中…' : '检索')),
                errorMessage && (React.createElement("p", { role: "alert", className: "fish-error" }, errorMessage)),
                recallResult && (React.createElement("div", { className: "fish-search-result" },
                    React.createElement("p", { className: "fish-muted" },
                        recallResult.note,
                        " \u00B7 \u547D\u4E2D ",
                        recallResult.items.length,
                        " \u6761"),
                    recallResult.items.length === 0 && (React.createElement(EmptyState, { title: "\u6CA1\u6709\u627E\u5230\u9002\u7528\u7684\u8BB0\u5FC6" })),
                    recallResult.items.map((item, index) => (React.createElement(MemoryCard, { key: item.memory.id, memory: item.memory, state: state, compact: true, index: index, footer: React.createElement("div", { className: "fish-recall-why" },
                            React.createElement("span", { className: "fish-score" }, item.score.toFixed(2)),
                            item.reasons.map((reason) => (React.createElement("span", { key: reason }, reason)))) }))),
                    recallResult.context && (React.createElement("details", { className: "fish-source" },
                        React.createElement("summary", null, "\u539F\u6587"),
                        React.createElement("pre", null, recallResult.context))))))),
        React.createElement("details", { className: "fish-fold" },
            React.createElement("summary", null,
                "\u8BB0\u5FC6\u7684\u53D8\u5316 ",
                React.createElement("span", null,
                    state.history.length,
                    " \u6761")),
            React.createElement("div", { className: "fish-fold-body" },
                state.history.length === 0 && React.createElement("p", { className: "fish-muted" }, "\u5C1A\u65E0\u53D8\u5316\u8BB0\u5F55\u3002"),
                React.createElement("ol", { className: "fish-timeline" }, state.history.slice(0, 30).map((changeRecord, index) => (React.createElement("li", { className: "fish-history", key: index, "data-action": changeRecord.action },
                    React.createElement("div", { className: "fish-record-meta" },
                        changeRecord.action && (React.createElement("span", { className: "fish-tag fish-action-tag" }, actionLabels[changeRecord.action] || changeRecord.action)),
                        React.createElement("strong", null, changeRecord.reason),
                        changeRecord.at && (React.createElement("time", { className: "fish-record-meta-end", dateTime: changeRecord.at }, dateLabel(changeRecord.at)))),
                    React.createElement("p", null, changeRecord.after?.text || changeRecord.before?.text),
                    changeRecord.before && changeRecord.after && (React.createElement("details", { className: "fish-source" },
                        React.createElement("summary", null, "\u65E7\u7248\u672C"),
                        React.createElement("p", { className: "fish-before" }, changeRecord.before.text))))))),
                state.history.length > 30 && (React.createElement("p", { className: "fish-muted" }, "\u663E\u793A\u6700\u8FD1 30 \u6761\uFF0C\u5B8C\u6574\u8BB0\u5F55\u53EF\u901A\u8FC7\u300C\u5BFC\u51FA\u300D\u83B7\u53D6\u3002"))))));
}
//# sourceMappingURL=memory-panel.js.map