import * as React from 'react'
import type { HistoryPage, SettingsState } from '../contracts.js'
import { dateLabel, request } from './api.js'
import { memoryKindLabels } from './components.js'

const actions: Record<string, string> = {
  ADD: '新记住',
  UPDATE: '更新',
  DELETE: '不再作数',
  MERGE: '合并',
  CONSOLIDATE: '形成倾向',
  MIGRATE: '格式升级',
}

export function HistoryPanel({ state }: { state: SettingsState }) {
  const [page, setPage] = React.useState(1)
  const [filter, setFilter] = React.useState({ query: '', kind: '', action: '' })
  const [data, setData] = React.useState<HistoryPage | null>(null)
  const [error, setError] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [refresh, setRefresh] = React.useState(0)
  const through = React.useRef<number | undefined>(undefined)
  const { user, persona } = state.scope
  React.useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    void request<HistoryPage>(
      'history',
      { scope: { user, persona, project: '' }, page, ...filter, through: through.current },
      state.token,
      controller.signal,
    )
      .then((result) => {
        if (controller.signal.aborted) {
          return
        }
        through.current = result.through
        setData(result)
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) {
          setError(failure instanceof Error ? failure.message : '读取变化记录失败')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [page, filter, refresh, user, persona, state.token])
  const pages = Math.max(1, Math.ceil((data?.total || 0) / (data?.pageSize || 20)))
  function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    through.current = undefined
    setPage(1)
    setFilter({
      query: String(form.get('query') || '').trim(),
      kind: String(form.get('kind') || ''),
      action: String(form.get('action') || ''),
    })
    setData(null)
  }
  return (
    <div className="fish-fold-body">
      <form
        className="fish-history-controls"
        onSubmit={search}
      >
        <label>
          关键词
          <input
            name="query"
            type="search"
            maxLength={200}
            placeholder="查找内容、改动前或原因"
          />
        </label>
        <label>
          记忆类型
          <select name="kind">
            <option value="">全部类型</option>
            {Object.entries(memoryKindLabels).map(([value, label]) => (
              <option
                key={value}
                value={value}
              >
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          变化类型
          <select name="action">
            <option value="">全部变化</option>
            {Object.entries(actions).map(([value, label]) => (
              <option
                key={value}
                value={value}
              >
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="fish-button fish-button-small"
        >
          查找
        </button>
        <button
          type="button"
          className="fish-text-button"
          disabled={loading}
          onClick={() => {
            through.current = undefined
            setPage(1)
            setRefresh((value) => value + 1)
          }}
        >
          刷新记录
        </button>
      </form>
      <p
        className="fish-muted"
        role="status"
      >
        {loading ? '正在读取…' : `共 ${data?.total || 0} 条 · 每页 20 条`}
      </p>
      {error && (
        <p
          className="fish-error"
          role="alert"
        >
          {error}
        </p>
      )}
      {!loading && !error && data?.total === 0 && (
        <p className="fish-muted">没有匹配的变化记录。</p>
      )}
      <ol
        className="fish-timeline"
        aria-busy={loading}
      >
        {!loading &&
          !error &&
          data?.items.map((record) => {
            const memory = record.after || record.before
            return (
              <li
                className="fish-history"
                key={record.id}
                data-action={record.action}
              >
                <div className="fish-record-meta">
                  <span className="fish-tag fish-action-tag">
                    {actions[record.action || ''] || record.action}
                  </span>
                  {memory && (
                    <span className={`fish-kind fish-kind-${memory.kind}`}>
                      {memoryKindLabels[memory.kind]}
                    </span>
                  )}
                  {record.at && (
                    <time
                      className="fish-record-meta-end"
                      dateTime={record.at}
                    >
                      {dateLabel(record.at)}
                    </time>
                  )}
                </div>
                <p>{memory?.text}</p>
                {record.before && record.after && record.before.text !== record.after.text && (
                  <details className="fish-source">
                    <summary>改动前</summary>
                    <p className="fish-before">{record.before.text}</p>
                  </details>
                )}
                {record.reason && (
                  <p className="fish-muted fish-history-reason">原因：{record.reason}</p>
                )}
              </li>
            )
          })}
      </ol>
      {data && data.total > 0 && (
        <form
          className="fish-pagination"
          aria-label="变化记录分页"
          onSubmit={(event) => {
            event.preventDefault()
            const value = Number(new FormData(event.currentTarget).get('page'))
            if (Number.isInteger(value) && value >= 1 && value <= pages) {
              setPage(value)
            }
          }}
        >
          <button
            type="button"
            className="fish-button fish-button-small"
            disabled={loading || data.page <= 1}
            onClick={() => setPage(data.page - 1)}
          >
            上一页
          </button>
          <span>
            第 {data.page} / {pages} 页
          </span>
          <button
            type="button"
            className="fish-button fish-button-small"
            disabled={loading || data.page >= pages}
            onClick={() => setPage(data.page + 1)}
          >
            下一页
          </button>
          <label>
            跳至
            <input
              key={`${data.page}-${pages}`}
              name="page"
              aria-label="目标页码"
              type="number"
              min={1}
              max={pages}
              defaultValue={data.page}
              required
            />
          </label>
          <button
            type="submit"
            className="fish-text-button"
            disabled={loading}
          >
            跳转
          </button>
        </form>
      )}
    </div>
  )
}
