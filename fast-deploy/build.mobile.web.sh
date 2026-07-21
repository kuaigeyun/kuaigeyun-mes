#!/usr/bin/env bash
# 构建 riveredge-app/mobile 的 Expo Web 导出到 web-dist（供 Caddy /mobile 托管）。
# 移动端源码在闭源目录，产物默认不同步主仓；部署机需具备该目录并执行本脚本（或 npm run build:web）。
#
# Usage: ./fast-deploy/build.mobile.web.sh

set -euo pipefail
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=8192}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MOBILE_DIR="$PROJECT_ROOT/riveredge-app/mobile"
WEB_DIST="$MOBILE_DIR/web-dist"

if [ ! -f "$MOBILE_DIR/package.json" ]; then
  echo "错误: 缺少 $MOBILE_DIR（闭源移动端未组装到工作区）"
  exit 1
fi

cd "$MOBILE_DIR"
if [ ! -d node_modules ]; then
  npm install
fi

npm run build:web

test -f "$WEB_DIST/index.html" || {
  echo "错误: 未生成 $WEB_DIST/index.html"
  exit 1
}

echo "完成: Expo Web → $WEB_DIST"
