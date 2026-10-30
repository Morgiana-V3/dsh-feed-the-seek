import type { Memory, Persona, Scope, Settings, Snapshot, Source, State, Trait } from '../types.js'
import type { MemoryAssociation } from '../associations.js'
import type { PersonaDiff, PersonaDoc } from '../persona.js'

export interface SessionSummary {
  id: string
  project: string
  persona: string
  enabled: boolean
}

export interface HistoryEntry {
  action?: string
  at?: string
  reason: string
  before?: Memory | null
  after?: Memory | null
}

export interface SettingsState {
  token: string
  demo: boolean
  scope: Scope
  activePersona: string
  personas: Persona[]
  memories: (Memory & { activation?: number })[]
  associations: MemoryAssociation[]
  states: State[]
  traits: Trait[]
  sources: Record<string, Source | undefined>
  history: HistoryEntry[]
  settings: Settings
  sessions: SessionSummary[]
  jobs: { id: string; status: string; updated_at: string; error?: string }[]
  vector: { available: boolean; configured: boolean; count: number; apiKeyConfigured?: boolean }
  revision: number
  /** Aggregated mood shown on the overview; null when emotion is turned off. */
  mood: CurrentMood | null
  persona?: PersonaDoc & { threshold: number; history: { version: number; at: string; diff: PersonaDiff }[] }
  selfCount?: number
  selfLimit?: number
}

export interface CurrentMood {
  mood: string
  label: string
  asset: 'calm' | 'happy' | 'discouraged' | 'annoyed'
  since: string
  strength: string
  reason: string
  project: string
  layer: '' | 'task' | 'relationship'
}

export async function request<TResponse>(
  endpoint: string,
  body?: unknown,
  token?: string,
  signal?: AbortSignal,
): Promise<TResponse> {
  const options: RequestInit = { cache: 'no-store', signal }
  if (body !== undefined) {
    options.method = 'POST'
    options.headers = { 'content-type': 'application/json', 'x-yuwen-token': token || '' }
    options.body = JSON.stringify(body)
  }

  const response = await fetch('/fish-brain/api/' + endpoint, options)
  const responseText = await response.text()
  if (!responseText.trim()) {
    throw new Error(
      `记忆服务未返回数据（HTTP ${response.status}）。请完全退出并重新打开 DSH 后重试。`,
    )
  }

  let responseData
  try {
    responseData = JSON.parse(responseText)
  } catch {
    throw new Error(`记忆服务返回格式异常（HTTP ${response.status}）。请重启 DSH 后重试。`)
  }
  if (!response.ok) {
    throw new Error(responseData?.error || `记忆服务请求失败（HTTP ${response.status}）`)
  }
  return responseData as TResponse
}

export type RecallResult = Snapshot
export type SubmitAction = (endpoint: string, body: unknown) => Promise<unknown>

export function projectLabel(projectPath: string): string {
  return projectPath.split(/[\\/]/).filter(Boolean).at(-1) || '无项目'
}

export function dateLabel(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '时间未知'
  }
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}
