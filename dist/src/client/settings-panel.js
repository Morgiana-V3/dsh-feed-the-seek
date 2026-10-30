import * as React from 'react';
import { dateLabel, projectLabel } from './api.js';
import { Toggle } from './components.js';
import { RetrievalSettings } from './retrieval-settings.js';
const settingOptions = [
    { key: 'enabled', label: '记得你', description: '聊天时想起以前的事' },
    { key: 'learning', label: '记住新的事', description: '从聊天里学，也会改正记错的' },
    { key: 'emotion', label: '心情', description: '最近的经历会影响我的语气' },
    { key: 'growth', label: '慢慢长大', description: '把你的反馈和我的表现慢慢变成性格' },
];
const jobLabels = {
    done: '记下了',
    failed: '没记下',
    pending: '等着',
    running: '回想中',
    obsolete: '旧格式',
};
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
    return (React.createElement("div", null,
        React.createElement("div", { className: "fish-section-heading" },
            React.createElement("h3", null, "\u6211\u4F1A\u505A\u4EC0\u4E48"),
            React.createElement("span", { className: "fish-muted" }, "\u6240\u6709\u4F19\u4F34\u5171\u7528")),
        React.createElement("div", { className: "fish-toggle-grid" }, settingOptions.map((setting) => (React.createElement(Toggle, { key: setting.key, label: setting.label, description: setting.description, checked: state.settings[setting.key], pending: setting.key in pendingSettings, disabled: setting.key in pendingSettings, onChange: (checked) => {
                void updateSetting(setting.key, checked);
            } })))),
        React.createElement("p", { className: "fish-muted fish-cost-note" }, "\u8BB0\u4F4F\u65B0\u7684\u4E8B\u3001\u6574\u7406\u6027\u683C\u4F1A\u7528\u5F53\u524D\u5BF9\u8BDD\u7684\u6A21\u578B\uFF0C\u4F1A\u4EA7\u751F\u989D\u5916\u7528\u91CF\u3002"),
        React.createElement("details", { className: "fish-fold" },
            React.createElement("summary", null,
                "\u5BF9\u8BDD\u4E0E\u56DE\u60F3\u8BB0\u5F55 ",
                React.createElement("span", null,
                    state.sessions.length,
                    " \u6BB5\u5BF9\u8BDD"),
                state.jobs.some((job) => job.status === 'failed') && (React.createElement("span", { className: "fish-tag fish-tag-alert" }, "\u6709\u5931\u8D25\u4EFB\u52A1"))),
            React.createElement("div", { className: "fish-fold-body" },
                state.sessions.length === 0 && React.createElement("p", { className: "fish-muted" }, "\u8FD8\u6CA1\u6709\u966A\u4F60\u804A\u8FC7\u3002"),
                state.sessions.map((session) => (React.createElement("div", { className: "fish-session", key: session.id },
                    React.createElement(Toggle, { label: projectLabel(session.project), description: `对话 ${session.id.replace(/^session-/, '').slice(0, 8)}`, checked: session.enabled, disabled: isBusy, onChange: async (checked) => {
                            if (await submitAction('session', { id: session.id, enabled: checked })) {
                                notify(checked ? '这段对话会用到记忆' : '这段对话不再用记忆');
                            }
                        } }),
                    React.createElement("details", { className: "fish-source" },
                        React.createElement("summary", null, "\u5BF9\u8BDD\u8BE6\u60C5"),
                        React.createElement("p", null, session.id),
                        React.createElement("p", null, session.project || '无项目'))))),
                React.createElement("div", { className: "fish-jobs" },
                    state.jobs.slice(0, 10).map((job) => (React.createElement("div", { className: "fish-job", key: job.id },
                        React.createElement("span", { className: "fish-tag" }, jobLabels[job.status] || job.status),
                        React.createElement("time", null, dateLabel(job.updated_at)),
                        job.error && React.createElement("p", { className: "fish-error" }, job.error)))),
                    state.jobs.length === 0 && React.createElement("p", { className: "fish-muted" }, "\u8FD8\u6CA1\u6709\u56DE\u60F3\u8BB0\u5F55\u3002"),
                    state.jobs.some((job) => job.status === 'failed') && (React.createElement("button", { type: "button", className: "fish-button", disabled: isBusy, onClick: async () => {
                            if (await submitAction('retry', {}))
                                notify('好，我再想一想');
                        } }, "\u628A\u6CA1\u8BB0\u4E0B\u6765\u7684\u518D\u60F3\u4E00\u904D"))))),
        React.createElement(RetrievalSettings, { state: state, isBusy: isBusy, submitAction: submitAction, notify: notify }),
        React.createElement("details", { className: "fish-fold" },
            React.createElement("summary", null, "\u91CD\u65B0\u517B\u4E00\u4E2A"),
            React.createElement("div", { className: "fish-fold-body" },
                React.createElement("p", { className: "fish-muted" }, "\u65B0\u7684\u5979\u4F1A\u4ECE\u96F6\u5F00\u59CB\u8BA4\u8BC6\u4F60\u3002\u73B0\u5728\u8FD9\u4F4D\u4F1A\u7559\u5728\u8FD9\u91CC\uFF0C\u8BB0\u5FC6\u90FD\u8FD8\u5728\uFF0C\u4F46\u4E0D\u518D\u53C2\u4E0E\u65B0\u7684\u5BF9\u8BDD\u3002"),
                React.createElement("form", { className: "fish-form", onSubmit: createPersona },
                    React.createElement("label", null,
                        "\u7ED9\u5979\u8D77\u4E2A\u540D\u5B57",
                        React.createElement("input", { name: "name", required: true, maxLength: 40, placeholder: "\u6BD4\u5982\uFF1A\u5C0F\u9CB8" })),
                    React.createElement("button", { type: "submit", className: "fish-button", disabled: isBusy }, "\u8FCE\u63A5\u65B0\u7684\u5979"))))));
}
//# sourceMappingURL=settings-panel.js.map