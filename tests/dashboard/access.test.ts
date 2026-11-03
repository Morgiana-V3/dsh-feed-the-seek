import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, request } from 'node:http'
import { Store } from '../../src/storage/index.js'
import { Engine } from '../../src/companion/index.js'
import { createDashboard } from '../../src/dashboard/index.js'

async function startDashboard(context: TestContext, mounted: boolean) {
  const store = new Store(':memory:')
  const dashboard = createDashboard(new Engine(store), { demo: false, port: 0 })
  const prefix = mounted ? '/fish-brain' : ''
  const server = createServer((request, response) => {
    void dashboard.handle(request, response, prefix)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  context.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    store.close()
  })
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  const port = address.port

  function send(path: string, headers: Record<string, string>, body?: object) {
    return new Promise<{ status: number; body: string }>((resolve, reject) => {
      const outgoing = request(
        {
          hostname: '127.0.0.1',
          port,
          path: prefix + path,
          method: body ? 'POST' : 'GET',
          headers,
        },
        (response) => {
          let result = ''
          response.setEncoding('utf8')
          response.on('data', (chunk) => {
            result += chunk
          })
          response.on('end', () => resolve({ status: response.statusCode!, body: result }))
          response.on('error', reject)
        },
      )
      outgoing.on('error', reject)
      outgoing.end(body ? JSON.stringify(body) : undefined)
    })
  }
  return { send, store, port }
}

test('mounted settings work through domain HTTP/HTTPS proxies, including external ports', async (context) => {
  const { send, store } = await startDashboard(context, true)
  for (const [host, origin] of [
    ['domain.com', 'https://domain.com'],
    ['domain.com', 'http://domain.com'],
    ['domain.com:443', 'https://domain.com'],
    ['domain.com:8443', 'https://domain.com:8443'],
    ['192.168.1.10:8080', 'http://192.168.1.10:8080'],
    ['[::1]:8080', 'http://[::1]:8080'],
  ]) {
    const state = await send('/api/state', { host, origin })
    assert.equal(state.status, 200, `${host} ${origin}: ${state.body}`)
    const { token } = JSON.parse(state.body)
    assert.equal((await send('/native.css', { host })).status, 200)
    assert.equal(
      (
        await send(
          '/api/settings',
          {
            host,
            origin,
            'x-feed-the-seek-token': token,
          },
          { learning: false },
        )
      ).status,
      200,
    )
    assert.equal(store.settings().learning, false)
    store.saveSettings({ ...store.settings(), learning: true })
  }
  // Same-origin browser GETs do not always include an Origin header.
  assert.equal((await send('/api/state', { host: 'domain.com' })).status, 200)
})

test('remote settings still reject foreign origins, missing tokens and forged forwarding headers', async (context) => {
  const { send, store } = await startDashboard(context, true)
  const { token } = JSON.parse((await send('/api/state', { host: 'domain.com' })).body)
  for (const origin of [
    'https://evil.invalid',
    'https://domain.com:8443',
    'null',
    'https://domain.com.evil.invalid',
    'https://domain.com/path',
    'file://domain.com',
  ]) {
    assert.equal(
      (
        await send(
          '/api/settings',
          {
            host: 'domain.com',
            origin,
            'x-feed-the-seek-token': token,
          },
          { learning: false },
        )
      ).status,
      403,
      origin,
    )
  }
  for (const requestToken of ['', 'wrong-token']) {
    assert.equal(
      (
        await send(
          '/api/settings',
          {
            host: 'domain.com',
            origin: 'https://domain.com',
            'x-feed-the-seek-token': requestToken,
          },
          { learning: false },
        )
      ).status,
      403,
    )
  }
  assert.equal(
    (
      await send('/api/state', {
        host: 'domain.com',
        'sec-fetch-site': 'cross-site',
      })
    ).status,
    403,
  )
  assert.equal(
    (
      await send(
        '/api/settings',
        {
          host: 'domain.com',
          origin: 'https://evil.invalid',
          'x-feed-the-seek-token': token,
          'x-forwarded-host': 'evil.invalid',
          'x-forwarded-proto': 'https',
        },
        { learning: false },
      )
    ).status,
    403,
  )
  assert.equal(store.settings().learning, true)
  for (const host of ['domain.com@evil.invalid', 'domain.com/path', 'domain.com,evil.invalid']) {
    assert.equal((await send('/api/state', { host })).status, 403)
  }
})

test('standalone dashboard keeps loopback-only host and origin restrictions', async (context) => {
  const { send, port } = await startDashboard(context, false)
  assert.equal((await send('/api/state', { host: 'domain.com' })).status, 403)
  assert.equal(
    (
      await send('/api/state', {
        host: 'domain.com',
        'x-forwarded-host': `localhost:${port}`,
      })
    ).status,
    403,
  )
  for (const host of [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`]) {
    assert.equal((await send('/api/state', { host, origin: `http://${host}` })).status, 200)
  }
  assert.equal(
    (
      await send('/api/state', {
        host: `localhost:${port}`,
        origin: `https://localhost:${port}`,
      })
    ).status,
    403,
  )
})
