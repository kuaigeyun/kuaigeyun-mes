import { copyFileSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const src = resolve(root, 'node_modules/@mlightcad/libredwg-web/wasm/libredwg-web.wasm');
const dest = resolve(root, 'static/libredwg-web.wasm');

if (!existsSync(src)) {
  console.warn('[sync-libredwg-wasm] skip: libredwg wasm not found');
  process.exit(0);
}

copyFileSync(src, dest);
console.log('[sync-libredwg-wasm] copied to static/libredwg-web.wasm');
