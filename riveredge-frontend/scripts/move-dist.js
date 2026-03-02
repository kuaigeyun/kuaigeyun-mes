#!/usr/bin/env node
// 若 vite 输出到 src/dist，则移动到项目根 dist（与 Caddy 期望的 riveredge-frontend/dist 一致）
// 同时复制 static 目录（fonts、img、lottie、social 等）到 dist，确保生产环境可访问
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const srcDist = path.join(projectRoot, 'src', 'dist');
const rootDist = path.join(projectRoot, 'dist');
const staticDir = path.join(projectRoot, 'static');

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

if (fs.existsSync(srcDist)) {
  if (fs.existsSync(rootDist)) fs.rmSync(rootDist, { recursive: true });
  fs.renameSync(srcDist, rootDist);
  console.log('Moved src/dist -> dist');
}

// 复制 static 到 dist（含 fonts、img、lottie、social 等）
if (fs.existsSync(staticDir)) {
  copyRecursive(staticDir, rootDist);
  console.log('Copied static/ -> dist/');
}
