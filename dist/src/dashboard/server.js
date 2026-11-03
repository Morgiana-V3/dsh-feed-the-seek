import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { DEMO_SCOPE, demoStep } from '../demo/index.js';
import { ApiKey, embeddingKeyReference, makeEmbedder, resolveEmbeddingKey, testEmbeddingConnection, } from '../embedding/index.js';
import { moodAsset, moodLabels, pickDisplayedMood, strengthLabel, } from '../emotion/index.js';
import { DEFAULT_SCOPE, isForgotten, isRecallable, sameOwner, Scope, } from '../memory/index.js';
import { loadPersona, PERSONA, personaHistory, SELF_LIMIT } from '../persona/index.js';
import { Settings } from '../settings/index.js';
async function jsonBody(request) {
    let body = '';
    for await (const chunk of request) {
        body += chunk;
        if (Buffer.byteLength(body) > 64000) {
            throw new Error('请求过大');
        }
    }
    return JSON.parse(body || '{}');
}
function validRequestHost(host, mounted) {
    if (!host || /[\s/@\\?#,]/.test(host)) {
        return false;
    }
    try {
        const address = new URL(`http://${host}`);
        // Mounted routes inherit DSH's host/authentication policy. Only the separate
        // loopback dashboard needs its own DNS-rebinding host restriction.
        return mounted || ['127.0.0.1', 'localhost', '[::1]'].includes(address.hostname);
    }
    catch {
        return false;
    }
}
function matchesRequestOrigin(origin, host, mounted) {
    try {
        const source = new URL(origin);
        if (source.protocol !== 'http:' && !(mounted && source.protocol === 'https:')) {
            return false;
        }
        // TLS can terminate at the reverse proxy. Compare the public authority using
        // the browser's scheme; do not trust arbitrary X-Forwarded-Host headers.
        return (source.origin === origin && source.origin === new URL(`${source.protocol}//${host}`).origin);
    }
    catch {
        return false;
    }
}
/**
 * Index coverage for the configured model only. Vectors of an earlier model or dimension stay
 * in the table but are never used, so counting them would overstate what semantic recall can find.
 */
function vectorCoverage(engine, settings, memories) {
    const active = memories.filter((candidateMemory) => candidateMemory.status === 'active');
    let key;
    try {
        key = makeEmbedder(settings)?.key;
    }
    catch {
        key = undefined;
    }
    const versions = key ? engine.store.vectorVersions(key) : new Map();
    const count = active.filter((candidateMemory) => versions.get(candidateMemory.id) === candidateMemory.version).length;
    return { count, total: active.length };
}
/** Validation details from zod are English JSON; only our own Chinese messages are shown as-is. */
function errorMessage(error) {
    if (error instanceof z.ZodError) {
        const own = error.issues
            .map((issue) => issue.message)
            .find((message) => /\p{Script=Han}/u.test(message));
        return own || '提交的内容格式不正确，请检查后重试';
    }
    return error instanceof Error ? error.message : '请求失败';
}
const HISTORY_SHOWN = 30;
/**
 * Mood and fading change with time alone; within this window an unchanged key means the page
 * already shows the current state, so polling gets a tiny "unchanged" answer instead.
 */
const STATE_TIME_WINDOW_MS = 60_000;
function memoryPresence(engine, scope, memories, now = Date.now()) {
    const pinned = engine.stableContext(scope, now, { ignoreSwitch: true }).ids;
    const presence = new Map();
    for (const memory of memories) {
        if (memory.status !== 'active') {
            continue;
        }
        let memoryPresence = 'topical';
        if (!isRecallable(memory)) {
            memoryPresence = 'record';
        }
        else if (pinned.has(memory.id)) {
            memoryPresence = 'pinned';
        }
        else if (isForgotten(memory, engine.store.uses(memory.id), now)) {
            memoryPresence = 'faded';
        }
        presence.set(memory.id, memoryPresence);
    }
    return presence;
}
function currentMood(engine, scope) {
    const key = `mood:display:${scope.persona}`;
    const previous = engine.store.getMeta(key, undefined);
    const { state, displayed } = pickDisplayedMood(engine.store.activeStates(scope, Date.now(), true), previous);
    if (JSON.stringify(previous) !== JSON.stringify(displayed)) {
        engine.store.setMeta(key, displayed);
    }
    let layer = '';
    if (state) {
        layer = state.layer === 'task' ? 'task' : 'relationship';
    }
    return {
        mood: displayed.mood,
        label: moodLabels[displayed.mood],
        asset: moodAsset(displayed.mood),
        since: displayed.since,
        strength: state ? strengthLabel(state.effectiveIntensity) : '',
        reason: state ? state.displayReason || state.reason : '',
        layer,
    };
}
export function createDashboard(engine, options) {
    const token = randomBytes(24).toString('hex');
    const publicRoot = fileURLToPath(new URL('../../../public/', import.meta.url));
    const handle = async (request, response, mountPath = '') => {
        try {
            const host = request.headers.host || '';
            if (!validRequestHost(host, Boolean(mountPath))) {
                response.writeHead(403);
                response.end('Invalid host');
                return;
            }
            const url = new URL(request.url || '/', `http://${host}`);
            if (mountPath) {
                if (!url.pathname.startsWith(mountPath + '/')) {
                    response.writeHead(404);
                    response.end();
                    return;
                }
                url.pathname = url.pathname.slice(mountPath.length);
            }
            response.setHeader('X-Content-Type-Options', 'nosniff');
            response.setHeader('Cache-Control', 'no-store');
            response.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'");
            const send = (value, status = 200) => {
                response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
                response.end(JSON.stringify(value));
            };
            const checkedScope = (value) => {
                const scope = Scope.parse(value);
                if (scope.user !== DEFAULT_SCOPE.user ||
                    !engine.store.personas().some((candidatePersona) => candidatePersona.id === scope.persona)) {
                    throw new Error('实例不存在');
                }
                return scope;
            };
            if (url.pathname.startsWith('/api/')) {
                const origin = request.headers.origin;
                if (request.headers['sec-fetch-site'] === 'cross-site' ||
                    (origin && !matchesRequestOrigin(origin, host, Boolean(mountPath)))) {
                    send({ error: '请求来源不匹配' }, 403);
                    return;
                }
                if (request.method === 'POST' && request.headers['x-feed-the-seek-token'] !== token) {
                    send({ error: '请刷新页面后重试' }, 403);
                    return;
                }
                if (request.method === 'GET' && url.pathname === '/api/state') {
                    const settings = engine.store.settings();
                    const apiKeyConfigured = !!(await resolveEmbeddingKey(settings, engine.credentials));
                    const scope = checkedScope({
                        ...(options.demo ? DEMO_SCOPE : DEFAULT_SCOPE),
                        persona: url.searchParams.get('persona') || engine.store.activePersona(),
                    });
                    // Everything the page shows moves the revision, a listed job, the credential service or
                    // the time window; while none of them moved, the full snapshot is not rebuilt or sent.
                    const stateKey = [
                        engine.store.revision,
                        scope.persona,
                        engine.store.activePersona(),
                        apiKeyConfigured,
                        engine.store.jobs.changeKey(scope),
                        options.demo ? engine.store.getMeta(`demo:stage:${scope.persona}`, 0) : '',
                        Math.floor(Date.now() / STATE_TIME_WINDOW_MS),
                    ].join('|');
                    if (url.searchParams.get('since') === stateKey) {
                        send({ unchanged: true, stateKey });
                        return;
                    }
                    const memories = engine.store
                        .memories(undefined, true)
                        .filter((candidateMemory) => sameOwner(candidateMemory.scope, scope));
                    const presence = memoryPresence(engine, scope, memories);
                    send({
                        token,
                        stateKey,
                        demo: options.demo,
                        scope,
                        memories: memories.map((candidateMemory) => ({
                            ...candidateMemory,
                            presence: presence.get(candidateMemory.id),
                        })),
                        personas: engine.store.personas(),
                        activePersona: engine.store.activePersona(),
                        traits: engine.store.traits(scope, true),
                        // With emotion off nothing "still in effect" is shown; stored states stay untouched.
                        states: settings.emotion ? engine.store.states(scope, Date.now(), true) : [],
                        mood: settings.emotion ? currentMood(engine, scope) : null,
                        persona: {
                            ...loadPersona(engine.store, scope.persona),
                            threshold: PERSONA.pendingThreshold,
                            history: personaHistory(engine.store, scope.persona).slice(0, 5),
                        },
                        selfCount: engine.store
                            .memories(scope, false)
                            .filter((candidateMemory) => candidateMemory.kind === 'self').length,
                        selfLimit: SELF_LIMIT,
                        history: engine.store.history(scope, { limit: HISTORY_SHOWN, changesOnly: true }),
                        historyCount: engine.store.historyCount(scope, { changesOnly: true }),
                        settings,
                        sources: {},
                        stage: engine.store.getMeta(`demo:stage:${scope.persona}`, 0),
                        demoReady: engine.store.getMeta(`demo:seeded:${scope.persona}`, false),
                        revision: engine.store.revision,
                        vector: {
                            apiKeyConfigured,
                            available: engine.store.vectorAvailable,
                            configured: !!settings.embeddingUrl && !!settings.embeddingModel,
                            ...vectorCoverage(engine, settings, memories),
                        },
                        learningUsage: engine.store.learningUsage(scope),
                        jobs: engine.store.jobs.list(scope),
                    });
                    return;
                }
                if (request.method !== 'POST') {
                    send({ error: '接口不存在' }, 404);
                    return;
                }
                const body = await jsonBody(request);
                if (url.pathname === '/api/history') {
                    const input = z
                        .object({
                        scope: Scope,
                        page: z.number().int().min(1).max(1000000).default(1),
                        query: z.string().max(200).default(''),
                        action: z
                            .enum(['', 'ADD', 'UPDATE', 'DELETE', 'MERGE', 'CONSOLIDATE', 'MIGRATE'])
                            .default(''),
                        kind: z.enum(['', 'cognition', 'experience', 'resonance', 'self']).default(''),
                        through: z.number().int().min(0).optional(),
                    })
                        .strict()
                        .parse(body);
                    const scope = checkedScope(input.scope);
                    const through = input.through ?? engine.store.historyRevision();
                    const filter = {
                        changesOnly: true,
                        query: input.query,
                        action: input.action,
                        kind: input.kind,
                        through,
                    };
                    const total = engine.store.historyCount(scope, filter);
                    const pageSize = 20;
                    const page = Math.min(input.page, Math.max(1, Math.ceil(total / pageSize)));
                    send({
                        items: engine.store.history(scope, {
                            ...filter,
                            limit: pageSize,
                            offset: (page - 1) * pageSize,
                        }),
                        total,
                        page,
                        pageSize,
                        through,
                    });
                    return;
                }
                if (url.pathname === '/api/persona/rename') {
                    const input = z
                        .object({ scope: Scope, name: z.string().trim().min(1).max(40) })
                        .strict()
                        .parse(body);
                    const scope = checkedScope(input.scope);
                    send(engine.store.renamePersona(scope.persona, input.name));
                    return;
                }
                if (url.pathname === '/api/persona/activate') {
                    const input = z.object({ scope: Scope }).strict().parse(body);
                    const scope = checkedScope(input.scope);
                    send(engine.store.activatePersona(scope.persona));
                    return;
                }
                if (url.pathname === '/api/embedding-test') {
                    const saved = engine.store.settings();
                    send(await testEmbeddingConnection(body, async (url) => {
                        if (!url ||
                            !saved.embeddingUrl ||
                            new URL(url).href !== new URL(saved.embeddingUrl).href) {
                            return undefined;
                        }
                        return resolveEmbeddingKey(saved, engine.credentials);
                    }));
                    return;
                }
                if (url.pathname === '/api/recall') {
                    const input = z.object({ query: z.string().max(4000), scope: Scope }).parse(body);
                    send(await engine.recall(checkedScope(input.scope), input.query));
                    return;
                }
                if (url.pathname === '/api/persona') {
                    const input = z
                        .object({ name: z.string().trim().min(1).max(40) })
                        .strict()
                        .parse(body);
                    send(engine.store.createPersona(input.name));
                    return;
                }
                if (url.pathname === '/api/settings') {
                    // growth is retired as a switch (it follows learning); a stale client cannot turn it off.
                    const { embeddingApiKey, clearEmbeddingApiKey, growth: _retired, ...updates } = body;
                    const apiKey = ApiKey.parse(embeddingApiKey);
                    const next = Settings.parse({ ...engine.store.settings(), ...updates });
                    if (next.embeddingUrl) {
                        const parsed = new URL(next.embeddingUrl);
                        if (!['http:', 'https:'].includes(parsed.protocol)) {
                            throw new Error('模型地址需要 HTTP 或 HTTPS');
                        }
                    }
                    if (next.retrievalMode === 'semantic' && (!next.embeddingUrl || !next.embeddingModel)) {
                        throw new Error('请先配置并测试向量服务，再启用语义检索');
                    }
                    if (clearEmbeddingApiKey === true) {
                        if (!engine.credentials || !next.embeddingUrl) {
                            throw new Error('当前没有可清除的已保存密钥');
                        }
                        try {
                            await engine.credentials.set(embeddingKeyReference(next.embeddingUrl), '');
                        }
                        catch {
                            throw new Error('API Key 清除失败，请检查 DSH 密钥服务后重试');
                        }
                    }
                    if (apiKey) {
                        if (!next.embeddingUrl || !next.embeddingModel) {
                            throw new Error('请先填写接口地址和模型名称');
                        }
                        if (!engine.credentials) {
                            throw new Error('当前运行环境没有 DSH 密钥服务，请在 DSH 设置中保存连接');
                        }
                        try {
                            await engine.credentials.set(embeddingKeyReference(next.embeddingUrl), apiKey);
                        }
                        catch {
                            throw new Error('API Key 保存失败，请检查 DSH 密钥服务后重试');
                        }
                    }
                    send(engine.store.saveSettings(next));
                    return;
                }
                if (url.pathname === '/api/index') {
                    send({ count: await engine.index(checkedScope(body.scope)) });
                    return;
                }
                if (url.pathname === '/api/retry') {
                    options.retry?.(checkedScope(body.scope));
                    send({ ok: true });
                    return;
                }
                if (url.pathname === '/api/demo-step' && options.demo) {
                    const input = z.object({ step: z.number().int(), scope: Scope }).parse(body);
                    demoStep(engine, input.step, checkedScope(input.scope));
                    send({ ok: true });
                    return;
                }
                if (url.pathname === '/api/export') {
                    const scope = checkedScope(body.scope);
                    const memories = engine.store
                        .memories(undefined, true)
                        .filter((memory) => sameOwner(memory.scope, scope));
                    const history = engine.store.history(scope, { limit: Infinity });
                    const sourceIds = new Set([
                        ...memories,
                        ...history.flatMap((entry) => [entry.before, entry.after].filter((memory) => !!memory)),
                    ].flatMap((memory) => memory.sources));
                    send({
                        format: 'fish-brain-v2',
                        exportedAt: new Date().toISOString(),
                        memories,
                        history,
                        sources: Object.fromEntries([...sourceIds].map((id) => [id, engine.store.getSource(id)])),
                    });
                    return;
                }
                send({ error: '接口不存在' }, 404);
                return;
            }
            const assets = {
                '/': ['index.html', 'text/html'],
                '/app.js': ['app.js', 'text/javascript'],
                '/style.css': ['style.css', 'text/css'],
                '/native.css': ['native.css', 'text/css'],
                '/assets/fonts/zpix-v3.3.0.woff2': ['assets/fonts/zpix-v3.3.0.woff2', 'font/woff2'],
                '/assets/character-pixel.png': ['assets/portrait-calm.png', 'image/png'],
                '/assets/plugin-icon-v6.png': ['assets/plugin-icon-v6.png', 'image/png'],
                // Looping portraits plus static alternatives for reduced motion and legacy clients.
                ...Object.fromEntries([
                    'calm',
                    'happy',
                    'discouraged',
                    'annoyed',
                    'concerned',
                    'relieved',
                    'hopeful',
                    'shy',
                ].flatMap((mood) => ['png', 'webp'].map((format) => [
                    `/assets/portrait-${mood}.${format}`,
                    [`assets/portrait-${mood}.${format}`, `image/${format}`],
                ]))),
                '/assets/ARTWORK.md': ['assets/ARTWORK.md', 'text/plain'],
            };
            const asset = assets[url.pathname];
            if (!asset || request.method !== 'GET') {
                response.writeHead(404);
                response.end('Not found');
                return;
            }
            // Cache artwork and fonts between visits; clients version URLs when artwork changes.
            // Code stays uncached.
            if (/^(image|font)\//.test(asset[1])) {
                response.setHeader('Cache-Control', 'public, max-age=604800');
            }
            response.writeHead(200, {
                'content-type': asset[1].startsWith('text/') ? `${asset[1]}; charset=utf-8` : asset[1],
            });
            response.end(await readFile(resolve(publicRoot, asset[0])));
        }
        catch (error) {
            if (!response.headersSent) {
                response.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
            }
            response.end(JSON.stringify({ error: errorMessage(error) }));
        }
    };
    const server = createServer((request, response) => void handle(request, response));
    return {
        server,
        handle,
        listen: () => new Promise((ok, fail) => {
            server.once('error', fail);
            server.listen(options.port, '127.0.0.1', () => {
                server.off('error', fail);
                ok();
            });
        }),
    };
}
//# sourceMappingURL=server.js.map