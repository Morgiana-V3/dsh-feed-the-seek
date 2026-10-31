import { access, readdir, unlink } from 'node:fs/promises'
import path from 'node:path'

/** Drop only compiler files whose source was removed or moved. */
export async function pruneCompilerOutput(outputDirectory, sourceDirectory) {
  const outputRoot = path.resolve(outputDirectory)
  const sourceRoot = path.resolve(sourceDirectory)
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true }).catch((error) => {
      if (error.code === 'ENOENT') {
        return []
      }
      throw error
    })
    for (const entry of entries) {
      const filename = path.resolve(directory, entry.name)
      if (!filename.startsWith(outputRoot + path.sep) || entry.isSymbolicLink()) {
        throw new Error(`Unexpected compiler output path: ${filename}`)
      }
      if (entry.isDirectory()) {
        await visit(filename)
        continue
      }
      if (!/(?:\.d\.ts(?:\.map)?|\.js(?:\.map)?)$/.test(filename)) {
        continue
      }
      const stem = path
        .relative(outputRoot, filename)
        .replace(/(?:\.d\.ts(?:\.map)?|\.js(?:\.map)?)$/, '')
      const sources = await Promise.all(
        ['.ts', '.tsx'].map(async (extension) => {
          try {
            await access(path.join(sourceRoot, stem + extension))
            return true
          } catch (error) {
            if (error.code !== 'ENOENT') {
              throw error
            }
            return false
          }
        }),
      )
      if (!sources.some(Boolean)) {
        await unlink(filename)
      }
    }
  }
  await visit(outputRoot)
}
