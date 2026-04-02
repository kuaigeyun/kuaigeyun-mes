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
    log_info "正在拉起后端 (8200)..."
    cd riveredge-backend
    # 强制清理旧的 PID
    [ -f "../.logs/backend.pid" ] && rm -f "../.logs/backend.pid"
    PYTHONPATH="src" nohup uv run uvicorn server.main:app --host 0.0.0.0 --port 8200 --reload --reload-dir src > ../.logs/backend.log 2>&1 &
    echo $! > ../.logs/backend.pid
    cd ..
    
    # 轮询等待
    local retries=0
    while [ $retries -lt $BACKEND_START_TIMEOUT ]; do
        check_port 8200 && break
        sleep 1
        let retries=retries+1
    done
    check_port 8200 || { log_error "后端启动超时 (30s)"; return 1; }
    log_success "后端就绪!"
}

start_frontend() {
    log_info "正在拉起前端 (8100)..."
    cd riveredge-frontend
    # 自动校准代理
    sed -i "s|target: 'http://localhost:[0-9]\+'|target: 'http://localhost:8200'|g" vite.config.ts 2>/dev/null || true
    [ -f "../.logs/frontend.pid" ] && rm -f "../.logs/frontend.pid"
    nohup npx vite --port 8100 --host 127.0.0.1 > ../.logs/frontend.log 2>&1 &
    echo $! > ../.logs/frontend.pid
    cd ..
    log_success "前端已挂起!"
}

stop_all() {
    log_info "停止所有服务..."
    kill_port 8200
    kill_port 8100
}

case "$1" in
    stop) stop_all ;;
    status)
        check_port 8200 && log_success "Backend [OK]" || log_warn "Backend [OFF]"
        check_port 8100 && log_success "Frontend [OK]" || log_warn "Frontend [OFF]"
        ;;
    be) kill_port 8200; start_backend ;;
    fe) kill_port 8100; start_frontend ;;
    *)
        mkdir -p .logs
        stop_all
        start_backend && start_frontend
        log_success "🚀 RiverEdge 系统已恢复就绪!"
        echo "  - Web端: http://localhost:8100"
        echo "  - API: http://localhost:8200"
        ;;
esac
