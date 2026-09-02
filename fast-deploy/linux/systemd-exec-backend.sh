#!/usr/bin/env bash
# systemd 直管：uvicorn 前台运行（OOM 后由 Restart=always 拉起）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export DEPLOY_MODE=prod
export RIVEREDGE_SYSTEMD=1
# shellcheck source=../lib/common.sh
source "$SCRIPT_DIR/../lib/common.sh"
load_deploy_env
ensure_timezone_env
ensure_sensitive_lexicon_pack || exit 1
sync_backend_deps
export_production_malloc_tuning
export PORT="${BACKEND_PORT}"
export HOST=127.0.0.1
export ENVIRONMENT=production
export DEBUG=false
export SETUPTOOLS_EGG_INFO_DIR="$LOGS_DIR"
export PYTHONPATH="$BACKEND_DIR/src"
playwright_export_env
cd "$BACKEND_DIR"
exec "$(resolve_uv)" run $(backend_uv_extra_args) uvicorn server.main:app \
    --host 127.0.0.1 --port "$BACKEND_PORT" --workers 1
