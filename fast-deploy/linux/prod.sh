#!/usr/bin/env bash
# RiverEdge 生产模式快速部署（Linux / macOS）
# 用法: ./fast-deploy/linux/prod.sh [check|install|configure|migrate|build|start|stop|status|update|install-service|uninstall-service]
# 可选: USE_MIRROR=1 ./fast-deploy/linux/prod.sh install  （国内镜像）

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export DEPLOY_MODE=prod
# shellcheck source=../lib/common.sh
source "$SCRIPT_DIR/../lib/common.sh"
load_deploy_env
fd_dispatch "${1:-}"
