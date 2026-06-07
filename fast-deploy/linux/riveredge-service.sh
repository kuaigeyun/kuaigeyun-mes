#!/usr/bin/env bash
# RiverEdge 生产环境 systemd 入口（由 riveredge.service 调用，勿手动执行）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export RIVEREDGE_SYSTEMD=1
export DEPLOY_MODE=prod
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin:${HOME}/.local/bin:${HOME}/.cargo/bin"

action="${1:-start}"
if [ "$action" = "start" ]; then
    attempt=1
    while [ "$attempt" -le 3 ]; do
        if /usr/bin/env bash "$SCRIPT_DIR/prod.sh" start; then
            exit 0
        fi
        if [ "$attempt" -lt 3 ]; then
            echo "riveredge start failed (attempt ${attempt}/3), retry in 15s..." >&2
            sleep 15
        fi
        attempt=$((attempt + 1))
    done
    exit 1
fi
exec /usr/bin/env bash "$SCRIPT_DIR/prod.sh" "$action"
