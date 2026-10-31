import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Engine } from '../companion/index.js'
import { createDashboard } from '../dashboard/index.js'
import { Learner, type Generator } from '../learning/index.js'
import { DEFAULT_SCOPE, type Scope, type Snapshot, type Source } from '../memory/index.js'
import { Store } from '../storage/index.js'
import { mountDashboard } from './dashboard-host.js'
import { learningCallOptions } from './model-options.js'

// DSH changes independently. The dynamic boundary supports the installed 0.1.5
// host and the newer assembly API without bundling a second Cordis runtime.
type Host = any
export const name = 'feed-the-seek'
export const inject = ['agents', 'systemPrompt', 'sessions', 'tools', 'llm']
export interface Config {
  dataDir?: string
  dashboardPort?: number
  checkpointsEvery?: number
}
async function hostModule(name: string) {
  const roots = [
    import.meta.url,
    pathToFileURL(join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'profiles', 'package.json'))
      .href,
  ]
  // Desktop owns its SDK. Do not accidentally load an older global CLI SDK.
  if (process.versions.electron) {
    roots.unshift(
      pathToFileURL(join(dirname(process.execPath), 'resources', 'app.asar', 'dsh', 'package.json'))
        .href,
    )
  }
  for (const root of roots) {
    try {
      const path = createRequire(root).resolve(name)
      return await import(pathToFileURL(path).href)
    } catch {
      /* Try the host-owned dependency tree. */
    }
  }
  throw new Error(`dsh-feed-the-seek无法加载宿主模块 ${name}`)
}
export function contentText(content: unknown): string {
  if (typeof content === 'string') {
    return content.slice(0, 8000)
  }
  if (!Array.isArray(content)) {
    return ''
  }
  return content
    .filter(
      (contentPart) =>
        contentPart && contentPart.type === 'text' && typeof contentPart.text === 'string',
    )
    .map((contentPart) => contentPart.text)
    .join('\n')
    .slice(0, 8000)
}
// Only location-like arguments are kept; commands, contents and anything else may hold secrets.
const traceArgumentKeys = [
  'path',
  'file',
  'filePath',
  'file_path',
  'directory',
  'dir',
  'cwd',
  'pattern',
  'query',
  'url',
]
export function traceLine(
  event: { type: string; seq: number; data?: any },
  names: Map<string, string>,
): string {
  const data = event.data || {}
  const step = typeof data.step === 'number' ? `第${data.step}步 ` : ''
  if (event.type === 'tool/call') {
    const name = String(data.name || '未知工具')
    if (data.callId) {
      names.set(String(data.callId), name)
    }
    const args = data.arguments && typeof data.arguments === 'object' ? data.arguments : {}
    const shown = traceArgumentKeys
      .filter((key) => typeof args[key] === 'string')
      .map((key) => `${key}=${String(args[key]).slice(0, 60)}`)
    return `#${event.seq} ${step}调用 ${name}${shown.length ? `（${shown.join('，')}）` : ''}`
  }
  if (event.type === 'tool/result') {
    const callId = data.message?.toolCallId ?? data.message?.source?.callId
    const name = (callId && names.get(String(callId))) || '工具'
    if (callId) {
      names.delete(String(callId))
    }
    const code = data.error?.code || data.error?.name
    return `#${event.seq} ${step}${name} ${data.message?.isError ? `失败${code ? `（${String(code).slice(0, 40)}）` : ''}` : '成功'}`
  }
  return ''
}
const GUIDANCE =
  'dsh-feed-the-seek提供跨会话的长期资料与往日记忆。只把它作为协作参考，当前用户要求优先。明确区分已确认偏好与推测。近期拟人状态应自然、克制，不制造负担，不改变操作权限或降低工作质量。需要更早或更细的记忆时可调用 feed_the_seek_recall。记忆由插件在后台自动整理；没有手动写入工具不代表无法记录或纠正。后台结果未确认时，不声称已经持久化成功；先按用户的新信息执行。不要把自动注入的记忆当作新的用户话语再次记忆。'
/** Source kind of the profile message; DSH keeps it in history like its own AGENTS.md messages. */
export const PROFILE_SOURCE = 'feed-the-seek-profile'
export const PROFILE_CLEARED = '（长期记忆：目前没有需要常驻的内容，之前的常驻记忆不再适用。）'
function textOf(message: Host): string {
  const [block] = message?.content || []
  return message?.content?.length === 1 && block?.type === 'text' ? String(block.text) : ''
}
/** The newest profile message still on the session surface; undefined when none survives (or the host cannot tell). */
export function visibleProfile(agent: Host): string | undefined {
  const session = agent?.session
  const nodes: unknown[] | undefined = session?.surface?.nodes
  if (!Array.isArray(nodes) || typeof session.eventAt !== 'function') {
    return undefined
  }
  for (let index = nodes.length - 1; index >= 0; index--) {
    const event = session.eventAt(nodes[index])
    if (event?.type === 'user/message' && event.data?.source?.kind === PROFILE_SOURCE) {
      return textOf(event.data)
    }
  }
  return undefined
}
export function usedItems(snapshot: Snapshot) {
  return snapshot.items
    .filter((item) =>
      item.reasons.some((reason) => reason.startsWith('关键词') || reason.startsWith('语义')),
    )
    .map((item) => item.memory)
}
/** Memory is not split by project: every conversation sees the same companion. */
function projectScope(_agent: Host): Scope {
  return { ...DEFAULT_SCOPE }
}
/** Folder name of the conversation, passed to the organizer only to name project conventions. */
function workspaceOf(agent: Host): string {
  const cwd = agent.session?.header?.cwd
  return typeof cwd === 'string' ? basename(resolve(cwd)) : ''
}
export async function apply(context: Host, config: Config = {}) {
  const { defineTool } = await hostModule('@deepseek-ai/dsh-tools')
  const { createUserMessage } = await hostModule('@deepseek-ai/dsh-llm')
  const dir =
    config.dataDir || join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'feed-the-seek')
  const store = new Store(join(dir, 'memory.sqlite'))
  const engine = new Engine(store)
  context.inject(['credentials'], (credentialContext: Host) => {
    engine.credentials = credentialContext.credentials
    credentialContext.on('dispose', () => {
      engine.credentials = undefined
    })
  })
  const scopeOf = (agent: Host): Scope => ({
    ...projectScope(agent),
    persona: store.bindSession(String(agent.id)),
  })
  const latest = new Map<string, string>()
  const buffers = new Map<string, Source[]>()
  const snapshots = new Map<string, Snapshot>()
  const mounted = new Map<string, (() => void)[]>()
  const turns = new Map<string, string>()
  const learner = new Learner(engine, (job) => {
    if (!job.provider || !job.model) {
      return
    }
    const generate: Generator = async (system, user, signal) => {
      let text = ''
      let finished = false
      let usage = {}
      try {
        const callOptions = await learningCallOptions(
          context.llm,
          job.provider!,
          job.model!,
          signal,
        )
        for await (const chunk of context.llm.stream({
          provider: job.provider,
          model: job.model,
          system,
          messages: [
            createUserMessage({
              content: [{ type: 'text', text: user }],
              source: { kind: 'user' },
            }),
          ],
          ...callOptions,
          signal,
        })) {
          if (chunk.type === 'text-delta') {
            text += chunk.text
          }
          if (chunk.type === 'usage') {
            usage = chunk.usage
          }
          if (chunk.type === 'finish') {
            const reason = typeof chunk.reason === 'string' ? chunk.reason : chunk.reason?.kind
            if (reason !== 'stop') {
              throw new Error(`记忆整理未完整结束：${reason || 'unknown'}`)
            }
            finished = true
          }
        }
        if (!finished) {
          throw new Error('记忆整理流未正常结束')
        }
        return text
      } finally {
        store.recordLearningUsage(job.scope, usage, finished)
      }
    }
    return generate
  })
  // Compact tool trace of the current turn: order, tool name, success. Never tool output,
  // never full arguments. It lets the organizer check what the assistant actually did.
  const traces = new Map<string, { seq: number; line: string }[]>()
  const traceSubmitted = new Map<string, { seq: number; sources: Source[] }>()
  const toolNames = new Map<string, string>()
  // Source ids of this turn already handed to a checkpoint job. A later checkpoint or the
  // turn-end job sends them only as context, so the same words are not learned twice.
  const submitted = new Map<string, Set<string>>()
  function enqueue(agent: Host, key: string) {
    const id = String(agent.id)
    if (!store.sessionEnabled(id)) {
      return
    }
    const events = buffers.get(id) || []
    const human = events.findLast((candidateSource) => candidateSource.role === 'user')
    const window = events.slice(-11)
    if (human && !window.some((candidateSource) => candidateSource.id === human.id)) {
      window.unshift(human)
    }
    if (!window.some((candidateSource) => candidateSource.role === 'user')) {
      return
    }
    const seen = submitted.get(id) || new Set<string>()
    const fresh = window.filter((candidateSource) => !seen.has(candidateSource.id))
    // Rule-based gate: a mid-turn checkpoint only runs when the user said something new. Pure tool
    // work waits for the turn end, where it is organized once together with the rest of the turn.
    if (
      key.startsWith('checkpoint:') &&
      !fresh.some((candidateSource) => candidateSource.role === 'user')
    ) {
      return
    }
    const traced = traceSubmitted.get(id) || { seq: -1, sources: [] }
    const newTrace = (traces.get(id) || []).filter((entry) => entry.seq > traced.seq).slice(-40)
    if (newTrace.length) {
      const first = newTrace[0].seq
      const last = newTrace.at(-1)!.seq
      fresh.push({
        id: `${id}:trace:${first}-${last}`,
        session: id,
        event: turns.get(id) || `${id}:trace`,
        scope: scopeOf(agent),
        role: 'tool',
        text:
          '工具调用轨迹（#事件序号，按发生顺序；只含工具名与成败）\n' +
          newTrace.map((entry) => entry.line).join('\n'),
        at: new Date().toISOString(),
      })
    }
    if (!fresh.length) {
      return
    }
    const context = [
      ...window.filter((candidateSource) => seen.has(candidateSource.id)),
      ...traced.sources,
    ]
    for (const source of fresh) {
      seen.add(source.id)
    }
    submitted.set(id, seen)
    if (newTrace.length) {
      traceSubmitted.set(id, {
        seq: newTrace.at(-1)!.seq,
        sources: [...traced.sources, fresh.at(-1)!],
      })
    }
    const header = agent.session?.requestHeader?.()?.config || agent.options || {}
    learner.enqueue({
      id: `${id}:${key}`,
      scope: scopeOf(agent),
      sources: fresh,
      context,
      provider: header.provider,
      model: header.model,
      workspace: workspaceOf(agent),
    })
  }
  // Three layers, by how often they change (DSH keeps the conversation history itself):
  //  stable  – who she is / who you are; a compact runtime block, frozen within the turn.
  //            Never embed changing data in the host's entire system prompt: in-history models
  //            would append another full system prompt after every profile update.
  //  turn    – topical memories, recent changes, mood; a runtime-context snapshot that DSH appends
  //            to history only when its text changes. Recomputed only for a new user message.
  //  demand  – feed_the_seek_recall, when the model decides it needs more.
  const stable = new Map<string, { text: string; ids: Set<string> }>()
  const recallDirty = new Set<string>()
  // Until the history is compacted, memories learned in this session are already visible as the
  // original messages; injecting them again would only duplicate (or contradict) the history.
  const compacted = new Set<string>()
  const refreshStable = (agent: Host) => {
    stable.set(String(agent.id), engine.stableContext(scopeOf(agent)))
  }
  // Every runtime-context contribution is re-sent as one full snapshot whenever any part of it
  // changes, and topical memory changes on almost every message. Carried there, the whole profile
  // would be re-appended to history each turn. Newer agent loops expose agent/pre-step, so the
  // profile travels as its own message instead — sent once, and again only when it changes or
  // compaction removed it, the way DSH delivers AGENTS.md. Older hosts keep the context path.
  let preStepSeen = false
  const profileAsMessage = (agent: Host) =>
    preStepSeen ||
    (!!agent && typeof agent === 'object' && 'runtimeContext' in agent && 'inbox' in agent)
  function mount(agent: Host) {
    const id = String(agent.id)
    if (mounted.has(id) || agent.session?.header?.origin === 'subagent') {
      return
    }
    refreshStable(agent)
    const off = agent.ctx.systemPrompt.section({
      name: 'feed-the-seek:guidance',
      order: 10300,
      interpolate: false,
      text: () => {
        if (!store.sessionEnabled(id)) {
          return ''
        }
        return GUIDANCE
      },
    })
    mounted.set(id, [off])
  }
  const disposers: (() => void)[] = []
  disposers.push(context.on('agent/created', ({ agent }: Host) => mount(agent)))
  for (const agent of context.agents.list()) {
    mount(agent)
  }
  disposers.push(
    context.on('agent/inbox/claimed', ({ agent, message }: Host) => {
      if (message.source?.kind === 'user') {
        const id = String(agent.id)
        latest.set(id, contentText(message.content))
        recallDirty.add(id)
      }
    }),
  )
  disposers.push(
    context.on(
      'system-prompt/assemble',
      async (_assembly: Host, context: Host, next: () => Promise<Host>) => {
        const assembled = await next()
        const agent = context.agent
        if (!agent || !mounted.has(String(agent.id)) || !store.sessionEnabled(String(agent.id))) {
          return assembled
        }
        const id = String(agent.id)
        const query = latest.get(id) || ''
        try {
          let snapshot = snapshots.get(id)
          // Background learning mid-turn does not trigger a new snapshot: each change would append
          // another full copy to the history. A new user message (or a compaction) does.
          if (!snapshot || snapshot.query !== query || recallDirty.has(id)) {
            recallDirty.delete(id)
            snapshot = await engine.recall(scopeOf(agent), query, context.signal, {
              excludeIds: stable.get(id)?.ids,
              excludeSessions: compacted.has(id) ? undefined : new Set([id]),
            })
            snapshots.set(id, snapshot)
            // Only topic-matched memories count as used; fixed profile display does not reinforce.
            if (turns.has(id)) {
              store.use(usedItems(snapshot), turns.get(id)!)
            }
          }
          const profile = stable.get(id)?.text
          if (profile && !profileAsMessage(agent)) {
            assembled.contexts.push({
              name: 'feed-the-seek:profile',
              order: 940,
              text: profile,
              interpolate: false,
            })
          }
          if (snapshot.context) {
            assembled.contexts.push({
              name: 'feed-the-seek:memory',
              order: 950,
              text: snapshot.context,
              interpolate: false,
            })
          }
        } catch (error) {
          if (context.signal?.aborted) {
            throw error
          }
          console.warn('[dsh-feed-the-seek] 本轮记忆读取失败，继续原任务')
        }
        return assembled
      },
    ),
  )
  disposers.push(
    context.on('agent/pre-step', async (input: Host, next: () => Promise<Host>) => {
      preStepSeen = true
      const decision = await next()
      const agent = input?.agent
      if (!agent || !decision || decision.kind === 'reject' || !Array.isArray(decision.messages)) {
        return decision
      }
      const id = String(agent.id)
      if (!mounted.has(id)) {
        return decision
      }
      // Nothing enters this step (the host would not open a request): nothing to attach to.
      if (input.step === 1 && decision.messages.length === 0) {
        return decision
      }
      const visible = visibleProfile(agent)
      const desired = store.sessionEnabled(id) ? stable.get(id)?.text || '' : ''
      // A profile that went away is withdrawn explicitly; the old message stays in history otherwise.
      const target = desired || (visible ? PROFILE_CLEARED : '')
      if (
        !target ||
        visible === target ||
        decision.messages.some(
          (message: Host) => message?.source?.kind === PROFILE_SOURCE && textOf(message) === target,
        )
      ) {
        return decision
      }
      const message = createUserMessage({
        content: [{ type: 'text', text: target }],
        source: { kind: PROFILE_SOURCE },
      })
      const claimed: Host[] = Array.isArray(input.messages) ? input.messages : []
      const after = decision.messages.findLastIndex((entry: Host) => claimed.includes(entry))
      return { ...decision, messages: decision.messages.toSpliced(after + 1, 0, message) }
    }),
  )
  disposers.push(
    context.on('session/event', (session: Host, event: Host) => {
      const id = String(session.id || session.header?.id)
      const agent = context.agents.get(id)
      if (!agent || !mounted.has(id) || !store.sessionEnabled(id)) {
        return
      }
      if (event.type === 'compaction/end') {
        refreshStable(agent)
        compacted.add(id)
        recallDirty.add(id)
      }
      if (event.type === 'turn/start') {
        refreshStable(agent)
        buffers.set(id, [])
        submitted.delete(id)
        traces.delete(id)
        traceSubmitted.delete(id)
        turns.set(id, `${id}:turn:${event.seq}`)
      }
      if (event.type === 'tool/call' || event.type === 'tool/result') {
        const line = traceLine(event, toolNames)
        if (line) {
          const list = traces.get(id) || []
          list.push({ seq: Number(event.seq), line })
          traces.set(id, list.slice(-200))
        }
      }
      const message = event.type === 'user/message' ? event.data : event.data?.message
      const human = event.type === 'user/message' && message?.source?.kind === 'user'
      const assistant = event.type === 'assistant/message' && !event.data.interrupted
      if (human || assistant) {
        const text = contentText(message?.content)
        if (text) {
          const source: Source = {
            id: `${id}:${event.seq}`,
            session: id,
            event: turns.get(id) || `${id}:message:${event.seq}`,
            scope: scopeOf(agent),
            role: human ? 'user' : 'assistant',
            text,
            at: new Date(event.time || Date.now()).toISOString(),
          }
          const list = buffers.get(id) || []
          list.push(source)
          buffers.set(id, list)
          if (human) {
            latest.set(id, text)
            recallDirty.add(id)
          }
        }
      }
      // One organizer call per ordinary turn. Long-running hosts can explicitly opt into checkpoints.
      if (
        event.type === 'step/end' &&
        config.checkpointsEvery &&
        config.checkpointsEvery >= 2 &&
        event.data.step % config.checkpointsEvery === 0
      ) {
        enqueue(agent, `checkpoint:${event.seq}`)
      }
      if (event.type === 'turn/end') {
        enqueue(agent, `turn:${event.seq}`)
        buffers.delete(id)
        submitted.delete(id)
        traces.delete(id)
        traceSubmitted.delete(id)
        turns.delete(id)
      }
    }),
  )
  disposers.push(
    context.on('agent/disposed', ({ agent }: Host) => {
      const id = String(agent.id)
      mounted.get(id)?.forEach((off) => off())
      mounted.delete(id)
      latest.delete(id)
      snapshots.delete(id)
      stable.delete(id)
      recallDirty.delete(id)
      compacted.delete(id)
      buffers.delete(id)
      submitted.delete(id)
      traces.delete(id)
      traceSubmitted.delete(id)
      turns.delete(id)
    }),
  )
  disposers.push(
    context.tools.register(
      defineTool({
        name: 'feed_the_seek_recall',
        description:
          '检索当前角色记住的知识、规则、用户偏好、共同经历与自我观察。主题变化或已有上下文不足时调用。',
        parameters: {
          query: { type: 'string', required: true, description: '当前需要回忆的具体主题' },
        },
        output: {
          schema: { type: 'string' },
          render: (_args: unknown, value: string) => [{ type: 'text', text: value }],
        },
        async execute(args: { query: string }, exec: Host) {
          if (!exec.agent || !store.sessionEnabled(String(exec.agent.id))) {
            return '本会话未启用dsh-feed-the-seek。'
          }
          const id = String(exec.agent.id)
          const snapshot = await engine.recall(
            scopeOf(exec.agent),
            args.query.slice(0, 4000),
            exec.signal,
            { deliberate: true },
          )
          // A deliberate recall is a real use: it keeps the memory alive.
          store.use(usedItems(snapshot), `${turns.get(id) || id}:recall`)
          return snapshot.context || '没有找到适用的历史记录，请依据当前对话继续。'
        },
      }),
    ),
  )
  const dashboard = createDashboard(engine, {
    demo: false,
    port: config.dashboardPort ?? 4319,
    retry: (scope) => learner.retry(scope),
  })
  await mountDashboard(context, dashboard, {
    isDesktop: Boolean(process.versions.electron),
    port: config.dashboardPort ?? 4319,
    dataDirectory: dir,
  })
  void learner.drain()
  context.on('dispose', async () => {
    disposers.forEach((off) => off())
    mounted.forEach((offs) => offs.forEach((off) => off()))
    await learner.close()
    await new Promise<void>((ok) => dashboard.server.close(() => ok()))
    store.close()
  })
}
