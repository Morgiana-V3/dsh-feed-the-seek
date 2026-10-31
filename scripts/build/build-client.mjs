import { build } from 'esbuild'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const manifest = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'))
const stylesheet = await readFile(new URL('../../public/native.css', import.meta.url))
const styleRevision = createHash('sha256').update(stylesheet).digest('hex').slice(0, 12)
const compiled = await build({
  entryPoints: ['src/dashboard/client/index.tsx'],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'transform',
  external: ['react'],
  define: {
    __PLUGIN_VERSION__: JSON.stringify(manifest.version),
    __PLUGIN_BUILD__: JSON.stringify(process.env.FISH_BRAIN_BUILD_ID || styleRevision),
  },
  legalComments: 'none',
})
const clientModule = `// Generated from src/dashboard/client; edit the source modules, then run npm run build.
window.__ModuleLoader__.load({
  id: ${JSON.stringify(manifest.name)},
  factory: function(require) {
    const module = { exports: {} };
${compiled.outputFiles[0].text}
    return module.exports;
  }
});
`
await writeFile(
  new URL(process.env.FISH_BRAIN_CLIENT_OUTPUT || '../../public/client.js', import.meta.url),
  clientModule,
)
