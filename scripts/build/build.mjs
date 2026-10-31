import { spawnSync } from 'node:child_process'
import { readdir, unlink } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../../', import.meta.url))
process.chdir(projectRoot)

function run(args) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', windowsHide: true })
  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    process.exit(result.status || 1)
  }
}

// Validate first: a type error must not remove the previously usable build.
run(['node_modules/typescript/bin/tsc', '--noEmit'])

// Only compiler-owned files inside dist are removed. Databases and development state are untouched.
const outputRoot = path.resolve(projectRoot, 'dist')
async function cleanCompilerOutput(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch((error) => {
    if (error.code === 'ENOENT') {
      return []
    }
    throw error
  })
  for (const entry of entries) {
    const filename = path.resolve(directory, entry.name)
    if (!filename.startsWith(outputRoot + path.sep) || entry.isSymbolicLink()) {
      throw new Error(`Unexpected build output path: ${filename}`)
    }
    if (entry.isDirectory()) {
      await cleanCompilerOutput(filename)
    } else if (/(?:\.js|\.d\.ts|\.js\.map|\.d\.ts\.map)$/.test(entry.name)) {
      await unlink(filename)
    }
  }
}

await cleanCompilerOutput(path.join(outputRoot, 'src'))
await cleanCompilerOutput(path.join(outputRoot, 'tests'))
run(['node_modules/typescript/bin/tsc', '--noEmitOnError'])
run(['scripts/build/build-client.mjs'])
