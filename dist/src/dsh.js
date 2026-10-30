import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Store } from './store.js';
import { Engine } from './engine.js';
import { Learner } from './learning.js';
import { learningCallOptions } from './learning-model.js';
import { createDashboard } from './server.js';
import { mountDashboard } from './dashboard-host.js';
import { DEFAULT_SCOPE } from './types.js';
export const name = 'yuwen';
export const inject = ['agents', 'systemPrompt', 'sessions', 'tools', 'llm'];
async function hostModule(name) {
    const roots = [import.meta.url, pathToFileURL(join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'profiles', 'package.json')).href];
    // Desktop owns its SDK. Do not accidentally load an older global CLI SDK.
    if (process.versions.electron)
        roots.unshift(pathToFileURL(join(dirname(process.execPath), 'resources', 'app.asar', 'dsh', 'package.json')).href);
    for (const root of roots) {
        try {
            const path = createRequire(root).resolve(name);
            return await import(pathToFileURL(path).href);
        }
        catch { /* Try the host-owned dependency tree. */ }
    }
    throw new Error(`dsh-feed-the-seek无法加载宿主模块 ${name}`);
}
export function contentText(content) {
    if (typeof content === 'string')
        return content.slice(0, 8000);
    if (!Array.isArray(content))
        return '';
    return content.filter(x => x && x.type === 'text' && typeof x.text === 'string').map(x => x.text).join('\n').slice(0, 8000);
}
// Only location-like arguments are kept; commands, contents and anything else may hold secrets.
const traceArgumentKeys = ['path', 'file', 'filePath', 'file_path', 'directory', 'dir', 'cwd', 'pattern', 'query', 'url'];
export function traceLine(event, names) {
    const data = event.data || {};
    const step = typeof data.step === 'number' ? `第${data.step}步 ` : '';
    if (event.type === 'tool/call') {
        const name = String(data.name || '未知工具');
        if (data.callId)
            names.set(String(data.callId), name);
        const args = data.arguments && typeof data.arguments === 'object' ? data.arguments : {};
        const shown = traceArgumentKeys.filter(key => typeof args[key] === 'string').map(key => `${key}=${String(args[key]).slice(0, 60)}`);
        return `#${event.seq} ${step}调用 ${name}${shown.length ? `（${shown.join('，')}）` : ''}`;
    }
    if (event.type === 'tool/result') {
        const callId = data.message?.toolCallId ?? data.message?.source?.callId;
        const name = (callId && names.get(String(callId))) || '工具';
        if (callId)
            names.delete(String(callId));
        const code = data.error?.code || data.error?.name;
        return `#${event.seq} ${step}${name} ${data.message?.isError ? `失败${code ? `（${String(code).slice(0, 40)}）` : ''}` : '成功'}`;
    }
    return '';
}
const GUIDANCE = 'dsh-feed-the-seek提供跨会话的长期资料与往日记忆。只把它作为协作参考，当前用户要求优先。明确区分已确认偏好与推测。近期拟人状态应自然、克制，不制造负担，不改变操作权限或降低工作质量。需要更早或更细的记忆时可调用 yuwen_recall。记忆由插件在后台自动整理；没有手动写入工具不代表无法记录或纠正。后台结果未确认时，不声称已经持久化成功；先按用户的新信息执行。不要把自动注入的记忆当作新的用户话语再次记忆。';
export function usedItems(snapshot) {
    return snapshot.items.filter(item => item.reasons.some(reason => reason.startsWith('关键词') || reason.startsWith('语义'))).map(item => item.memory);
}
function projectScope(agent) {
    const cwd = agent.session?.header?.cwd;
    return { ...DEFAULT_SCOPE, project: typeof cwd === 'string' ? (process.platform === 'win32' ? resolve(cwd).toLowerCase() : resolve(cwd)) : '' };
}
export async function apply(ctx, config = {}) {
    const { defineTool } = await hostModule('@deepseek-ai/dsh-tools');
    const { createUserMessage } = await hostModule('@deepseek-ai/dsh-llm');
    const dir = config.dataDir || join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'yuwen');
    const store = new Store(join(dir, 'memory.sqlite'));
    const engine = new Engine(store);
    ctx.inject(['credentials'], (credentialContext) => {
        engine.credentials = credentialContext.credentials;
        credentialContext.on('dispose', () => { engine.credentials = undefined; });
    });
    const scopeOf = (agent) => ({ ...projectScope(agent), persona: store.bindSession(String(agent.id)) });
    const latest = new Map();
    const buffers = new Map();
    const snapshots = new Map();
    const mounted = new Map();
    const turns = new Map();
    const learner = new Learner(engine, job => {
        if (!job.provider || !job.model)
            return;
        const generate = async (system, user, signal) => {
            let text = '';
            let finished = false;
            const callOptions = await learningCallOptions(ctx.llm, job.provider, job.model, signal);
            for await (const chunk of ctx.llm.stream({ provider: job.provider, model: job.model, system,
                messages: [createUserMessage({ content: [{ type: 'text', text: user }], source: { kind: 'user' } })], ...callOptions, signal })) {
                if (chunk.type === 'text-delta')
                    text += chunk.text;
                if (chunk.type === 'finish') {
                    const reason = typeof chunk.reason === 'string' ? chunk.reason : chunk.reason?.kind;
                    if (reason !== 'stop')
                        throw new Error(`记忆整理未完整结束：${reason || 'unknown'}`);
                    finished = true;
                }
            }
            if (!finished)
                throw new Error('记忆整理流未正常结束');
            return text;
        };
        return generate;
    });
    // Compact tool trace of the current turn: order, tool name, success. Never tool output,
    // never full arguments. It lets the organizer check what the assistant actually did.
    const traces = new Map();
    const traceSubmitted = new Map();
    const toolNames = new Map();
    // Source ids of this turn already handed to a checkpoint job. A later checkpoint or the
    // turn-end job sends them only as context, so the same words are not learned twice.
    const submitted = new Map();
    function enqueue(agent, key) {
        const id = String(agent.id);
        if (!store.sessionEnabled(id))
            return;
        const events = buffers.get(id) || [];
        const human = events.findLast(s => s.role === 'user');
        const window = events.slice(-11);
        if (human && !window.some(s => s.id === human.id))
            window.unshift(human);
        if (!window.some(s => s.role === 'user'))
            return;
        const seen = submitted.get(id) || new Set();
        const fresh = window.filter(s => !seen.has(s.id));
        // Rule-based gate: a mid-turn checkpoint only runs when the user said something new. Pure tool
        // work waits for the turn end, where it is organized once together with the rest of the turn.
        if (key.startsWith('checkpoint:') && !fresh.some(s => s.role === 'user'))
            return;
        const traced = traceSubmitted.get(id) || { seq: -1, sources: [] };
        const newTrace = (traces.get(id) || []).filter(entry => entry.seq > traced.seq).slice(-40);
        if (newTrace.length) {
            const first = newTrace[0].seq, last = newTrace.at(-1).seq;
            fresh.push({ id: `${id}:trace:${first}-${last}`, session: id, event: turns.get(id) || `${id}:trace`, scope: scopeOf(agent), role: 'tool',
                text: '工具调用轨迹（#事件序号，按发生顺序；只含工具名与成败）\n' + newTrace.map(entry => entry.line).join('\n'), at: new Date().toISOString() });
        }
        if (!fresh.length)
            return;
        const context = [...window.filter(s => seen.has(s.id)), ...traced.sources];
        for (const source of fresh)
            seen.add(source.id);
        submitted.set(id, seen);
        if (newTrace.length)
            traceSubmitted.set(id, { seq: newTrace.at(-1).seq, sources: [...traced.sources, fresh.at(-1)] });
        const header = agent.session?.requestHeader?.()?.config || agent.options || {};
        learner.enqueue({ id: `${id}:${key}`, scope: scopeOf(agent), sources: fresh, context, provider: header.provider, model: header.model });
    }
    // Three layers, by how often they change (DSH keeps the conversation history itself):
    //  stable  – who she is / who you are; in the system section at the head of every request.
    //            Recomputed only at turn boundaries so the prompt prefix stays cacheable.
    //  turn    – topical memories, recent changes, mood; a runtime-context snapshot that DSH appends
    //            to history only when its text changes. Recomputed only for a new user message.
    //  demand  – yuwen_recall, when the model decides it needs more.
    const stable = new Map();
    const recallDirty = new Set();
    // Until the history is compacted, memories learned in this session are already visible as the
    // original messages; injecting them again would only duplicate (or contradict) the history.
    const compacted = new Set();
    const refreshStable = (agent) => { stable.set(String(agent.id), engine.stableContext(scopeOf(agent))); };
    function mount(agent) {
        const id = String(agent.id);
        if (mounted.has(id) || agent.session?.header?.origin === 'subagent')
            return;
        refreshStable(agent);
        const off = agent.ctx.systemPrompt.section({ name: 'yuwen:guidance', order: 10300, interpolate: false,
            text: () => {
                if (!store.sessionEnabled(id))
                    return '';
                const layer = stable.get(id)?.text;
                return GUIDANCE + (layer ? '\n\n' + layer : '');
            } });
        mounted.set(id, [off]);
    }
    const disposers = [];
    disposers.push(ctx.on('agent/created', ({ agent }) => mount(agent)));
    for (const agent of ctx.agents.list())
        mount(agent);
    disposers.push(ctx.on('agent/inbox/claimed', ({ agent, message }) => {
        if (message.source?.kind === 'user') {
            const id = String(agent.id);
            latest.set(id, contentText(message.content));
            recallDirty.add(id);
        }
    }));
    disposers.push(ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
        const assembled = await next();
        const agent = context.agent;
        if (!agent || !mounted.has(String(agent.id)) || !store.sessionEnabled(String(agent.id)))
            return assembled;
        const id = String(agent.id);
        const query = latest.get(id) || '';
        try {
            let snapshot = snapshots.get(id);
            // Background learning mid-turn does not trigger a new snapshot: each change would append
            // another full copy to the history. A new user message (or a compaction) does.
            if (!snapshot || snapshot.query !== query || recallDirty.has(id)) {
                recallDirty.delete(id);
                snapshot = await engine.recall(scopeOf(agent), query, context.signal, {
                    excludeIds: stable.get(id)?.ids, excludeSessions: compacted.has(id) ? undefined : new Set([id]),
                });
                snapshots.set(id, snapshot);
                // Only topic-matched memories count as used; fixed profile display does not reinforce.
                if (turns.has(id))
                    store.use(usedItems(snapshot), turns.get(id));
            }
            if (snapshot.context)
                assembled.contexts.push({ name: 'yuwen:memory', order: 950, text: snapshot.context, interpolate: false });
        }
        catch (error) {
            if (context.signal?.aborted)
                throw error;
            console.warn('[dsh-feed-the-seek] 本轮记忆读取失败，继续原任务');
        }
        return assembled;
    }));
    disposers.push(ctx.on('session/event', (session, event) => {
        const id = String(session.id || session.header?.id);
        const agent = ctx.agents.get(id);
        if (!agent || !mounted.has(id) || !store.sessionEnabled(id))
            return;
        if (event.type === 'compaction/end') {
            compacted.add(id);
            recallDirty.add(id);
        }
        if (event.type === 'turn/start') {
            refreshStable(agent);
            buffers.set(id, []);
            submitted.delete(id);
            traces.delete(id);
            traceSubmitted.delete(id);
            turns.set(id, `${id}:turn:${event.seq}`);
        }
        if (event.type === 'tool/call' || event.type === 'tool/result') {
            const line = traceLine(event, toolNames);
            if (line) {
                const list = traces.get(id) || [];
                list.push({ seq: Number(event.seq), line });
                traces.set(id, list.slice(-200));
            }
        }
        const message = event.type === 'user/message' ? event.data : event.data?.message;
        const human = event.type === 'user/message' && message?.source?.kind === 'user';
        const assistant = event.type === 'assistant/message' && !event.data.interrupted;
        if (human || assistant) {
            const text = contentText(message?.content);
            if (text) {
                const source = { id: `${id}:${event.seq}`, session: id, event: turns.get(id) || `${id}:message:${event.seq}`, scope: scopeOf(agent), role: human ? 'user' : 'assistant', text, at: new Date(event.time || Date.now()).toISOString() };
                const list = buffers.get(id) || [];
                list.push(source);
                buffers.set(id, list);
                if (human) {
                    latest.set(id, text);
                    recallDirty.add(id);
                }
            }
        }
        if (event.type === 'step/end' && event.data.step % Math.max(2, config.checkpointsEvery || 5) === 0)
            enqueue(agent, `checkpoint:${event.seq}`);
        if (event.type === 'turn/end') {
            enqueue(agent, `turn:${event.seq}`);
            buffers.delete(id);
            submitted.delete(id);
            traces.delete(id);
            traceSubmitted.delete(id);
            turns.delete(id);
        }
    }));
    disposers.push(ctx.on('agent/disposed', ({ agent }) => {
        const id = String(agent.id);
        mounted.get(id)?.forEach(off => off());
        mounted.delete(id);
        latest.delete(id);
        snapshots.delete(id);
        stable.delete(id);
        recallDirty.delete(id);
        compacted.delete(id);
        buffers.delete(id);
        submitted.delete(id);
        traces.delete(id);
        traceSubmitted.delete(id);
        turns.delete(id);
    }));
    disposers.push(ctx.tools.register(defineTool({
        name: 'yuwen_recall', description: '检索当前角色记住的知识、规则、用户偏好、共同经历与自我观察。主题变化或已有上下文不足时调用。',
        parameters: { query: { type: 'string', required: true, description: '当前需要回忆的具体主题' } },
        output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
        async execute(args, exec) {
            if (!exec.agent || !store.sessionEnabled(String(exec.agent.id)))
                return '本会话未启用dsh-feed-the-seek。';
            const id = String(exec.agent.id);
            const snapshot = await engine.recall(scopeOf(exec.agent), args.query.slice(0, 4000), exec.signal, { deliberate: true });
            // A deliberate recall is a real use: it keeps the memory alive.
            store.use(usedItems(snapshot), `${turns.get(id) || id}:recall`);
            return snapshot.context || '没有找到适用的历史记录，请依据当前对话继续。';
        },
    })));
    const dashboard = createDashboard(engine, { demo: false, port: config.dashboardPort ?? 4319, retry: () => learner.retry(),
        sessions: () => ctx.agents.list().filter((agent) => mounted.has(String(agent.id))).map((agent) => ({ id: String(agent.id), project: scopeOf(agent).project, persona: scopeOf(agent).persona, enabled: store.sessionEnabled(String(agent.id)) })) });
    await mountDashboard(ctx, dashboard, {
        isDesktop: Boolean(process.versions.electron),
        port: config.dashboardPort ?? 4319,
        dataDirectory: dir,
    });
    void learner.drain();
    ctx.on('dispose', async () => {
        disposers.forEach(off => off());
        mounted.forEach(offs => offs.forEach(off => off()));
        await learner.close();
        await new Promise(ok => dashboard.server.close(() => ok()));
        store.close();
    });
}
//# sourceMappingURL=dsh.js.map