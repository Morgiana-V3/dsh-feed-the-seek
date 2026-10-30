import { execSync } from 'node:child_process'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const manifest = JSON.parse(await readFile('package.json', 'utf8'))
const [bundle] = JSON.parse(execSync('npm pack --dry-run --json --ignore-scripts', {
  encoding: 'utf8',
  windowsHide: true,
  maxBuffer: 8 * 1024 * 1024,
}))
const packed = new Set(bundle.files.map((file) => file.path))
for (const required of [
  'dist/src/dsh.js', 'public/client.js', 'public/native.css',
  'public/assets/portrait-calm.png', 'public/assets/portrait-happy.png',
  'public/assets/portrait-discouraged.png', 'public/assets/portrait-annoyed.png',
  'public/assets/fonts/zpix-v3.3.0.woff2', 'public/assets/fonts/ZPIX-UPSTREAM-README.md',
  manifest.icon, 'cordis.patch.yml',
]) {
  if (!packed.has(required)) {
    throw new Error(`Missing release file: ${required}`)
  }
}
const forbidden = /(?:^|\/)(?:outputs|work|\.yuwen|\.reference|tests|node_modules)(?:\/|$)|\.(?:sqlite(?:-wal|-shm)?|db|log|tgz|map|pem|key|p12|pfx)$|(?:^|\/)\.env(?:\.|$)/i
for (const filename of packed) {
  if (forbidden.test(filename)) {
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
    encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024,
  }).split('\0').filter(Boolean)
} catch {
  // Archives without Git can still have their complete package content checked.
}
if (candidates.length) {
  const gitFiles = new Set(candidates)
  for (const filename of packed) {
    const runtimeFile = filename.startsWith('dist/src/') ||
      filename === 'public/client.js' || filename === manifest.icon
    if (runtimeFile && !gitFiles.has(filename)) {
      throw new Error(`Git URL installation would miss this runtime file: ${filename}`)
    }
  }
}
const textFile = /\.(?:[cm]?js|tsx?|json|jsonl|ya?ml|md|txt|html|css|py|ps1)$/i
const signatures = [
  /(?<![\w-])(?:pst-|sk-(?:proj-)?)[A-Za-z0-9_-]{20,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /[A-Z]:[\\/]+Users[\\/]+(?!<|YOUR_)[a-z0-9_.-]+[\\/]/i,
]
let scanned = 0
for (const filename of new Set([...candidates, ...packed])) {
  if (!textFile.test(filename)) {
    continue
  }
  const absolute = path.resolve(root, filename)
  if (!absolute.startsWith(root + path.sep) || !(await stat(absolute)).isFile()) {
    throw new Error(`Invalid source path: ${filename}`)
  }
  const contents = await readFile(absolute, 'utf8')
  if (signatures.some((signature) => signature.test(contents))) {
    // Never print the matching value: findings may themselves be credentials.
    throw new Error(`Potential credential or personal absolute path: ${filename}`)
  }
  scanned++
}
console.log(JSON.stringify({
  package: manifest.name, version: manifest.version,
  files: packed.size, compressedBytes: bundle.size, scannedTextFiles: scanned,
  iconBytes: icon.length, privateFileChecks: 'passed',
}))
