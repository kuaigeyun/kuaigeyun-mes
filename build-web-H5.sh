#!/usr/bin/env bash
# 兼容旧名字：转发到根目录 build-web.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$SCRIPT_DIR/build-web.sh" "$@"
