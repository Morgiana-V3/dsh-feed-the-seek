import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { createServer } from 'node:http'
import { runInNewContext } from 'node:vm'
import { Store } from '../src/store.js'
import { Engine } from '../src/engine.js'
import { createDashboard } from '../src/server.js'

test('native host routes keep origin/token protection and share the real store', async (t) => {
  const store = new Store(':memory:')
  const dashboard = createDashboard(new Engine(store), { demo: false, port: 0 })
  const host = createServer((req, res) => void dashboard.handle(req, res, '/fish-brain'))
  await new Promise<void>((r) => host.listen(0, '127.0.0.1', r))
  t.after(async () => {
    await new Promise<void>((r) => host.close(() => r()))
    store.close()
  })
  const addr = host.address()
  assert.ok(addr && typeof addr === 'object')
  const base = `http://127.0.0.1:${addr.port}`
  const data: any = await (await fetch(base + '/fish-brain/api/state')).json()
  assert.equal(data.demo, false)
  const post = (headers: Record<string, string>) =>
    fetch(base + '/fish-brain/api/settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ learning: false }),
    })
  assert.equal((await post({})).status, 403)
  assert.equal(
    (await post({ 'x-yuwen-token': data.token, origin: 'https://evil.invalid' })).status,
    403,
  )
  assert.equal((await post({ 'x-yuwen-token': data.token })).status, 200)
  assert.equal(store.settings().learning, false)
  assert.equal((await fetch(base + '/api/state')).status, 404)
  assert.equal(
    (
      await fetch(base + '/fish-brain/api/memory', {
        method: 'POST',
        headers: { 'x-yuwen-token': data.token },
        body: '{}',
      })
    ).status,
    404,
  )
})

test('native client contributes a settings section through the host module loader', () => {
  let entry: any, registration: any
  runInNewContext(readFileSync(new URL('../../public/client.js', import.meta.url), 'utf8'), {
    window: {
      __ModuleLoader__: {
        load(value: unknown) {
          entry = value
        },
      },
    },
  })
  assert.equal(entry.id, 'dsh-feed-the-seek')
  const client = entry.factory((name: string) => {
    assert.equal(name, 'react')
    return { createElement: (type: unknown) => ({ type }) }
  })
  client.apply({
    get: (name: string) => {
      assert.equal(name, 'slots')
      return {
        inject: (name: string, fn: Function) => {
          assert.equal(name, 'settings.section')
          fn()
        },
        register: (spec: unknown, render: Function) => {
          registration = { spec, render }
        },
      }
    },
  })
  assert.equal(registration.spec.label(), '大肥鱼饲养手册')
  assert.equal(registration.spec.id, 'fish-brain-patch')
  assert.equal(typeof registration.render().type, 'function')
})

test('native settings explain empty/error responses and recover when the service becomes ready', async () => {
  let clientEntry: any
  let settingsComponent: () => unknown
  let pollSettings: () => Promise<void>
  let stateIndex = 0
  const stateValues: unknown[] = []
  const mountEffects: (() => void)[] = []
  const responses = [
    new Response(null, { status: 404 }),
    new Response('<html>Unavailable</html>', { status: 503 }),
    Response.json({ error: '请求来源不匹配' }, { status: 403 }),
    Response.json({ revision: 1, memories: [] }),
  ]
  const reactStub = {
    createElement: (type: unknown) => ({ type }),
    useState(initialValue: unknown) {
      const index = stateIndex++
      stateValues[index] = initialValue
      return [
        initialValue,
        (nextValue: unknown) => {
          stateValues[index] = nextValue
        },
      ]
    },
    useRef: (initialValue: unknown) => ({ current: initialValue }),
    useCallback: (callback: unknown) => callback,
    useEffect: (effect: () => void) => {
      mountEffects.push(effect)
    },
  }

  runInNewContext(readFileSync(new URL('../../public/client.js', import.meta.url), 'utf8'), {
    window: {
      __ModuleLoader__: {
        load(entry: unknown) {
          clientEntry = entry
        },
      },
    },
    AbortController,
    fetch: async (url: string) => {
      assert.equal(url, '/fish-brain/api/state')
      return responses.shift()
    },
    // Polling is a setTimeout chain that pauses while the page is hidden.
    setTimeout(callback: () => Promise<void>) {
      pollSettings = callback
      return 1
    },
    clearTimeout() {},
    document: { hidden: false, addEventListener() {}, removeEventListener() {} },
  })
  clientEntry
    .factory(() => reactStub)
    .apply({
      get: () => ({
        inject: (_name: string, register: () => void) => register(),
        register: (_spec: unknown, render: () => { type: () => unknown }) => {
          settingsComponent = render().type
        },
      }),
    })
  settingsComponent!()
  mountEffects[0]()
  await new Promise<void>((resolvePending) => setImmediate(resolvePending))
  assert.match(String(stateValues[1]), /记忆服务未返回数据（HTTP 404）/)

  await pollSettings!()
  assert.match(String(stateValues[1]), /返回格式异常（HTTP 503）/)
  await pollSettings!()
  assert.equal(stateValues[1], '请求来源不匹配')
  await pollSettings!()
  assert.equal(stateValues[1], '')
  assert.equal((stateValues[0] as { revision: number }).revision, 1)
})

const desktop = join(
  process.env.LOCALAPPDATA || '',
  'Programs',
  'DeepSeek Harness',
  'DeepSeek Harness.exe',
)
for (const webServerOrder of ['early', 'late']) {
  test(
    `Desktop kernel mounts settings with ${webServerOrder} web service and remounts after replacement`,
    {
      skip: process.platform !== 'win32' || !existsSync(desktop),
    },
    () => {
      const verificationOutput = execFileSync(
        desktop,
        ['--expose-internals', 'scripts/smoke-desktop.cjs'],
        {
          cwd: resolve('.'),
          windowsHide: true,
          timeout: 30000,
          encoding: 'utf8',
          env: {
            ...process.env,
            ELECTRON_RUN_AS_NODE: '1',
            FISH_BRAIN_TEST_WEB_ORDER: webServerOrder,
          },
        },
      )
      assert.match(verificationOutput, /"actualDesktopKernel":true/)
      assert.match(verificationOutput, /"memoryInjected":true/)
      assert.match(verificationOutput, /"nativeSettingsRoute":true/)
      assert.match(verificationOutput, /"webServerRemounted":true/)
      assert.match(verificationOutput, /"routeReleased":true/)
    },
  )
}
