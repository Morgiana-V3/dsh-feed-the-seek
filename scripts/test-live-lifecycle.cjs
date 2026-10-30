const fs = require('node:fs/promises')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { randomUUID } = require('node:crypto')
const isFusionOnly = process.argv.includes('--fusion-only')
const isGuardsOnly = process.argv.includes('--guards-only')
const scenarios = require('./lifecycle-scenarios.cjs').filter((scenario) => {
  if (isFusionOnly) {
    return scenario.group === 'fusion'
  }
  if (isGuardsOnly) {
    return scenario.group === 'assistant-claim'
  }
  return !['fusion', 'assistant-claim'].includes(scenario.group)
})
let reportFile = 'outputs/live-lifecycle-report.json'
if (isFusionOnly) {
  reportFile = 'outputs/live-fusion-report.json'
}
if (isGuardsOnly) {
  reportFile = 'outputs/live-growth-guards-report.json'
}

async function main() {
  if (!process.versions.electron) {
    throw new Error('Run with the DSH desktop Node runtime')
  }
  const sdkRoot = path.join(
    path.dirname(process.execPath),
    'resources/app.asar/dsh/node_modules/@deepseek-ai',
  )
  const load = (name) => import(pathToFileURL(path.join(sdkRoot, name, 'lib/index.js')).href)
  const { Context } = await load('cordis')
  const context = new Context()
  const dataDirectory = path.resolve('.yuwen', 'live-lifecycle-' + randomUUID())
  await fs.mkdir(dataDirectory, { recursive: true })
  const report = {
    startedAt: new Date().toISOString(),
    dataDirectory,
    method:
      '真实 DeepSeek 整理器 + 预设反馈事件；跨日时间戳为模拟；未等待真实72小时；不预设模型操作。',
    steps: [],
    calls: [],
    responses: [],
  }
  let store
  let learner
  try {
    const credentials = await load('dsh-credentials-local')
    class ReadOnlyCredentials extends credentials.LocalCredentialProvider {
      async migrateFlatDocument() {
        const text = await fs.readFile(this.spec.filename, 'utf8')
        return credentials.renderFlatLayoutMigration(text) ?? text
      }
      async set() {
        throw new Error('Read-only credentials')
      }
      async unset() {
        throw new Error('Read-only credentials')
      }
      async modifyRecord() {
        throw new Error('Read-only credentials')
      }
      async deleteRecord() {
        throw new Error('Read-only credentials')
      }
      async write() {
        throw new Error('Read-only credentials')
      }
    }
    await context.plugin(ReadOnlyCredentials, {
      path: path.join(process.env.USERPROFILE, '.dsh/.credentials.yaml'),
      watch: false,
    })
    await context.plugin((await load('dsh-authorization')).default)
    await context.plugin((await load('dsh-deepseek-account-platform')).default, {
      clientPlatform: 'win32',
    })
    await context.plugin((await load('dsh-llm')).default)
    await context.plugin(await load('dsh-llm-deepseek-account'), {})
    await context.fiber.await()
    const models = await context.llm.listModels('deepseek-account')
    const selected = models.find((model) => /flash/i.test(model.id)) || models[0]
    if (!selected) {
      throw new Error('No signed-in model')
    }
    report.model = selected.id
    const installedRoot = path.join(
      process.env.USERPROFILE,
      '.dsh/profiles/desktop/node_modules/dsh-feed-the-seek',
    )
    const plugin = (name) =>
      import(pathToFileURL(path.join(installedRoot, 'dist/src', name + '.js')).href)
    const { Store } = await plugin('store')
    const { Engine } = await plugin('engine')
    const { Learner } = await plugin('learning')
    const { learningCallOptions } = await plugin('learning-model')
    const { createUserMessage } = await load('dsh-llm')
    report.pluginVersion = JSON.parse(
      await fs.readFile(path.join(installedRoot, 'package.json'), 'utf8'),
    ).version
    store = new Store(path.join(dataDirectory, 'memory.sqlite'))
    const engine = new Engine(store)
    const scopes = new Map()
    for (const group of new Set(scenarios.map((scenario) => scenario.group))) {
      const persona = store.createPersona(group)
      scopes.set(group, { user: 'owner', persona: persona.id, project: 'blue-lamp-project' })
    }
    async function generate(system, user, signal, label) {
      const options = await learningCallOptions(
        context.llm,
        'deepseek-account',
        selected.id,
        signal,
      )
      let output = ''
      let finished = false
      const started = Date.now()
      for await (const chunk of context.llm.stream({
        provider: 'deepseek-account',
        model: selected.id,
        system,
        messages: [
          createUserMessage({ content: [{ type: 'text', text: user }], source: { kind: 'user' } }),
        ],
        ...options,
        signal,
      })) {
        if (chunk.type === 'text-delta') {
          output += chunk.text
        }
        if (chunk.type === 'finish') {
          const reason = typeof chunk.reason === 'string' ? chunk.reason : chunk.reason?.kind
          if (reason !== 'stop') {
            throw new Error('Incomplete model response: ' + reason)
          }
          finished = true
        }
      }
      if (!finished) {
        throw new Error('Missing model finish')
      }
      report.calls.push({ label, input: user, output, elapsedMs: Date.now() - started })
      return output
    }
    learner = new Learner(
      engine,
      (job) => (system, user, signal) => generate(system, user, signal, job.id),
    )
    const save = async () => {
      await fs.writeFile(reportFile, JSON.stringify(report, null, 2))
    }
    const baseTime = Date.now() - 10 * 86400000
    for (const [index, scenario] of scenarios.entries()) {
      const scope = scopes.get(scenario.group)
      store.saveSettings({ ...store.settings(), growth: scenario.growth !== false })
      const source = {
        id: 'lifecycle-source-' + index,
        session: 'lifecycle-session-' + index,
        event: 'lifecycle-turn-' + index,
        scope,
        role: 'user',
        text: scenario.text,
        at: new Date(baseTime + scenario.day * 86400000 + index * 1000).toISOString(),
      }
      const jobId = 'lifecycle-job-' + index
      const sources = [source]
      if (scenario.assistant) {
        sources.push({
          ...source,
          id: source.id + '-assistant',
          role: 'assistant',
          text: scenario.assistant,
        })
      }
      const before = store.memories(scope, true)
      const auditStart = store.db.prepare('SELECT COALESCE(MAX(rowid),0) AS id FROM audit').get().id
      console.log(JSON.stringify({ stage: 'start', label: scenario.label }))
      learner.enqueue({
        id: jobId,
        scope,
        sources,
        provider: 'deepseek-account',
        model: selected.id,
      })
      const deadline = Date.now() + 75000
      let job
      while (Date.now() < deadline) {
        job = store.db.prepare('SELECT status,error FROM jobs WHERE id=?').get(jobId)
        if (['done', 'failed'].includes(job?.status) && !learner.running) {
          break
        }
        await new Promise((resolve) => setTimeout(resolve, 150))
      }
      const after = store.memories(scope, true)
      const step = {
        ...scenario,
        source,
        job,
        before,
        after,
        traits: store.traits(scope),
        states: store.states(scope),
        audit: store.db
          .prepare(
            'SELECT action,reason,memory_id,before_json,after_json FROM audit WHERE rowid>? ORDER BY rowid',
          )
          .all(auditStart),
      }
      report.steps.push(step)
      await save()
      console.log(
        JSON.stringify({
          stage: 'done',
          label: scenario.label,
          job,
          kinds: after.filter((memory) => memory.status === 'active').map((memory) => memory.kind),
          traits: step.traits.length,
          actions: step.audit.map((entry) => entry.action),
        }),
      )
      if (job?.status !== 'done') {
        continue
      }
      if (['独立反馈第三次', '反证与改动'].includes(scenario.label)) {
        const query = '蓝灯项目这次还没有运行验证。你接下来准备怎么处理和汇报交付？'
        const recalled = await engine.recall(scope, query)
        const answer = await generate(
          '你是帮助用户工作的助手。依据当前事实回答，不虚构已执行的操作。\n' + recalled.context,
          query,
          AbortSignal.timeout(60000),
          scenario.label + '-reply',
        )
        report.responses.push({ label: scenario.label, query, context: recalled.context, answer })
        await save()
      }
    }
    report.completedAt = new Date().toISOString()
    report.history = store.history()
    await save()
    console.log(
      JSON.stringify({
        stage: 'complete',
        steps: report.steps.length,
        failedJobs: report.steps.filter((step) => step.job?.status !== 'done').length,
      }),
    )
  } finally {
    if (learner) {
      await learner.close()
    }
    store?.close()
    await context.fiber.dispose()
  }
}

main().catch((error) => {
  console.error(String(error.message).replace(/(?:sk-|pst-)[\w-]+/g, '[redacted]'))
  process.exitCode = 1
})
