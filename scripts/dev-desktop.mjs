import { spawn } from 'node:child_process'
import { watch } from 'node:fs'
import { mkdir, open, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const project = fileURLToPath(new URL('../', import.meta.url))
process.chdir(project)
const desktop =
  process.env.FISH_BRAIN_DSH_EXECUTABLE ||
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'DeepSeek Harness', 'DeepSeek Harness.exe')
const staging = path.join(project, '.yuwen', 'development-build')
const clientOutput = path.join(staging, 'client.js')
const watchers = []
let stopping = false
let building = false
let queued = false
let debounceTimer
let lockOwned = false
const lockPath = path.join(project, '.yuwen', 'dev-desktop.lock')

async function acquireLock() {
  await mkdir(path.dirname(lockPath), { recursive: true })
  try {
    const lock = await open(lockPath, 'wx')
    await lock.writeFile(String(process.pid))
    await lock.close()
    lockOwned = true
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error
    }
    const owner = Number(await readFile(lockPath, 'utf8'))
    if (!Number.isInteger(owner) || owner <= 0) {
      throw new Error(`开发锁文件无效，请检查 ${lockPath}`)
    }
    try {
      process.kill(owner, 0)
    } catch (probeError) {
      if (probeError.code !== 'ESRCH') {
        throw probeError
      }
      await unlink(lockPath)
      return acquireLock()
    }
    throw new Error(`开发命令已在运行（进程 ${owner}），请先在原终端停止。`)
  }
}

async function releaseLock() {
  if (lockOwned) {
    lockOwned = false
    await unlink(lockPath)
  }
}

function run(executable, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: project,
      stdio: 'inherit',
      windowsHide: true,
      env: { ...process.env, ...extraEnv },
    })
    child.once('error', reject)
    child.once('exit', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`命令失败（${code}）：${path.basename(executable)} ${args[0]}`))
      }
    })
  })
}

async function publishFile(source, destination) {
  const content = await readFile(source)
  const previous = await readFile(destination).catch((error) => {
    if (error.code !== 'ENOENT') {
      throw error
    }
  })
  if (previous?.equals(content)) {
    return
  }
  await mkdir(path.dirname(destination), { recursive: true })
  const temporary = `${destination}.fish-dev-tmp`
  await writeFile(temporary, content)
  await rename(temporary, destination)
}

async function publishDirectory(source, destination) {
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name)
    const to = path.join(destination, entry.name)
    if (entry.isDirectory()) {
      await publishDirectory(from, to)
    } else {
      await publishFile(from, to)
    }
  }
}

async function buildDevelopment() {
  await mkdir(staging, { recursive: true })
  // Failed compilation never overwrites the running backend or client bundle.
  await run(process.execPath, [
    'node_modules/typescript/bin/tsc',
    '--outDir',
    staging,
    '--noEmitOnError',
  ])
  await run(process.execPath, ['scripts/build-client.mjs'], {
    FISH_BRAIN_BUILD_ID: String(Date.now()),
    FISH_BRAIN_CLIENT_OUTPUT: pathToFileURL(clientOutput).href,
  })
  await publishDirectory(path.join(staging, 'src'), path.join(project, 'dist', 'src'))
  await publishFile(clientOutput, path.join(project, 'public', 'client.js'))
  console.log(`[开发] ${new Date().toLocaleTimeString()} 编译完成，已发布到 DSH 本地插件。`)
}

async function rebuild() {
  if (building || stopping) {
    queued = !stopping
    return
  }
  building = true
  try {
    do {
      queued = false
      try {
        await buildDevelopment()
      } catch (error) {
        console.error('[开发] 编译失败，保留上一版代码。', error.message)
      }
    } while (queued && !stopping)
  } finally {
    building = false
    if (stopping) {
      await releaseLock()
    }
  }
}

function scheduleBuild(filename) {
  const name = String(filename || '').replaceAll('\\', '/')
  if (name === 'client.js' || name.endsWith('.fish-dev-tmp')) {
    return
  }
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(rebuild, 300)
}

function stop() {
  stopping = true
  clearTimeout(debounceTimer)
  for (const watcher of watchers) {
    watcher.close()
  }
  if (!building) {
    void releaseLock().catch((error) => console.error(error.message))
  }
  console.log('\n[开发] 已停止监听。本地关联保留；恢复安装版请运行 npm run dev:dsh:stop。')
}

async function main() {
  if (process.platform !== 'win32') {
    throw new Error('此脚本用于当前 Windows DSH 桌面安装。')
  }
  await acquireLock()
  if (process.argv.includes('--release')) {
    await run(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmitOnError'])
    await run(process.execPath, ['scripts/build-client.mjs'])
    const npm = process.env.npm_execpath
    if (!npm) {
      throw new Error('请使用 npm run dev:dsh:stop 执行。')
    }
    await run(process.execPath, [npm, 'pack', '--silent'])
    await run(desktop, ['--expose-internals', 'scripts/install-desktop.cjs', '--release'], {
      ELECTRON_RUN_AS_NODE: '1',
    })
    console.log('[开发] 已恢复安装版，请重启 DSH。')
    await releaseLock()
    return
  }

  await buildDevelopment()
  if (process.argv.includes('--build-only')) {
    await releaseLock()
    return
  }
  if (!process.argv.includes('--watch-only')) {
    await run(desktop, ['--expose-internals', 'scripts/install-desktop.cjs', '--development'], {
      ELECTRON_RUN_AS_NODE: '1',
    })
  }
  for (const directory of ['src', 'public']) {
    watchers.push(
      watch(directory, { recursive: true }, (_event, filename) => scheduleBuild(filename)),
    )
  }
  for (const filename of ['package.json', 'tsconfig.json', 'scripts/build-client.mjs']) {
    watchers.push(watch(filename, () => scheduleBuild(filename)))
  }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
  console.log('[开发] 正在监听源代码与资源。首次关联后请重启 DSH 一次。')
  console.log('[开发] 界面重载会清空未保存表单；依赖、插件配置或入口变更请重启开发命令和 DSH。')
}

main().catch((error) => {
  console.error(error)
  stop()
  process.exitCode = 1
})
