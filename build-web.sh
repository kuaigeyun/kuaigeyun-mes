#!/usr/bin/env bash
# 兼容入口：保留根目录调用方式，实际执行 riveredge-panel/build-web.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$SCRIPT_DIR/riveredge-panel/build-web.sh" "$@"
