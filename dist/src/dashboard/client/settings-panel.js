import * as React from 'react';
import { Toggle, displayName } from './components.js';
import { RetrievalSettings } from './retrieval-settings.js';
const masterSetting = {
    key: 'enabled',
    label: '记忆功能',
    description: '在对话中使用已保存的记忆。关闭后既不读取，也不记录新内容。',
};
const featureSettings = [
    {
        key: 'learning',
        label: '自动记录',
        description: '对话结束后整理值得保留的内容，也会修正记错的。会调用当前对话模型，产生额外用量。',
    },
    {
        key: 'emotion',
        label: '情绪表达',
        description: '近期经历会影响回复的语气。',
    },
];
export function SettingsPanel({ state, isBusy, pendingSettings, submitAction, updateSetting, notify, onPersonaCreated, }) {
    async function createPersona(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const name = String(new FormData(form).get('name')).trim();
        const persona = (await submitAction('persona', { name }));
        if (persona) {
            form.reset();
            onPersonaCreated(persona);
        }
    }
    const isEnabled = state.settings.enabled;
    const usage = state.learningUsage;
    const viewedName = displayName(state.personas.find((persona) => persona.id === state.scope.persona)?.name);
    return (React.createElement("div", null,
        React.createElement("div", { className: "fish-section-heading" },
            React.createElement("h3", null, "\u529F\u80FD\u5F00\u5173"),
            React.createElement("span", { className: "fish-muted" }, "\u5BF9\u6240\u6709\u4F19\u4F34\u751F\u6548")),
        React.createElement("div", { className: "fish-toggle-grid" },
            React.createElement(Toggle, { className: "fish-toggle-master", label: masterSetting.label, description: masterSetting.description, checked: isEnabled, pending: masterSetting.key in pendingSettings, disabled: masterSetting.key in pendingSettings, onChange: (checked) => {
                    void updateSetting(masterSetting.key, checked);
                } }),
            featureSettings.map((setting) => (React.createElement(Toggle, { key: setting.key, label: setting.label, description: setting.description, checked: state.settings[setting.key], pending: setting.key in pendingSettings, inactive: !isEnabled, disabled: !isEnabled || setting.key in pendingSettings, onChange: (checked) => {
                    void updateSetting(setting.key, checked);
                } })))),
        !isEnabled && (React.createElement("p", { className: "fish-muted fish-cost-note" }, "\u8BB0\u5FC6\u529F\u80FD\u5DF2\u5173\u95ED\uFF0C\u4EE5\u4E0A\u8BBE\u7F6E\u6682\u4E0D\u751F\u6548\uFF0C\u91CD\u65B0\u5F00\u542F\u540E\u6062\u590D\u3002")),
        usage && (React.createElement("dl", { className: "fish-usage", "aria-label": `「${viewedName}」的后台用量` },
            React.createElement("div", null,
                React.createElement("dt", null, "\u540E\u53F0\u8C03\u7528"),
                React.createElement("dd", null,
                    usage.calls.toLocaleString(),
                    " \u6B21",
                    usage.failedCalls > 0 && React.createElement("small", null,
                        usage.failedCalls,
                        " \u6B21\u672A\u5B8C\u6210"))),
            React.createElement("div", null,
                React.createElement("dt", null, "\u8F93\u5165 token"),
                React.createElement("dd", null, usage.inputTokens.toLocaleString())),
            React.createElement("div", null,
                React.createElement("dt", null, "\u7F13\u5B58\u8BFB\u53D6 token"),
                React.createElement("dd", null, usage.cacheReadTokens.toLocaleString())),
            React.createElement("div", null,
                React.createElement("dt", null, "\u8F93\u51FA token"),
                React.createElement("dd", null, usage.outputTokens.toLocaleString())))),
        usage && React.createElement("p", { className: "fish-muted fish-usage-note" },
            "\u4EE5\u4E0A\u662F\u300C",
            viewedName,
            "\u300D\u7684\u540E\u53F0\u7528\u91CF\u3002"),
        React.createElement(RetrievalSettings, { state: state, isBusy: isBusy, submitAction: submitAction, notify: notify }),
        React.createElement("details", { className: "fish-fold" },
            React.createElement("summary", null, "\u9886\u517B\u65B0\u4F19\u4F34"),
            React.createElement("div", { className: "fish-fold-body" },
                React.createElement("p", { className: "fish-muted" }, "\u65B0\u7684\u4F19\u4F34\u4F1A\u4ECE\u96F6\u5F00\u59CB\u8BA4\u8BC6\u4F60\uFF0C\u4E4B\u540E\u65B0\u5F00\u7684\u5BF9\u8BDD\u7531\u5979\u966A\u4F34\uFF1B\u5DF2\u7ECF\u5728\u8FDB\u884C\u7684\u5BF9\u8BDD\u4ECD\u7531\u539F\u6765\u7684\u4F19\u4F34\u7EE7\u7EED\u3002\u539F\u6765\u7684\u4F19\u4F34\u4E0D\u4F1A\u88AB\u5220\u9664\uFF0C\u8BB0\u5FC6\u90FD\u4F1A\u4FDD\u7559\uFF1A\u5728\u9876\u90E8\u201C\u67E5\u770B\u4F19\u4F34\u201D\u91CC\u9009\u4E2D\u5979\uFF0C\u5C31\u80FD\u8BA9\u5979\u91CD\u65B0\u966A\u4F34\u65B0\u5BF9\u8BDD\u3002"),
                React.createElement("form", { className: "fish-form", onSubmit: createPersona },
                    React.createElement("label", null,
                        "\u540D\u5B57",
                        React.createElement("input", { name: "name", required: true, maxLength: 40, pattern: ".*\\S.*", title: "\u540D\u5B57\u4E0D\u80FD\u53EA\u6709\u7A7A\u683C", placeholder: "\u6BD4\u5982\uFF1A\u5C0F\u9CB8" })),
                    React.createElement("button", { type: "submit", className: "fish-button", disabled: isBusy }, "\u9886\u517B"))))));
}
//# sourceMappingURL=settings-panel.js.map