import * as React from 'react'
import { type SettingsState, type SubmitAction } from '../contracts.js'
import { request } from './api.js'

/**
 * Common services. The protocol list describes request formats; these are concrete services,
 * which is why a vendor (火山方舟) appears here and not as a "protocol".
 */
const embeddingPresets = [
  {
    id: 'ollama',
    label: '本机 Ollama · bge-m3（推荐：免费，数据不出电脑）',
    url: 'http://127.0.0.1:11434/api/embed',
    model: 'bge-m3',
    protocol: 'ollama',
    note: '先安装 Ollama，并在终端运行 ollama pull bge-m3。不需要 API Key。',
  },
  {
    id: 'openai',
    label: 'OpenAI · text-embedding-3-small',
    url: 'https://api.openai.com/v1/embeddings',
    model: 'text-embedding-3-small',
    protocol: 'openai',
    note: '需要 OpenAI 的 API Key；记忆文字会发送到 OpenAI 生成向量。',
  },
  {
    id: 'doubao',
    label: '火山方舟 · 豆包视觉向量',
    url: 'https://ark.cn-beijing.volces.com/api/v3/embeddings/multimodal',
    model: 'doubao-embedding-vision-251215',
    protocol: 'doubao',
    note: '需要火山方舟的 API Key；记忆文字会发送到火山方舟生成向量。',
  },
] as const

/** What retrieval actually runs on, for the status line. A saved semantic mode alone is not enough. */
export function retrievalStatus(state: SettingsState): string {
  if (state.settings.retrievalMode !== 'semantic') {
    return '关键词检索'
  }
  return state.vector.configured && state.vector.available
    ? '语义检索'
    : '语义检索未就绪 · 使用关键词检索'
}

function connectionValues(form: HTMLFormElement) {
  const values = new FormData(form)
  const keyInput = form.elements.namedItem('apiKey') as HTMLInputElement | null
  return {
    embeddingUrl: String(values.get('url')).trim(),
    embeddingModel: String(values.get('model')).trim(),
    embeddingApiKey: keyInput?.readOnly ? '' : String(values.get('apiKey') || '').trim(),
    embeddingProtocol: String(values.get('protocol')),
    embeddingDimensions: Number(values.get('dimensions') || 0),
  }
}

export function RetrievalSettings({
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
  const [isEditingKey, setIsEditingKey] = React.useState(false)
  const [draftUrl, setDraftUrl] = React.useState(state.settings.embeddingUrl)
  const formRef = React.useRef<HTMLFormElement>(null)
  const [preset, setPreset] = React.useState('')
  const presetNote = embeddingPresets.find((entry) => entry.id === preset)?.note
  // Choosing semantic search without a saved connection only opens the setup; the mode is
  // saved together with a connection that has just passed the test.
  const [isSettingUp, setIsSettingUp] = React.useState(false)

  /** Fills the uncontrolled fields from a preset; the user still tests and saves explicitly. */
  function applyPreset(id: string) {
    setPreset(id)
    const entry = embeddingPresets.find((candidate) => candidate.id === id)
    const form = formRef.current
    if (!entry || !form) {
      return
    }
    const set = (name: string, value: string) => {
      const field = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null
      if (field) {
        field.value = value
      }
    }
    set('url', entry.url)
    set('model', entry.model)
    set('protocol', entry.protocol)
    set('dimensions', '0')
    setDraftUrl(entry.url)
    clearTestResult()
  }
  const probeRef = React.useRef<AbortController | null>(null)
  const [isTesting, setIsTesting] = React.useState(false)
  const [testResult, setTestResult] = React.useState<{ ok: boolean; message: string } | null>(null)
  const isSemantic = state.settings.retrievalMode === 'semantic'
  const isSemanticReady = isSemantic && state.vector.configured && state.vector.available
  const showSetup = isSemantic || isSettingUp
  const showSavedKey =
    Boolean(state.vector.apiKeyConfigured) &&
    draftUrl.trim() === state.settings.embeddingUrl &&
    !isEditingKey
  const indexed = state.vector.count
  const total = state.vector.total ?? indexed

  React.useEffect(() => () => probeRef.current?.abort(), [])

  function clearTestResult() {
    probeRef.current?.abort()
    probeRef.current = null
    setIsTesting(false)
    setTestResult(null)
  }

  function chooseLocal() {
    setIsSettingUp(false)
    clearTestResult()
    if (isSemantic) {
      void submitAction('settings', { retrievalMode: 'local' })
    }
  }

  async function chooseSemantic() {
    if (state.vector.configured) {
      if (await submitAction('settings', { retrievalMode: 'semantic' })) {
        notify('已切换到语义检索')
      }
    } else {
      setIsSettingUp(true)
    }
  }

  /** Runs the probe; resolves to whether the connection works. */
  async function testConnection(): Promise<boolean> {
    const form = formRef.current
    if (!form || !form.reportValidity() || probeRef.current) {
      return false
    }
    const controller = new AbortController()
    probeRef.current = controller
    setIsTesting(true)
    setTestResult(null)
    try {
      const result = await request<{ dimensions: number; elapsedMs: number }>(
        'embedding-test',
        connectionValues(form),
        state.token,
        controller.signal,
      )
      if (probeRef.current !== controller) {
        return false
      }
      setTestResult({
        ok: true,
        message: `连接成功 · ${result.dimensions} 维 · ${result.elapsedMs} ms`,
      })
      return true
    } catch (error) {
      if (probeRef.current === controller && !controller.signal.aborted) {
        setTestResult({
          ok: false,
          message: error instanceof Error ? error.message : '连接测试失败',
        })
      }
      return false
    } finally {
      if (probeRef.current === controller) {
        probeRef.current = null
        setIsTesting(false)
      }
    }
  }

  async function saveConnection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    if (!(await testConnection())) {
      return
    }
    const saved = await submitAction('settings', {
      ...connectionValues(form),
      retrievalMode: 'semantic',
    })
    if (saved) {
      notify(isSemantic ? '连接配置已保存' : '语义检索已启用')
      setIsSettingUp(false)
      setIsEditingKey(false)
      const input = form.elements.namedItem('apiKey') as HTMLInputElement | null
      if (input && !input.readOnly) {
        input.value = ''
      }
    }
  }

  async function clearSavedKey() {
    clearTestResult()
    if (await submitAction('settings', { clearEmbeddingApiKey: true })) {
      notify('已清除保存的 API Key')
      setIsEditingKey(false)
    }
  }

  return (
    <section className="fish-retrieval-settings">
      <div className="fish-section-heading">
        <h3>检索方式</h3>
      </div>
      <fieldset
        className="fish-mode-options"
        disabled={isBusy}
      >
        <legend className="fish-screen-reader">选择检索方式</legend>
        <label className="fish-mode-option">
          <input
            type="radio"
            name="fish-retrieval-mode"
            value="local"
            checked={!showSetup}
            onChange={chooseLocal}
          />
          <span>
            <strong>关键词检索</strong>
            <span>无需配置，不调用外部服务。换一种说法时可能找不到相关记忆。</span>
          </span>
        </label>
        <label
          className="fish-mode-option"
          data-unavailable={!state.vector.available || undefined}
        >
          <input
            type="radio"
            name="fish-retrieval-mode"
            value="semantic"
            checked={showSetup}
            disabled={!state.vector.available}
            onChange={() => void chooseSemantic()}
          />
          <span>
            <strong>
              语义检索
              {isSemantic && !isSemanticReady && <small>未就绪</small>}
              {!isSemantic && isSettingUp && <small>待配置</small>}
            </strong>
            <span>
              {state.vector.available
                ? '能找到意思相近、措辞不同的记忆。需要文本向量服务；使用本机 Ollama 时数据不出电脑。'
                : '当前运行环境缺少向量扩展，暂时无法使用。'}
            </span>
          </span>
        </label>
      </fieldset>
      {showSetup && (
        <details
          className="fish-fold"
          open
        >
          <summary>
            向量服务{' '}
            <span
              className="fish-tag"
              data-ok={state.vector.configured || undefined}
            >
              {state.vector.configured ? '已保存' : '尚未配置'}
            </span>
          </summary>
          <div className="fish-fold-body">
            <p className="fish-muted">需要文本向量（Embedding）服务，聊天模型的接口不能代替。</p>
            <form
              ref={formRef}
              className="fish-form"
              onSubmit={saveConnection}
              onChange={clearTestResult}
            >
              <label>
                常用服务（选择后自动填写下面几项）
                <select
                  value={preset}
                  onChange={(event) => applyPreset(event.target.value)}
                  aria-describedby="fish-preset-note"
                >
                  <option value="">自己填写</option>
                  {embeddingPresets.map((entry) => (
                    <option
                      key={entry.id}
                      value={entry.id}
                    >
                      {entry.label}
                    </option>
                  ))}
                </select>
              </label>
              {presetNote && (
                <p
                  className="fish-muted"
                  id="fish-preset-note"
                >
                  {presetNote}
                </p>
              )}
              <label>
                接口地址
                <input
                  name="url"
                  type="url"
                  required
                  defaultValue={state.settings.embeddingUrl}
                  onChange={(event) => setDraftUrl(event.target.value)}
                  placeholder="https://…/embeddings"
                />
              </label>
              <label>
                向量模型名称
                <input
                  name="model"
                  required
                  defaultValue={state.settings.embeddingModel}
                />
              </label>
              <label>
                API Key
                {showSavedKey ? (
                  <input
                    key="saved-key"
                    name="apiKey"
                    type="password"
                    value="************"
                    readOnly
                    aria-label="API Key（已保存）"
                  />
                ) : (
                  <input
                    key="editable-key"
                    name="apiKey"
                    type="password"
                    autoComplete="new-password"
                    spellCheck={false}
                    maxLength={4096}
                    placeholder="输入 API Key（本地免密服务可留空）"
                  />
                )}
              </label>
              {showSavedKey && (
                <div className="fish-connection-actions">
                  <span role="status">API Key 已保存</span>
                  <button
                    type="button"
                    className="fish-button"
                    disabled={isBusy || isTesting}
                    onClick={() => {
                      clearTestResult()
                      setIsEditingKey(true)
                    }}
                  >
                    更换
                  </button>
                  <button
                    type="button"
                    className="fish-button"
                    disabled={isBusy || isTesting}
                    onClick={() => void clearSavedKey()}
                  >
                    清除
                  </button>
                </div>
              )}
              <details className="fish-source">
                <summary>高级选项</summary>
                <div className="fish-fold-body fish-form">
                  <label>
                    接口格式（一般按地址自动识别，无需修改）
                    <select
                      name="protocol"
                      defaultValue={state.settings.embeddingProtocol}
                    >
                      <option value="auto">按地址自动识别</option>
                      <option value="openai">OpenAI 格式（/embeddings，大多数服务）</option>
                      <option value="ollama">Ollama 格式（/api/embed）</option>
                      <option value="doubao">
                        多模态格式（/embeddings/multimodal，如豆包视觉向量）
                      </option>
                    </select>
                  </label>
                  <label>
                    向量维度（0 使用模型默认值）
                    <input
                      name="dimensions"
                      type="number"
                      min="0"
                      max="8192"
                      step="1"
                      defaultValue={state.settings.embeddingDimensions}
                    />
                  </label>
                </div>
              </details>
              <p className="fish-muted">使用远程服务时，对方会收到用于生成向量的文字。</p>
              <div className="fish-connection-actions">
                <button
                  type="button"
                  className="fish-button"
                  disabled={isBusy || isTesting}
                  onClick={() => void testConnection()}
                >
                  {isTesting ? '测试中…' : '仅测试'}
                </button>
                <button
                  type="submit"
                  className="fish-button fish-button-primary"
                  disabled={isBusy || isTesting}
                >
                  {isSemantic ? '测试并保存' : '测试并启用'}
                </button>
                {!isSemantic && (
                  <button
                    type="button"
                    className="fish-text-button"
                    onClick={chooseLocal}
                  >
                    取消
                  </button>
                )}
              </div>
              {testResult && (
                <p
                  role={testResult.ok ? 'status' : 'alert'}
                  className="fish-connection-result"
                  data-success={testResult.ok}
                >
                  {testResult.message}
                </p>
              )}
            </form>
            {isSemantic && (
              <div className="fish-form fish-index-form">
                <p className="fish-muted">
                  已建立索引 {indexed} / {total} 条
                </p>
                <button
                  type="button"
                  className="fish-button"
                  disabled={isBusy || !isSemanticReady || indexed >= total}
                  onClick={async () => {
                    const result = (await submitAction('index', {
                      scope: { ...state.scope, project: '' },
                    })) as { count?: number } | null
                    if (result) {
                      notify(`已为 ${result.count ?? 0} 条记忆建立索引`)
                    }
                  }}
                >
                  {indexed >= total ? '索引已是最新' : `为其余 ${total - indexed} 条建立索引`}
                </button>
              </div>
            )}
          </div>
        </details>
      )}
    </section>
  )
}
