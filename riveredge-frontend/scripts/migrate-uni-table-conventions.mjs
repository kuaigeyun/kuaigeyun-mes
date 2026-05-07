/**
 * One-shot: add stable `columnPersistenceId` on every `<UniTable` that lacks it.
 * UniTable import: keep a relative path to `components/uni-table` (barrel `@/components` is unreliable in `vite build src`).
 * Run: node scripts/migrate-uni-table-conventions.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const srcRoot = path.join(root, 'src')

const skipFiles = new Set([
  path.join(srcRoot, 'components', 'uni-table', 'index.tsx'),
  path.join(srcRoot, 'components', 'uni-table-detail', 'UniTableDetail.tsx'),
  path.join(srcRoot, 'components', 'layout-templates', 'ListPageTemplate.tsx'),
  path.join(srcRoot, 'components', 'layout-templates', 'TwoColumnLayout.tsx'),
])

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (name.endsWith('.tsx')) out.push(p)
  }
  return out
}

function makeBaseId(absFile) {
  let rel = path.relative(srcRoot, absFile).replace(/\\/g, '/')
  rel = rel.replace(/\.tsx$/, '')
  if (rel.endsWith('/index')) rel = rel.slice(0, -6)
  return rel.split('/').join('.')
}

function addColumnPersistence(content, absFile) {
  if (/\bcolumnPersistenceId\s*=/.test(content)) return content
  const baseId = makeBaseId(absFile)
  let n = 0
  return content.replace(
    /(<UniTable(?![A-Za-z])(?:<[^>]+>)?\r?\n)(\s*)/g,
    (_, g1, indent) => {
      n += 1
      const id = n === 1 ? baseId : `${baseId}:${n}`
      return `${g1}${indent}columnPersistenceId="${id}"\n${indent}`
    },
  )
}

const files = walk(srcRoot)
let changed = 0
for (const file of files) {
  if (skipFiles.has(file)) continue
  let c = fs.readFileSync(file, 'utf8')
  const orig = c
  if (/<UniTable(?![A-Za-z])/.test(c)) {
    c = addColumnPersistence(c, file)
  }
  if (c !== orig) {
    fs.writeFileSync(file, c)
    changed++
    console.log('updated', path.relative(root, file))
  }
}
console.log('done, files changed:', changed)
