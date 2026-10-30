const fs = require('node:fs/promises')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { randomUUID } = require('node:crypto')
const sessionEvidence = require('./session-evidence.cjs')

async function main() {
  if (!process.versions.electron) throw new Error('Run with the DSH desktop Node runtime')
  const sdkRoot = path.join(
    path.dirname(process.execPath),
    'resources/app.asar/dsh/node_modules/@deepseek-ai',
  )
  const load = (name) => import(pathToFileURL(path.join(sdkRoot, name, 'lib/index.js')).href)
  const { Context } = await load('cordis')
  const context = new Context()
  const report = { startedAt: new Date().toISOString(), turns: [], assertions: [], model: null }
  const isFourOperations = process.argv.includes('--four-operations')
  const isRecovery = process.argv.includes('--retry-failed')
  const previousReport = isRecovery
    ? JSON.parse(await fs.readFile('outputs/live-desktop-report.json', 'utf8'))
    : undefined
  const runDirectory =
    previousReport?.dataDirectory || path.resolve('.yuwen', 'live-' + randomUUID())
  if (!path.resolve(runDirectory).startsWith(path.resolve('.yuwen') + path.sep + 'live-')) {
    throw new Error('Live tests must use an isolated workspace test directory')
  }
  await fs.mkdir(runDirectory, { recursive: true })
  let store
  try {
    const credentialModule = await load('dsh-credentials-local')
    class ReadOnlyCredentials extends credentialModule.LocalCredentialProvider {
      async migrateFlatDocument() {
        const text = await fs.readFile(this.spec.filename, 'utf8')
        return credentialModule.renderFlatLayoutMigration(text) ?? text
      }
      async set() {
        throw new Error('Test credentials are read-only')
      }
      async unset() {
        throw new Error('Test credentials are read-only')
      }
      async modifyRecord() {
        throw new Error('Test credentials are read-only')
      }
      async deleteRecord() {
        throw new Error('Test credentials are read-only')
      }
      async write() {
        throw new Error('Test credentials are read-only')
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
    console.log(
      JSON.stringify({
        stage: 'models',
        models: models.map((model) => ({ id: model.id, name: model.name })),
      }),
    )
    if (!selected) throw new Error('No usable signed-in DeepSeek account model')
    report.model = selected.id
    report.modelInfo = await context.llm.resolveModelInfo('deepseek-account', selected.id)
    console.log(JSON.stringify({ stage: 'model-info', info: report.modelInfo }))
    if (process.argv.includes('--probe')) return

    for (const [name, config] of [
      ['dsh-session', {}],
      ['dsh-session-projection', {}],
      ['dsh-system-prompt', { includeRuntimeContext: true }],
      ['dsh-tools', {}],
      ['dsh-agent', {}],
      ['dsh-agent-loop', { agents: [], maxParallelToolCalls: 1 }],
      ['dsh-host-webserver', { host: '127.0.0.1', port: 0 }],
    ]) {
      await context.plugin((await load(name)).default, config)
    }
    const installedRoot = process.argv.includes('--workspace')
      ? path.resolve('.')
      : path.join(
          process.env.USERPROFILE,
          '.dsh/profiles/desktop/node_modules/dsh-feed-the-seek',
        )
    const { Store } = await import(
      pathToFileURL(path.join(installedRoot, 'dist/src/store.js')).href
    )
    await context.plugin(
      await import(pathToFileURL(path.join(installedRoot, 'dist/src/dsh.js')).href),
      { dataDir: runDirectory },
    )
    await context.fiber.await()
    store = new Store(path.join(runDirectory, 'memory.sqlite'))
    report.pluginVersion = JSON.parse(
      await fs.readFile(path.join(installedRoot, 'package.json'), 'utf8'),
    ).version
    const { createUserMessage } = await load('dsh-llm')
    const events = []
    const contexts = []
    context.on('session/event', (session, event) => events.push({ session: session.id, event }))
    context.on('system-prompt/assemble', async (assembly, input, next) => {
      const result = await next()
      contexts.push({ session: input.agent?.id, sections: result.contexts })
      return result
    })
    const project = path.join(runDirectory, 'project-a')
    await fs.mkdir(project, { recursive: true })
    async function agent(label, cwd = project) {
      const handle = await context.agents.create({
        sessionId: 'feiyu-live-' + label + '-' + randomUUID(),
        meta: { cwd },
        agentOptions: {
          provider: 'deepseek-account',
          model: selected.id,
          reasoningEffort: 'low',
        },
      })
      return handle.agent
    }
    async function waitForLearning() {
      const until = Date.now() + 90000
      while (Date.now() < until) {
        const jobs = store.db.prepare('SELECT status,error FROM jobs').all()
        if (jobs.every((job) => job.status === 'done' || job.status === 'failed')) return jobs
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
      throw new Error('Learning did not settle within 90 seconds')
    }
    if (isRecovery) {
      const origin = context.webServer.getOrigin()
      const settings = await (await fetch(origin + '/fish-brain/api/state')).json()
      const response = await fetch(origin + '/fish-brain/api/retry', {
        method: 'POST',
        headers: { 'x-yuwen-token': settings.token },
      })
      if (!response.ok) throw new Error('Retry endpoint failed')
      const jobs = await waitForLearning()
      const recovery = {
        testedAt: new Date().toISOString(),
        pluginVersion: report.pluginVersion,
        dataDirectory: runDirectory,
        jobs,
        memories: store.memories(undefined, true),
        allCompleted: jobs.every((job) => job.status === 'done'),
        staleFactAbsent: !store
          .memories()
          .some((memory) => /回声戒指/.test(memory.text) && /17\s*秒/.test(memory.text)),
      }
      await fs.writeFile('outputs/live-desktop-recovery.json', JSON.stringify(recovery, null, 2))
      console.log(
        JSON.stringify({
          stage: 'recovery',
          allCompleted: recovery.allCompleted,
          staleFactAbsent: recovery.staleFactAbsent,
          jobs: jobs.length,
        }),
      )
      if (!recovery.allCompleted || !recovery.staleFactAbsent) process.exitCode = 1
      return
    }
    async function turn(subject, label, prompt) {
      console.log(JSON.stringify({ stage: 'turn-start', label }))
      const start = events.length
      const contextStart = contexts.length
      const auditStart = store.db.prepare('SELECT COALESCE(MAX(rowid),0) AS id FROM audit').get().id
      subject.followup(
        createUserMessage({ content: [{ type: 'text', text: prompt }], source: { kind: 'user' } }),
      )
      let timer
      try {
        await Promise.race([
          subject.whenIdle(),
          new Promise((_, reject) => {
            timer = setTimeout(() => {
              subject.cancel({ kind: 'hook', reason: 'test timeout' })
              reject(new Error('Agent timeout'))
            }, 90000)
          }),
        ])
      } finally {
        clearTimeout(timer)
      }
      const jobs = await waitForLearning()
      const turnEvents = events.slice(start).filter((entry) => entry.session === subject.id)
      const terminal = turnEvents.findLast((entry) => entry.event.type === 'turn/end')?.event.data
      if (terminal?.reason?.kind !== 'completed') {
        await fs.writeFile(
          path.join(runDirectory, 'failed-events.json'),
          JSON.stringify(turnEvents, null, 2),
        )
        throw new Error(JSON.stringify(terminal?.reason || { reason: 'Missing completed turn' }))
      }
      const messages = turnEvents
        .filter((entry) => entry.event.type === 'assistant/message')
        .map((entry) => entry.event.data.message?.content || [])
        .flat()
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
      const result = {
        label,
        session: subject.id,
        prompt,
        answer: messages.join('\n'),
        terminal: turnEvents.findLast((entry) => entry.event.type === 'turn/end')?.event.data,
        contexts: contexts.slice(contextStart).filter((entry) => entry.session === subject.id),
        jobs,
        memories: store.memories(undefined, true),
        states: store.states({
          user: 'owner',
          persona: store.activePersona(),
          project: project.toLowerCase(),
        }),
        stepCount: turnEvents.filter((entry) => entry.event.type === 'step/end').length,
        events: isFourOperations ? sessionEvidence(turnEvents) : undefined,
        audit: store.db
          .prepare(
            'SELECT action,reason,memory_id,before_json,after_json FROM audit WHERE rowid>? ORDER BY rowid',
          )
          .all(auditStart),
        learningJobs: store.db.prepare('SELECT id,status,error,updated_at FROM jobs').all(),
      }
      report.turns.push(result)
      await fs.writeFile(path.join(runDirectory, 'report.json'), JSON.stringify(report, null, 2))
      console.log(
        JSON.stringify({
          stage: 'turn-done',
          label,
          answer: result.answer,
          jobs: jobs.map((job) => job.status),
          memories: result.memories.length,
          stepCount: result.stepCount,
        }),
      )
      return result
    }
    function check(name, passed) {
      report.assertions.push({ name, passed: Boolean(passed) })
    }
    if (isFourOperations) {
      report.dataDirectory = runDirectory
      report.method =
        '真实 DSH SDK Agent 会话、原生事件和插件自动学习；脚本只发送用户消息，不伪造助手回复或调用学习器。'
      const conversation = await agent('four-operations')
      const added = await turn(
        conversation,
        '新增约定',
        '我们给当前项目定一个内部演练代号，叫“雾蓝灯塔”。这是今后这个项目里使用的约定，只适用于当前项目。简单回应即可。',
      )
      const original = added.memories.find(
        (memory) => memory.status === 'active' && memory.text.includes('雾蓝灯塔'),
      )
      check('ADD-automatic', added.audit.some((entry) => entry.action === 'ADD') && original)
      const repeated = await turn(
        conversation,
        '重复约定',
        '再确认一下，当前项目的内部演练代号还是“雾蓝灯塔”，和我前面说的完全一样，没有任何新变化。',
      )
      check(
        'NONE-no-memory-mutation',
        repeated.audit.every((entry) => entry.action === 'NONE'),
      )
      const corrected = await turn(
        conversation,
        '纠正约定',
        '我刚说错了，这个项目的内部演练代号应当是“云白灯塔”。之前“雾蓝灯塔”的说法不对，以这次纠正为准，只保留现在这个正确称呼。',
      )
      check(
        'UPDATE-existing-memory',
        corrected.audit.some(
          (entry) => entry.action === 'UPDATE' && entry.memory_id === original?.id,
        ),
      )
      const withdrawn = await turn(
        conversation,
        '撤销约定',
        '我们决定取消这个项目的内部演练代号了。“云白灯塔”这个约定完全作废，今后不使用任何内部演练代号，只用项目原名即可。这是临时试写，不需要保留为长期约定，也不用另外记录这件撤销的小事。',
      )
      check(
        'DELETE-invalidates-memory',
        withdrawn.audit.some((entry) => entry.action === 'DELETE'),
      )
      check(
        'old-memory-inactive',
        withdrawn.memories.find((memory) => memory.id === original?.id)?.status === 'inactive',
      )
      const newConversation = await agent('four-operations-verify')
      const verified = await turn(
        newConversation,
        '新会话检查',
        '当前项目的内部演练代号是什么？如果没有可靠记录，请直接说不知道，不要编造。',
      )
      check(
        'inactive-memory-not-injected',
        !verified.contexts.some((assembly) =>
          assembly.sections.some(
            (section) => section.name === 'yuwen:memory' && /雾蓝灯塔|云白灯塔/.test(section.text),
          ),
        ),
      )
      const quiet = await turn(newConversation, '无信息交流', '好的，谢谢，先这样。')
      check(
        'small-talk-no-memory-mutation',
        quiet.audit.every((entry) => entry.action === 'NONE'),
      )
      check(
        'all-learning-jobs-completed',
        quiet.learningJobs.every((job) => job.status === 'done'),
      )
      report.completedAt = new Date().toISOString()
      report.memoryHistory = store.history()
      await fs.writeFile(
        'outputs/live-four-operations-report.json',
        JSON.stringify(report, null, 2),
      )
      console.log(JSON.stringify({ stage: 'complete', assertions: report.assertions }))
      return
    }
    const first = await agent('learn')
    const learned = await turn(
      first,
      'learn-fact-and-preference',
      '以后给我工作进度时，先写“结论：”，然后最多三个要点，不要反复道歉。我玩的虚构游戏《雾港》私服 1.0 里，回声戒指在满能量时额外触发一次技能，冷却 17 秒。先简单回应即可。',
    )
    check(
      'automatic-memory-created',
      learned.memories.some((memory) => memory.status === 'active' && /17/.test(memory.text)),
    )
    const second = await agent('recall')
    const recalled = await turn(
      second,
      'new-session-recall',
      '《雾港》私服 1.0 的回声戒指在满能量时怎么生效，冷却多久？按我平时喜欢的方式答复。',
    )
    check(
      'cross-session-fact-recalled',
      /17/.test(recalled.answer) && /额外|再|多/.test(recalled.answer),
    )
    check('preference-influenced-answer', /结论[：:]/.test(recalled.answer))
    const corrected = await turn(
      second,
      'correct-fact',
      '纠正一下，我之前记错了：这个私服 1.0 的回声戒指冷却是 23 秒，不是 17 秒，满能量额外触发一次的效果没变。请以这次纠正为准。',
    )
    check(
      'correction-persisted',
      corrected.memories.some((memory) => memory.status === 'active' && /23/.test(memory.text)),
    )
    const third = await agent('verify')
    const verified = await turn(
      third,
      'new-session-after-correction',
      '我之前聊过的《雾港》私服 1.0 回声戒指，现在确认的冷却时间是多少？',
    )
    check('corrected-recall', /23/.test(verified.answer))
    const failed = await turn(
      third,
      'failure-feedback',
      '刚才那次登录修复我验收了，还是失败。你太早宣布完成了。下次继续修这个项目时，请先复现并验证结果，再告诉我完成。返工直接查原因，不要反复道歉。',
    )
    check(
      'experience-or-self-observation',
      failed.memories.some(
        (memory) =>
          ['experience', 'self'].includes(memory.kind) && /验证|验收|登录/.test(memory.text),
      ),
    )
    check(
      'single-feedback-does-not-create-trait',
      store.traits({
        user: 'owner',
        persona: store.activePersona(),
        project: project.toLowerCase(),
      }).length === 0,
    )
    const fourth = await agent('feedback-recall')
    const followup = await turn(
      fourth,
      'new-session-work-plan',
      '继续上次的登录修复。先告诉我准备怎么推进，不要实际操作文件。',
    )
    check(
      'feedback-influences-next-plan',
      /复现|验证/.test(followup.answer) &&
        followup.contexts.some((entry) =>
          entry.sections.some(
            (section) => /登录/.test(section.text) && /失败|未完成|验收/.test(section.text),
          ),
        ),
    )
    const { defineTool } = await load('dsh-tools')
    let completedSteps = 0
    context.tools.register(
      defineTool({
        name: 'test_progress_step',
        description:
          '隔离测试工具，每次只完成一个编号步骤，按 1 到 7 顺序调用。不会访问文件或网络。',
        parameters: { step: { type: 'number', required: true, description: '当前步骤，1 到 7' } },
        output: {
          schema: { type: 'string' },
          render: (_args, value) => [{ type: 'text', text: value }],
        },
        async execute(args) {
          if (args.step !== completedSteps + 1 || args.step > 7)
            throw new Error('Steps must be sequential')
          completedSteps++
          if (completedSteps === 6) await waitForLearning()
          return `第 ${completedSteps} 步完成；${completedSteps < 7 ? '请调用下一步' : '七步全部完成，请报告结果'}`
        },
      }),
    )
    const longAgent = await agent('long-task')
    const long = await turn(
      longAgent,
      'long-task-checkpoint',
      '本项目的内部演练代号是“蓝鲸纸风车”，只适用于这个项目。现在调用 test_progress_step 工具顺序执行 1 到 7 步，每次只调用一步，等返回后再调用下一步，不要跳步。全部完成后简短报告。',
    )
    check('long-task-completed-seven-tool-steps', completedSteps === 7)
    check(
      'checkpoint-learning-before-turn-end',
      store.db
        .prepare('SELECT id,status FROM jobs WHERE id LIKE ?')
        .all(`${longAgent.id}:checkpoint:%`)
        .some((job) => job.status === 'done'),
    )
    check(
      'new-memory-injected-during-long-task',
      long.contexts
        .slice(1)
        .some((entry) =>
          entry.sections.some(
            (section) => section.name === 'yuwen:memory' && /蓝鲸纸风车/.test(section.text),
          ),
        ),
    )
    store.createPersona('隔离新伙伴')
    const fresh = await agent('fresh-persona')
    const isolated = await turn(
      fresh,
      'new-persona-isolation',
      '我玩的《雾港》私服 1.0 回声戒指冷却多少秒？如果没有可靠依据请直接说不知道。',
    )
    check(
      'new-persona-does-not-inherit-memory',
      !isolated.contexts.some((entry) =>
        entry.sections.some((section) => section.name === 'yuwen:memory'),
      ),
    )
    check(
      'all-learning-jobs-completed',
      store.db
        .prepare('SELECT status FROM jobs')
        .all()
        .every((job) => job.status === 'done'),
    )
    check(
      'corrected-fact-never-resurrected',
      !store
        .memories()
        .some((memory) => /回声戒指/.test(memory.text) && /17\s*秒/.test(memory.text)),
    )
    check(
      'temporary-tool-procedure-not-a-standing-rule',
      !store
        .memories()
        .some((memory) => memory.kind === 'cognition' && /test_progress_step/.test(memory.text)),
    )
    report.completedAt = new Date().toISOString()
    report.dataDirectory = runDirectory
    report.memoryHistory = store.history()
    await fs.mkdir('outputs', { recursive: true })
    await fs.writeFile('outputs/live-desktop-report.json', JSON.stringify(report, null, 2))
    console.log(
      JSON.stringify({
        stage: 'complete',
        model: report.model,
        assertions: report.assertions,
        report: 'outputs/live-desktop-report.json',
      }),
    )
    if (report.assertions.some((assertion) => !assertion.passed)) {
      process.exitCode = 1
    }
  } finally {
    await context.fiber.dispose()
    store?.close()
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      error: String(error.message).replace(/(?:sk-|pst-)[\w-]+/g, '[redacted]'),
      code: error.code,
    }),
  )
  process.exitCode = 1
})
