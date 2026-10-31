const $ = (id) => document.getElementById(id)
const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  )
const kinds = { cognition: '认知', experience: '经历', resonance: '共鸣', self: '自我' }
const categories = {
  person: '人物',
  fact: '知识',
  rule: '规则',
  convention: '约定',
  opinion: '观点',
  preference: '偏好',
  event: '事件',
  relationship: '关系',
  tendency: '倾向',
}
const moods = {
  steady: '平稳',
  concerned: '在意',
  discouraged: '轻度沮丧',
  relieved: '释然',
  hopeful: '期待',
}
let state
let historyData
let historyQuery = ''
let historyScope = ''
let historyRequest = 0
let page = 'overview'
let filter = ''
let search = ''
let viewPersona = ''
let sessionId = crypto.randomUUID()
let sessionNumber = 1
let sessionEnabled = true
let timer
function toast(text) {
  $('toast').textContent = text
  $('toast').classList.add('visible')
  clearTimeout(timer)
  timer = setTimeout(() => $('toast').classList.remove('visible'), 3500)
}
async function api(path, body) {
  const response = await fetch(
    '/api/' + path,
    body === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-feed-the-seek-token': state.token },
          body: JSON.stringify(body),
        },
  )
  const data = await response.json()
  if (!response.ok) {
    throw Error(data.error || '请求失败')
  }
  return data
}
const scope = () => ({ ...state.scope, project: $('project').value })
const active = () =>
  state.memories
    .filter((memory) => memory.status === 'active')
    .sort((leftMemory, rightMemory) => rightMemory.updatedAt.localeCompare(leftMemory.updatedAt))
const date = (value) =>
  new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
const heading = (text) => '<div class="page-heading"><h1>' + text + '</h1></div>'
function table(list) {
  return list.length
    ? '<div class="table-wrap"><table><thead><tr><th>记忆</th><th class="date-col">更新</th></tr></thead><tbody>' +
        list
          .map(
            (memory) =>
              '<tr><td class="content-col"><p>' +
              esc(memory.text) +
              '</p><div class="record-meta"><span class="tag">' +
              kinds[memory.kind] +
              ' · ' +
              categories[memory.knowledge.category] +
              '</span><span>' +
              (memory.evidence === 'explicit' ? '用户陈述' : '推测') +
              '</span></div><p class="small">' +
              esc(
                [
                  memory.knowledge.domain,
                  memory.knowledge.edition && '版本 ' + memory.knowledge.edition,
                  memory.knowledge.conditions,
                  memory.scope.project && '项目 ' + memory.scope.project,
                ]
                  .filter(Boolean)
                  .join(' · ') || '跨会话可用',
              ) +
              '</p><details><summary>记录详情</summary><p class="small">置信度 ' +
              Math.round(memory.confidence * 100) +
              '% · 重要度 ' +
              Math.round(memory.importance * 100) +
              '% · 活跃度 ' +
              Math.round(memory.activation * 100) +
              '%</p>' +
              '</details></td><td class="date-col">' +
              date(memory.updatedAt) +
              '<small>v' +
              memory.version +
              '</small></td></tr>',
          )
          .join('') +
        '</tbody></table></div>'
    : '<div class="empty-state">暂无记录</div>'
}
function demo() {
  return state.demo && state.demoReady
    ? '<section class="settings-card"><h2>演示事件</h2><p class="hint">固定模拟资料，不调用聊天模型。右侧可检索“回声戒指”，再新开测试会话。</p><div class="demo-steps">' +
        ['纠正 1.0 规则', '学习 2.0 规则', '确认工作完成']
          .map(
            (label, recallItem) =>
              '<button class="button" data-demo="' +
              (recallItem + 1) +
              '" ' +
              (state.stage !== recallItem ? 'disabled' : '') +
              '>' +
              label +
              '</button>',
          )
          .join('') +
        '</div></section>'
    : ''
}
function overview() {
  const current = state.states[0]
  return (
    heading('当前实例') +
    '<div class="toolbar"><label for="persona-view">查阅实例</label><select id="persona-view">' +
    state.personas
      .map(
        (project) =>
          '<option value="' +
          esc(project.id) +
          '" ' +
          (project.id === state.scope.persona ? 'selected' : '') +
          '>' +
          esc(project.name) +
          (project.id === state.activePersona ? ' · 新会话使用' : ' · 已保留') +
          '</option>',
      )
      .join('') +
    '</select></div><div class="status-bar">' +
    Object.entries(kinds)
      .map(
        ([k, v]) =>
          '<span class="stat">' +
          v +
          ' <strong>' +
          active().filter((memory) => memory.kind === k).length +
          '</strong></span>',
      )
      .join('') +
    '</div>' +
    (current && state.settings.emotion
      ? '<section class="mood-row"><div class="mood-content"><h2>近期状态 · ' +
        moods[current.mood] +
        '</h2><p>' +
        esc(current.reason) +
        '</p><p>' +
        esc(current.behavior) +
        '</p></div><picture><source media="(prefers-reduced-motion: reduce)" srcset="/assets/portrait-' +
        esc(state.mood?.asset || 'calm') +
        '.png?v=5"><img class="mood-character" src="/assets/portrait-' +
        esc(state.mood?.asset || 'calm') +
        '.webp?v=5" width="150" height="150" alt="蓝发鲸鱼娘女仆的当前心情"></picture></section>'
      : '') +
    '<section class="settings-card"><h2>稳定倾向</h2>' +
    (state.traits.length
      ? state.traits.map((t) => '<p>' + esc(t.text) + '</p>').join('')
      : '<p class="hint">尚未形成。自我观察需由至少三个独立反馈、三个日期及 72 小时跨度支撑。</p>') +
    '</section>' +
    demo() +
    '<section class="settings-card"><h2>重新养一个</h2><p class="hint">新实例从空白开始，不继承记忆或状态。已有 DSH 会话仍使用原实例；新会话使用新实例。旧记录保留供查阅。</p><form id="persona-form"><label class="input-label" for="persona-name">实例名称</label><input id="persona-name" required maxlength="40" placeholder="例如：第二只"><button class="button primary" type="submit">创建新实例</button></form></section>'
  )
}
function memories() {
  const list = active().filter(
    (memory) =>
      (!filter || memory.kind === filter) &&
      [memory.text, memory.knowledge.domain, memory.knowledge.conditions, memory.knowledge.edition]
        .join(' ')
        .includes(search),
  )
  return (
    heading('记忆') +
    '<div class="toolbar"><select id="dimension" aria-label="记忆维度"><option value="">全部维度</option>' +
    Object.entries(kinds)
      .map(
        ([k, v]) =>
          '<option value="' + k + '" ' + (filter === k ? 'selected' : '') + '>' + v + '</option>',
      )
      .join('') +
    '</select><input id="memory-search" aria-label="搜索记忆" placeholder="搜索内容、领域或版本" value="' +
    esc(search) +
    '"><span class="small">' +
    list.length +
    ' 条</span></div>' +
    table(list.slice(0, 50)) +
    (list.length > 50 ? '<p class="hint">显示前 50 条，请搜索缩小范围。</p>' : '') +
    '<p class="hint">记忆通过对话学习与修正。此处只读。</p>'
  )
}
async function loadHistory(pageNumber = 1) {
  const serial = ++historyRequest
  const scope = state.scope
  const result = await api('history', {
    scope,
    page: pageNumber,
    query: historyQuery,
    through: historyData?.through,
  })
  if (serial !== historyRequest || scope.persona !== state.scope.persona) {
    return
  }
  historyScope = scope.persona
  historyData = result
  render()
}
function growth() {
  return (
    heading('变化记录') +
    '<form id="history-search-form"><input id="history-query" type="search" maxlength="200" aria-label="查找变化记录" placeholder="查找内容或原因" value="' +
    esc(historyQuery) +
    '"><button type="submit" class="button">查找 / 刷新</button></form>' +
    '<p>共 ' +
    (historyData?.total || 0) +
    ' 条 · 每页20条</p><div class="toolbar"><button class="button" id="history-prev" ' +
    (!historyData || historyData.page <= 1 ? 'disabled' : '') +
    '>上一页</button><span>第 ' +
    (historyData?.page || 1) +
    ' / ' +
    Math.max(1, Math.ceil((historyData?.total || 0) / 20)) +
    ' 页</span><button class="button" id="history-next" ' +
    (!historyData || historyData.page * 20 >= historyData.total ? 'disabled' : '') +
    '>下一页</button></div>' +
    (historyData?.items || [])
      .map(
        (h) =>
          '<article class="trace"><h3><span class="tag">' +
          esc(
            {
              ADD: '新增',
              UPDATE: '更新',
              DELETE: '失效',
              MIGRATE: '迁移',
              CONSOLIDATE: '形成倾向',
              OBSERVE: '继续观察',
            }[h.action] || h.action,
          ) +
          '</span>' +
          esc(h.reason) +
          '</h3><p>' +
          esc(h.after?.text || h.before?.text || '') +
          '</p><small>' +
          date(h.at) +
          '</small>' +
          (h.before
            ? '<details><summary>旧版本</summary><p>' + esc(h.before.text) + '</p></details>'
            : '') +
          '</article>',
      )
      .join('')
  )
}
function toggle(key, title, description = '') {
  return (
    '<div class="settings-row"><div><h3>' +
    title +
    '</h3><p>' +
    description +
    '</p></div><button class="switch ' +
    (state.settings[key] ? 'on' : '') +
    '" role="switch" aria-checked="' +
    state.settings[key] +
    '" aria-label="' +
    title +
    '" data-setting="' +
    key +
    '"></button></div>'
  )
}
function settings() {
  return (
    heading('设置') +
    '<section class="settings-card"><form id="rename-persona-form"><label>伙伴名字<input name="name" required maxlength="40" value="' +
    esc(state.personas.find((entry) => entry.id === state.scope.persona)?.name || '') +
    '"></label><button type="submit" class="button">保存名字</button></form></section>' +
    '<section class="settings-card">' +
    toggle('enabled', '启用插件') +
    toggle('learning', '自动整理', '使用 DSH 当前模型，产生额外调用费用。') +
    toggle('emotion', '近期情绪') +
    toggle('growth', '自我观察与成长') +
    '</section><section class="settings-card"><h2>向量模型</h2><p class="hint">sqlite-vec ' +
    (state.vector.available ? '可用' : '不可用') +
    ' · 本实例已索引 ' +
    state.vector.count +
    ' 条</p><form id="embedding-form"><label class="input-label" for="embedding-url">接口地址</label><input id="embedding-url" type="url" value="' +
    esc(state.settings.embeddingUrl) +
    '" placeholder="http://127.0.0.1:11434/api/embed"><label class="input-label" for="embedding-model">模型</label><input id="embedding-model" value="' +
    esc(state.settings.embeddingModel) +
    '"><label class="input-label" for="embedding-env">密钥环境变量</label><input id="embedding-env" value="' +
    esc(state.settings.embeddingKeyEnv) +
    '"><p class="hint">支持 OpenAI 兼容 Embeddings 与 Ollama。远程模型会收到记忆内容与查询文本。未配置时使用关键词检索，不生成模拟向量。</p><button class="button primary" type="submit">保存连接</button> <button class="button" id="build-index" type="button">索引当前范围</button></form></section><section class="settings-card"><h2>数据</h2><button class="button" id="export">导出当前实例</button> <button class="button" id="retry">重试整理</button><p class="hint">完成 ' +
    state.jobs.filter((job) => job.status === 'done').length +
    ' · 失败 ' +
    state.jobs.filter((job) => job.status === 'failed').length +
    ' · 等待 ' +
    state.jobs.filter((job) => job.status === 'pending').length +
    '</p>' +
    state.jobs
      .filter((job) => job.error)
      .map((job) => '<p class="hint">' + esc(job.error) + '</p>')
      .join('') +
    '</section>' +
    ((state.sessions || []).length
      ? '<section class="settings-card"><h2>当前实例的 DSH 会话</h2>' +
        state.sessions
          .map(
            (source) =>
              '<div class="settings-row"><div><h3>' +
              esc(source.id) +
              '</h3><p>' +
              esc(source.project) +
              '</p></div><button class="switch ' +
              (source.enabled ? 'on' : '') +
              '" role="switch" aria-checked="' +
              source.enabled +
              '" aria-label="会话 ' +
              esc(source.id) +
              ' 使用记忆" data-session="' +
              esc(source.id) +
              '"></button></div>',
          )
          .join('') +
        '</section>'
      : '')
  )
}
function render() {
  $('main').innerHTML = { overview, memories, growth, settings }[page]()
  $('nav-count').textContent = active().length
  $('storage-status').textContent =
    (state.demo ? '演示数据库' : '本地数据库') +
    ' · ' +
    active().length +
    ' 条有效 · ' +
    state.memories.filter((memory) => memory.status === 'inactive').length +
    ' 条失效保留'
  document.querySelectorAll('[data-page]').forEach((el) => {
    el.classList.toggle('active', el.dataset.page === page)
    if (el.dataset.page === page) {
      el.setAttribute('aria-current', 'page')
    } else {
      el.removeAttribute('aria-current')
    }
  })
}
async function load() {
  const before = state?.revision
  state = await api('state' + (viewPersona ? '?persona=' + encodeURIComponent(viewPersona) : ''))
  if (historyScope !== state.scope.persona) {
    historyScope = state.scope.persona
    historyData = undefined
    historyQuery = ''
    historyRequest++
  }
  $('mode-label').textContent = state.demo ? '模拟数据' : '本地记忆'
  const selected = $('project').value
  const projects = [
    ...new Set([
      '',
      state.scope.project,
      ...state.memories.map((memory) => memory.scope.project),
      'other-project',
    ]),
  ]
  $('project').innerHTML = projects
    .map(
      (project) =>
        '<option value="' + esc(project) + '">' + esc(project || '跨项目资料') + '</option>',
    )
    .join('')
  $('project').value = projects.includes(selected) ? selected : state.scope.project
  render()
  if (before !== undefined && before !== state.revision) {
    clearRecall()
  }
}
function clearRecall() {
  $('recall-result').innerHTML = '<div class="empty-recall">请重新检索</div>'
  $('raw-context').textContent = '尚未检索'
}
async function recall() {
  const button = $('recall')
  button.disabled = true
  try {
    const recallResult = await api('recall', {
      query: $('query').value,
      scope: scope(),
      session: sessionId,
    })
    $('raw-context').textContent = recallResult.context || '无注入内容'
    $('recall-result').innerHTML =
      '<div class="recall-summary"><div class="recall-heading">命中 ' +
      recallResult.items.length +
      ' 条<span>' +
      (recallResult.mode === 'hybrid' ? '混合检索' : '关键词检索') +
      '</span></div>' +
      recallResult.items
        .map(
          (recallItem) =>
            '<div class="recall-item"><p>' +
            esc(recallItem.memory.text) +
            '</p><small>' +
            esc(
              [
                recallItem.memory.knowledge.edition &&
                  '版本 ' + recallItem.memory.knowledge.edition,
                ...recallItem.reasons,
              ]
                .filter(Boolean)
                .join(' · '),
            ) +
            '</small></div>',
        )
        .join('') +
      recallResult.states
        .map(
          (source) =>
            '<div class="recall-item"><p>' +
            moods[source.mood] +
            ' · ' +
            esc(source.behavior) +
            '</p></div>',
        )
        .join('') +
      '<p class="hint">' +
      esc(recallResult.note) +
      '</p></div>'
  } finally {
    button.disabled = false
  }
}
document.addEventListener('click', async (event) => {
  const button = event.target.closest('button')
  if (!button) {
    return
  }
  try {
    if (button.dataset.page) {
      page = button.dataset.page
      render()
      if (page === 'growth') {
        await loadHistory(1)
      }
    }
    if (button.id === 'history-prev') {
      await loadHistory(historyData.page - 1)
    }
    if (button.id === 'history-next') {
      await loadHistory(historyData.page + 1)
    }
    if (button.id === 'refresh') {
      await load()
      toast('已刷新')
    }
    if (button.id === 'recall') {
      await recall()
    }
    if (button.id === 'new-session') {
      sessionId = crypto.randomUUID()
      sessionNumber++
      sessionEnabled = true
      $('session-label').textContent = '测试会话 ' + String(sessionNumber).padStart(2, '0')
      $('session-toggle').classList.add('on')
      $('session-toggle').setAttribute('aria-checked', 'true')
      await recall()
    }
    if (button.id === 'session-toggle') {
      sessionEnabled = !sessionEnabled
      await api('session', { id: sessionId, enabled: sessionEnabled })
      button.classList.toggle('on', sessionEnabled)
      button.setAttribute('aria-checked', String(sessionEnabled))
      await recall()
    }
    if (button.dataset.demo) {
      button.disabled = true
      await api('demo-step', { step: Number(button.dataset.demo), scope: state.scope })
      await load()
      await recall()
    }
    if (button.dataset.setting) {
      await api('settings', { [button.dataset.setting]: !state.settings[button.dataset.setting] })
      await load()
    }
    if (button.dataset.session) {
      const session = state.sessions.find((session) => session.id === button.dataset.session)
      await api('session', { id: session.id, enabled: !session.enabled })
      await load()
    }
    if (button.id === 'build-index') {
      button.disabled = true
      const recallResult = await api('index', { scope: scope() })
      await load()
      toast('已索引 ' + recallResult.count + ' 条')
    }
    if (button.id === 'retry') {
      await api('retry', {})
      toast('已安排重试')
    }
    if (button.id === 'export') {
      const data = await api('export', { scope: scope() })
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      )
      const downloadLink = document.createElement('a')
      downloadLink.href = url
      downloadLink.download = 'dsh-feed-the-seek-instance.json'
      downloadLink.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
  } catch (err) {
    toast(err.message)
    button.disabled = false
  }
})
document.addEventListener('input', (event) => {
  if (event.target.id === 'memory-search') {
    search = event.target.value
    const pos = event.target.selectionStart
    render()
    $('memory-search').focus()
    $('memory-search').setSelectionRange(pos, pos)
  }
})
document.addEventListener('change', async (event) => {
  try {
    if (event.target.id === 'dimension') {
      filter = event.target.value
      render()
    }
    if (event.target.id === 'project') {
      await recall()
    }
    if (event.target.id === 'persona-view') {
      viewPersona = event.target.value
      await load()
      clearRecall()
    }
  } catch (err) {
    toast(err.message)
  }
})
document.addEventListener('submit', async (event) => {
  event.preventDefault()
  const button = event.target.querySelector('button[type="submit"]')
  if (button) {
    button.disabled = true
  }
  try {
    if (event.target.id === 'history-search-form') {
      historyQuery = $('history-query').value.trim()
      historyData = undefined
      await loadHistory(1)
    }
    if (event.target.id === 'rename-persona-form') {
      await api('persona/rename', {
        scope: state.scope,
        name: new FormData(event.target).get('name'),
      })
      await load()
      toast('伙伴名字已更新')
    }
    if (event.target.id === 'persona-form') {
      await api('persona', { name: $('persona-name').value.trim() })
      viewPersona = ''
      sessionId = crypto.randomUUID()
      sessionEnabled = true
      $('session-toggle').classList.add('on')
      $('session-toggle').setAttribute('aria-checked', 'true')
      await load()
      clearRecall()
      toast('新实例已创建，将用于新的 DSH 会话')
    }
    if (event.target.id === 'embedding-form') {
      await api('settings', {
        embeddingUrl: $('embedding-url').value.trim(),
        embeddingModel: $('embedding-model').value.trim(),
        embeddingKeyEnv: $('embedding-env').value.trim(),
      })
      await load()
      toast('连接已保存')
    }
  } catch (err) {
    toast(err.message)
  } finally {
    if (button) {
      button.disabled = false
    }
  }
})
try {
  await load()
} catch (err) {
  $('main').textContent = '加载失败：' + err.message
}
