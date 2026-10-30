import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import sessionEvidence from './session-evidence.cjs'

const reportPath = 'outputs/live-four-operations-report.json'
const report = JSON.parse(await readFile(reportPath, 'utf8'))
for (const turn of report.turns) {
  turn.events = sessionEvidence(turn.events)
}
await writeFile(reportPath, JSON.stringify(report, null, 2))
await writeFile(join(report.dataDirectory, 'report.json'), JSON.stringify(report, null, 2))
const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  )
const rows = report.turns
  .map((turn) => {
    const toolCalls = turn.events
      .filter((entry) => entry.event.type === 'assistant/message')
      .flatMap((entry) => entry.event.data.message.content)
      .filter((block) => block.type === 'tool-call')
    return `<section><h2>${escapeHtml(turn.label)}</h2>
    <p><b>发送给 Agent：</b>${escapeHtml(turn.prompt)}</p>
    <p><b>实际回复：</b>${escapeHtml(turn.answer)}</p>
    <p><b>Agent 主动调用工具：</b>${escapeHtml(toolCalls.map((call) => call.name).join('、') || '无')}</p>
    <p><b>后台整理结果：</b>${escapeHtml(turn.audit.map((entry) => entry.action).join('、') || '未修改记忆')}</p>
    <ul>${turn.audit.map((entry) => `<li>${escapeHtml(entry.action)}：${escapeHtml(entry.reason)}</li>`).join('')}</ul>
    <p><b>数据库状态：</b>${turn.memories.map((memory) => `${escapeHtml(memory.text)}（v${memory.version}，${memory.status === 'active' ? '有效' : '已失效'}）`).join('<br>')}</p>
    <details><summary>原生事件与对应整理任务</summary>
      <pre>${escapeHtml(JSON.stringify({ events: turn.events, learningJobs: turn.learningJobs }, null, 2))}</pre>
    </details></section>`
  })
  .join('')
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<title>DSH 原生会话四元操作实测</title><style>
body {
  max-width: 1080px;
  margin: 32px auto;
  padding: 0 24px;
  color: #20344e;
  background: #f7faff;
  font: 16px/1.7 system-ui;
}
section {
  margin: 24px 0;
  padding: 20px;
  background: white;
  border: 1px solid #bdcfea;
}
pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
summary {
  cursor: pointer;
}
</style><h1>DSH 原生会话四元操作实测</h1>
<p>插件 ${escapeHtml(report.pluginVersion)}；模型 ${escapeHtml(report.model)}；本地检索。</p>
<p>${escapeHtml(report.method)} 测试使用 DSH Desktop 自带运行时与 SDK，在后台创建隔离会话，没有操作用户现有聊天窗口。未伪造时间或手动写入记忆。</p>
<p>本轮观察：后台整理器在 turn/end 后执行 ADD → NONE → UPDATE → DELETE；Agent 没有写入工具调用。
新会话中 Agent 自行调用 yuwen_recall 检索，未找到有效记录后回答不知道。</p>
${rows}</html>`
await writeFile('outputs/live-four-operations-report.html', html)
console.log(
  JSON.stringify({
    assertions: report.assertions,
    report: 'outputs/live-four-operations-report.html',
  }),
)
