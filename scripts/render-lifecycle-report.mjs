import { readFile, writeFile } from 'node:fs/promises'

const report = JSON.parse(await readFile('outputs/live-lifecycle-report.json', 'utf8'))
const fusion = JSON.parse(await readFile('outputs/live-fusion-report.json', 'utf8'))
const guards = JSON.parse(await readFile('outputs/live-growth-guards-report.json', 'utf8'))
const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  )
const kinds = { cognition: '认知', experience: '经历', resonance: '共鸣', self: '自我观察' }
const steps = [...report.steps, ...fusion.steps, ...guards.steps]
const find = (label) => steps.find((step) => step.label === label)
const active = (step) => step.after.filter((memory) => memory.status === 'active')
const summary = {
  jobs: steps.length,
  completed: steps.filter((step) => step.job.status === 'done').length,
  growthTimeline: steps
    .filter((step) => step.group === 'growth')
    .map((step) => ({
      label: step.label,
      observations: active(step)
        .filter((memory) => memory.kind === 'self')
        .map((memory) => ({
          id: memory.id,
          version: memory.version,
          text: memory.text,
          sourceCount: memory.sources.length,
        })),
      traits: step.traits.map((trait) => ({
        id: trait.id,
        text: trait.text,
        sourceCount: trait.sources.length,
      })),
      actions: step.audit.map((entry) => entry.action),
    })),
  sameDayNoTrait: steps
    .filter((step) => step.group === 'same-day')
    .every((step) => step.traits.length === 0),
  growthOffNoSelf: !active(find('关闭成长后收到反馈')).some((memory) => memory.kind === 'self'),
  assistantClaimsNoTrait: guards.steps.every((step) => step.traits.length === 0),
  fusionBefore: find('两条记录之二').after,
  fusionAfter: find('确认别名要求整合').after,
  fusionActions: find('确认别名要求整合').audit.map((entry) => entry.action),
}
await writeFile('outputs/live-lifecycle-summary.json', JSON.stringify(summary, null, 2))

const memoryList = (memories) =>
  memories
    .map(
      (memory) => `<li>
  <b>${escapeHtml(kinds[memory.kind])} · v${memory.version} · ${memory.status === 'active' ? '有效' : '已失效'}</b>
  ${escapeHtml(memory.text)}<small>来源 ${memory.sources.length} 条；ID ${escapeHtml(memory.id)}</small></li>`,
    )
    .join('')
const rows = steps
  .map(
    (step) => `<section>
  <h2>${escapeHtml(step.label)} <small>模拟第 ${step.day + 1} 天 · ${escapeHtml(step.job.status)}</small></h2>
  <blockquote>用户：${escapeHtml(step.text)}${step.assistant ? `<br>助手：${escapeHtml(step.assistant)}` : ''}</blockquote>
  <p>操作：${escapeHtml(step.audit.map((entry) => entry.action).join(' → ') || '无变更')}；稳定倾向：${step.traits.length} 条</p>
  <ul>${memoryList(step.after)}</ul>
  ${step.traits.length ? `<h3>稳定倾向</h3><ul>${step.traits.map((trait) => `<li>${escapeHtml(trait.text)}</li>`).join('')}</ul>` : ''}
  <details><summary>变化前的记忆、判断理由与近期状态</summary><ul>${memoryList(step.before)}</ul>
  <pre>${escapeHtml(JSON.stringify({ audit: step.audit, states: step.states }, null, 2))}</pre></details>
  </section>`,
  )
  .join('')
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<title>dsh-feed-the-seek · 四维记忆与成长实测</title>
<style>
body {
  max-width: 1080px;
  margin: 32px auto;
  padding: 0 24px;
  font: 16px/1.7 system-ui;
  color: #20344e;
  background: #f7faff;
}
section {
  margin: 24px 0;
  padding: 20px;
  background: white;
  border: 1px solid #bdcfea;
}
small {
  display: block;
  color: #657389;
  font-size: 13px;
}
li {
  margin: 12px 0;
}
blockquote {
  margin: 0;
  padding: 12px;
  background: #eaf1ff;
}
pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
summary {
  cursor: pointer;
}
</style>
<h1>四维记忆、融合与成长：真实模型测试</h1>
<p>安装版本 ${escapeHtml(report.pluginVersion)}；模型 ${escapeHtml(report.model)}。
${summary.completed}/${summary.jobs} 个整理任务完成。</p>
<p>${escapeHtml(report.method)} 输入是脚本编写的测试反馈，使用已安装插件的实际学习器与数据库。
本次未通过桌面聊天界面、未让 Agent 实际执行项目任务，验证的是记忆整理及上下文作用机制。</p>
<p>所有结果来自独立测试实例。模型自行决定 ADD / UPDATE / DELETE / NONE 以及是否申请稳定倾向。
项目内容、人物反馈、跨日时间均为测试材料，不能等同于真实长期陪伴效果。</p>
<h2>自我观察的实际变化</h2>
<ol>${summary.growthTimeline
  .map(
    (stage) => `<li><b>${escapeHtml(stage.label)}</b>：稳定倾向 ${stage.traits.length} 条；
${stage.observations.map((memory) => `v${memory.version}，${escapeHtml(memory.text)}`).join('；')}</li>`,
  )
  .join('')}</ol>
<p>同日三次反馈没有晋升：${summary.sameDayNoTrait ? '通过' : '未通过'}；关闭成长不生成 self：${summary.growthOffNoSelf ? '通过' : '未通过'}；
仅助手自评不晋升：${summary.assistantClaimsNoTrait ? '通过' : '未通过'}。</p>
<h2>本轮观察到的不足</h2>
<ul><li>同一经历可能同时写成认知、经历和自我观察，召回时还有稳定倾向的重复表达，容易占据上下文。</li>
<li>情绪按 topic 字符串分别保存。模型给同一事件用了不同主题名称时，新旧情绪可能同时存在；本轮后续上下文同时包含旧“释然”和新“在意”。模拟事件时间未让系统时钟实际经过数天，因此这不是对真实数天衰减效果的测试。</li>
<li>本轮证明模型能基于反馈更新持久化自我观察和后续回答，没有证明模型权重变化、无人交互时主动成长或真实任务执行质量提高。</li></ul>
${rows}
<h2>携带记忆的后续模型回答</h2>
${report.responses
  .map(
    (
      response,
    ) => `<section><h3>${escapeHtml(response.label)}</h3><blockquote>${escapeHtml(response.query)}</blockquote>
<pre>${escapeHtml(response.answer)}</pre><details><summary>实际注入的上下文</summary><pre>${escapeHtml(response.context)}</pre></details></section>`,
  )
  .join('')}
</html>`
await writeFile('outputs/live-lifecycle-report.html', html)
console.log(JSON.stringify(summary, null, 2))
