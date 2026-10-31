export type {
  CurrentMood,
  HistoryEntry,
  RecallResult,
  SettingsState,
  SubmitAction,
} from '../contracts.js'

export async function request<TResponse>(
  endpoint: string,
  body?: unknown,
  token?: string,
  signal?: AbortSignal,
): Promise<TResponse> {
  const options: RequestInit = { cache: 'no-store', signal }
  if (body !== undefined) {
    options.method = 'POST'
    options.headers = { 'content-type': 'application/json', 'x-feed-the-seek-token': token || '' }
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
