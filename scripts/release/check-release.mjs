import { execSync } from 'node:child_process'
import { access, lstat, readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const manifest = JSON.parse(await readFile('package.json', 'utf8'))
const [bundle] = JSON.parse(
  execSync('npm pack --dry-run --json --ignore-scripts', {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
  }),
)
const packed = new Set(bundle.files.map((file) => file.path))
const requiredFiles = [
  'dist/src/dsh.js',
  'public/client.js',
  'public/native.css',
  'public/assets/portrait-calm.png',
  'public/assets/portrait-happy.png',
  'public/assets/portrait-discouraged.png',
  'public/assets/portrait-annoyed.png',
  'public/assets/portrait-concerned.png',
  'public/assets/portrait-relieved.png',
  'public/assets/portrait-hopeful.png',
  'public/assets/portrait-shy.png',
  'public/assets/fonts/zpix-v3.3.0.woff2',
  'public/assets/fonts/ZPIX-UPSTREAM-README.md',
  manifest.icon,
  'cordis.patch.yml',
]
for (const required of requiredFiles) {
  if (!packed.has(required)) {
    throw new Error(`Missing release file: ${required}`)
  }
}
const privatePath =
  /(?:^|\/)(?:outputs|work|\.feed-the-seek|\.yuwen|\.reference|\.claude|\.codex|node_modules)(?:\/|$)|\.(?:sqlite(?:-wal|-shm)?|db|log|tgz|map|pem|key|p12|pfx)$|(?:^|\/)\.env(?:\.|$)/i
const developmentPath = /^(?:tests|scripts|src)\/|^dist\/tests\//
for (const filename of packed) {
  if (privatePath.test(filename) || developmentPath.test(filename)) {
    throw new Error(`Private or development file in release: ${filename}`)
  }
}
const icon = await readFile(manifest.icon)
if (icon.length > 256 * 1024 || icon.readUInt32BE(0) !== 0x89504e47) {
  throw new Error('Plugin icon must be a PNG smaller than 256 KiB')
}
const client = await readFile('public/client.js', 'utf8')
if (!client.includes(JSON.stringify(manifest.name))) {
  throw new Error('Built client has the wrong module id; run the build first')
}

// Scan candidate source files too: a clean tarball alone does not make a Git upload safe.
let candidates = []
try {
  candidates = execSync('git ls-files --cached --others --exclude-standard -z', {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
  })
    .split('\0')
    .filter(Boolean)
  const deleted = new Set(
    execSync('git ls-files --deleted -z', { encoding: 'utf8', windowsHide: true }).split('\0'),
  )
  candidates = candidates.filter((filename) => !deleted.has(filename))
} catch {
  // Archives without Git can still have their complete package content checked.
}
if (candidates.length) {
  const gitFiles = new Set(candidates)
  for (const filename of packed) {
    if (!gitFiles.has(filename)) {
      throw new Error(`Git URL installation would miss this runtime file: ${filename}`)
    }
  }
  for (const filename of candidates) {
    if (privatePath.test(filename)) {
      throw new Error(`Private file in Git candidates: ${filename}`)
    }
    if (/^public\/assets\/.*\.png$/.test(filename) && !requiredFiles.includes(filename)) {
      throw new Error(`Unlisted artwork in Git candidates: ${filename}`)
    }
    if (/^dist\/src\/.*\.(?:js|d\.ts)$/.test(filename)) {
      const source = filename.replace(/^dist\//, '').replace(/\.(?:d\.ts|js)$/, '')
      const exists = await Promise.all(
        ['.ts', '.tsx'].map((extension) =>
          access(source + extension).then(
            () => true,
            () => false,
          ),
        ),
      )
      if (!exists.some(Boolean)) {
        throw new Error(`Stale compiler output without source: ${filename}`)
      }
    }
  }
}
const textFile = /\.(?:[cm]?js|tsx?|json|jsonl|ya?ml|md|txt|html|css|py|ps1)$/i
const signatures = [
  /(?<![\w-])(?:pst-|sk-(?:proj-)?)[A-Za-z0-9_-]{20,}/,
  /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|xox[baprs]-[A-Za-z0-9-]{20,})/,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  /\bBearer\s+[A-Za-z0-9._~+/-]{24,}={0,2}/i,
  /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/,
  /[A-Z]:[\\/]+Users[\\/]+(?!<|YOUR_)[a-z0-9_.-]+[\\/]/i,
  /\/(?:Users|home)\/(?!<|YOUR_)[a-z0-9_.-]+\//i,
]
let scanned = 0
let scannedImages = 0
for (const filename of new Set([...candidates, ...packed])) {
  const absolute = path.resolve(root, filename)
  if (!absolute.startsWith(root + path.sep) || !(await lstat(absolute)).isFile()) {
    throw new Error(`Invalid source path: ${filename}`)
  }
  if (filename.endsWith('.png')) {
    const png = await readFile(absolute)
    if (!png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      throw new Error(`Invalid PNG: ${filename}`)
    }
    for (let offset = 8; offset + 12 <= png.length;) {
      const length = png.readUInt32BE(offset)
      const chunk = png.toString('ascii', offset + 4, offset + 8)
      if (offset + length + 12 > png.length) {
        throw new Error(`Truncated PNG: ${filename}`)
      }
      if (['tEXt', 'zTXt', 'iTXt', 'eXIf'].includes(chunk)) {
        throw new Error(`PNG contains private-capable metadata (${chunk}): ${filename}`)
      }
      offset += length + 12
    }
    scannedImages++
  }
  if (!textFile.test(filename)) {
    continue
  }
  const contents = await readFile(absolute, 'utf8')
  if (signatures.some((signature) => signature.test(contents))) {
    // Never print the matching value: findings may themselves be credentials.
    throw new Error(`Potential credential or personal absolute path: ${filename}`)
  }
  scanned++
}
console.log(
  JSON.stringify({
    package: manifest.name,
    version: manifest.version,
    files: packed.size,
    compressedBytes: bundle.size,
    scannedTextFiles: scanned,
    scannedImages,
    iconBytes: icon.length,
    privateFileChecks: 'passed',
  }),
)
