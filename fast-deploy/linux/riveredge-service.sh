#!/usr/bin/env bash
# RiverEdge 生产环境 systemd 入口（由 riveredge.service 调用，勿手动执行）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${HOME}/.local/bin:${HOME}/.cargo/bin"
export DEPLOY_MODE=prod

exec "$SCRIPT_DIR/prod.sh" "${1:-start}"
