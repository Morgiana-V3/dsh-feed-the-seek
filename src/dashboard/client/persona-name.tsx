import * as React from 'react'
import type { SettingsState, SubmitAction } from '../contracts.js'
import { displayName } from './components.js'

export function PersonaName({
  state,
  isBusy,
  submitAction,
  notify,
}: {
  state: SettingsState
  isBusy: boolean
  submitAction: SubmitAction
  notify: (message: string) => void
}) {
  const [editing, setEditing] = React.useState(false)
  const [name, setName] = React.useState('')
  const persona = state.personas.find((entry) => entry.id === state.scope.persona)
  async function save(event: React.FormEvent) {
    event.preventDefault()
    const result = await submitAction('persona/rename', { scope: state.scope, name: name.trim() })
    if (result) {
      setEditing(false)
      notify('伙伴名字已更新')
    }
  }
  if (!editing) {
    return (
      <button
        type="button"
        className="fish-text-button"
        disabled={isBusy}
        onClick={() => {
          setName(displayName(persona?.name) === persona?.name ? persona.name : '')
          setEditing(true)
        }}
      >
        改名
      </button>
    )
  }
  return (
    <form
      className="fish-name-form"
      onSubmit={(event) => void save(event)}
    >
      <label>
        伙伴名字
        <input
          autoFocus
          required
          maxLength={40}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="给她起个名字"
        />
      </label>
      <button
        className="fish-button fish-button-small"
        disabled={isBusy || !name.trim()}
        type="submit"
      >
        保存
      </button>
      <button
        className="fish-text-button"
        disabled={isBusy}
        type="button"
        onClick={() => setEditing(false)}
      >
        取消
      </button>
    </form>
  )
}
