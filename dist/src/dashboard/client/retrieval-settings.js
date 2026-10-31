import * as React from 'react';
import { request } from './api.js';
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
/** What retrieval actually runs on, for the status line. A saved semantic mode alone is not enough. */
export function retrievalStatus(state) {
    if (state.settings.retrievalMode !== 'semantic') {
        return '关键词检索';
    }
    return state.vector.configured && state.vector.available
        ? '语义检索'
        : '语义检索未就绪 · 使用关键词检索';
}
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
    const [isEditingKey, setIsEditingKey] = React.useState(false);
    const [draftUrl, setDraftUrl] = React.useState(state.settings.embeddingUrl);
    const formRef = React.useRef(null);
    const [preset, setPreset] = React.useState('');
    const presetNote = embeddingPresets.find((entry) => entry.id === preset)?.note;
    // Choosing semantic search without a saved connection only opens the setup; the mode is
    // saved together with a connection that has just passed the test.
    const [isSettingUp, setIsSettingUp] = React.useState(false);
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
            if (field) {
                field.value = value;
            }
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
    const isSemantic = state.settings.retrievalMode === 'semantic';
    const isSemanticReady = isSemantic && state.vector.configured && state.vector.available;
    const showSetup = isSemantic || isSettingUp;
    const showSavedKey = Boolean(state.vector.apiKeyConfigured) &&
        draftUrl.trim() === state.settings.embeddingUrl &&
        !isEditingKey;
    const indexed = state.vector.count;
    const total = state.vector.total ?? indexed;
    React.useEffect(() => () => probeRef.current?.abort(), []);
    function clearTestResult() {
        probeRef.current?.abort();
        probeRef.current = null;
        setIsTesting(false);
        setTestResult(null);
    }
    function chooseLocal() {
        setIsSettingUp(false);
        clearTestResult();
        if (isSemantic) {
            void submitAction('settings', { retrievalMode: 'local' });
        }
    }
    async function chooseSemantic() {
        if (state.vector.configured) {
            if (await submitAction('settings', { retrievalMode: 'semantic' })) {
                notify('已切换到语义检索');
            }
        }
        else {
            setIsSettingUp(true);
        }
    }
    /** Runs the probe; resolves to whether the connection works. */
    async function testConnection() {
        const form = formRef.current;
        if (!form || !form.reportValidity() || probeRef.current) {
            return false;
        }
        const controller = new AbortController();
        probeRef.current = controller;
        setIsTesting(true);
        setTestResult(null);
        try {
            const result = await request('embedding-test', connectionValues(form), state.token, controller.signal);
            if (probeRef.current !== controller) {
                return false;
            }
            setTestResult({
                ok: true,
                message: `连接成功 · ${result.dimensions} 维 · ${result.elapsedMs} ms`,
            });
            return true;
        }
        catch (error) {
            if (probeRef.current === controller && !controller.signal.aborted) {
                setTestResult({
                    ok: false,
                    message: error instanceof Error ? error.message : '连接测试失败',
                });
            }
            return false;
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
        if (!(await testConnection())) {
            return;
        }
        const saved = await submitAction('settings', {
            ...connectionValues(form),
            retrievalMode: 'semantic',
        });
        if (saved) {
            notify(isSemantic ? '连接配置已保存' : '语义检索已启用');
            setIsSettingUp(false);
            setIsEditingKey(false);
            const input = form.elements.namedItem('apiKey');
            if (input && !input.readOnly) {
                input.value = '';
            }
        }
    }
    async function clearSavedKey() {
        clearTestResult();
        if (await submitAction('settings', { clearEmbeddingApiKey: true })) {
            notify('已清除保存的 API Key');
            setIsEditingKey(false);
        }
    }
    return (React.createElement("section", { className: "fish-retrieval-settings" },
        React.createElement("div", { className: "fish-section-heading" },
            React.createElement("h3", null, "\u68C0\u7D22\u65B9\u5F0F")),
        React.createElement("fieldset", { className: "fish-mode-options", disabled: isBusy },
            React.createElement("legend", { className: "fish-screen-reader" }, "\u9009\u62E9\u68C0\u7D22\u65B9\u5F0F"),
            React.createElement("label", { className: "fish-mode-option" },
                React.createElement("input", { type: "radio", name: "fish-retrieval-mode", value: "local", checked: !showSetup, onChange: chooseLocal }),
                React.createElement("span", null,
                    React.createElement("strong", null, "\u5173\u952E\u8BCD\u68C0\u7D22"),
                    React.createElement("span", null, "\u65E0\u9700\u914D\u7F6E\uFF0C\u4E0D\u8C03\u7528\u5916\u90E8\u670D\u52A1\u3002\u6362\u4E00\u79CD\u8BF4\u6CD5\u65F6\u53EF\u80FD\u627E\u4E0D\u5230\u76F8\u5173\u8BB0\u5FC6\u3002"))),
            React.createElement("label", { className: "fish-mode-option", "data-unavailable": !state.vector.available || undefined },
                React.createElement("input", { type: "radio", name: "fish-retrieval-mode", value: "semantic", checked: showSetup, disabled: !state.vector.available, onChange: () => void chooseSemantic() }),
                React.createElement("span", null,
                    React.createElement("strong", null,
                        "\u8BED\u4E49\u68C0\u7D22",
                        isSemantic && !isSemanticReady && React.createElement("small", null, "\u672A\u5C31\u7EEA"),
                        !isSemantic && isSettingUp && React.createElement("small", null, "\u5F85\u914D\u7F6E")),
                    React.createElement("span", null, state.vector.available
                        ? '能找到意思相近、措辞不同的记忆。需要文本向量服务；使用本机 Ollama 时数据不出电脑。'
                        : '当前运行环境缺少向量扩展，暂时无法使用。')))),
        showSetup && (React.createElement("details", { className: "fish-fold", open: true },
            React.createElement("summary", null,
                "\u5411\u91CF\u670D\u52A1",
                ' ',
                React.createElement("span", { className: "fish-tag", "data-ok": state.vector.configured || undefined }, state.vector.configured ? '已保存' : '尚未配置')),
            React.createElement("div", { className: "fish-fold-body" },
                React.createElement("p", { className: "fish-muted" }, "\u9700\u8981\u6587\u672C\u5411\u91CF\uFF08Embedding\uFF09\u670D\u52A1\uFF0C\u804A\u5929\u6A21\u578B\u7684\u63A5\u53E3\u4E0D\u80FD\u4EE3\u66FF\u3002"),
                React.createElement("form", { ref: formRef, className: "fish-form", onSubmit: saveConnection, onChange: clearTestResult },
                    React.createElement("label", null,
                        "\u5E38\u7528\u670D\u52A1\uFF08\u9009\u62E9\u540E\u81EA\u52A8\u586B\u5199\u4E0B\u9762\u51E0\u9879\uFF09",
                        React.createElement("select", { value: preset, onChange: (event) => applyPreset(event.target.value), "aria-describedby": "fish-preset-note" },
                            React.createElement("option", { value: "" }, "\u81EA\u5DF1\u586B\u5199"),
                            embeddingPresets.map((entry) => (React.createElement("option", { key: entry.id, value: entry.id }, entry.label))))),
                    presetNote && (React.createElement("p", { className: "fish-muted", id: "fish-preset-note" }, presetNote)),
                    React.createElement("label", null,
                        "\u63A5\u53E3\u5730\u5740",
                        React.createElement("input", { name: "url", type: "url", required: true, defaultValue: state.settings.embeddingUrl, onChange: (event) => setDraftUrl(event.target.value), placeholder: "https://\u2026/embeddings" })),
                    React.createElement("label", null,
                        "\u5411\u91CF\u6A21\u578B\u540D\u79F0",
                        React.createElement("input", { name: "model", required: true, defaultValue: state.settings.embeddingModel })),
                    React.createElement("label", null,
                        "API Key",
                        showSavedKey ? (React.createElement("input", { key: "saved-key", name: "apiKey", type: "password", value: "************", readOnly: true, "aria-label": "API Key\uFF08\u5DF2\u4FDD\u5B58\uFF09" })) : (React.createElement("input", { key: "editable-key", name: "apiKey", type: "password", autoComplete: "new-password", spellCheck: false, maxLength: 4096, placeholder: "\u8F93\u5165 API Key\uFF08\u672C\u5730\u514D\u5BC6\u670D\u52A1\u53EF\u7559\u7A7A\uFF09" }))),
                    showSavedKey && (React.createElement("div", { className: "fish-connection-actions" },
                        React.createElement("span", { role: "status" }, "API Key \u5DF2\u4FDD\u5B58"),
                        React.createElement("button", { type: "button", className: "fish-button", disabled: isBusy || isTesting, onClick: () => {
                                clearTestResult();
                                setIsEditingKey(true);
                            } }, "\u66F4\u6362"),
                        React.createElement("button", { type: "button", className: "fish-button", disabled: isBusy || isTesting, onClick: () => void clearSavedKey() }, "\u6E05\u9664"))),
                    React.createElement("details", { className: "fish-source" },
                        React.createElement("summary", null, "\u9AD8\u7EA7\u9009\u9879"),
                        React.createElement("div", { className: "fish-fold-body fish-form" },
                            React.createElement("label", null,
                                "\u63A5\u53E3\u683C\u5F0F\uFF08\u4E00\u822C\u6309\u5730\u5740\u81EA\u52A8\u8BC6\u522B\uFF0C\u65E0\u9700\u4FEE\u6539\uFF09",
                                React.createElement("select", { name: "protocol", defaultValue: state.settings.embeddingProtocol },
                                    React.createElement("option", { value: "auto" }, "\u6309\u5730\u5740\u81EA\u52A8\u8BC6\u522B"),
                                    React.createElement("option", { value: "openai" }, "OpenAI \u683C\u5F0F\uFF08/embeddings\uFF0C\u5927\u591A\u6570\u670D\u52A1\uFF09"),
                                    React.createElement("option", { value: "ollama" }, "Ollama \u683C\u5F0F\uFF08/api/embed\uFF09"),
                                    React.createElement("option", { value: "doubao" }, "\u591A\u6A21\u6001\u683C\u5F0F\uFF08/embeddings/multimodal\uFF0C\u5982\u8C46\u5305\u89C6\u89C9\u5411\u91CF\uFF09"))),
                            React.createElement("label", null,
                                "\u5411\u91CF\u7EF4\u5EA6\uFF080 \u4F7F\u7528\u6A21\u578B\u9ED8\u8BA4\u503C\uFF09",
                                React.createElement("input", { name: "dimensions", type: "number", min: "0", max: "8192", step: "1", defaultValue: state.settings.embeddingDimensions })))),
                    React.createElement("p", { className: "fish-muted" }, "\u4F7F\u7528\u8FDC\u7A0B\u670D\u52A1\u65F6\uFF0C\u5BF9\u65B9\u4F1A\u6536\u5230\u7528\u4E8E\u751F\u6210\u5411\u91CF\u7684\u6587\u5B57\u3002"),
                    React.createElement("div", { className: "fish-connection-actions" },
                        React.createElement("button", { type: "button", className: "fish-button", disabled: isBusy || isTesting, onClick: () => void testConnection() }, isTesting ? '测试中…' : '仅测试'),
                        React.createElement("button", { type: "submit", className: "fish-button fish-button-primary", disabled: isBusy || isTesting }, isSemantic ? '测试并保存' : '测试并启用'),
                        !isSemantic && (React.createElement("button", { type: "button", className: "fish-text-button", onClick: chooseLocal }, "\u53D6\u6D88"))),
                    testResult && (React.createElement("p", { role: testResult.ok ? 'status' : 'alert', className: "fish-connection-result", "data-success": testResult.ok }, testResult.message))),
                isSemantic && (React.createElement("div", { className: "fish-form fish-index-form" },
                    React.createElement("p", { className: "fish-muted" },
                        "\u5DF2\u5EFA\u7ACB\u7D22\u5F15 ",
                        indexed,
                        " / ",
                        total,
                        " \u6761"),
                    React.createElement("button", { type: "button", className: "fish-button", disabled: isBusy || !isSemanticReady || indexed >= total, onClick: async () => {
                            const result = (await submitAction('index', {
                                scope: { ...state.scope, project: '' },
                            }));
                            if (result) {
                                notify(`已为 ${result.count ?? 0} 条记忆建立索引`);
                            }
                        } }, indexed >= total ? '索引已是最新' : `为其余 ${total - indexed} 条建立索引`))))))));
}
//# sourceMappingURL=retrieval-settings.js.map