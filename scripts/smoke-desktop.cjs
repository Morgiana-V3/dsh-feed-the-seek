const path = require('node:path')
const fs = require('node:fs/promises')
const { pathToFileURL } = require('node:url')
const assert = require('node:assert/strict')

async function verifyDesktopIntegration() {
  const hostPackagesDirectory = path.join(
    path.dirname(process.execPath),
    'resources/app.asar/dsh/node_modules/@deepseek-ai',
  )
  const loadHostModule = (packageName) =>
    import(pathToFileURL(path.join(hostPackagesDirectory, packageName, 'lib/index.js')).href)
  const { Context } = await loadHostModule('cordis')
  const context = new Context()
  const testDirectory = path.resolve('.yuwen')
  await fs.mkdir(testDirectory, { recursive: true })
  const dataDirectory = await fs.mkdtemp(path.join(testDirectory, 'desktop-native-smoke-'))
  const pluginDirectory =
    process.env.FISH_BRAIN_TEST_INSTALLED === '1'
      ? path.join(
          process.env.USERPROFILE,
          '.dsh/profiles/desktop/node_modules/dsh-feed-the-seek',
        )
      : path.resolve('.')
  const { Store } = await import(
    pathToFileURL(path.join(pluginDirectory, 'dist/src/store.js')).href
  )
  const { Engine } = await import(
    pathToFileURL(path.join(pluginDirectory, 'dist/src/engine.js')).href
  )
  const store = new Store(path.join(dataDirectory, 'memory.sqlite'))
  const engine = new Engine(store)
  const scope = { user: 'owner', persona: 'yuwen', project: '' }
  const isWebServerDelayed = process.env.FISH_BRAIN_TEST_WEB_ORDER === 'late'

  try {
    store.source({
      id: 'smoke-source',
      session: 'isolated-fixture',
      role: 'user',
      text: '测试专用：回复先给结论',
      at: new Date().toISOString(),
      scope,
    })
    engine.apply(
      {
        operations: [
          {
            action: 'ADD',
            kind: 'cognition',
            knowledge: { category: 'preference' },
            text: '测试专用：回复先给结论',
            global: true,
            sources: ['smoke-source'],
            reason: '隔离环境验证注入',
          },
        ],
      },
      scope,
      [],
      ['smoke-source'],
    )

    const corePlugins = [
      ['dsh-session', {}],
      ['dsh-session-projection', {}],
      ['dsh-system-prompt', { includeRuntimeContext: true }],
      ['dsh-llm', {}],
      ['dsh-tools', {}],
      ['dsh-agent', {}],
      ['dsh-agent-loop', { agents: [], maxParallelToolCalls: 10 }],
    ]
    for (const [packageName, config] of corePlugins) {
      const hostPlugin = await loadHostModule(packageName)
      await context.plugin(hostPlugin.default, config)
    }

    const webServerPlugin = await loadHostModule('dsh-host-webserver')
    const webServerConfig = { host: '127.0.0.1', port: 0 }
    let webServerFiber
    if (!isWebServerDelayed) {
      webServerFiber = context.plugin(webServerPlugin.default, webServerConfig)
      await webServerFiber
    }

    const memoryPlugin = await import(
      pathToFileURL(path.join(pluginDirectory, 'dist/src/dsh.js')).href
    )
    const memoryFiber = context.plugin(memoryPlugin, { dataDir: dataDirectory })
    await memoryFiber
    await memoryFiber.await()
    assert.equal(memoryFiber.state, 2, 'plugin must be active')

    if (isWebServerDelayed) {
      webServerFiber = context.plugin(webServerPlugin.default, webServerConfig)
      await webServerFiber
    }
    await context.fiber.await()

    const agentHandle = await context.agents.create({
      sessionId: 'fish-native-isolated-check',
      meta: { cwd: path.resolve('.') },
    })
    const { assembleContextFor } = await loadHostModule('dsh-agent')
    const assembly = await context.systemPrompt.assemble(assembleContextFor(agentHandle.agent))
    assert.ok(
      assembly.tools.some((tool) => tool.name === 'yuwen_recall'),
      'recall tool is registered',
    )
    assert.ok(
      assembly.sections.some((section) => section.text.includes('测试专用：回复先给结论')),
      'real kernel injects profile memory into the stable system section',
    )

    async function verifySettingsRoute() {
      const response = await fetch(context.webServer.getOrigin() + '/fish-brain/api/state')
      assert.equal(response.status, 200)
      const settingsState = await response.json()
      assert.equal(settingsState.demo, false)
      assert.equal(settingsState.sessions.length, 1)
      assert.equal(settingsState.vector.available, true)
      return settingsState
    }

    const initialState = await verifySettingsRoute()
    const credentialModule = await loadHostModule('dsh-credentials-local')
    const credentialOptions = { path: path.join(dataDirectory, 'credentials.yaml'), watch: false }
    let credentialFiber = context.plugin(
      credentialModule.LocalCredentialProvider,
      credentialOptions,
    )
    await credentialFiber
    await context.fiber.await()
    const keyResponse = await fetch(context.webServer.getOrigin() + '/fish-brain/api/settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-yuwen-token': initialState.token },
      body: JSON.stringify({
        embeddingUrl: 'http://127.0.0.1:9/v1/embeddings',
        embeddingModel: 'isolated-credential-test',
        embeddingApiKey: 'fixture-desktop-key',
      }),
    })
    assert.equal(keyResponse.status, 200)
    assert.equal(JSON.stringify(await keyResponse.json()).includes('fixture-desktop-key'), false)
    assert.equal((await verifySettingsRoute()).vector.apiKeyConfigured, true)
    assert.equal(JSON.stringify(store.settings()).includes('fixture-desktop-key'), false)
    await credentialFiber.dispose()
    credentialFiber = context.plugin(credentialModule.LocalCredentialProvider, credentialOptions)
    await credentialFiber
    await context.fiber.await()
    assert.equal((await verifySettingsRoute()).vector.apiKeyConfigured, true)
    const stylesheet = await fetch(context.webServer.getOrigin() + '/fish-brain/native.css')
    assert.equal(stylesheet.status, 200)
    assert.match(stylesheet.headers.get('content-type'), /text\/css/)
    assert.match(await stylesheet.text(), /\.fish-brain/)
    const portrait = await fetch(
      context.webServer.getOrigin() + '/fish-brain/assets/character-pixel.png',
    )
    assert.equal(portrait.status, 200)
    assert.equal(portrait.headers.get('content-type'), 'image/png')
    assert.equal(Buffer.from(await portrait.arrayBuffer()).readUInt32BE(0), 0x89504e47)
    const settingsResponse = await fetch(
      context.webServer.getOrigin() + '/fish-brain/api/settings',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-yuwen-token': initialState.token },
        body: JSON.stringify({ learning: false }),
      },
    )
    assert.equal(settingsResponse.status, 200)
    assert.equal((await settingsResponse.json()).learning, false)

    await webServerFiber.dispose()
    webServerFiber = context.plugin(webServerPlugin.default, webServerConfig)
    await webServerFiber
    await context.fiber.await()
    const remountedState = await verifySettingsRoute()
    assert.equal(remountedState.settings.learning, false)

    await memoryFiber.dispose()
    const releasedRouteResponse = await fetch(
      context.webServer.getOrigin() + '/fish-brain/api/state',
    )
    assert.equal(releasedRouteResponse.status, 404, 'plugin disposal must release its route')

    console.log(
      JSON.stringify({
        actualDesktopKernel: true,
        nativeSettingsRoute: true,
        webServerOrder: isWebServerDelayed ? 'late' : 'early',
        webServerRemounted: true,
        routeReleased: true,
        agentCreated: true,
        memoryInjected: true,
        recallTool: true,
        vectorExtension: true,
        credentialSavedAndReloaded: true,
        dataDirectory,
        realModelCalled: false,
      }),
    )
  } finally {
    await context.fiber.dispose()
    store.close()
  }
}

verifyDesktopIntegration().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
