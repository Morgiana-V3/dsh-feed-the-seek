import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, realpath, writeFile, unlink } from 'node:fs/promises'
import path from 'node:path'

const home = await mkdtemp(path.resolve('.feed-the-seek/development-profile-check-'))
const profile = path.join(home, 'profiles/desktop')
const desktop = path.join(
  process.env.LOCALAPPDATA,
  'Programs/DeepSeek Harness/DeepSeek Harness.exe',
)
const reportPath = 'outputs/desktop-installation.json'
const originalReport = await readFile(reportPath).catch((error) => {
  if (error.code !== 'ENOENT') {
    throw error
  }
  return undefined
})
const manifest = {
  name: 'fish-development-profile-check',
  private: true,
  dependencies: { 'dsh-fish-brain-patch': `link:${path.resolve('.').replaceAll('\\', '/')}` },
  dsh: {
    profile: {
      bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', 'dsh-fish-brain-patch'],
    },
  },
}
const retainedPatch =
  '# Keep this unrelated setting\n- id: ui-theme\n  config:\n    preference: light\n'
await mkdir(profile, { recursive: true })
await writeFile(path.join(profile, 'package.json'), JSON.stringify(manifest, null, 2))
await writeFile(path.join(profile, 'cordis.patch.yml'), retainedPatch)

function install(mode) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      desktop,
      ['--expose-internals', 'scripts/development/install-desktop.cjs', mode],
      {
        windowsHide: true,
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', DSH_HOME: home },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    let output = ''
    child.stdout.on('data', (chunk) => {
      output += chunk
    })
    child.stderr.on('data', (chunk) => {
      output += chunk
    })
    child.once('error', reject)
    child.once('exit', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(output))
      }
    })
  })
}

try {
  const linkedPackage = path.join(profile, 'node_modules/dsh-feed-the-seek')
  const patchPath = path.join(profile, 'cordis.patch.yml')
  await install('--development')
  assert.equal(await realpath(linkedPackage), path.resolve('.'))
  const migrated = JSON.parse(await readFile(path.join(profile, 'package.json'), 'utf8'))
  assert.equal(migrated.dependencies['dsh-fish-brain-patch'], undefined)
  assert.deepEqual(migrated.dsh.profile.bundles, [
    '@deepseek-ai/dsh-base',
    '@deepseek-ai/dsh-web-app',
    'dsh-feed-the-seek',
  ])
  assert.ok((await readFile(patchPath, 'utf8')).startsWith(retainedPatch))
  await install('--development')
  assert.equal((await readFile(patchPath, 'utf8')).match(/BEGIN FISH BRAIN/g).length, 1)
  await install('--release')
  assert.notEqual(await realpath(linkedPackage), path.resolve('.'))
  assert.equal(await readFile(patchPath, 'utf8'), retainedPatch)
  const after = JSON.parse(await readFile(path.join(profile, 'package.json'), 'utf8'))
  assert.deepEqual(after.dsh.profile.bundles.slice(0, 2), manifest.dsh.profile.bundles.slice(0, 2))
  const report = {
    isolatedHome: home,
    linked: true,
    idempotent: true,
    restoredPackage: true,
    unrelatedSettingsRetained: true,
    legacyPackageMigrated: true,
  }
  await writeFile('outputs/development-profile-check.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report))
} finally {
  if (originalReport) {
    await writeFile(reportPath, originalReport)
  } else {
    await unlink(reportPath).catch((error) => {
      if (error.code !== 'ENOENT') {
        throw error
      }
    })
  }
}
