#!/usr/bin/env bash
# RiverEdge 生产环境 systemd 入口（编排目标 riveredge.service 由子单元承载进程）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export RIVEREDGE_SYSTEMD=1
export DEPLOY_MODE=prod
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin:${HOME}/.local/bin:${HOME}/.cargo/bin"

action="${1:-start}"
# shellcheck source=../lib/common.sh
source "$SCRIPT_DIR/../lib/common.sh"

if [ "$action" = "start" ] && systemd_managed_prod_stack 2>/dev/null; then
    load_deploy_env
    ensure_production_swap || true
    wait_for_local_postgres_ready 120 || exit 1
    exec /usr/bin/env bash "$SCRIPT_DIR/prod.sh" start
fi

if [ "$action" = "start" ]; then
    attempt=1
    while [ "$attempt" -le 3 ]; do
        if /usr/bin/env bash "$SCRIPT_DIR/prod.sh" start; then
            exit 0
        fi
        if [ "$attempt" -lt 3 ]; then
            echo "riveredge start failed (attempt ${attempt}/3), cleaning up before retry..." >&2
            /usr/bin/env bash "$SCRIPT_DIR/prod.sh" stop >/dev/null 2>&1 || true
            sleep 15
        fi
        attempt=$((attempt + 1))
    done
    exit 1
fi
exec /usr/bin/env bash "$SCRIPT_DIR/prod.sh" "$action"
