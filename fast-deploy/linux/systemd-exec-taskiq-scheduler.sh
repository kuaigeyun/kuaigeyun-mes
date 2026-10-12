#!/usr/bin/env bash
# systemd 直管：Taskiq scheduler 前台运行
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export DEPLOY_MODE=prod
export RIVEREDGE_SYSTEMD=1
# shellcheck source=../lib/common.sh
source "$SCRIPT_DIR/../lib/common.sh"
load_deploy_env
sync_backend_deps
export_production_malloc_tuning
export ENVIRONMENT=production
export SETUPTOOLS_EGG_INFO_DIR="$LOGS_DIR"
export PYTHONPATH="$BACKEND_DIR/src"
playwright_export_env
cd "$BACKEND_DIR"
exec "$(resolve_uv)" run $(backend_uv_extra_args) taskiq scheduler --app-dir src \
    core.tasks.taskiq_app:scheduler \
    core.tasks.taskiq_app
