const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

async function waitUntil(check, message) {
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) {
    if (await check()) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  throw new Error(message)
}

async function main() {
  const runtime = path.join(path.dirname(process.execPath), 'resources/app.asar/dsh/node_modules')
  const modulePath = (name) => path.join(runtime, '@deepseek-ai', name, 'lib/index.js')
  const { boot } = await import(pathToFileURL(modulePath('dsh-app-boot')).href)
  const directory = await fs.mkdtemp(path.resolve('.yuwen/development-check-'))
  const plugin = path.join(directory, 'plugin')
  await fs.cp('dist/src', path.join(plugin, 'dist/src'), { recursive: true })
  await fs.cp('public', path.join(plugin, 'public'), { recursive: true })
  await fs.copyFile('package.json', path.join(plugin, 'package.json'))
  const serverFile = path.join(plugin, 'dist/src/server.js')
  const original = await fs.readFile(serverFile, 'utf8')
  const modified = original.replace(
    "res.setHeader('X-Content-Type-Options', 'nosniff');",
    "res.setHeader('X-Fish-Dev-Test', 'before'); res.setHeader('X-Content-Type-Options', 'nosniff');",
  )
  assert.notEqual(original, modified)
  await fs.writeFile(serverFile, modified)
  const rows = [
    ['timer', 'cordis-plugin-timer', {}],
    ['session', 'dsh-session', {}],
    ['projection', 'dsh-session-projection', {}],
    ['prompt', 'dsh-system-prompt', {}],
    ['llm', 'dsh-llm', {}],
    ['tools', 'dsh-tools', {}],
    ['agent', 'dsh-agent', {}],
    ['web', 'dsh-host-webserver', { host: '127.0.0.1', port: 0 }],
    ['hmr', 'dsh-hmr', { root: [path.join(plugin, 'dist/src')], ignored: [], debounce: 300 }],
    ['clientModules', 'dsh-client-modules', {}],
    ['clientHmr', 'dsh-client-hmr', { pollIntervalMs: 100 }],
  ].map(([id, name, config]) => ({ id, name: pathToFileURL(modulePath(name)).href, config }))
  rows.push({
    id: 'memory',
    name: pathToFileURL(path.join(plugin, 'dist/src/dsh.js')).href,
    config: { dataDir: path.join(directory, 'memory') },
  })
  const configPath = path.join(directory, 'cordis.json')
  await fs.writeFile(configPath, JSON.stringify(rows, null, 2))
  const context = await boot('fish-development-check', configPath, [])
  try {
    await context.fiber.await()
    const origin = context.webServer.getOrigin()
    const stateUrl = origin + '/fish-brain/api/state'
    const initialResponse = await fetch(stateUrl)
    assert.equal(initialResponse.headers.get('x-fish-dev-test'), 'before')
    const initialState = await initialResponse.json()
    const save = await fetch(origin + '/fish-brain/api/settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-yuwen-token': initialState.token },
      body: JSON.stringify({ learning: false }),
    })
    assert.equal(save.status, 200)

    const pluginName = 'dsh-feed-the-seek'
    const graphEntry = () =>
      context.clientModules.graph().entries.find((row) => row.id === pluginName)
    assert.ok(graphEntry(), 'real DSH client registry must discover the plugin')
    const previousRevision = graphEntry().rev
    const events = new AbortController()
    const stream = await fetch(origin + '/plugins/events', { signal: events.signal })
    assert.equal(stream.status, 200)
    const reader = stream.body.getReader()
    const firstFrame = await reader.read()
    assert.match(Buffer.from(firstFrame.value).toString(), /graph/)
    await fs.appendFile(path.join(plugin, 'public/client.js'), '\n// development-reload-check\n')
    await waitUntil(() => graphEntry().rev !== previousRevision, 'client revision did not reload')
    const nextFrame = await reader.read()
    assert.match(Buffer.from(nextFrame.value).toString(), /rebuilt|graph/)
    events.abort()
    await reader.cancel().catch(() => {})

    await new Promise((resolve) => setTimeout(resolve, 500))
    await fs.writeFile(serverFile, modified.replace("'before'", "'after'"))
    await waitUntil(async () => {
      const response = await fetch(stateUrl).catch(() => undefined)
      return response?.headers.get('x-fish-dev-test') === 'after'
    }, 'backend did not hot reload')
    const updatedState = await (await fetch(stateUrl)).json()
    assert.equal(updatedState.settings.learning, false, 'persistent settings must survive reload')
    assert.notEqual(
      updatedState.token,
      initialState.token,
      'a new dashboard instance must be active',
    )
    const report = {
      nativeHost: true,
      isolated: true,
      backendHotReload: true,
      persistentSettingsRetained: true,
      clientRegistryRebuilt: true,
      clientEventDelivered: true,
      directory,
    }
    await fs.writeFile('outputs/development-check.json', JSON.stringify(report, null, 2))
    console.log(JSON.stringify(report))
  } finally {
    await context.fiber.dispose()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
