import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

const fixture = path.resolve('src/fish-development-typecheck-fixture.ts')
const child = spawn(process.execPath, ['scripts/dev-desktop.mjs', '--watch-only'], {
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
})
let output = ''
let exited = false
let fixtureCreated = false
child.stdout.on('data', (chunk) => {
  output += chunk
})
child.stderr.on('data', (chunk) => {
  output += chunk
})
const finished = new Promise((resolve) =>
  child.once('exit', () => {
    exited = true
    resolve()
  }),
)

async function waitFor(condition) {
  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    if (condition()) {
      return
    }
    assert.equal(exited, false, output)
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('开发监听检查超时：' + output)
}

async function fingerprint() {
  const hash = createHash('sha256')
  for (const filename of ['public/client.js', 'dist/src/dsh.js', 'dist/src/server.js']) {
    hash.update(await readFile(filename))
  }
  return hash.digest('hex')
}

try {
  await waitFor(() => output.includes('正在监听源代码'))
  const before = await fingerprint()
  await writeFile(fixture, 'export const typecheckFailure: number = "invalid"\n', { flag: 'wx' })
  fixtureCreated = true
  await waitFor(() => output.includes('编译失败，保留上一版代码'))
  assert.equal(await fingerprint(), before, 'failed build must preserve running artifacts')
  output = ''
  await unlink(fixture)
  fixtureCreated = false
  await waitFor(() => output.includes('编译完成，已发布'))
  assert.notEqual(
    await fingerprint(),
    before,
    'a fixed source tree must publish a new client build',
  )
  const report = { automaticWatch: true, failedBuildPreserved: true, recoveryBuildPublished: true }
  await writeFile('outputs/development-watch-check.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report))
} finally {
  child.kill()
  await finished
  if (fixtureCreated) {
    await unlink(fixture)
  }
  const lockPath = path.resolve('.yuwen/dev-desktop.lock')
  const owner = await readFile(lockPath, 'utf8').catch(() => '')
  if (owner === String(child.pid)) {
    await unlink(lockPath)
  }
}
