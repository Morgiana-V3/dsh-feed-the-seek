import * as React from 'react';
import { projectLabel, request } from './api.js';
/**
 * Common services. The protocol list describes request formats; these are concrete services,
 * which is why a vendor (火山方舟) appears here and not as a "protocol".
 */
const embeddingPresets = [
    {
        id: 'ollama',
        label: '本机 Ollama · bge-m3（推荐：免费，数据不出电脑）',
        url: 'http://127.0.0.1:11434/api/embed',
        model: 'bge-m3',
        protocol: 'ollama',
        note: '先安装 Ollama，并在终端运行 ollama pull bge-m3。不需要 API Key。',
    },
    {
        id: 'openai',
        label: 'OpenAI · text-embedding-3-small',
        url: 'https://api.openai.com/v1/embeddings',
        model: 'text-embedding-3-small',
        protocol: 'openai',
        note: '需要 OpenAI 的 API Key；记忆文字会发送到 OpenAI 生成向量。',
    },
    {
        id: 'doubao',
        label: '火山方舟 · 豆包视觉向量',
        url: 'https://ark.cn-beijing.volces.com/api/v3/embeddings/multimodal',
        model: 'doubao-embedding-vision-251215',
        protocol: 'doubao',
        note: '需要火山方舟的 API Key；记忆文字会发送到火山方舟生成向量。',
    },
];
function connectionValues(form) {
    const values = new FormData(form);
    const keyInput = form.elements.namedItem('apiKey');
    return {
        embeddingUrl: String(values.get('url')).trim(),
        embeddingModel: String(values.get('model')).trim(),
        embeddingApiKey: keyInput?.readOnly ? '' : String(values.get('apiKey') || '').trim(),
        embeddingProtocol: String(values.get('protocol')),
        embeddingDimensions: Number(values.get('dimensions') || 0),
    };
}
export function RetrievalSettings({ state, isBusy, submitAction, notify, }) {
    const [indexProject, setIndexProject] = React.useState('');
    const [isEditingKey, setIsEditingKey] = React.useState(false);
    const [draftUrl, setDraftUrl] = React.useState(state.settings.embeddingUrl);
    const formRef = React.useRef(null);
    const [preset, setPreset] = React.useState('');
    const presetNote = embeddingPresets.find((entry) => entry.id === preset)?.note;
    /** Fills the uncontrolled fields from a preset; the user still tests and saves explicitly. */
    function applyPreset(id) {
        setPreset(id);
        const entry = embeddingPresets.find((candidate) => candidate.id === id);
        const form = formRef.current;
        if (!entry || !form) {
            return;
        }
        const set = (name, value) => {
            const field = form.elements.namedItem(name);
            if (field)
                field.value = value;
        };
        set('url', entry.url);
        set('model', entry.model);
        set('protocol', entry.protocol);
        set('dimensions', '0');
        setDraftUrl(entry.url);
        clearTestResult();
    }
    const probeRef = React.useRef(null);
    const [isTesting, setIsTesting] = React.useState(false);
    const [testResult, setTestResult] = React.useState(null);
    const projects = [...new Set(['', ...state.memories.map((memory) => memory.scope.project)])];
    const isSemantic = state.settings.retrievalMode === 'semantic';
    const showSavedKey = Boolean(state.vector.apiKeyConfigured) &&
        draftUrl.trim() === state.settings.embeddingUrl &&
        !isEditingKey;
    React.useEffect(() => () => probeRef.current?.abort(), []);
    function clearTestResult() {
        probeRef.current?.abort();
        probeRef.current = null;
        setIsTesting(false);
        setTestResult(null);
    }
    async function testConnection() {
        const form = formRef.current;
        if (!form || !form.reportValidity() || probeRef.current) {
            return;
        }
        const controller = new AbortController();
        probeRef.current = controller;
        setIsTesting(true);
        setTestResult(null);
        try {
            const result = await request('embedding-test', connectionValues(form), state.token, controller.signal);
            if (probeRef.current === controller) {
                setTestResult({
                    ok: true,
                    message: `连接成功 · ${result.dimensions} 维 · ${result.elapsedMs} ms`,
                });
            }
        }
        catch (error) {
            if (probeRef.current === controller && !controller.signal.aborted) {
                setTestResult({
                    ok: false,
                    message: error instanceof Error ? error.message : '连接测试失败',
                });
            }
        }
        finally {
            if (probeRef.current === controller) {
                probeRef.current = null;
                setIsTesting(false);
            }
        }
    }
    async function saveConnection(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const saved = await submitAction('settings', connectionValues(form));
        if (saved) {
            notify('连接配置已保存');
            setIsEditingKey(false);
            const input = form.elements.namedItem('apiKey');
            if (input && !input.readOnly) {
                input.value = '';
            }
        }
    }
    return (React.createElement("section", { className: "fish-retrieval-settings" },
        React.createElement("div", { className: "fish-section-heading" },
            React.createElement("h3", null, "\u6211\u600E\u4E48\u60F3\u8D77\u4EE5\u524D\u7684\u4E8B")),
        React.createElement("fieldset", { className: "fish-mode-options", disabled: isBusy },
            React.createElement("legend", { className: "fish-screen-reader" }, "\u9009\u62E9\u8BB0\u5FC6\u65B9\u5F0F"),
            React.createElement("label", { className: "fish-mode-option" },
                React.createElement("input", { type: "radio", name: "fish-retrieval-mode", value: "local", checked: !isSemantic, onChange: () => {
                        void submitAction('settings', { retrievalMode: 'local' });
                    } }),
                React.createElement("span", null,
                    React.createElement("strong", null, "\u6309\u5173\u952E\u8BCD\u60F3\u8D77"),
                    React.createElement("span", null, "\u4E0D\u7528\u914D\u7F6E\uFF0C\u4E5F\u4E0D\u8C03\u7528\u5176\u4ED6\u670D\u52A1\u3002\u540C\u4E00\u4EF6\u4E8B\u6362\u4E2A\u8BF4\u6CD5\u65F6\uFF0C\u53EF\u80FD\u60F3\u4E0D\u8D77\u6765\u3002"))),
            React.createElement("label", { className: "fish-mode-option" },
                React.createElement("input", { type: "radio", name: "fish-retrieval-mode", value: "semantic", checked: isSemantic, onChange: () => {
                        void submitAction('settings', { retrievalMode: 'semantic' });
                    } }),
                React.createElement("span", null,
                    React.createElement("strong", null, "\u542C\u5F97\u61C2\u6362\u4E2A\u8BF4\u6CD5"),
                    React.createElement("span", null, "\u8BF4\u201C\u64B8\u732B\u201D\u4E5F\u80FD\u60F3\u8D77\u5E74\u7CD5\u3002\u9700\u8981\u4E00\u4E2A\u6587\u672C\u5411\u91CF\u670D\u52A1\uFF1B\u7528\u672C\u673A Ollama \u65F6\u6570\u636E\u4E0D\u51FA\u7535\u8111\u3002")))),
        React.createElement("p", { className: "fish-muted" }, "\u4E24\u79CD\u65B9\u5F0F\u5171\u7528\u540C\u4E00\u4EFD\u8BB0\u5FC6\uFF0C\u968F\u65F6\u5207\u6362\u90FD\u4E0D\u4F1A\u4E22\u3002\u8BB0\u5FC6\u548C\u5411\u91CF\u90FD\u5B58\u5728\u672C\u673A\uFF1B\u6211\u7684\u540D\u5B57\u3001\u5BF9\u4F60\u7684\u79F0\u547C\u548C\u6211\u7684\u6027\u683C\u4E0D\u9760\u68C0\u7D22\uFF0C\u4E24\u79CD\u65B9\u5F0F\u4E0B\u90FD\u4E00\u76F4\u8BB0\u5F97\u3002"),
        isSemantic && (React.createElement("details", { className: "fish-fold", open: true },
            React.createElement("summary", null,
                "\u5411\u91CF\u670D\u52A1",
                ' ',
                React.createElement("span", { className: "fish-tag", "data-ok": state.vector.configured || undefined }, state.vector.configured ? '已保存' : '尚未配置')),
            React.createElement("div", { className: "fish-fold-body" },
                React.createElement("p", { className: "fish-muted" }, "\u9700\u8981\u6587\u672C\u5411\u91CF\uFF08Embedding\uFF09\u670D\u52A1\uFF0C\u804A\u5929\u6A21\u578B\u7684\u63A5\u53E3\u4E0D\u80FD\u4EE3\u66FF\u3002\u6CA1\u914D\u597D\u6216\u8FDE\u4E0D\u4E0A\u65F6\uFF0C\u4F1A\u81EA\u52A8\u6539\u56DE\u6309\u5173\u952E\u8BCD\u60F3\u8D77\u3002"),
                React.createElement("form", { ref: formRef, className: "fish-form", onSubmit: saveConnection, onChange: clearTestResult },
                    React.createElement("label", null,
                        "\u5E38\u7528\u670D\u52A1\uFF08\u9009\u4E00\u4E2A\u4F1A\u81EA\u52A8\u586B\u597D\u4E0B\u9762\u51E0\u9879\uFF09",
                        React.createElement("select", { value: preset, onChange: (event) => applyPreset(event.target.value), "aria-describedby": "fish-preset-note" },
                            React.createElement("option", { value: "" }, "\u81EA\u5DF1\u586B\u5199"),
                            embeddingPresets.map((entry) => (React.createElement("option", { key: entry.id, value: entry.id }, entry.label))))),
                    presetNote && (React.createElement("p", { className: "fish-muted", id: "fish-preset-note" }, presetNote)),
                    React.createElement("label", null,
                        "\u63A5\u53E3\u683C\u5F0F\uFF08\u4E00\u822C\u6309\u5730\u5740\u81EA\u52A8\u8BC6\u522B\uFF0C\u65E0\u9700\u4FEE\u6539\uFF09",
                        React.createElement("select", { name: "protocol", defaultValue: state.settings.embeddingProtocol },
                            React.createElement("option", { value: "auto" }, "\u6309\u5730\u5740\u81EA\u52A8\u8BC6\u522B"),
                            React.createElement("option", { value: "openai" }, "OpenAI \u683C\u5F0F\uFF08/embeddings\uFF0C\u5927\u591A\u6570\u670D\u52A1\uFF09"),
                            React.createElement("option", { value: "ollama" }, "Ollama \u683C\u5F0F\uFF08/api/embed\uFF09"),
                            React.createElement("option", { value: "doubao" }, "\u591A\u6A21\u6001\u683C\u5F0F\uFF08/embeddings/multimodal\uFF0C\u5982\u8C46\u5305\u89C6\u89C9\u5411\u91CF\uFF09"))),
                    React.createElement("label", null,
                        "\u63A5\u53E3\u5730\u5740",
                        React.createElement("input", { name: "url", type: "url", required: true, defaultValue: state.settings.embeddingUrl, onChange: (event) => setDraftUrl(event.target.value), placeholder: "https://\u2026/embeddings" })),
                    React.createElement("label", null,
                        "\u5411\u91CF\u6A21\u578B\u540D\u79F0",
                        React.createElement("input", { name: "model", required: true, defaultValue: state.settings.embeddingModel })),
                    React.createElement("label", null,
                        "\u5411\u91CF\u7EF4\u5EA6\uFF080 \u4F7F\u7528\u6A21\u578B\u9ED8\u8BA4\u503C\uFF09",
                        React.createElement("input", { name: "dimensions", type: "number", min: "0", max: "8192", step: "1", defaultValue: state.settings.embeddingDimensions })),
                    React.createElement("p", { className: "fish-muted" }, "\u53EA\u652F\u6301\u6A21\u578B\u5141\u8BB8\u7684\u7EF4\u5EA6\u3002\u4FEE\u6539\u63A5\u53E3\u683C\u5F0F\u3001\u6A21\u578B\u6216\u7EF4\u5EA6\u540E\uFF0C\u9700\u8981\u91CD\u65B0\u51C6\u5907\u7D22\u5F15\u3002"),
                    React.createElement("label", null,
                        "API Key",
                        showSavedKey ? (React.createElement("input", { key: "saved-key", name: "apiKey", type: "password", value: "************", readOnly: true, "aria-label": "API Key\uFF08\u5DF2\u4FDD\u5B58\uFF09" })) : (React.createElement("input", { key: "editable-key", name: "apiKey", type: "password", autoComplete: "new-password", spellCheck: false, maxLength: 4096, placeholder: "\u8F93\u5165 API Key\uFF08\u672C\u5730\u514D\u5BC6\u670D\u52A1\u53EF\u7559\u7A7A\uFF09" }))),
                    showSavedKey && (React.createElement("div", { className: "fish-connection-actions" },
                        React.createElement("span", { role: "status" }, "API Key \u5DF2\u4FDD\u5B58"),
                        React.createElement("button", { type: "button", className: "fish-button", disabled: isBusy || isTesting, onClick: () => {
                                clearTestResult();
                                setIsEditingKey(true);
                            } }, "\u66F4\u6362\u5BC6\u94A5"))),
                    React.createElement("p", { className: "fish-muted" }, "\u670D\u52A1\u8D1F\u8D23\u751F\u6210\u5411\u91CF\uFF0C\u8BB0\u5FC6\u4E0E\u5411\u91CF\u5747\u4FDD\u5B58\u5728\u672C\u673A\u3002\u8FDC\u7A0B\u670D\u52A1\u4F1A\u6536\u5230\u7528\u4E8E\u751F\u6210\u5411\u91CF\u7684\u6587\u5B57\u3002"),
                    React.createElement("div", { className: "fish-connection-actions" },
                        React.createElement("button", { type: "button", className: "fish-button", disabled: isBusy || isTesting, onClick: () => void testConnection() }, isTesting ? '测试中…' : '测试连接'),
                        React.createElement("button", { type: "submit", className: "fish-button fish-button-primary", disabled: isBusy || isTesting }, "\u4FDD\u5B58\u8FDE\u63A5")),
                    React.createElement("p", { className: "fish-muted" }, "\u6D4B\u8BD5\u53EA\u53D1\u9001\u56FA\u5B9A\u6D4B\u8BD5\u6587\u5B57\uFF0C\u4E0D\u4FDD\u5B58\u914D\u7F6E\u3001\u6D4B\u8BD5\u7ED3\u679C\u6216\u5411\u91CF\u3002"),
                    testResult && (React.createElement("p", { role: testResult.ok ? 'status' : 'alert', className: "fish-connection-result", "data-success": testResult.ok }, testResult.message))),
                React.createElement("div", { className: "fish-form fish-index-form" },
                    React.createElement("p", { className: "fish-muted" },
                        "\u5411\u91CF\u6269\u5C55",
                        state.vector.available ? '可用' : '不可用',
                        " \u00B7 \u5DF2\u4FDD\u5B58 ",
                        state.vector.count,
                        ' ',
                        "\u6761\u7D22\u5F15\u3002\u65B0\u8BB0\u5FC6\u81EA\u52A8\u5904\u7406\uFF0C\u5DF2\u6709\u8BB0\u5FC6\u53EF\u5728\u8FD9\u91CC\u51C6\u5907\u3002"),
                    React.createElement("label", null,
                        "\u5904\u7406\u8303\u56F4",
                        React.createElement("select", { value: indexProject, onChange: (event) => setIndexProject(event.target.value) }, projects.map((projectPath) => (React.createElement("option", { key: projectPath, value: projectPath }, projectPath ? projectLabel(projectPath) : '不限项目'))))),
                    React.createElement("button", { type: "button", className: "fish-button", disabled: isBusy || !state.vector.configured || !state.vector.available, onClick: async () => {
                            const result = (await submitAction('index', {
                                scope: { ...state.scope, project: indexProject },
                            }));
                            if (result)
                                notify(`又有 ${result.count ?? 0} 条记忆可以换个说法想起了`);
                        } }, "\u8BA9\u4EE5\u524D\u7684\u8BB0\u5FC6\u4E5F\u80FD\u8FD9\u6837\u60F3\u8D77")))))));
}
//# sourceMappingURL=retrieval-settings.js.map