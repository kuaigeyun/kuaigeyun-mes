#!/usr/bin/env bash
# RiverEdge 开发模式快速部署（Linux / macOS / Git Bash）
# 用法: ./fast-deploy/linux/dev.sh [check|install|configure|migrate|build|start|stop|status|update]

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export DEPLOY_MODE=dev
# shellcheck source=../lib/common.sh
source "$SCRIPT_DIR/../lib/common.sh"
load_deploy_env
fd_dispatch "${1:-}"
