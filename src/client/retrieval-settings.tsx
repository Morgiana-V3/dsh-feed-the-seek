import * as React from 'react'
import { projectLabel, request, type SettingsState, type SubmitAction } from './api.js'

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
  const [indexProject, setIndexProject] = React.useState('')
  const [isEditingKey, setIsEditingKey] = React.useState(false)
  const [draftUrl, setDraftUrl] = React.useState(state.settings.embeddingUrl)
  const formRef = React.useRef<HTMLFormElement>(null)
  const [preset, setPreset] = React.useState('')
  const presetNote = embeddingPresets.find((entry) => entry.id === preset)?.note

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
      if (field) field.value = value
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
  const projects = [...new Set(['', ...state.memories.map((memory) => memory.scope.project)])]
  const isSemantic = state.settings.retrievalMode === 'semantic'
  const showSavedKey =
    Boolean(state.vector.apiKeyConfigured) &&
    draftUrl.trim() === state.settings.embeddingUrl &&
    !isEditingKey

  React.useEffect(() => () => probeRef.current?.abort(), [])

  function clearTestResult() {
    probeRef.current?.abort()
    probeRef.current = null
    setIsTesting(false)
    setTestResult(null)
  }

  async function testConnection() {
    const form = formRef.current
    if (!form || !form.reportValidity() || probeRef.current) {
      return
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
      if (probeRef.current === controller) {
        setTestResult({
          ok: true,
          message: `连接成功 · ${result.dimensions} 维 · ${result.elapsedMs} ms`,
        })
      }
    } catch (error) {
      if (probeRef.current === controller && !controller.signal.aborted) {
        setTestResult({
          ok: false,
          message: error instanceof Error ? error.message : '连接测试失败',
        })
      }
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
    const saved = await submitAction('settings', connectionValues(form))
    if (saved) {
      notify('连接配置已保存')
      setIsEditingKey(false)
      const input = form.elements.namedItem('apiKey') as HTMLInputElement | null
      if (input && !input.readOnly) {
        input.value = ''
      }
    }
  }

  return (
    <section className="fish-retrieval-settings">
      <div className="fish-section-heading">
        <h3>我怎么想起以前的事</h3>
      </div>
      <fieldset className="fish-mode-options" disabled={isBusy}>
        <legend className="fish-screen-reader">选择记忆方式</legend>
        <label className="fish-mode-option">
          <input
            type="radio"
            name="fish-retrieval-mode"
            value="local"
            checked={!isSemantic}
            onChange={() => {
              void submitAction('settings', { retrievalMode: 'local' })
            }}
          />
          <span>
            <strong>
              按关键词想起
            </strong>
            <span>不用配置，也不调用其他服务。同一件事换个说法时，可能想不起来。</span>
          </span>
        </label>
        <label className="fish-mode-option">
          <input
            type="radio"
            name="fish-retrieval-mode"
            value="semantic"
            checked={isSemantic}
            onChange={() => {
              void submitAction('settings', { retrievalMode: 'semantic' })
            }}
          />
          <span>
            <strong>听得懂换个说法</strong>
            <span>说“撸猫”也能想起年糕。需要一个文本向量服务；用本机 Ollama 时数据不出电脑。</span>
          </span>
        </label>
      </fieldset>
      <p className="fish-muted">
        两种方式共用同一份记忆，随时切换都不会丢。记忆和向量都存在本机；我的名字、对你的称呼和我的性格不靠检索，两种方式下都一直记得。
      </p>
      {isSemantic && (
        <details className="fish-fold" open>
          <summary>
            向量服务{' '}
            <span className="fish-tag" data-ok={state.vector.configured || undefined}>
              {state.vector.configured ? '已保存' : '尚未配置'}
            </span>
          </summary>
          <div className="fish-fold-body">
          <p className="fish-muted">
            需要文本向量（Embedding）服务，聊天模型的接口不能代替。没配好或连不上时，会自动改回按关键词想起。
          </p>
          <form
            ref={formRef}
            className="fish-form"
            onSubmit={saveConnection}
            onChange={clearTestResult}
          >
            <label>
              常用服务（选一个会自动填好下面几项）
              <select
                value={preset}
                onChange={(event) => applyPreset(event.target.value)}
                aria-describedby="fish-preset-note"
              >
                <option value="">自己填写</option>
                {embeddingPresets.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>
            {presetNote && (
              <p className="fish-muted" id="fish-preset-note">
                {presetNote}
              </p>
            )}
            <label>
              接口格式（一般按地址自动识别，无需修改）
              <select name="protocol" defaultValue={state.settings.embeddingProtocol}>
                <option value="auto">按地址自动识别</option>
                <option value="openai">OpenAI 格式（/embeddings，大多数服务）</option>
                <option value="ollama">Ollama 格式（/api/embed）</option>
                <option value="doubao">多模态格式（/embeddings/multimodal，如豆包视觉向量）</option>
              </select>
            </label>
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
              <input name="model" required defaultValue={state.settings.embeddingModel} />
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
            <p className="fish-muted">
              只支持模型允许的维度。修改接口格式、模型或维度后，需要重新准备索引。
            </p>
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
                  更换密钥
                </button>
              </div>
            )}
            <p className="fish-muted">
              服务负责生成向量，记忆与向量均保存在本机。远程服务会收到用于生成向量的文字。
            </p>
            <div className="fish-connection-actions">
              <button
                type="button"
                className="fish-button"
                disabled={isBusy || isTesting}
                onClick={() => void testConnection()}
              >
                {isTesting ? '测试中…' : '测试连接'}
              </button>
              <button
                type="submit"
                className="fish-button fish-button-primary"
                disabled={isBusy || isTesting}
              >
                保存连接
              </button>
            </div>
            <p className="fish-muted">测试只发送固定测试文字，不保存配置、测试结果或向量。</p>
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
          <div className="fish-form fish-index-form">
            <p className="fish-muted">
              向量扩展{state.vector.available ? '可用' : '不可用'} · 已保存 {state.vector.count}{' '}
              条索引。新记忆自动处理，已有记忆可在这里准备。
            </p>
            <label>
              处理范围
              <select
                value={indexProject}
                onChange={(event) => setIndexProject(event.target.value)}
              >
                {projects.map((projectPath) => (
                  <option key={projectPath} value={projectPath}>
                    {projectPath ? projectLabel(projectPath) : '不限项目'}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="fish-button"
              disabled={isBusy || !state.vector.configured || !state.vector.available}
              onClick={async () => {
                const result = (await submitAction('index', {
                  scope: { ...state.scope, project: indexProject },
                })) as { count?: number } | null
                if (result) notify(`又有 ${result.count ?? 0} 条记忆可以换个说法想起了`)
              }}
            >
              让以前的记忆也能这样想起
            </button>
          </div>
          </div>
        </details>
      )}
    </section>
  )
}
