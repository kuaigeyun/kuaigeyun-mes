import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const src = resolve(root, 'node_modules/@mlightcad/libredwg-web/wasm/libredwg-web.wasm');
const dest = resolve(root, 'static/libredwg-web.wasm');

if (!existsSync(src)) {
  console.warn('[sync-libredwg-wasm] skip: libredwg wasm not found');
} else {
  copyFileSync(src, dest);
  console.log('[sync-libredwg-wasm] copied to static/libredwg-web.wasm');
}

const workerDir = resolve(root, 'static/cad-workers');
mkdirSync(workerDir, { recursive: true });
const workers = [
  [
    'node_modules/@mlightcad/cad-simple-viewer/dist/libredwg-parser-worker.js',
    'libredwg-parser-worker.js',
  ],
  [
    'node_modules/@mlightcad/cad-simple-viewer/dist/mtext-renderer-worker.js',
    'mtext-renderer-worker.js',
  ],
];
for (const [rel, name] of workers) {
  const from = resolve(root, rel);
  if (!existsSync(from)) {
    throw new Error(`[sync-libredwg-wasm] missing worker: ${rel}`);
  }
  copyFileSync(from, resolve(workerDir, name));
  console.log(`[sync-libredwg-wasm] copied cad-workers/${name}`);
}
