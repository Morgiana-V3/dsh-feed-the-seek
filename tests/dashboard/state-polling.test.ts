import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Engine } from '../../src/companion/index.js'
import { createDashboard } from '../../src/dashboard/index.js'
import { Store } from '../../src/storage/index.js'

async function serve(store: Store) {
  const dashboard = createDashboard(new Engine(store), { demo: false, port: 0 })
  await dashboard.listen()
  const origin = `http://127.0.0.1:${(dashboard.server.address() as { port: number }).port}`
  return {
    origin,
    close: () => new Promise<void>((resolve) => dashboard.server.close(() => resolve())),
  }
}

test('polling with an unchanged key gets a tiny answer; any change sends the full state again', async (t) => {
  const store = new Store(':memory:')
  const { origin, close } = await serve(store)
  t.after(async () => {
    await close()
    store.close()
  })
  const read = async (since?: string) =>
    (await (
      await fetch(origin + '/api/state' + (since ? '?since=' + encodeURIComponent(since) : ''))
    ).json()) as {
      unchanged?: true
      stateKey: string
      memories?: unknown[]
    }
  const first = await read()
  assert.ok(first.stateKey)
  assert.ok(Array.isArray(first.memories))
  assert.deepEqual(await read(first.stateKey), { unchanged: true, stateKey: first.stateKey })

  // A data change moves the revision.
  store.saveSettings({ ...store.settings(), emotion: false })
  const afterSettings = await read(first.stateKey)
  assert.equal(afterSettings.unchanged, undefined)
  assert.notEqual(afterSettings.stateKey, first.stateKey)

  // A background job changing status does not touch the revision but still refreshes the page.
  store.jobs.enqueue(
    'job-1',
    JSON.stringify({
      id: 'job-1',
      scope: { user: 'owner', persona: 'default', project: '' },
      sources: [],
    }),
  )
  const afterJob = await read(afterSettings.stateKey)
  assert.equal(afterJob.unchanged, undefined, 'a new job is shown')
  store.jobs.start('job-1')
  assert.equal((await read(afterJob.stateKey)).unchanged, undefined, 'a status change is shown')
})

test('old "nothing to change" judgments are pruned; real changes stay', () => {
  const store = new Store(':memory:')
  const day = 86_400_000
  const now = Date.now()
  const insert = (action: string, daysAgo: number) =>
    store.db
      .prepare('INSERT INTO audit VALUES (?,?,?,?,?,?,?)')
      .run(
        `${action}-${daysAgo}`,
        new Date(now - daysAgo * day).toISOString(),
        action,
        '',
        'x',
        null,
        null,
      )
  for (const action of ['NONE', 'OBSERVE', 'ADD', 'MERGE']) {
    insert(action, 40)
    insert(action, 5)
  }
  assert.equal(store.pruneAudit(now), 2)
  const left = store.db
    .prepare('SELECT id FROM audit ORDER BY id')
    .all()
    .map((row) => String(row.id))
  assert.deepEqual(left, ['ADD-40', 'ADD-5', 'MERGE-40', 'MERGE-5', 'NONE-5', 'OBSERVE-5'])
  store.close()
})
