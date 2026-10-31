import * as React from 'react';
import { dateLabel, request } from './api.js';
import { memoryKindLabels } from './components.js';
const actions = {
    ADD: '新记住',
    UPDATE: '更新',
    DELETE: '不再作数',
    MERGE: '合并',
    CONSOLIDATE: '形成倾向',
    MIGRATE: '格式升级',
};
export function HistoryPanel({ state }) {
    const [page, setPage] = React.useState(1);
    const [filter, setFilter] = React.useState({ query: '', kind: '', action: '' });
    const [data, setData] = React.useState(null);
    const [error, setError] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [refresh, setRefresh] = React.useState(0);
    const through = React.useRef(undefined);
    const { user, persona } = state.scope;
    React.useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError('');
        void request('history', { scope: { user, persona, project: '' }, page, ...filter, through: through.current }, state.token, controller.signal)
            .then((result) => {
            if (controller.signal.aborted) {
                return;
            }
            through.current = result.through;
            setData(result);
        })
            .catch((failure) => {
            if (!controller.signal.aborted) {
                setError(failure instanceof Error ? failure.message : '读取变化记录失败');
            }
        })
            .finally(() => {
            if (!controller.signal.aborted) {
                setLoading(false);
            }
        });
        return () => controller.abort();
    }, [page, filter, refresh, user, persona, state.token]);
    const pages = Math.max(1, Math.ceil((data?.total || 0) / (data?.pageSize || 20)));
    function search(event) {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        through.current = undefined;
        setPage(1);
        setFilter({
            query: String(form.get('query') || '').trim(),
            kind: String(form.get('kind') || ''),
            action: String(form.get('action') || ''),
        });
        setData(null);
    }
    return (React.createElement("div", { className: "fish-fold-body" },
        React.createElement("form", { className: "fish-history-controls", onSubmit: search },
            React.createElement("label", null,
                "\u5173\u952E\u8BCD",
                React.createElement("input", { name: "query", type: "search", maxLength: 200, placeholder: "\u67E5\u627E\u5185\u5BB9\u3001\u6539\u52A8\u524D\u6216\u539F\u56E0" })),
            React.createElement("label", null,
                "\u8BB0\u5FC6\u7C7B\u578B",
                React.createElement("select", { name: "kind" },
                    React.createElement("option", { value: "" }, "\u5168\u90E8\u7C7B\u578B"),
                    Object.entries(memoryKindLabels).map(([value, label]) => (React.createElement("option", { key: value, value: value }, label))))),
            React.createElement("label", null,
                "\u53D8\u5316\u7C7B\u578B",
                React.createElement("select", { name: "action" },
                    React.createElement("option", { value: "" }, "\u5168\u90E8\u53D8\u5316"),
                    Object.entries(actions).map(([value, label]) => (React.createElement("option", { key: value, value: value }, label))))),
            React.createElement("button", { type: "submit", className: "fish-button fish-button-small" }, "\u67E5\u627E"),
            React.createElement("button", { type: "button", className: "fish-text-button", disabled: loading, onClick: () => {
                    through.current = undefined;
                    setPage(1);
                    setRefresh((value) => value + 1);
                } }, "\u5237\u65B0\u8BB0\u5F55")),
        React.createElement("p", { className: "fish-muted", role: "status" }, loading ? '正在读取…' : `共 ${data?.total || 0} 条 · 每页 20 条`),
        error && (React.createElement("p", { className: "fish-error", role: "alert" }, error)),
        !loading && !error && data?.total === 0 && (React.createElement("p", { className: "fish-muted" }, "\u6CA1\u6709\u5339\u914D\u7684\u53D8\u5316\u8BB0\u5F55\u3002")),
        React.createElement("ol", { className: "fish-timeline", "aria-busy": loading }, !loading &&
            !error &&
            data?.items.map((record) => {
                const memory = record.after || record.before;
                return (React.createElement("li", { className: "fish-history", key: record.id, "data-action": record.action },
                    React.createElement("div", { className: "fish-record-meta" },
                        React.createElement("span", { className: "fish-tag fish-action-tag" }, actions[record.action || ''] || record.action),
                        memory && (React.createElement("span", { className: `fish-kind fish-kind-${memory.kind}` }, memoryKindLabels[memory.kind])),
                        record.at && (React.createElement("time", { className: "fish-record-meta-end", dateTime: record.at }, dateLabel(record.at)))),
                    React.createElement("p", null, memory?.text),
                    record.before && record.after && record.before.text !== record.after.text && (React.createElement("details", { className: "fish-source" },
                        React.createElement("summary", null, "\u6539\u52A8\u524D"),
                        React.createElement("p", { className: "fish-before" }, record.before.text))),
                    record.reason && (React.createElement("p", { className: "fish-muted fish-history-reason" },
                        "\u539F\u56E0\uFF1A",
                        record.reason))));
            })),
        data && data.total > 0 && (React.createElement("form", { className: "fish-pagination", "aria-label": "\u53D8\u5316\u8BB0\u5F55\u5206\u9875", onSubmit: (event) => {
                event.preventDefault();
                const value = Number(new FormData(event.currentTarget).get('page'));
                if (Number.isInteger(value) && value >= 1 && value <= pages) {
                    setPage(value);
                }
            } },
            React.createElement("button", { type: "button", className: "fish-button fish-button-small", disabled: loading || data.page <= 1, onClick: () => setPage(data.page - 1) }, "\u4E0A\u4E00\u9875"),
            React.createElement("span", null,
                "\u7B2C ",
                data.page,
                " / ",
                pages,
                " \u9875"),
            React.createElement("button", { type: "button", className: "fish-button fish-button-small", disabled: loading || data.page >= pages, onClick: () => setPage(data.page + 1) }, "\u4E0B\u4E00\u9875"),
            React.createElement("label", null,
                "\u8DF3\u81F3",
                React.createElement("input", { key: `${data.page}-${pages}`, name: "page", "aria-label": "\u76EE\u6807\u9875\u7801", type: "number", min: 1, max: pages, defaultValue: data.page, required: true })),
            React.createElement("button", { type: "submit", className: "fish-text-button", disabled: loading }, "\u8DF3\u8F6C")))));
}
//# sourceMappingURL=history-panel.js.map