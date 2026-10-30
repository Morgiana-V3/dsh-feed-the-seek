import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { Store } from './store.js';
import { Engine } from './engine.js';
import { Scope, DEFAULT_SCOPE, sameOwner, Settings } from './types.js';
import { loadPersona, personaHistory, PERSONA } from './persona.js';
import { SELF_LIMIT } from './self-consolidation.js';
import { moodAsset, moodLabels, pickDisplayedMood, strengthLabel, type DisplayedMood } from './mood.js';
import { seedDemo, demoStep, DEMO_SCOPE } from './demo.js';
import { associateMemories } from './associations.js';
import { testEmbeddingConnection } from './embedding-connection.js';
import { ApiKey, embeddingKeyReference, resolveEmbeddingKey } from './embedding-credentials.js';

async function jsonBody(req: IncomingMessage) {
  let body = '';
  for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 64000) throw new Error('请求过大'); }
  return JSON.parse(body || '{}');
}
function currentMood(engine: Engine, scope: Scope) {
  const key = `mood:display:${scope.persona}`;
  const previous = engine.store.getMeta<DisplayedMood | undefined>(key, undefined);
  const { state, displayed } = pickDisplayedMood(engine.store.activeStates(scope, Date.now(), true), previous);
  if (JSON.stringify(previous) !== JSON.stringify(displayed)) engine.store.setMeta(key, displayed);
  return {
    mood: displayed.mood, label: moodLabels[displayed.mood], asset: moodAsset(displayed.mood), since: displayed.since,
    strength: state ? strengthLabel(state.effectiveIntensity) : '', reason: state ? state.displayReason || state.reason : '',
    project: state?.scope.project || '', layer: state ? (state.scope.project ? 'task' : 'relationship') : '',
  };
}
export function createDashboard(engine: Engine, options: { demo: boolean; port: number; retry?: () => void; sessions?: () => {id:string;project:string;persona:string;enabled:boolean}[] }) {
  const token = randomBytes(24).toString('hex');
  const publicRoot = fileURLToPath(new URL('../../public/', import.meta.url));
  const handle = async (req: IncomingMessage, res: ServerResponse, mountPath = '') => {
    try {
      const host = req.headers.host || '';
      if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host)) { res.writeHead(403); res.end('Invalid host'); return; }
      const url = new URL(req.url || '/', `http://${host}`);
      if (mountPath) {
        if (!url.pathname.startsWith(mountPath + '/')) { res.writeHead(404);res.end();return; }
        url.pathname = url.pathname.slice(mountPath.length);
      }
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'");
      const send = (value: unknown, status = 200) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };
      const checkedScope = (value: unknown) => {
        const scope = Scope.parse(value);
        if (scope.user!==DEFAULT_SCOPE.user || !engine.store.personas().some(p=>p.id===scope.persona)) throw new Error('实例不存在');
        return scope;
      };
      if (url.pathname.startsWith('/api/')) {
        if (req.headers.origin && req.headers.origin !== `http://${host}`) { send({ error: '请求来源不匹配' }, 403); return; }
        if (req.method === 'POST' && req.headers['x-yuwen-token'] !== token) { send({ error: '请刷新页面后重试' }, 403); return; }
        if (req.method === 'GET' && url.pathname === '/api/state') {
          const settings = engine.store.settings();
          const apiKeyConfigured = !!(await resolveEmbeddingKey(settings, engine.credentials));
          const scope = checkedScope({...options.demo ? DEMO_SCOPE : DEFAULT_SCOPE,persona:url.searchParams.get('persona') || engine.store.activePersona()});
          const memories = engine.store.memories(undefined,true).filter(m=>sameOwner(m.scope,scope));
          const ids = new Set(memories.map(m=>m.id));
          send({ token, demo: options.demo, scope, memories:memories.map(m=>({...m,activation:engine.store.activation(m)})),
            personas:engine.store.personas(), activePersona:engine.store.activePersona(), traits:engine.store.traits(scope,true),
            associations: associateMemories(memories),
            // With emotion off nothing "still in effect" is shown; stored states stay untouched.
            states: settings.emotion ? engine.store.states(scope,Date.now(),true) : [], mood: settings.emotion ? currentMood(engine, scope) : null,
            persona: { ...loadPersona(engine.store, scope.persona), threshold: PERSONA.pendingThreshold, history: personaHistory(engine.store, scope.persona).slice(0, 5) },
            selfCount: engine.store.memories(scope, false).filter(m => m.kind === 'self').length, selfLimit: SELF_LIMIT, history: engine.store.history(scope), settings,
            sessions: options.sessions?.().filter(s=>s.persona===scope.persona) || [],
            sources: Object.fromEntries([...new Set(memories.flatMap(m=>m.sources))].map(id=>[id,engine.store.getSource(id)])),
            stage: engine.store.getMeta(`demo:stage:${scope.persona}`,0), demoReady:engine.store.getMeta(`demo:seeded:${scope.persona}`,false), revision: engine.store.revision,
            vector: { apiKeyConfigured, available: engine.store.vectorAvailable, configured: !!settings.embeddingUrl && !!settings.embeddingModel, count: engine.store.db.prepare('SELECT memory_id FROM vectors').all().filter(r=>ids.has(String(r.memory_id))).length },
            jobs: engine.store.db.prepare('SELECT * FROM jobs ORDER BY updated_at DESC').all().filter(r=>sameOwner(JSON.parse(String(r.payload)).scope,scope)).slice(0,20).map(({payload,...job})=>job) }); return;
        }
        if (req.method !== 'POST') { send({ error: '接口不存在' },404); return; }
        const body = await jsonBody(req);
        if (url.pathname === '/api/embedding-test') {
          const saved = engine.store.settings();
          send(await testEmbeddingConnection(body, async (url) => {
            if (!url || !saved.embeddingUrl || new URL(url).href !== new URL(saved.embeddingUrl).href) return undefined;
            return resolveEmbeddingKey(saved, engine.credentials);
          }));
          return;
        }
        if (url.pathname === '/api/recall') {
          const input = z.object({ query: z.string().max(4000), scope: Scope, session: z.string().max(150).optional() }).parse(body);
          checkedScope(input.scope);
          if (input.session && !engine.store.sessionEnabled(input.session)) { send({ query: input.query, scope: input.scope, items: [], states: [], context: '', mode: 'keyword', note: '此会话已关闭记忆', revision: engine.store.revision }); return; }
          send(await engine.recall(input.scope,input.query)); return;
        }
        if (url.pathname === '/api/persona') {
          const input = z.object({name:z.string().trim().min(1).max(40)}).strict().parse(body);
          send(engine.store.createPersona(input.name)); return;
        }
        if (url.pathname === '/api/settings') {
          const { embeddingApiKey, ...updates } = body;
          const apiKey = ApiKey.parse(embeddingApiKey);
          const next = Settings.parse({ ...engine.store.settings(), ...updates });
          if (next.embeddingUrl) { const parsed = new URL(next.embeddingUrl); if (!['http:','https:'].includes(parsed.protocol)) throw new Error('模型地址需要 HTTP 或 HTTPS'); }
          if (apiKey) {
            if (!next.embeddingUrl || !next.embeddingModel) throw new Error('请先填写接口地址和模型名称');
            if (!engine.credentials) throw new Error('当前运行环境没有 DSH 密钥服务，请在 DSH 设置中保存连接');
            try { await engine.credentials.set(embeddingKeyReference(next.embeddingUrl), apiKey); }
            catch { throw new Error('API Key 保存失败，请检查 DSH 密钥服务后重试'); }
          }
          send(engine.store.saveSettings(next)); return;
        }
        if (url.pathname === '/api/session') { const input = z.object({ id:z.string().min(1).max(150), enabled:z.boolean() }).parse(body); engine.store.toggleSession(input.id,input.enabled); send({ok:true}); return; }
        if (url.pathname === '/api/index') { send({ count: await engine.index(checkedScope(body.scope)) }); return; }
        if (url.pathname === '/api/retry') { options.retry?.(); send({ok:true}); return; }
        if (url.pathname === '/api/demo-step' && options.demo) { const input=z.object({step:z.number().int(),scope:Scope}).parse(body);demoStep(engine,input.step,checkedScope(input.scope)); send({ok:true}); return; }
        if (url.pathname === '/api/export') { const scope=checkedScope(body.scope); send({ format:'fish-brain-v2', exportedAt:new Date().toISOString(), memories:engine.store.memories(undefined,true).filter(m=>sameOwner(m.scope,scope)), history:engine.store.history(scope) }); return; }
        send({error:'接口不存在'},404); return;
      }
      const assets: Record<string, [string,string]> = { '/':['index.html','text/html'], '/app.js':['app.js','text/javascript'], '/style.css':['style.css','text/css'],
        '/native.css': ['native.css', 'text/css'],
        '/assets/fonts/zpix-v3.3.0.woff2': ['assets/fonts/zpix-v3.3.0.woff2', 'font/woff2'],
        '/assets/character-pixel.png': ['assets/portrait-calm.png', 'image/png'],
        '/assets/plugin-icon-v5.png': ['assets/plugin-icon-v5.png', 'image/png'],
        // Display-size portraits, one per mood (generated from the 832×1024 originals).
        ...Object.fromEntries(['calm','happy','discouraged','annoyed'].map(mood => [`/assets/portrait-${mood}.png`, [`assets/portrait-${mood}.png`, 'image/png'] as [string,string]])),
        '/assets/ARTWORK.md':['assets/ARTWORK.md','text/plain'] };
      const asset = assets[url.pathname];
      if (!asset || req.method !== 'GET') { res.writeHead(404); res.end('Not found'); return; }
      // Images and the font never change under the same file name; caching them avoids
      // re-downloading ~2 MB each time the settings page opens. Code stays uncached.
      if (/^(image|font)\//.test(asset[1])) res.setHeader('Cache-Control', 'public, max-age=604800');
      res.writeHead(200, {'content-type':asset[1].startsWith('text/') ? `${asset[1]}; charset=utf-8` : asset[1]}); res.end(await readFile(resolve(publicRoot,asset[0])));
    } catch (error) { if (!res.headersSent) res.writeHead(400,{'content-type':'application/json; charset=utf-8'}); res.end(JSON.stringify({error:error instanceof Error ? error.message : '请求失败'})); }
  };
  const server = createServer((req,res)=>void handle(req,res));
  return { server, handle, listen: () => new Promise<void>((ok,fail) => { server.once('error',fail); server.listen(options.port,'127.0.0.1',() => { server.off('error',fail); ok(); }); }) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const demo = process.env.YUWEN_DEMO !== '0';
  const port = Number(process.env.YUWEN_PORT || 4318);
  const store = new Store(resolve(process.env.YUWEN_DATA_DIR || '.yuwen',demo ? 'demo.sqlite' : 'memory.sqlite'));
  const engine = new Engine(store);
  if (demo) seedDemo(engine);
  const dashboard = createDashboard(engine,{demo,port});
  await dashboard.listen();
  console.log(`dsh-feed-the-seek ${demo ? '演示空间' : '本地记忆'} http://127.0.0.1:${port}`);
  const shutdown = () => dashboard.server.close(() => { store.close(); process.exit(0); });
  process.on('SIGINT',shutdown); process.on('SIGTERM',shutdown);
}
