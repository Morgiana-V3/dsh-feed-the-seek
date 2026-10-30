const { app, BrowserWindow } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const assert = require('node:assert/strict')
const { createServer } = require('node:http')

app.setPath('userData', path.resolve('.yuwen/isolated-ui-profile'))
app.disableHardwareAcceleration()

async function checkNativeSettings() {
  await app.whenReady()
  const { createNativePreview } = await import(
    pathToFileURL(path.resolve('scripts/preview-native.mjs')).href
  )
  const secrets = new Map()
  const preview = await createNativePreview({
    credentials: {
      async resolve(reference) {
        const value = secrets.get(reference)
        return value ? { value } : undefined
      },
      async set(reference, value) {
        secrets.set(reference, value)
      },
    },
  })
  let embeddingStatus = 200
  let authorization
  const embeddingServer = createServer((request, response) => {
    authorization = request.headers.authorization
    request.resume()
    response.writeHead(embeddingStatus, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ data: [{ embedding: [0.1, 0.3, 0.5] }] }))
  })
  await new Promise((resolve) => embeddingServer.listen(0, '127.0.0.1', resolve))
  const window = new BrowserWindow({
    show: false,
    width: 1080,
    height: 1020,
    webPreferences: { backgroundThrottling: false, sandbox: true, offscreen: true },
  })
  const rendererErrors = []
  window.webContents.on('console-message', (event) => {
    if (event.level === 'error') {
      rendererErrors.push(event.message)
    }
  })
  async function evaluate(source) {
    try {
      return await window.webContents.executeJavaScript(source)
    } catch (error) {
      throw new Error(`UI check failed: ${source}`, { cause: error })
    }
  }
  async function waitUntil(expression) {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate(expression)) {
        return
      }
      await new Promise((resolveWait) => setTimeout(resolveWait, 50))
    }
    throw new Error('UI condition not reached: ' + expression)
  }
  async function screenshot(name) {
    await evaluate(
      'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))',
    )
    await new Promise((resolvePaint) => setTimeout(resolvePaint, 200))
    const capture = await window.webContents.capturePage()
    await fs.writeFile(path.resolve('outputs', name), capture.toPNG())
  }
  try {
    await window.loadURL(preview.origin)
    await waitUntil('Boolean(document.querySelector(".fish-portrait")?.naturalWidth)')
    assert.equal(
      await evaluate(
        `document.fonts.load('12px "Fish Zpix"', '大肥鱼饲养手册记忆認知かな').then(fonts => fonts.length)`,
      ),
      1,
    )
    assert.equal(await evaluate(`document.fonts.check('12px "Fish Zpix"', '大肥鱼饲养手册')`), true)
    assert.match(
      await evaluate('getComputedStyle(document.querySelector(".fish-brain")).fontFamily'),
      /Fish Zpix/,
    )
    assert.equal(
      await evaluate('getComputedStyle(document.querySelector(".fish-tabs")).display'),
      'grid',
    )
    await screenshot('pixel-settings-overview.png')

    await evaluate('document.querySelector("#fish-tab-memories").click()')
    await waitUntil('document.querySelectorAll(".fish-memory-card").length === 5')
    await evaluate(
      '[...document.querySelectorAll(".fish-filters button")].find(button => button.textContent.includes("经历")).click()',
    )
    await waitUntil('document.querySelectorAll(".fish-memory-card").length === 1')
    assert.equal(
      await evaluate(
        'document.querySelectorAll(".fish-memory-card input, .fish-memory-card textarea").length',
      ),
      0,
    )
    await screenshot('pixel-settings-memories.png')

    await evaluate(`
      document.querySelector('.fish-search-form').closest('details').open = true;
      const queryInput = document.querySelector('.fish-search-form input');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(queryInput, '回声戒指');
      queryInput.dispatchEvent(new Event('input', { bubbles: true }));
    `)
    await evaluate('document.querySelector(".fish-form").requestSubmit()')
    await waitUntil(
      'document.querySelector(".fish-search-result pre")?.textContent.includes("回声戒指")',
    )

    await evaluate('document.querySelector("#fish-tab-settings").click()')
    await waitUntil('document.querySelectorAll(".fish-toggle-grid input").length === 4')
    await evaluate('document.querySelector(".fish-toggle-grid input").click()')
    await waitUntil(
      'document.querySelector(".fish-toggle-grid input").checked === false && !document.querySelector(".fish-toggle-grid input").disabled',
    )
    const enabled = await evaluate(
      `fetch('/fish-brain/api/state').then(response => response.json()).then(state => state.settings.enabled)`,
    )
    assert.equal(enabled, false, 'toggle persists through the actual API')
    await evaluate('document.querySelector(".fish-toggle-grid input").click()')
    await waitUntil(
      'document.querySelector(".fish-toggle-grid input").checked === true && !document.querySelector(".fish-toggle-grid input").disabled',
    )
    await screenshot('pixel-settings-options.png')
    assert.equal(
      await evaluate(
        'document.querySelector("input[name=fish-retrieval-mode][value=local]").checked',
      ),
      true,
    )
    await evaluate(
      'document.querySelector("input[name=fish-retrieval-mode][value=semantic]").click()',
    )
    await waitUntil(
      'Boolean(document.querySelector("input[name=url]")) && !document.querySelector(".fish-mode-options").disabled',
    )
    assert.equal(
      await evaluate(
        "fetch('/fish-brain/api/state').then(response => response.json()).then(state => state.settings.retrievalMode)",
      ),
      'semantic',
    )
    const beforeProbe = await evaluate(
      "fetch('/fish-brain/api/state').then(response => response.json())",
    )
    await evaluate(`
      const probeFields = { url: 'http://127.0.0.1:${embeddingServer.address().port}/v1/embeddings', model: 'unsaved-ui-test', apiKey: 'fixture-ui-key' };
      for (const [name, value] of Object.entries(probeFields)) {
        const field = document.querySelector('input[name=' + name + ']');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, value);
        field.dispatchEvent(new Event('input', { bubbles: true }));
      }
      [...document.querySelectorAll('button')].find(button => button.textContent === '测试连接').click();
    `)
    await waitUntil(
      'document.querySelector(".fish-connection-result")?.textContent.includes("连接成功")',
    )
    assert.match(
      await evaluate('document.querySelector(".fish-connection-result").textContent'),
      /3 维/,
    )
    const afterProbe = await evaluate(
      "fetch('/fish-brain/api/state').then(response => response.json())",
    )
    assert.deepEqual(afterProbe.settings, beforeProbe.settings)
    assert.equal(afterProbe.revision, beforeProbe.revision)
    assert.deepEqual(afterProbe.vector, beforeProbe.vector)
    assert.equal(authorization, 'Bearer fixture-ui-key')
    assert.equal(secrets.size, 0)
    assert.equal(await evaluate('document.querySelector("input[name=apiKey]").type'), 'password')
    assert.equal(await evaluate('Boolean(document.querySelector("input[name=env]"))'), false)
    await evaluate(
      'document.querySelector(".fish-connection-actions").scrollIntoView({ block: "center" })',
    )
    await screenshot('pixel-settings-connection-test.png')
    embeddingStatus = 401
    await evaluate(
      "[...document.querySelectorAll('button')].find(button => button.textContent === '测试连接').click()",
    )
    await waitUntil(
      'document.querySelector(".fish-connection-result[role=alert]")?.textContent.includes("401")',
    )
    await evaluate(`
      const modelField = document.querySelector('input[name=model]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(modelField, 'edited-model');
      modelField.dispatchEvent(new Event('input', { bubbles: true }));
    `)
    await waitUntil('!document.querySelector(".fish-connection-result")')
    embeddingStatus = 200
    await evaluate('document.querySelector("input[name=apiKey]").form.requestSubmit()')
    await waitUntil(
      'document.querySelector("input[name=apiKey]").readOnly && document.querySelector("input[name=apiKey]").value === "************"',
    )
    const keyState = await evaluate(
      "fetch('/fish-brain/api/state').then(response => response.json())",
    )
    assert.equal(keyState.vector.apiKeyConfigured, true)
    assert.equal(JSON.stringify(keyState).includes('fixture-ui-key'), false)
    await evaluate(
      "[...document.querySelectorAll('button')].find(button => button.textContent === '测试连接').click()",
    )
    await waitUntil(
      'document.querySelector(".fish-connection-result")?.textContent.includes("连接成功")',
    )
    assert.equal(authorization, 'Bearer fixture-ui-key')
    await evaluate(
      'document.querySelector("input[name=apiKey]").scrollIntoView({ block: "center" })',
    )
    await screenshot('pixel-settings-saved-key.png')
    await evaluate(
      "[...document.querySelectorAll('button')].find(button => button.textContent === '更换密钥').click()",
    )
    await waitUntil(
      '!document.querySelector("input[name=apiKey]").readOnly && document.querySelector("input[name=apiKey]").value === ""',
    )
    assert.equal(secrets.size, 1, 'editing must not delete the stored key')
    await evaluate('document.querySelector("input[name=fish-retrieval-mode][value=local]").click()')
    await waitUntil(
      '!document.querySelector("input[name=url]") && !document.querySelector(".fish-mode-options").disabled',
    )

    await evaluate(`
      [...document.querySelectorAll('.fish-fold')].find(section => section.querySelector('summary').textContent.includes('重新养一个')).open = true;
      const nameInput = document.querySelector('input[name="name"]');
      nameInput.value = '像素测试伙伴';
      nameInput.form.requestSubmit();
    `)
    await waitUntil(
      'document.querySelector(".fish-profile-info h2")?.textContent === "像素测试伙伴"',
    )
    assert.equal(await evaluate('document.querySelectorAll(".fish-memory-card").length'), 0)
    await screenshot('pixel-settings-empty.png')

    window.setSize(430, 900)
    await screenshot('pixel-settings-narrow.png')
    assert.equal(
      await evaluate('document.documentElement.scrollWidth <= window.innerWidth'),
      true,
      'narrow settings must not overflow horizontally',
    )
    assert.deepEqual(
      rendererErrors.filter((message) => !message.includes('400 (Bad Request)')),
      [],
    )
    console.log(
      JSON.stringify({
        rendered: true,
        zpixFontLoaded: true,
        tabs: true,
        filters: true,
        recall: true,
        persistedToggle: true,
        connectionProbeWithoutSaving: true,
        newPersonaEmpty: true,
        narrowLayout: true,
        rendererErrors: 0,
      }),
    )
  } finally {
    window.destroy()
    await preview.close()
    await new Promise((resolve) => embeddingServer.close(resolve))
  }
}

checkNativeSettings()
  .then(() => app.quit())
  .catch((error) => {
    console.error(error)
    app.exit(1)
  })
