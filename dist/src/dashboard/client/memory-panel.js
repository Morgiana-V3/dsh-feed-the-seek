import * as React from 'react';
import { request } from './api.js';
import { HistoryPanel } from './history-panel.js';
import { EmptyState, MemoryCard, PixelIcon, memoryKindLabels } from './components.js';
const PAGE_SIZE = 30;
export function MemoryPanel({ state, selectedKind, onSelectKind, newMemoryIds, notify, }) {
    const [historyOpen, setHistoryOpen] = React.useState(false);
    const [filterText, setFilterText] = React.useState('');
    const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);
    const [isExporting, setIsExporting] = React.useState(false);
    const [errorMessage, setErrorMessage] = React.useState('');
    const memories = state.memories.filter((memory) => memory.status === 'active');
    const normalizedFilter = filterText.trim().toLowerCase();
    const filteredMemories = memories
        .filter((memory) => selectedKind === 'all' || memory.kind === selectedKind)
        .filter((memory) => !normalizedFilter ||
        [memory.text, memory.knowledge.edition, memory.knowledge.conditions]
            .join(' ')
            .toLowerCase()
            .includes(normalizedFilter))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    React.useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [selectedKind, normalizedFilter]);
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
    const historyCount = state.historyCount ?? state.history.length;
    const kindCounts = Object.fromEntries(Object.keys(memoryKindLabels).map((kind) => [
        kind,
        memories.filter((memory) => memory.kind === kind).length,
    ]));
    return (React.createElement("div", null,
        React.createElement("div", { className: "fish-section-heading" },
            React.createElement("h3", null, "\u6211\u8BB0\u5F97\u7684\u4E8B"),
            React.createElement("div", { className: "fish-heading-actions" },
                React.createElement("button", { type: "button", className: "fish-button fish-button-small", disabled: isExporting || (state.memories.length === 0 && historyCount === 0), onClick: () => void exportMemories() },
                    React.createElement(PixelIcon, { name: "download" }),
                    isExporting ? '导出中…' : '导出'))),
        errorMessage && (React.createElement("p", { className: "fish-error", role: "alert" }, errorMessage)),
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
                React.createElement("input", { type: "search", value: filterText, placeholder: "\u7B5B\u9009\u8BB0\u5FC6", "aria-label": "\u7B5B\u9009\u8BB0\u5FC6", onChange: (event) => setFilterText(event.target.value) }))),
        filteredMemories.length === 0 &&
            (normalizedFilter ? (React.createElement(EmptyState, { title: "\u6CA1\u6709\u5339\u914D\u7684\u8BB0\u5FC6" }, "\u6362\u4E2A\u5173\u952E\u8BCD\u8BD5\u8BD5\u3002")) : (React.createElement(EmptyState, { title: "\u8FD8\u6CA1\u6709\u8BB0\u4F4F\u4EC0\u4E48" }, "\u804A\u8FC7\u4E4B\u540E\uFF0C\u6211\u8BB0\u4F4F\u7684\u4E8B\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC\u3002"))),
        React.createElement("div", { className: "fish-record-list" }, filteredMemories.slice(0, visibleCount).map((memory, index) => (React.createElement(MemoryCard, { key: memory.id, memory: memory, state: state, index: index, isNew: newMemoryIds.has(memory.id) })))),
        filteredMemories.length > visibleCount && (React.createElement("button", { type: "button", className: "fish-button fish-load-more", onClick: () => setVisibleCount((count) => count + PAGE_SIZE) },
            "\u518D\u663E\u793A ",
            Math.min(PAGE_SIZE, filteredMemories.length - visibleCount),
            " \u6761 \u00B7 \u5269\u4F59",
            ' ',
            filteredMemories.length - visibleCount)),
        React.createElement("details", { className: "fish-fold", onToggle: (event) => setHistoryOpen(event.currentTarget.open) },
            React.createElement("summary", null,
                "\u8BB0\u5FC6\u7684\u53D8\u5316 ",
                React.createElement("span", null,
                    historyCount,
                    " \u6761")),
            historyOpen && (React.createElement(HistoryPanel, { key: state.scope.persona, state: state })))));
}
//# sourceMappingURL=memory-panel.js.map