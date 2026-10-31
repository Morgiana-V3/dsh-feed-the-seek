import * as React from 'react'
import type { Kind } from '../../memory/index.js'
import {
  PixelIcon,
  displayName,
  useNewMemoryIds,
  type PixelGlyph,
  learningActivity,
} from './components.js'
import { PersonaName } from './persona-name.js'
import { MemoryPanel } from './memory-panel.js'
import { OverviewPanel } from './overview-panel.js'
import { retrievalStatus } from './retrieval-settings.js'
import { SettingsPanel } from './settings-panel.js'
import { useSettings } from './use-settings.js'

declare const __PLUGIN_VERSION__: string
declare const __PLUGIN_BUILD__: string

const tabs: readonly { id: string; label: string; icon: PixelGlyph }[] = [
  { id: 'overview', label: '概览', icon: 'overview' },
  { id: 'memories', label: '记忆', icon: 'memories' },
  { id: 'settings', label: '设置', icon: 'settings' },
] as const
type TabId = 'overview' | 'memories' | 'settings'

function LoadingSkeleton() {
  return (
    <div
      className="fish-skeleton"
      role="status"
      aria-label="正在连接记忆服务"
    >
      <div className="fish-skeleton-row">
        <i className="fish-skeleton-portrait" />
        <div>
          <i style={{ width: '40%' }} />
          <i style={{ width: '65%', height: 24 }} />
          <i style={{ width: '30%' }} />
        </div>
      </div>
      <div className="fish-skeleton-grid">
        <i />
        <i />
        <i />
        <i />
      </div>
      <i style={{ width: '100%', height: 56 }} />
      <span className="fish-screen-reader">正在连接记忆服务…</span>
    </div>
  )
}

export function SettingsSection() {
  const {
    state,
    errorMessage,
    dismissError,
    isBusy,
    isRefreshing,
    pendingSettings,
    notice,
    notify,
    setViewedPersonaId,
    refreshSettings,
    submitAction,
    updateSetting,
  } = useSettings()
  const [activeTab, setActiveTab] = React.useState<TabId>('overview')
  const [memoryKind, setMemoryKind] = React.useState<Kind | 'all'>('all')

  function moveTab(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex = index
    if (event.key === 'ArrowRight') {
      nextIndex = (index + 1) % tabs.length
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (index + tabs.length - 1) % tabs.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = tabs.length - 1
    } else {
      return
    }
    event.preventDefault()
    setActiveTab(tabs[nextIndex].id as TabId)
    const buttons =
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    buttons?.[nextIndex].focus()
  }

  function openMemories(kind: Kind | 'all' = 'all') {
    setMemoryKind(kind)
    setActiveTab('memories')
  }

  return (
    <section
      className="fish-brain"
      aria-label="大肥鱼饲养手册"
      aria-busy={!state || undefined}
    >
      <link
        rel="stylesheet"
        href={`/fish-brain/native.css?v=${__PLUGIN_BUILD__}`}
      />
      <header className="fish-header">
        <div className="fish-brand">
          <span
            className="fish-logo"
            aria-hidden="true"
          >
            <img
              src="/fish-brain/assets/plugin-icon-v6.png"
              width={32}
              height={32}
              alt=""
            />
          </span>
          <h2>大肥鱼饲养手册</h2>
          <span className="fish-version">v{__PLUGIN_VERSION__}</span>
        </div>
        <button
          type="button"
          className="fish-button fish-refresh"
          disabled={isRefreshing}
          aria-busy={isRefreshing || undefined}
          onClick={() => {
            void refreshSettings()
          }}
          aria-label="刷新记忆数据"
        >
          <PixelIcon
            name="refresh"
            className="fish-refresh-icon"
          />
          <span>刷新</span>
        </button>
      </header>
      {errorMessage && (
        <div
          className="fish-error fish-error-banner"
          role="alert"
        >
          <p>{errorMessage}</p>
          <button
            type="button"
            className="fish-icon-button"
            onClick={dismissError}
            aria-label="关闭提示"
          >
            <PixelIcon name="close" />
          </button>
        </div>
      )}
      {!state && <LoadingSkeleton />}
      {state && (
        <SettingsBody
          state={state}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          moveTab={moveTab}
          memoryKind={memoryKind}
          setMemoryKind={setMemoryKind}
          openMemories={openMemories}
          isBusy={isBusy}
          pendingSettings={pendingSettings}
          notify={notify}
          setViewedPersonaId={setViewedPersonaId}
          submitAction={submitAction}
          updateSetting={updateSetting}
        />
      )}
      <div
        className="fish-toast-region"
        role="status"
        aria-live="polite"
      >
        {notice && (
          <div
            key={notice.id}
            className="fish-toast"
            data-tone={notice.tone}
          >
            {notice.message}
          </div>
        )}
      </div>
    </section>
  )
}

type SettingsHook = ReturnType<typeof useSettings>

function SettingsBody({
  state,
  activeTab,
  setActiveTab,
  moveTab,
  memoryKind,
  setMemoryKind,
  openMemories,
  isBusy,
  pendingSettings,
  notify,
  setViewedPersonaId,
  submitAction,
  updateSetting,
}: {
  state: NonNullable<SettingsHook['state']>
  activeTab: TabId
  setActiveTab: (tab: TabId) => void
  moveTab: (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => void
  memoryKind: Kind | 'all'
  setMemoryKind: (kind: Kind | 'all') => void
  openMemories: (kind?: Kind | 'all') => void
  isBusy: boolean
  pendingSettings: SettingsHook['pendingSettings']
  notify: SettingsHook['notify']
  setViewedPersonaId: (id: string) => void
  submitAction: SettingsHook['submitAction']
  updateSetting: SettingsHook['updateSetting']
}) {
  const newMemoryIds = useNewMemoryIds(state)
  const viewedPersona = state.personas.find((persona) => persona.id === state.scope.persona)
  const activePersona = state.personas.find((persona) => persona.id === state.activePersona)
  const isViewingRetained = state.scope.persona !== state.activePersona
  const runningJobs = learningActivity(state.jobs).working
  const isRecording = state.settings.enabled && state.settings.learning

  return (
    <>
      <div className="fish-frame">
        <div className="fish-toolbar">
          <div className="fish-toolbar-main">
            <label className="fish-persona-select">
              查看伙伴
              <select
                value={state.scope.persona}
                disabled={isBusy}
                onChange={(event) => setViewedPersonaId(event.target.value)}
              >
                {state.personas.map((persona) => (
                  <option
                    key={persona.id}
                    value={persona.id}
                  >
                    {displayName(persona.name)}
                    {persona.id === state.activePersona ? ' · 陪伴新对话' : ''}
                  </option>
                ))}
              </select>
            </label>
            {isViewingRetained ? (
              <button
                type="button"
                className="fish-button fish-button-small"
                disabled={isBusy}
                title={`她的记忆都还在，之前和她开始的对话仍由她陪伴。新对话目前由「${displayName(activePersona?.name)}」陪伴，点一下改为由她陪伴。`}
                onClick={async () => {
                  if (await submitAction('persona/activate', { scope: state.scope })) {
                    notify(`之后的新对话由「${displayName(viewedPersona?.name)}」陪伴`)
                  }
                }}
              >
                让她陪伴新对话
              </button>
            ) : (
              <span
                className="fish-tag"
                data-ok
                title="之后新开的对话由她陪伴；已经开始的对话仍由当时的伙伴陪伴。"
              >
                陪伴新对话中
              </span>
            )}
          </div>
          <PersonaName
            key={state.scope.persona}
            state={state}
            isBusy={isBusy}
            submitAction={submitAction}
            notify={notify}
          />
          {state.demo && <span className="fish-tag fish-tag-dashed">演示数据</span>}
        </div>
        <nav
          className="fish-tabs"
          role="tablist"
          aria-label="插件页面"
        >
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`fish-tab-${tab.id}`}
              aria-controls="fish-tab-content"
              aria-selected={activeTab === tab.id}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onKeyDown={(event) => moveTab(event, index)}
              onClick={() => setActiveTab(tab.id as TabId)}
            >
              <PixelIcon name={tab.icon} />
              {tab.label}
              {tab.id === 'memories' && newMemoryIds.size > 0 && activeTab !== 'memories' && (
                <span
                  className="fish-tab-dot"
                  aria-label={`${newMemoryIds.size} 条新记忆`}
                />
              )}
            </button>
          ))}
        </nav>
        <div
          key={activeTab}
          className="fish-panel"
          id="fish-tab-content"
          role="tabpanel"
          aria-labelledby={`fish-tab-${activeTab}`}
        >
          {activeTab === 'overview' && (
            <OverviewPanel
              state={state}
              isBusy={isBusy}
              newMemoryIds={newMemoryIds}
              onOpenMemories={openMemories}
              onRetry={async () => {
                if (await submitAction('retry', { scope: state.scope })) {
                  notify('好，我再想一想')
                }
              }}
            />
          )}
          {activeTab === 'memories' && (
            <MemoryPanel
              key={state.scope.persona}
              state={state}
              selectedKind={memoryKind}
              onSelectKind={setMemoryKind}
              newMemoryIds={newMemoryIds}
              notify={notify}
            />
          )}
          {activeTab === 'settings' && (
            <SettingsPanel
              key={state.scope.persona}
              state={state}
              isBusy={isBusy}
              pendingSettings={pendingSettings}
              submitAction={submitAction}
              updateSetting={updateSetting}
              notify={notify}
              onPersonaCreated={(persona) => {
                setViewedPersonaId(persona.id)
                setActiveTab('overview')
                notify(`欢迎「${persona.name}」`)
              }}
            />
          )}
        </div>
      </div>
      <footer className="fish-footer">
        <span
          data-active={(isRecording && runningJobs > 0) || undefined}
          data-off={!isRecording || undefined}
        >
          <i aria-hidden="true" />
          {recordingStatus(state.settings.enabled, state.settings.learning, runningJobs)}
        </span>
        {state.settings.enabled && <span>{retrievalStatus(state)}</span>}
      </footer>
    </>
  )
}

interface Slots {
  inject(name: string, setup: () => unknown): unknown
  register(
    spec: { name: string; id: string; order: number; label: () => string },
    render: () => React.ReactNode,
  ): unknown
}

export const inject = ['slots']

export function apply(context: { get(name: 'slots'): Slots | undefined }) {
  const slots = context.get('slots')
  if (!slots) {
    return
  }
  slots.inject('settings.section', () =>
    slots.register(
      {
        name: 'settings.section',
        id: 'fish-brain-patch',
        order: 53,
        label: () => '大肥鱼饲养手册',
      },
      () => <SettingsSection />,
    ),
  )
}

function recordingStatus(enabled: boolean, learning: boolean, runningJobs: number): string {
  if (!enabled) {
    return '记忆功能已关闭'
  }
  if (!learning) {
    return '自动记录已关闭'
  }
  if (runningJobs > 0) {
    return '正在整理刚才的对话'
  }
  return '自动记录中'
}
