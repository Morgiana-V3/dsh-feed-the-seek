// Run with the installed Desktop executable and ELECTRON_RUN_AS_NODE=1.
// Install an already-built local tarball without driving or restarting the UI.
const fs = require('node:fs/promises')
const path = require('node:path')
const { homedir } = require('node:os')
const { pathToFileURL } = require('node:url')
const { spawn } = require('node:child_process')

;(async () => {
  if (!process.versions.electron) {
    throw Error('Use the DeepSeek Harness Desktop runtime')
  }
  const app = path.dirname(process.execPath)
  const runtime = path.join(app, 'resources', 'app.asar', 'dsh')
  const profile = path.join(
    process.env.DSH_HOME || path.join(homedir(), '.dsh'),
    'profiles',
    'desktop',
  )
  const project = path.resolve(__dirname, '../..')
  const development = process.argv.includes('--development')
  const release = process.argv.includes('--release')
  const manifest = JSON.parse(await fs.readFile(path.join(project, 'package.json'), 'utf8'))
  const packageArgument = process.argv.slice(2).find((argument) => !argument.startsWith('--'))
  const tarball = path.resolve(
    project,
    packageArgument || `${manifest.name}-${manifest.version}.tgz`,
  )
  if (path.dirname(tarball) !== project) {
    throw Error('The local package must be inside this workspace')
  }
  if (!development) {
    await fs.access(tarball)
  }
  const bundled = (name) =>
    import(
      pathToFileURL(path.join(runtime, 'node_modules', '@deepseek-ai', name, 'lib', 'index.js'))
        .href
    )
  const { withFileLock, writeFileAtomic } = await bundled('dsh-atomic-write')
  const boot = await bundled('dsh-app-boot')
  const manifestPath = path.join(profile, 'package.json')
  await withFileLock(
    manifestPath,
    async () => {
      try {
        await fs.access(path.join(profile, '.plugin-manager', 'run.json'))
        throw Error('Desktop has an unfinished package operation; finish it first')
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error
        }
      }
      const backup = path.join(
        project,
        'outputs',
        'desktop-backup-' + new Date().toISOString().replace(/[:.]/g, '-'),
      )
      await fs.mkdir(backup, { recursive: true })
      const originals = new Map()
      for (const name of [
        'package.json',
        'pnpm-lock.yaml',
        'cordis.patch.yml',
        'pnpm-workspace.yaml',
      ]) {
        try {
          const data = await fs.readFile(path.join(profile, name))
          originals.set(name, data)
          await fs.writeFile(path.join(backup, name), data)
        } catch (error) {
          if (error.code !== 'ENOENT') {
            throw error
          }
        }
      }
      const before = JSON.parse(originals.get('package.json').toString())
      // Retire the former package without changing the persistent plugin identity.
      const legacyPackageName = 'dsh-fish-brain-patch'
      const pnpm = path.join(
        app,
        'resources',
        'runtime',
        'primary-runtime',
        'dependencies',
        'pnpm',
        'bin',
        'pnpm.mjs',
      )
      const installTarget = development ? `link:${project.replaceAll('\\', '/')}` : tarball
      const alreadyLinked =
        development &&
        before.dependencies?.[manifest.name] === installTarget &&
        (await fs.realpath(path.join(profile, 'node_modules', manifest.name)).catch(() => '')) ===
          project
      const runPackageManager = (arguments_) =>
        new Promise((resolve, reject) => {
          const child = spawn(process.execPath, ['--expose-internals', pnpm, ...arguments_], {
            cwd: profile,
            windowsHide: true,
            stdio: 'inherit',
            env: {
              ...process.env,
              ELECTRON_RUN_AS_NODE: '1',
              DSH_DESKTOP_NODE_EXECUTABLE: process.execPath,
              PATH:
                path.join(app, 'resources', 'runtime', 'bin') + path.delimiter + process.env.PATH,
            },
          })
          child.once('error', reject)
          child.once('exit', resolve)
        })
      let code = 0
      if (!development && before.dependencies?.[manifest.name]?.startsWith('link:')) {
        code = await runPackageManager(['remove', manifest.name, '--config.ignore-scripts=true'])
      }
      if (!alreadyLinked && code === 0) {
        code = await runPackageManager([
          'add',
          installTarget,
          '--ignore-scripts',
          '--prefer-offline',
        ])
      }
      if (code === 0 && before.dependencies?.[legacyPackageName]) {
        code = await runPackageManager([
          'remove',
          legacyPackageName,
          '--config.ignore-scripts=true',
        ])
      }
      if (code !== 0) {
        for (const name of ['package.json', 'pnpm-lock.yaml']) {
          if (originals.has(name)) {
            await writeFileAtomic(path.join(profile, name), originals.get(name), { mode: 0o600 })
          }
        }
        throw Error('Package install failed; manifest and lockfile restored, backup: ' + backup)
      }
      const installedPath = path.join(profile, 'node_modules', manifest.name)
      const pkg = JSON.parse(await fs.readFile(path.join(installedPath, 'package.json'), 'utf8'))
      if (pkg.name !== manifest.name || !pkg.dsh?.bundle || !pkg.dsh?.client) {
        throw Error('Installed package does not contain the host and native client')
      }
      const after = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
      // Preserve all existing bundle selections, including intentionally disabled dependencies.
      const bundles = [
        ...new Set(
          (before.dsh?.profile?.bundles || []).map((name) =>
            name === legacyPackageName ? pkg.name : name,
          ),
        ),
      ]
      if (!bundles.includes(pkg.name)) {
        bundles.push(pkg.name)
      }
      after.dsh = { ...after.dsh, profile: { ...after.dsh?.profile, bundles } }
      await writeFileAtomic(manifestPath, JSON.stringify(after, null, 2) + '\n', { mode: 0o600 })
      if (development || release) {
        const patchPath = path.join(profile, 'cordis.patch.yml')
        const begin = '# BEGIN FISH BRAIN LOCAL DEVELOPMENT'
        const end = '# END FISH BRAIN LOCAL DEVELOPMENT'
        const previousPatch = await fs.readFile(patchPath, 'utf8').catch((error) => {
          if (error.code === 'ENOENT') {
            return ''
          }
          throw error
        })
        const blockPattern = new RegExp(`${begin}[\\s\\S]*?${end}\\r?\\n?`, 'g')
        let nextPatch = previousPatch.replace(blockPattern, '')
        if (development) {
          const watchRoot = path.join(project, 'dist', 'src').replaceAll('\\', '/')
          nextPatch =
            nextPatch.trimEnd() +
            '\n' +
            begin +
            '\n' +
            '- id: hmr\n  disabled: false\n  config:\n' +
            `    base: ${JSON.stringify(pathToFileURL(project).href + '/')}\n` +
            `    root: [${JSON.stringify(watchRoot)}]\n    debounce: 750\n` +
            end +
            '\n'
        }
        if (nextPatch !== previousPatch) {
          await writeFileAtomic(patchPath, nextPatch, { mode: 0o600 })
        }
      }
      const anchor = path.join(runtime, 'node_modules', '@deepseek-ai', 'dsh', 'package.json')
      const composed = boot.loadProfileDirectory('dsh', profile, anchor)
      const failure = composed.skippedBundles.find((b) => b.packageName === pkg.name)
      if (failure) {
        throw Error(failure.reason)
      }
      const report = {
        version: pkg.version,
        profile,
        package: installedPath,
        backup,
        selected: composed.layers.some((layer) => layer.packageName === pkg.name),
        activation: alreadyLinked ? 'development-linked' : 'restart-required',
        nativeSettings: '大肥鱼饲养手册',
        development,
        source: development ? project : tarball,
      }
      await fs.writeFile(
        path.join(project, 'outputs', 'desktop-installation.json'),
        JSON.stringify(report, null, 2),
      )
      console.log(JSON.stringify(report, null, 2))
    },
    { waitMs: 10000 },
  )
})().catch((event) => {
  console.error(event)
  process.exitCode = 1
})
