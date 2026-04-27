#!/bin/bash

# RiverEdge SaaS - Taskiq Worker + Scheduler（PostgreSQL broker）

# 必须固定到本脚本所在目录，否则从其它目录调用时 $(pwd)/src 会指错，worker 无法 import core.*
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR" || exit 1
export PYTHONPATH="${PYTHONPATH}:${SCRIPT_DIR}/src"

echo "🚀 RiverEdge Taskiq Worker + Scheduler 启动中... (dir=${SCRIPT_DIR})"

ENVIRONMENT=${ENVIRONMENT:-development}

if [ "$ENVIRONMENT" = "development" ]; then
    RELOAD="--reload"
else
    RELOAD=""
fi

# Worker：消费 PG 队列中的任务（与 API 共用 core.tasks.taskiq_app:broker）
echo "📦 正在启动 Taskiq worker..."
uv run taskiq worker core.tasks.taskiq_app:broker \
    --fs-discover \
    $RELOAD \
    --modules core.tasks.taskiq_app \
    --modules core.inngest.functions \
    --modules apps.master_data.inngest.functions \
    --modules apps.kuaizhizao.inngest.functions &

# Scheduler：cron 任务（schedule 标签 + AsyncpgScheduleSource）
echo "⏰ 正在启动 Taskiq scheduler..."
uv run taskiq scheduler core.tasks.taskiq_app:scheduler \
    --fs-discover \
    $RELOAD \
    --modules core.tasks.taskiq_app \
    --modules core.inngest.functions \
    --modules apps.master_data.inngest.functions \
    --modules apps.kuaizhizao.inngest.functions &

wait
