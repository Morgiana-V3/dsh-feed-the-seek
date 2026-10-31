import * as React from 'react'
import type { Kind } from '../../memory/index.js'
import { type SettingsState } from '../contracts.js'
import { request } from './api.js'
import { HistoryPanel } from './history-panel.js'
import { EmptyState, MemoryCard, PixelIcon, memoryKindLabels } from './components.js'

const PAGE_SIZE = 30

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
  const [historyOpen, setHistoryOpen] = React.useState(false)
  const [filterText, setFilterText] = React.useState('')
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE)
  const [isExporting, setIsExporting] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState('')
  const memories = state.memories.filter((memory) => memory.status === 'active')
  const normalizedFilter = filterText.trim().toLowerCase()
  const filteredMemories = memories
    .filter((memory) => selectedKind === 'all' || memory.kind === selectedKind)
    .filter(
      (memory) =>
        !normalizedFilter ||
        [memory.text, memory.knowledge.edition, memory.knowledge.conditions]
          .join(' ')
          .toLowerCase()
          .includes(normalizedFilter),
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [selectedKind, normalizedFilter])

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

  const historyCount = state.historyCount ?? state.history.length

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
          <button
            type="button"
            className="fish-button fish-button-small"
            disabled={isExporting || (state.memories.length === 0 && historyCount === 0)}
            onClick={() => void exportMemories()}
          >
            <PixelIcon name="download" />
            {isExporting ? '导出中…' : '导出'}
          </button>
        </div>
      </div>
      {errorMessage && (
        <p
          className="fish-error"
          role="alert"
        >
          {errorMessage}
        </p>
      )}
      <div className="fish-list-controls">
        <div
          className="fish-filters"
          role="group"
          aria-label="记忆分类"
        >
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
            placeholder="筛选记忆"
            aria-label="筛选记忆"
            onChange={(event) => setFilterText(event.target.value)}
          />
        </label>
      </div>
      {filteredMemories.length === 0 &&
        (normalizedFilter ? (
          <EmptyState title="没有匹配的记忆">换个关键词试试。</EmptyState>
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
      <details
        className="fish-fold"
        onToggle={(event) => setHistoryOpen(event.currentTarget.open)}
      >
        <summary>
          记忆的变化 <span>{historyCount} 条</span>
        </summary>
        {historyOpen && (
          <HistoryPanel
            key={state.scope.persona}
            state={state}
          />
        )}
      </details>
    </div>
  )
}
