#!/bin/bash

# RiverEdge SaaS - Taskiq Worker + Scheduler（PostgreSQL broker）

# 必须固定到本脚本所在目录，否则从其它目录调用时 $(pwd)/src 会指错，worker 无法 import core.*
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR" || exit 1
export PYTHONPATH="${PYTHONPATH}:${SCRIPT_DIR}/src"

echo "🚀 RiverEdge Taskiq Worker + Scheduler 启动中... (dir=${SCRIPT_DIR})"

ENVIRONMENT=${ENVIRONMENT:-development}

if [ "$ENVIRONMENT" = "development" ]; then
    TASKIQ_WORKERS="${TASKIQ_WORKERS:-2}"
else
    TASKIQ_WORKERS="${TASKIQ_WORKERS:-1}"
fi

# taskiq --reload 需要额外安装 taskiq[reload]；默认关闭，避免脚本直接启动失败。
# 如需启用，可手动导出 TASKIQ_ENABLE_RELOAD=1。
if [ "${TASKIQ_ENABLE_RELOAD:-0}" = "1" ]; then
    RELOAD_FLAG="--reload"
else
    RELOAD_FLAG=""
fi

# Worker：消费 PG 队列中的任务（与 API 共用 core.tasks.taskiq_app:broker）
echo "📦 正在启动 Taskiq worker..."
uv run taskiq worker \
    --app-dir src \
    --fs-discover \
    --workers "$TASKIQ_WORKERS" \
    $RELOAD_FLAG \
    core.tasks.taskiq_app:broker &

# Scheduler：cron 任务（schedule 标签 + AsyncpgScheduleSource）
echo "⏰ 正在启动 Taskiq scheduler..."
uv run taskiq scheduler \
    --app-dir src \
    --fs-discover \
    core.tasks.taskiq_app:scheduler &

wait
