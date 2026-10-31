import * as React from 'react'
import type { Persona } from '../../persona/index.js'
import type { Settings } from '../../settings/index.js'
import { type SettingsState, type SubmitAction } from '../contracts.js'
import { Toggle, displayName } from './components.js'
import { RetrievalSettings } from './retrieval-settings.js'

const masterSetting = {
  key: 'enabled',
  label: '记忆功能',
  description: '在对话中使用已保存的记忆。关闭后既不读取，也不记录新内容。',
} as const

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
] as const

type ToggleKey = typeof masterSetting.key | (typeof featureSettings)[number]['key']

export function SettingsPanel({
  state,
  isBusy,
  pendingSettings,
  submitAction,
  updateSetting,
  notify,
  onPersonaCreated,
}: {
  state: SettingsState
  isBusy: boolean
  pendingSettings: Partial<Settings>
  submitAction: SubmitAction
  updateSetting: (key: ToggleKey, value: boolean) => Promise<void>
  notify: (message: string) => void
  onPersonaCreated: (persona: Persona) => void
}) {
  async function createPersona(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const name = String(new FormData(form).get('name')).trim()
    const persona = (await submitAction('persona', { name })) as Persona | null
    if (persona) {
      form.reset()
      onPersonaCreated(persona)
    }
  }

  const isEnabled = state.settings.enabled
  const usage = state.learningUsage
  const viewedName = displayName(
    state.personas.find((persona) => persona.id === state.scope.persona)?.name,
  )

  return (
    <div>
      <div className="fish-section-heading">
        <h3>功能开关</h3>
        <span className="fish-muted">对所有伙伴生效</span>
      </div>
      <div className="fish-toggle-grid">
        <Toggle
          className="fish-toggle-master"
          label={masterSetting.label}
          description={masterSetting.description}
          checked={isEnabled}
          pending={masterSetting.key in pendingSettings}
          disabled={masterSetting.key in pendingSettings}
          onChange={(checked) => {
            void updateSetting(masterSetting.key, checked)
          }}
        />
        {featureSettings.map((setting) => (
          <Toggle
            key={setting.key}
            label={setting.label}
            description={setting.description}
            checked={state.settings[setting.key]}
            pending={setting.key in pendingSettings}
            inactive={!isEnabled}
            disabled={!isEnabled || setting.key in pendingSettings}
            onChange={(checked) => {
              void updateSetting(setting.key, checked)
            }}
          />
        ))}
      </div>
      {!isEnabled && (
        <p className="fish-muted fish-cost-note">
          记忆功能已关闭，以上设置暂不生效，重新开启后恢复。
        </p>
      )}
      {usage && (
        <dl
          className="fish-usage"
          aria-label={`「${viewedName}」的后台用量`}
        >
          <div>
            <dt>后台调用</dt>
            <dd>
              {usage.calls.toLocaleString()} 次
              {usage.failedCalls > 0 && <small>{usage.failedCalls} 次未完成</small>}
            </dd>
          </div>
          <div>
            <dt>输入 token</dt>
            <dd>{usage.inputTokens.toLocaleString()}</dd>
          </div>
          <div>
            <dt>缓存读取 token</dt>
            <dd>{usage.cacheReadTokens.toLocaleString()}</dd>
          </div>
          <div>
            <dt>输出 token</dt>
            <dd>{usage.outputTokens.toLocaleString()}</dd>
          </div>
        </dl>
      )}
      {usage && <p className="fish-muted fish-usage-note">以上是「{viewedName}」的后台用量。</p>}
      <RetrievalSettings
        state={state}
        isBusy={isBusy}
        submitAction={submitAction}
        notify={notify}
      />
      <details className="fish-fold">
        <summary>领养新伙伴</summary>
        <div className="fish-fold-body">
          <p className="fish-muted">
            新的伙伴会从零开始认识你，之后新开的对话由她陪伴；已经在进行的对话仍由原来的伙伴继续。原来的伙伴不会被删除，记忆都会保留：在顶部“查看伙伴”里选中她，就能让她重新陪伴新对话。
          </p>
          <form
            className="fish-form"
            onSubmit={createPersona}
          >
            <label>
              名字
              <input
                name="name"
                required
                maxLength={40}
                pattern=".*\S.*"
                title="名字不能只有空格"
                placeholder="比如：小鲸"
              />
            </label>
            <button
              type="submit"
              className="fish-button"
              disabled={isBusy}
            >
              领养
            </button>
          </form>
        </div>
      </details>
    </div>
  )
}
