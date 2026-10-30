import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'
import { Store } from '../dist/src/store.js'
import { Engine } from '../dist/src/engine.js'
import { createDashboard } from '../dist/src/server.js'
import { seedDemo } from '../dist/src/demo.js'

export async function createNativePreview(options = {}) {
  const isLiveSnapshot = Boolean(options.databasePath)
  const store = new Store(options.databasePath || ':memory:')
  const engine = new Engine(store, undefined, options.credentials)
  if (!isLiveSnapshot) seedDemo(engine)
  const dashboard = createDashboard(engine, { demo: !isLiveSnapshot, port: 0 })
  const runtime = await build({
    stdin: {
      contents: `
        import * as React from 'react';
        import { createRoot } from 'react-dom/client';
        const root = createRoot(document.getElementById('plugin'));
        window.__ModuleLoader__ = { load(entry) {
          const client = entry.factory(name => {
            if (name !== 'react') throw Error('Unexpected dependency: ' + name);
            return React;
          });
          client.apply({ get: () => ({
            inject: (name, setup) => setup(),
            register: (spec, render) => root.render(render()),
          }) });
        } };
      `,
      resolveDir: process.cwd(),
      loader: 'js',
    },
    bundle: true,
    write: false,
    format: 'iife',
    define: { 'process.env.NODE_ENV': '"development"' },
  })
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>大肥鱼饲养手册 · 隔离预览</title>
    <style>
      body { margin:0; padding:30px; background:#e7e9ed; font:15px system-ui; color:#333; }
      .shell { display:grid; grid-template-columns:190px minmax(0,1fr); gap:28px; max-width:960px;
        margin:auto; padding:28px; background:white; border:1px solid #cfd3db; border-radius:22px; }
      aside h2 { font-size:19px; margin:0 0 28px; } aside p { padding:13px; margin:6px 0; }
      aside .selected { background:#edf0f5; border-radius:10px; font-weight:600; }
      main { min-width:0; } @media(max-width:600px) { body{padding:12px}.shell{display:block;padding:12px}aside{display:none} }
    </style>
    ${isLiveSnapshot ? '<p style="max-width:960px;margin:0 auto 16px">真实模型实测数据 · 独立只读副本。可查阅记忆、来源、变更和试检索，不影响 DSH 的正式记忆。</p>' : ''}
    <div class="shell"><aside><h2>设置</h2><p>账号与余额</p><p>通用设置</p><p>模型</p><p>内置插件</p><p>Agent 预设</p><p class="selected">大肥鱼饲养手册</p></aside><main id="plugin"></main></div>
    <script src="/preview-runtime.js"></script><script src="/preview-plugin.js"></script></html>`
  const server = createServer(async (request, response) => {
    try {
      if (
        options.readOnly &&
        request.method === 'POST' &&
        !['/fish-brain/api/recall', '/fish-brain/api/export'].includes(request.url)
      ) {
        response.writeHead(403, { 'content-type': 'application/json; charset=utf-8' })
        response.end(
          JSON.stringify({ error: '这是实测数据的只读副本，请在 DSH 正式设置中修改配置。' }),
        )
        return
      }
      if (request.url === '/') {
        response.setHeader('content-type', 'text/html; charset=utf-8')
        response.end(html)
      } else if (request.url === '/preview-runtime.js') {
        response.setHeader('content-type', 'text/javascript; charset=utf-8')
        response.end(runtime.outputFiles[0].text)
      } else if (request.url === '/preview-plugin.js') {
        response.setHeader('content-type', 'text/javascript; charset=utf-8')
        response.end(await readFile('public/client.js'))
      } else {
        await dashboard.handle(request, response, '/fish-brain')
      }
    } catch {
      response.writeHead(500)
      response.end('Preview failed')
    }
  })
  await new Promise((resolveReady) => server.listen(0, '127.0.0.1', resolveReady))
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: async () => {
      await new Promise((resolveClosed) => server.close(resolveClosed))
      store.close()
    },
  }
}
