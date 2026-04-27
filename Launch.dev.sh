#!/bin/bash
# RiverEdge SaaS 多组织框架 - 一键启动脚本 (重构稳定版)

# 环境参数
BACKEND_PORT=8200
FRONTEND_PORT=8100
BACKEND_START_TIMEOUT=30

log_info() { echo -e "\033[0;34m[$(date +'%H:%M:%S')] INFO: $1\033[0m"; }
log_warn() { echo -e "\033[1;33m[$(date +'%H:%M:%S')] WARN: $1\033[0m"; }
log_success() { echo -e "\033[0;32m[$(date +'%H:%M:%S')] SUCCESS: $1\033[0m"; }
log_error() { echo -e "\033[0;31m[$(date +'%H:%M:%S')] ERROR: $1\033[0m"; }

check_port() {
    netstat -ano 2>/dev/null | grep ":$1 " | grep -qE "LISTENING|ESTABLISHED|TIME_WAIT" && return 0
    return 1
}

kill_port() {
    local port=$1
    if check_port $port; then
        log_warn "清理端口 $port..."
        local pids=$(netstat -ano 2>/dev/null | grep ":$port " | awk '{print $NF}' | sort -u | grep -v "^0$")
        for pid in $pids; do
            [ ! -z "$pid" ] && taskkill.exe //F //PID $pid 2>/dev/null || true
        done
        sleep 1
    fi
}

start_backend() {
    log_info "正在拉起后端 (${BACKEND_PORT})..."
    cd riveredge-backend
    # 强制清理旧的 PID
    [ -f "../.logs/backend.pid" ] && rm -f "../.logs/backend.pid"
    PYTHONPATH="src" nohup uv run uvicorn server.main:app --host 0.0.0.0 --port "${BACKEND_PORT}" --reload --reload-dir src > ../.logs/backend.log 2>&1 &
    echo $! > ../.logs/backend.pid
    cd ..
    
    # 轮询等待
    local retries=0
    while [ $retries -lt $BACKEND_START_TIMEOUT ]; do
        check_port "${BACKEND_PORT}" && break
        sleep 1
        let retries=retries+1
    done
    check_port "${BACKEND_PORT}" || { log_error "后端启动超时 (${BACKEND_START_TIMEOUT}s)"; return 1; }
    log_success "后端就绪!"
}

start_worker() {
    log_info "正在拉起 Taskiq Worker/Scheduler..."
    cd riveredge-backend
    # 启动 Worker
    [ -f "../.logs/worker.pid" ] && rm -f "../.logs/worker.pid"
    PYTHONPATH="src" nohup uv run taskiq worker core.tasks.taskiq_app:broker --fs-discover \
        core.tasks.taskiq_app \
        core.tasks.data_backup_handlers \
        core.inngest.functions \
        apps.master_data.inngest.functions \
        apps.kuaizhizao.inngest.functions > ../.logs/worker.log 2>&1 &
    echo $! > ../.logs/worker.pid
    
    # 启动 Scheduler
    [ -f "../.logs/scheduler.pid" ] && rm -f "../.logs/scheduler.pid"
    PYTHONPATH="src" nohup uv run taskiq scheduler core.tasks.taskiq_app:scheduler --fs-discover \
        core.tasks.taskiq_app \
        core.inngest.functions \
        apps.master_data.inngest.functions \
        apps.kuaizhizao.inngest.functions > ../.logs/scheduler.log 2>&1 &
    echo $! > ../.logs/scheduler.pid
    cd ..
    log_success "Taskiq 异步引擎已就绪!"
}

start_frontend() {
    log_info "正在拉起前端 (${FRONTEND_PORT})..."
    cd riveredge-frontend
    # 自动校准代理
    sed -i "s|target: 'http://localhost:[0-9]\+'|target: 'http://localhost:${BACKEND_PORT}'|g" vite.config.ts 2>/dev/null || true
    [ -f "../.logs/frontend.pid" ] && rm -f "../.logs/frontend.pid"
    nohup npx vite --port "${FRONTEND_PORT}" --host 127.0.0.1 > ../.logs/frontend.log 2>&1 &
    echo $! > ../.logs/frontend.pid
    cd ..
    log_success "前端已挂起!"
}

stop_all() {
    log_info "停止所有服务..."
    kill_port "${BACKEND_PORT}"
    kill_port "${FRONTEND_PORT}"
    
    # 清理 Worker 和 Scheduler
    for pidfile in .logs/worker.pid .logs/scheduler.pid; do
        if [ -f "$pidfile" ]; then
            local pid=$(cat "$pidfile")
            [ ! -z "$pid" ] && taskkill.exe //F //PID $pid 2>/dev/null || true
            rm -f "$pidfile"
        fi
    done
}

case "$1" in
    stop) stop_all ;;
    status)
        check_port "${BACKEND_PORT}" && log_success "Backend [OK]" || log_warn "Backend [OFF]"
        check_port "${FRONTEND_PORT}" && log_success "Frontend [OK]" || log_warn "Frontend [OFF]"
        [ -f ".logs/worker.pid" ] && log_success "Worker [OK]" || log_warn "Worker [OFF]"
        [ -f ".logs/scheduler.pid" ] && log_success "Scheduler [OK]" || log_warn "Scheduler [OFF]"
        ;;
    be) kill_port "${BACKEND_PORT}"; start_backend ;;
    fe) kill_port "${FRONTEND_PORT}"; start_frontend ;;
    *)
        mkdir -p .logs
        stop_all
        start_backend && start_worker && start_frontend
        log_success "🚀 RiverEdge 系统已恢复就绪!"
        echo "  - Web端: http://localhost:${FRONTEND_PORT}"
        echo "  - API: http://localhost:${BACKEND_PORT}"
        ;;
esac
