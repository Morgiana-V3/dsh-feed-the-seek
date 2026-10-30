import * as React from 'react'
import type { Persona, Settings } from '../types.js'
import { dateLabel, projectLabel, type SettingsState, type SubmitAction } from './api.js'
import { Toggle } from './components.js'
import { RetrievalSettings } from './retrieval-settings.js'

const settingOptions = [
  { key: 'enabled', label: '记得你', description: '聊天时想起以前的事' },
  { key: 'learning', label: '记住新的事', description: '从聊天里学，也会改正记错的' },
  { key: 'emotion', label: '心情', description: '最近的经历会影响我的语气' },
  { key: 'growth', label: '慢慢长大', description: '把你的反馈和我的表现慢慢变成性格' },
] as const

const jobLabels: Record<string, string> = {
  done: '记下了',
  failed: '没记下',
  pending: '等着',
  running: '回想中',
  obsolete: '旧格式',
}

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
  updateSetting: (key: (typeof settingOptions)[number]['key'], value: boolean) => Promise<void>
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

  return (
    <div>
      <div className="fish-section-heading">
        <h3>我会做什么</h3>
        <span className="fish-muted">所有伙伴共用</span>
      </div>
      <div className="fish-toggle-grid">
        {settingOptions.map((setting) => (
          <Toggle
            key={setting.key}
            label={setting.label}
            description={setting.description}
            checked={state.settings[setting.key]}
            pending={setting.key in pendingSettings}
            disabled={setting.key in pendingSettings}
            onChange={(checked) => {
              void updateSetting(setting.key, checked)
            }}
          />
        ))}
      </div>
      <p className="fish-muted fish-cost-note">记住新的事、整理性格会用当前对话的模型，会产生额外用量。</p>
      <details className="fish-fold">
        <summary>
          对话与回想记录 <span>{state.sessions.length} 段对话</span>
          {state.jobs.some((job) => job.status === 'failed') && (
            <span className="fish-tag fish-tag-alert">有失败任务</span>
          )}
        </summary>
        <div className="fish-fold-body">
        {state.sessions.length === 0 && <p className="fish-muted">还没有陪你聊过。</p>}
        {state.sessions.map((session) => (
          <div className="fish-session" key={session.id}>
            <Toggle
              label={projectLabel(session.project)}
              description={`对话 ${session.id.replace(/^session-/, '').slice(0, 8)}`}
              checked={session.enabled}
              disabled={isBusy}
              onChange={async (checked) => {
                if (await submitAction('session', { id: session.id, enabled: checked })) {
                  notify(checked ? '这段对话会用到记忆' : '这段对话不再用记忆')
                }
              }}
            />
            <details className="fish-source">
              <summary>对话详情</summary>
              <p>{session.id}</p>
              <p>{session.project || '无项目'}</p>
            </details>
          </div>
        ))}
        <div className="fish-jobs">
          {state.jobs.slice(0, 10).map((job) => (
            <div className="fish-job" key={job.id}>
              <span className="fish-tag">{jobLabels[job.status] || job.status}</span>
              <time>{dateLabel(job.updated_at)}</time>
              {job.error && <p className="fish-error">{job.error}</p>}
            </div>
          ))}
          {state.jobs.length === 0 && <p className="fish-muted">还没有回想记录。</p>}
          {state.jobs.some((job) => job.status === 'failed') && (
            <button
              type="button"
              className="fish-button"
              disabled={isBusy}
              onClick={async () => {
                if (await submitAction('retry', {})) notify('好，我再想一想')
              }}
            >
              把没记下来的再想一遍
            </button>
          )}
        </div>
        </div>
      </details>
      <RetrievalSettings
        state={state}
        isBusy={isBusy}
        submitAction={submitAction}
        notify={notify}
      />
      <details className="fish-fold">
        <summary>重新养一个</summary>
        <div className="fish-fold-body">
        <p className="fish-muted">新的她会从零开始认识你。现在这位会留在这里，记忆都还在，但不再参与新的对话。</p>
        <form className="fish-form" onSubmit={createPersona}>
          <label>
            给她起个名字
            <input name="name" required maxLength={40} placeholder="比如：小鲸" />
          </label>
          <button type="submit" className="fish-button" disabled={isBusy}>
            迎接新的她
          </button>
        </form>
        </div>
      </details>
    </div>
  )
}
