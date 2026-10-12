#!/usr/bin/env bash
# systemd 直管：Taskiq worker 前台运行
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
exec "$(resolve_uv)" run $(backend_uv_extra_args) taskiq worker --app-dir src \
    --workers "$TASKIQ_WORKERS" \
    core.tasks.taskiq_app:broker \
    core.tasks.taskiq_app core.tasks.ai_tasks core.tasks.worker_bootstrap core.tasks.data_backup_handlers
