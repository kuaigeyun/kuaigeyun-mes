#!/usr/bin/env bash
# systemd：KU-Bridge WorkBuddy MCP Sidecar（监听 127.0.0.1，由 Caddy /mcp 反代）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export DEPLOY_MODE=prod
export RIVEREDGE_SYSTEMD=1
# shellcheck source=../lib/common.sh
source "$SCRIPT_DIR/../lib/common.sh"
load_deploy_env

sidecar_dir="$(resolve_workbuddy_mcp_dir)" || exit 1
env_file="${WORKBUDDY_MCP_ENV_FILE:-$FAST_DEPLOY_CONFIG_DIR/workbuddy-mcp.env}"
if [ ! -f "$env_file" ]; then
    echo "缺少 Sidecar 环境文件: $env_file（请从 workbuddy-mcp.env.example 复制并填写 OPEN_API_*）" >&2
    exit 1
fi

export MCP_HOST=127.0.0.1
export MCP_PORT="${WORKBUDDY_MCP_PORT:-8765}"
export MCP_TRANSPORT="${MCP_TRANSPORT:-streamable-http}"

# shellcheck disable=SC1090
set -a
source "$env_file"
set +a

cd "$sidecar_dir"
exec "$(resolve_uv)" run python server.py
