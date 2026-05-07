/**
 * Replace `import … from '@/components'` (UniTable barrel) with a relative path to `components/uni-table`.
 * Needed because production `vite build src` does not reliably resolve `@/components` with the current Rollup alias chain.
 * Run: node scripts/fix-uni-table-imports-relative.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const src = path.join(root, 'src')
const target = path.join(src, 'components', 'uni-table')

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name)
    if (name.isDirectory()) {
      if (name.name === 'node_modules' || name.name === 'dist') continue
      walk(p, out)
    } else if (name.name.endsWith('.tsx') || name.name.endsWith('.ts')) {
      out.push(p)
    }
  }
  return out
}

function relImport(fromFile) {
  let rel = path.relative(path.dirname(fromFile), target).split(path.sep).join('/')
  if (!rel.startsWith('.')) rel = `./${rel}`
  return rel
}

let n = 0
for (const f of walk(src)) {
  let c = fs.readFileSync(f, 'utf8')
  if (!c.includes('@/components')) continue
  const r = relImport(f)
  // 仅替换真正的 import 行，避免 JSDoc 里示例代码中的 from '@/components' 被误改
  const newC = c.replace(
    /^\s*import\s+[^'"]+\s+from\s+['"]@\/components['"]\s*;?\s*$/gm,
    (line) => line.replace(/from\s+['"]@\/components['"]/, `from '${r}'`),
  )
  if (newC !== c) {
    fs.writeFileSync(f, newC)
    console.log(path.relative(src, f), '->', r)
    n++
  }
}
console.log('done, files changed:', n)
