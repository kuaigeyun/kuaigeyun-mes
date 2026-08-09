/**
 * postinstall 末步：patch-package 修改 node_modules 后，Vite 依赖预打包缓存
 * （node_modules/.vite）不会因 lockfile 未变而失效，会继续 serve 未打补丁的旧 bundle。
 * 唯一正确路径：补丁应用后清除缓存，dev server 下次启动时重新预打包。
 */
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
rmSync(join(root, 'node_modules', '.vite'), { recursive: true, force: true });
console.log('[clear-vite-dep-cache] node_modules/.vite removed (re-optimize on next dev start)');
