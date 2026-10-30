import * as React from 'react';
import { PixelIcon, displayName, useNewMemoryIds } from './components.js';
import { MemoryPanel } from './memory-panel.js';
import { OverviewPanel } from './overview-panel.js';
import { SettingsPanel } from './settings-panel.js';
import { useSettings } from './use-settings.js';
const tabs = [
    { id: 'overview', label: '概览', icon: 'overview' },
    { id: 'memories', label: '记忆', icon: 'memories' },
    { id: 'settings', label: '设置', icon: 'settings' },
];
function LoadingSkeleton() {
    return (React.createElement("div", { className: "fish-skeleton", role: "status", "aria-label": "\u6B63\u5728\u8FDE\u63A5\u8BB0\u5FC6\u670D\u52A1" },
        React.createElement("div", { className: "fish-skeleton-row" },
            React.createElement("i", { className: "fish-skeleton-portrait" }),
            React.createElement("div", null,
                React.createElement("i", { style: { width: '40%' } }),
                React.createElement("i", { style: { width: '65%', height: 24 } }),
                React.createElement("i", { style: { width: '30%' } }))),
        React.createElement("div", { className: "fish-skeleton-grid" },
            React.createElement("i", null),
            React.createElement("i", null),
            React.createElement("i", null),
            React.createElement("i", null)),
        React.createElement("i", { style: { width: '100%', height: 56 } }),
        React.createElement("span", { className: "fish-screen-reader" }, "\u6B63\u5728\u8FDE\u63A5\u8BB0\u5FC6\u670D\u52A1\u2026")));
}
export function SettingsSection() {
    const { state, errorMessage, dismissError, isBusy, isRefreshing, pendingSettings, notice, notify, setViewedPersonaId, refreshSettings, submitAction, updateSetting, } = useSettings();
    const [activeTab, setActiveTab] = React.useState('overview');
    const [memoryKind, setMemoryKind] = React.useState('all');
    function moveTab(event, index) {
        let nextIndex = index;
        if (event.key === 'ArrowRight') {
            nextIndex = (index + 1) % tabs.length;
        }
        else if (event.key === 'ArrowLeft') {
            nextIndex = (index + tabs.length - 1) % tabs.length;
        }
        else if (event.key === 'Home') {
            nextIndex = 0;
        }
        else if (event.key === 'End') {
            nextIndex = tabs.length - 1;
        }
        else {
            return;
        }
        event.preventDefault();
        setActiveTab(tabs[nextIndex].id);
        const buttons = event.currentTarget.parentElement?.querySelectorAll('[role="tab"]');
        buttons?.[nextIndex].focus();
    }
    function openMemories(kind = 'all') {
        setMemoryKind(kind);
        setActiveTab('memories');
    }
    return (React.createElement("section", { className: "fish-brain", "aria-label": "\u5927\u80A5\u9C7C\u9972\u517B\u624B\u518C", "aria-busy": !state || undefined },
        React.createElement("link", { rel: "stylesheet", href: `/fish-brain/native.css?v=${__PLUGIN_BUILD__}` }),
        React.createElement("header", { className: "fish-header" },
            React.createElement("div", { className: "fish-brand" },
                React.createElement("span", { className: "fish-logo", "aria-hidden": "true" },
                    React.createElement("img", { src: "/fish-brain/assets/plugin-icon-v6.png", width: 32, height: 32, alt: "" })),
                React.createElement("h2", null, "\u5927\u80A5\u9C7C\u9972\u517B\u624B\u518C"),
                React.createElement("span", { className: "fish-version" },
                    "v",
                    __PLUGIN_VERSION__)),
            React.createElement("button", { type: "button", className: "fish-button fish-refresh", disabled: isRefreshing, "aria-busy": isRefreshing || undefined, onClick: () => {
                    void refreshSettings();
                }, "aria-label": "\u5237\u65B0\u8BB0\u5FC6\u6570\u636E" },
                React.createElement(PixelIcon, { name: "refresh", className: "fish-refresh-icon" }),
                React.createElement("span", null, "\u5237\u65B0"))),
        errorMessage && (React.createElement("div", { className: "fish-error fish-error-banner", role: "alert" },
            React.createElement("p", null, errorMessage),
            React.createElement("button", { type: "button", className: "fish-icon-button", onClick: dismissError, "aria-label": "\u5173\u95ED\u63D0\u793A" },
                React.createElement(PixelIcon, { name: "close" })))),
        !state && React.createElement(LoadingSkeleton, null),
        state && (React.createElement(SettingsBody, { state: state, activeTab: activeTab, setActiveTab: setActiveTab, moveTab: moveTab, memoryKind: memoryKind, setMemoryKind: setMemoryKind, openMemories: openMemories, isBusy: isBusy, pendingSettings: pendingSettings, notify: notify, setViewedPersonaId: setViewedPersonaId, submitAction: submitAction, updateSetting: updateSetting })),
        React.createElement("div", { className: "fish-toast-region", role: "status", "aria-live": "polite" }, notice && (React.createElement("div", { key: notice.id, className: "fish-toast", "data-tone": notice.tone }, notice.message)))));
}
function SettingsBody({ state, activeTab, setActiveTab, moveTab, memoryKind, setMemoryKind, openMemories, isBusy, pendingSettings, notify, setViewedPersonaId, submitAction, updateSetting, }) {
    const newMemoryIds = useNewMemoryIds(state);
    const viewedPersona = state.personas.find((persona) => persona.id === state.scope.persona);
    const activePersona = state.personas.find((persona) => persona.id === state.activePersona);
    const isViewingRetained = state.scope.persona !== state.activePersona;
    const runningJobs = state.jobs.filter((job) => job.status === 'pending' || job.status === 'running').length;
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: "fish-frame" },
            React.createElement("div", { className: "fish-toolbar" },
                React.createElement("label", { className: "fish-persona-select" },
                    "\u4F19\u4F34",
                    React.createElement("select", { value: state.scope.persona, disabled: isBusy, onChange: (event) => setViewedPersonaId(event.target.value) }, state.personas.map((persona) => (React.createElement("option", { key: persona.id, value: persona.id },
                        displayName(persona.name),
                        persona.id === state.activePersona ? ' · 正在陪你' : ' · 以前的她'))))),
                state.demo && React.createElement("span", { className: "fish-tag fish-tag-dashed" }, "\u6F14\u793A\u6570\u636E")),
            isViewingRetained && (React.createElement("div", { className: "fish-retained-banner" },
                "\u6B63\u5728\u770B\u4EE5\u524D\u7684\u300C",
                displayName(viewedPersona?.name),
                "\u300D\uFF1A\u5979\u7684\u8BB0\u5FC6\u90FD\u8FD8\u5728\uFF0C\u4F46\u4E0D\u518D\u53C2\u4E0E\u65B0\u7684\u5BF9\u8BDD\uFF1B\u65B0\u7684\u5BF9\u8BDD\u7531\u300C",
                displayName(activePersona?.name),
                "\u300D\u966A\u4F60\u3002",
                React.createElement("button", { type: "button", className: "fish-text-button", onClick: () => setViewedPersonaId(state.activePersona) }, "\u56DE\u5230\u73B0\u5728\u7684\u5979"))),
            React.createElement("nav", { className: "fish-tabs", role: "tablist", "aria-label": "\u63D2\u4EF6\u9875\u9762" }, tabs.map((tab, index) => (React.createElement("button", { key: tab.id, type: "button", role: "tab", id: `fish-tab-${tab.id}`, "aria-controls": "fish-tab-content", "aria-selected": activeTab === tab.id, tabIndex: activeTab === tab.id ? 0 : -1, onKeyDown: (event) => moveTab(event, index), onClick: () => setActiveTab(tab.id) },
                React.createElement(PixelIcon, { name: tab.icon }),
                tab.label,
                tab.id === 'memories' && newMemoryIds.size > 0 && activeTab !== 'memories' && (React.createElement("span", { className: "fish-tab-dot", "aria-label": `${newMemoryIds.size} 条新记忆` })))))),
            React.createElement("div", { key: activeTab, className: "fish-panel", id: "fish-tab-content", role: "tabpanel", "aria-labelledby": `fish-tab-${activeTab}` },
                activeTab === 'overview' && (React.createElement(OverviewPanel, { state: state, isBusy: isBusy, newMemoryIds: newMemoryIds, onOpenMemories: openMemories, onRetry: async () => {
                        if (await submitAction('retry', {}))
                            notify('好，我再想一想');
                    } })),
                activeTab === 'memories' && (React.createElement(MemoryPanel, { key: state.scope.persona, state: state, selectedKind: memoryKind, onSelectKind: setMemoryKind, newMemoryIds: newMemoryIds, notify: notify })),
                activeTab === 'settings' && (React.createElement(SettingsPanel, { key: state.scope.persona, state: state, isBusy: isBusy, pendingSettings: pendingSettings, submitAction: submitAction, updateSetting: updateSetting, notify: notify, onPersonaCreated: (persona) => {
                        setViewedPersonaId(persona.id);
                        setActiveTab('overview');
                        notify(`欢迎「${persona.name}」`);
                    } })))),
        React.createElement("footer", { className: "fish-footer" },
            React.createElement("span", { "data-active": runningJobs > 0 || undefined },
                React.createElement("i", { "aria-hidden": "true" }),
                !state.settings.learning
                    ? '暂时不记新的事'
                    : runningJobs > 0
                        ? '正在回想刚才的事'
                        : '会记住新的事'),
            React.createElement("span", null, state.settings.retrievalMode === 'semantic' ? '听得懂换个说法' : '按关键词回忆'))));
}
export const inject = ['slots'];
export function apply(context) {
    const slots = context.get('slots');
    if (!slots) {
        return;
    }
    slots.inject('settings.section', () => slots.register({
        name: 'settings.section',
        id: 'fish-brain-patch',
        order: 53,
        label: () => '大肥鱼饲养手册',
    }, () => React.createElement(SettingsSection, null)));
}
//# sourceMappingURL=index.js.map