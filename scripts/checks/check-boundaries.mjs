import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const projectRoot = fileURLToPath(new URL('../../', import.meta.url))
process.chdir(projectRoot)

// Runtime dependencies only. Type-only references must still use the feature's public API.
const dependencies = {
  memory: ['emotion'],
  emotion: [],
  settings: [],
  privacy: [],
  embedding: ['settings'],
  storage: ['memory', 'settings', 'privacy'],
  persona: ['memory'],
  companion: ['memory', 'storage', 'embedding', 'emotion', 'persona'],
  learning: ['memory', 'companion', 'persona', 'privacy'],
  demo: ['memory', 'companion', 'storage', 'dashboard'],
  dashboard: ['memory', 'companion', 'settings', 'persona', 'emotion', 'embedding', 'demo'],
  dsh: ['memory', 'storage', 'companion', 'learning', 'dashboard'],
}
const errors = []
const graph = new Map()
const nodeRuntimeFiles = new Set()
const files = ['src', 'tests'].flatMap((directory) =>
  readdirSync(directory, { recursive: true })
    .filter((filename) => /\.tsx?$/.test(filename))
    .map((filename) => `${directory}/${filename.replaceAll('\\', '/')}`),
)

function featureOf(filename) {
  const parts = filename.split('/')
  return parts[0] === 'src' && parts.length > 2 ? parts[1] : undefined
}

function isTypeOnly(node) {
  if (ts.isImportDeclaration(node)) {
    const clause = node.importClause
    return Boolean(
      clause?.isTypeOnly ||
      (clause &&
        !clause.name &&
        clause.namedBindings &&
        ts.isNamedImports(clause.namedBindings) &&
        clause.namedBindings.elements.length > 0 &&
        clause.namedBindings.elements.every((entry) => entry.isTypeOnly)),
    )
  }
  return Boolean(
    node.isTypeOnly ||
    (node.exportClause &&
      ts.isNamedExports(node.exportClause) &&
      node.exportClause.elements.length > 0 &&
      node.exportClause.elements.every((entry) => entry.isTypeOnly)),
  )
}

for (const file of files) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const feature = featureOf(file)
  const edges = []
  graph.set(file, edges)
  const report = (node, message) => {
    const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1
    errors.push(`${file}:${line}: ${message}`)
  }
  for (const node of source.statements) {
    if ((!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) || !node.moduleSpecifier) {
      continue
    }
    const specifier = node.moduleSpecifier.text
    const typeOnly = isTypeOnly(node)
    if (!typeOnly && specifier.startsWith('node:')) {
      nodeRuntimeFiles.add(file)
    }
    if (file.includes('/client/') && !typeOnly && specifier.startsWith('node:')) {
      report(node, '浏览器代码不能导入 Node.js 运行时模块')
    }
    if (!specifier.startsWith('.')) {
      continue
    }
    const base = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier))
    const target = [base.replace(/\.js$/, '.ts'), base.replace(/\.js$/, '.tsx')].find(existsSync)
    if (!target) {
      report(node, `模块不存在：${specifier}`)
      continue
    }
    const targetFeature = featureOf(target)
    const isProcessEntry = file === 'src/server.ts' && target === 'src/demo/main.ts'
    if (
      targetFeature &&
      targetFeature !== feature &&
      target !== `src/${targetFeature}/index.ts` &&
      !isProcessEntry
    ) {
      report(node, `跨功能引用必须经过 ${targetFeature}/index.ts`)
    }
    if (!typeOnly) {
      edges.push(target)
      if (
        feature &&
        targetFeature &&
        feature !== targetFeature &&
        !dependencies[feature]?.includes(targetFeature)
      ) {
        report(node, `${feature} 不允许运行时依赖 ${targetFeature}`)
      }
      if (
        file.includes('/client/') &&
        target.startsWith('src/dashboard/') &&
        !target.includes('/client/') &&
        target !== 'src/dashboard/contracts.ts'
      ) {
        report(node, '管理页浏览器代码不能导入 HTTP 服务实现')
      }
    }
  }
  function visit(node) {
    if (
      file.startsWith('src/') &&
      feature !== 'storage' &&
      ts.isPropertyAccessExpression(node) &&
      node.name.text === 'db'
    ) {
      report(node, '数据库访问只能在 storage 内部实现')
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
}

const complete = new Set()
const visiting = []
function checkCycles(file) {
  if (visiting.includes(file)) {
    errors.push(`运行时循环依赖：${[...visiting.slice(visiting.indexOf(file)), file].join(' → ')}`)
    return
  }
  if (complete.has(file)) {
    return
  }
  visiting.push(file)
  for (const target of graph.get(file) || []) {
    checkCycles(target)
  }
  visiting.pop()
  complete.add(file)
}
for (const file of files) {
  checkCycles(file)
}

for (const entry of files.filter((file) => file.includes('/client/'))) {
  const seen = new Set()
  function inspectBrowserDependency(file) {
    if (seen.has(file)) {
      return
    }
    seen.add(file)
    if (nodeRuntimeFiles.has(file)) {
      errors.push(entry + ': 浏览器依赖链引入了 Node.js 模块：' + file)
    }
    for (const dependency of graph.get(file) || []) {
      inspectBrowserDependency(dependency)
    }
  }
  inspectBrowserDependency(entry)
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exitCode = 1
} else {
  console.log(
    `功能边界检查通过：${files.length} 个文件，公开入口、依赖方向、数据库边界与运行时循环检查通过。`,
  )
}
