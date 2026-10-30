import * as React from 'react'
import type { Kind } from '../types.js'
import {
  dateLabel,
  request,
  projectLabel,
  type RecallResult,
  type SettingsState,
} from './api.js'
import { EmptyState, MemoryCard, PixelIcon, memoryKindLabels } from './components.js'

const PAGE_SIZE = 30

const actionLabels: Record<string, string> = {
  ADD: '记住了',
  UPDATE: '更新了',
  DELETE: '不再作数',
  MIGRATE: '旧格式转换',
  CONSOLIDATE: '成为性格',
  MERGE: '合并',
}

export function MemoryPanel({
  state,
  selectedKind,
  onSelectKind,
  newMemoryIds,
  notify,
}: {
  state: SettingsState
  selectedKind: Kind | 'all'
  onSelectKind: (kind: Kind | 'all') => void
  newMemoryIds: Set<string>
  notify: (message: string) => void
}) {
  const [filterText, setFilterText] = React.useState('')
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE)
  const [query, setQuery] = React.useState('')
  const [project, setProject] = React.useState('')
  const [recallResult, setRecallResult] = React.useState<RecallResult | null>(null)
  const [isSearching, setIsSearching] = React.useState(false)
  const [isExporting, setIsExporting] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState('')
  const controllerRef = React.useRef<AbortController | null>(null)
  const memories = state.memories.filter((memory) => memory.status === 'active')
  const normalizedFilter = filterText.trim().toLowerCase()
  const filteredMemories = memories
    .filter((memory) => selectedKind === 'all' || memory.kind === selectedKind)
    .filter(
      (memory) =>
        !normalizedFilter ||
        [memory.text, memory.knowledge.domain, memory.knowledge.conditions, ...memory.tags]
          .join(' ')
          .toLowerCase()
          .includes(normalizedFilter),
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  const projects = [
    ...new Set([
      '',
      ...state.sessions.map((session) => session.project),
      ...memories.map((memory) => memory.scope.project),
    ]),
  ]

  React.useEffect(() => {
    setRecallResult(null)
  }, [state.revision])

  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [selectedKind, normalizedFilter])

  React.useEffect(
    () => () => {
      controllerRef.current?.abort()
    },
    [],
  )

  async function searchMemories(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setIsSearching(true)
    setErrorMessage('')
    try {
      const result = await request<RecallResult>(
        'recall',
        {
          query,
          scope: { ...state.scope, project },
        },
        state.token,
        controller.signal,
      )
      if (!controller.signal.aborted) {
        setRecallResult(result)
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setErrorMessage(error instanceof Error ? error.message : '检索失败')
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsSearching(false)
      }
    }
  }

  async function exportMemories() {
    setIsExporting(true)
    setErrorMessage('')
    try {
      const data = await request('export', { scope: state.scope }, state.token)
      const persona = state.personas.find((entry) => entry.id === state.scope.persona)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `dsh-feed-the-seek-memory-${persona?.name || state.scope.persona}-${new Date()
        .toISOString()
        .slice(0, 10)}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      notify('已导出记忆记录')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '导出失败')
    } finally {
      setIsExporting(false)
    }
  }

  const kindCounts = Object.fromEntries(
    (Object.keys(memoryKindLabels) as Kind[]).map((kind) => [
      kind,
      memories.filter((memory) => memory.kind === kind).length,
    ]),
  ) as Record<Kind, number>

  return (
    <div>
      <div className="fish-section-heading">
        <h3>我记得的事</h3>
        <div className="fish-heading-actions">
          <span className="fish-tag" title="这里只能看；想纠正，直接在对话里告诉我">想改就直接告诉我</span>
          <button
            type="button"
            className="fish-button fish-button-small"
            disabled={isExporting || memories.length === 0}
            onClick={() => void exportMemories()}
          >
            <PixelIcon name="download" />
            {isExporting ? '导出中…' : '导出'}
          </button>
        </div>
      </div>
      <div className="fish-list-controls">
        <div className="fish-filters" role="group" aria-label="记忆分类">
          <button
            type="button"
            aria-pressed={selectedKind === 'all'}
            onClick={() => onSelectKind('all')}
          >
            全部 {memories.length}
          </button>
          {(Object.entries(memoryKindLabels) as [Kind, string][]).map(([kind, label]) => (
            <button
              key={kind}
              type="button"
              className={`fish-filter-${kind}`}
              aria-pressed={selectedKind === kind}
              onClick={() => onSelectKind(kind)}
            >
              {label} {kindCounts[kind]}
            </button>
          ))}
        </div>
        <label className="fish-filter-input">
          <PixelIcon name="search" />
          <input
            type="search"
            value={filterText}
            placeholder="筛选文字、领域、标签"
            aria-label="筛选记忆"
            onChange={(event) => setFilterText(event.target.value)}
          />
        </label>
      </div>
      {filteredMemories.length === 0 &&
        (normalizedFilter ? (
          <EmptyState title="没有匹配的记忆">换个关键词，或在下方用语义检索试试。</EmptyState>
        ) : (
          <EmptyState title="还没有记住什么">聊过之后，我记住的事会出现在这里。</EmptyState>
        ))}
      <div className="fish-record-list">
        {filteredMemories.slice(0, visibleCount).map((memory, index) => (
          <MemoryCard
            key={memory.id}
            memory={memory}
            state={state}
            index={index}
            isNew={newMemoryIds.has(memory.id)}
          />
        ))}
      </div>
      {filteredMemories.length > visibleCount && (
        <button
          type="button"
          className="fish-button fish-load-more"
          onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
        >
          再显示 {Math.min(PAGE_SIZE, filteredMemories.length - visibleCount)} 条 · 剩余{' '}
          {filteredMemories.length - visibleCount}
        </button>
      )}
      <details className="fish-fold">
        <summary>
          我会想起什么 <span>说一句话试试</span>
        </summary>
        <div className="fish-fold-body">
          <form className="fish-form fish-search-form" onSubmit={searchMemories}>
            <label>
              范围
              <select value={project} onChange={(event) => setProject(event.target.value)}>
                {projects.map((projectPath) => (
                  <option key={projectPath} value={projectPath}>
                    {projectPath ? projectLabel(projectPath) : '不限项目'}
                  </option>
                ))}
              </select>
            </label>
            <label>
              内容
              <input
                value={query}
                maxLength={4000}
                required
                placeholder="例如：回声戒指有什么效果？"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <button
              className="fish-button fish-button-primary"
              disabled={isSearching}
              aria-busy={isSearching || undefined}
              type="submit"
            >
              {isSearching ? '检索中…' : '检索'}
            </button>
          </form>
          {errorMessage && (
            <p role="alert" className="fish-error">
              {errorMessage}
            </p>
          )}
          {recallResult && (
            <div className="fish-search-result">
              <p className="fish-muted">
                {recallResult.note} · 命中 {recallResult.items.length} 条
              </p>
              {recallResult.items.length === 0 && (
                <EmptyState title="没有找到适用的记忆" />
              )}
              {recallResult.items.map((item, index) => (
                <MemoryCard
                  key={item.memory.id}
                  memory={item.memory}
                  state={state}
                  compact
                  index={index}
                  footer={
                    <div className="fish-recall-why">
                      <span className="fish-score">{item.score.toFixed(2)}</span>
                      {item.reasons.map((reason) => (
                        <span key={reason}>{reason}</span>
                      ))}
                    </div>
                  }
                />
              ))}
              {recallResult.context && (
                <details className="fish-source">
                  <summary>原文</summary>
                  <pre>{recallResult.context}</pre>
                </details>
              )}
            </div>
          )}
        </div>
      </details>
      <details className="fish-fold">
        <summary>
          记忆的变化 <span>{state.history.length} 条</span>
        </summary>
        <div className="fish-fold-body">
          {state.history.length === 0 && <p className="fish-muted">尚无变化记录。</p>}
          <ol className="fish-timeline">
            {state.history.slice(0, 30).map((changeRecord, index) => (
              <li className="fish-history" key={index} data-action={changeRecord.action}>
                <div className="fish-record-meta">
                  {changeRecord.action && (
                    <span className="fish-tag fish-action-tag">
                      {actionLabels[changeRecord.action] || changeRecord.action}
                    </span>
                  )}
                  <strong>{changeRecord.reason}</strong>
                  {changeRecord.at && (
                    <time className="fish-record-meta-end" dateTime={changeRecord.at}>
                      {dateLabel(changeRecord.at)}
                    </time>
                  )}
                </div>
                <p>{changeRecord.after?.text || changeRecord.before?.text}</p>
                {changeRecord.before && changeRecord.after && (
                  <details className="fish-source">
                    <summary>旧版本</summary>
                    <p className="fish-before">{changeRecord.before.text}</p>
                  </details>
                )}
              </li>
            ))}
          </ol>
          {state.history.length > 30 && (
            <p className="fish-muted">显示最近 30 条，完整记录可通过「导出」获取。</p>
          )}
        </div>
      </details>
    </div>
  )
}
