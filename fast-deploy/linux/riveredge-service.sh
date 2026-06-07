#!/usr/bin/env bash
# RiverEdge 生产环境 systemd 入口（由 riveredge.service 调用，勿手动执行）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export RIVEREDGE_SYSTEMD=1
export DEPLOY_MODE=prod
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin:${HOME}/.local/bin:${HOME}/.cargo/bin"

exec "$SCRIPT_DIR/prod.sh" "${1:-start}"
