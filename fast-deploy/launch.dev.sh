#!/bin/bash
# RiverEdge SaaS 多组织框架 - 一键启动脚本 (重构稳定版)
# 用法: ./fast-deploy/launch.dev.sh [stop|status|be|fe]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT" || exit 1

# 环境参数
BACKEND_PORT=8200
FRONTEND_PORT=8100
BACKEND_START_TIMEOUT=90
PORT_KILL_MAX_ROUNDS=6

log_info() { echo -e "\033[0;34m[$(date +'%H:%M:%S')] INFO: $1\033[0m"; }
log_warn() { echo -e "\033[1;33m[$(date +'%H:%M:%S')] WARN: $1\033[0m"; }
log_success() { echo -e "\033[0;32m[$(date +'%H:%M:%S')] SUCCESS: $1\033[0m"; }
log_error() { echo -e "\033[0;31m[$(date +'%H:%M:%S')] ERROR: $1\033[0m"; }

# Windows: 直接对端口监听者 Stop-Process（不依赖 Git Bash 能否 tasklist 到 PID）
powershell_stop_port_listeners() {
    local port=$1
    command -v powershell.exe >/dev/null 2>&1 || return 0
    powershell.exe -NoProfile -Command "
        Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue |
          Select-Object -ExpandProperty OwningProcess -Unique |
          Where-Object { \$_ -gt 0 } |
          ForEach-Object { Stop-Process -Id \$_ -Force -ErrorAction SilentlyContinue }
    " 2>/dev/null || true
}

get_listening_pids_raw() {
    local port=$1
    if command -v powershell.exe >/dev/null 2>&1; then
        powershell.exe -NoProfile -Command "
            Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue |
              Select-Object -ExpandProperty OwningProcess -Unique |
              Where-Object { \$_ -gt 0 }
        " 2>/dev/null | tr -d '\r' | sort -u | grep -E '^[0-9]+$' || true
    else
        netstat -ano 2>/dev/null \
            | grep LISTENING \
            | grep -E "[:.]${port}[[:space:]]" \
            | awk '{print $NF}' \
            | sort -u \
            | grep -E '^[0-9]+$' || true
    fi
}

# 状态展示用：仅返回仍存活的 PID
get_listening_pids() {
    local port=$1
    local alive=""
    local pid
    for pid in $(get_listening_pids_raw "$port"); do
        pid_is_alive "$pid" && alive="${alive}${pid} "
    done
    echo "$alive" | xargs 2>/dev/null || true
}

backend_http_ready() {
    curl -sf --connect-timeout 1 --max-time 1 "http://127.0.0.1:${BACKEND_PORT}/health" >/dev/null 2>&1
}

backend_port_ready() {
    [ -n "$(get_listening_pids_raw "${BACKEND_PORT}")" ]
}

check_port() {
    backend_http_ready
}

pid_is_alive() {
    local pid=$1
    [ -n "$pid" ] || return 1
    kill -0 "$pid" 2>/dev/null && return 0
    tasklist.exe //FI "PID eq $pid" 2>/dev/null | grep -q "$pid" && return 0
    return 1
}

graceful_kill_pid() {
    local pid=$1
    [ -z "$pid" ] && return 0
    pid_is_alive "$pid" || return 0
    kill -INT "$pid" 2>/dev/null || taskkill.exe //PID "$pid" //T 2>/dev/null || true
    sleep 3
    pid_is_alive "$pid" && taskkill.exe //F //PID "$pid" //T 2>/dev/null || true
}

kill_pids() {
    local pids=$1
    local pid
    for pid in $pids; do
        [ -n "$pid" ] || continue
        kill -INT "$pid" 2>/dev/null || taskkill.exe //PID "$pid" 2>/dev/null || true
    done
    sleep 2
    for pid in $pids; do
        [ -n "$pid" ] || continue
        taskkill.exe //F //PID "$pid" 2>/dev/null || true
    done
    sleep 1
}

kill_port() {
    local port=$1
    local skip_uvicorn_tree_kill=${2:-0}
    local round=0
    local pids

    while [ "$round" -lt "$PORT_KILL_MAX_ROUNDS" ]; do
        if [ "$port" = "${BACKEND_PORT}" ] && [ "$skip_uvicorn_tree_kill" != "1" ]; then
            kill_uvicorn_reload_tree "${BACKEND_PORT}"
        fi
        powershell_stop_port_listeners "$port"
        pids="$(get_listening_pids_raw "$port")"
        alive_pids=""
        for pid in $pids; do
            pid_is_alive "$pid" && alive_pids="${alive_pids}${pid} "
        done
        if [ -n "$alive_pids" ]; then
            log_warn "清理端口 $port（第 $((round + 1)) 轮）: ${alive_pids}"
            kill_pids "$alive_pids"
        fi
        if [ "$port" = "${BACKEND_PORT}" ]; then
            backend_http_ready || return 0
        else
            [ -z "$(get_listening_pids_raw "$port")" ] && return 0
        fi
        round=$((round + 1))
        sleep 1
    done

    if [ "$port" = "${BACKEND_PORT}" ]; then
        backend_http_ready && { log_error "端口 $port 仍被占用（HTTP /health 可访问）"; return 1; }
        return 0
    fi
    pids="$(get_listening_pids_raw "$port")"
    if [ -n "$pids" ]; then
        log_error "端口 $port 仍有监听: $pids"
        return 1
    fi
}

# Windows：清理 uvicorn --reload 整棵树（reloader + spawn_main worker + 后台 bash 启动器）
# TCP OwningProcess 常为已退出的 reloader 幽灵 PID，杀它无效；须杀 worker 与启动 shell。
kill_uvicorn_reload_tree() {
    local port=$1
    command -v powershell.exe >/dev/null 2>&1 || return 0
    powershell.exe -NoProfile -Command "
        \$port = '${port}'
        \$killed = @()

        Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | ForEach-Object {
            \$cmd = \$_.CommandLine
            if (-not \$cmd) { return }
            \$id = \$_.ProcessId
            \$name = \$_.Name
            \$shouldKill = \$false

            # reload worker（真正处理 HTTP 的 spawn 子进程）
            if (\$cmd -match 'multiprocessing\.spawn import spawn_main') {
                \$shouldKill = \$true
            }

            # python / uv 本体上的 uvicorn（排除 bash/powershell/wmic 包装命令）
            if (-not \$shouldKill -and \$name -match '^(python|uv|uvicorn)(\.exe)?$') {
                if ((\$cmd -match 'server\.main:app') -and (\$cmd -match ('--port[\s=]' + \$port))) {
                    \$shouldKill = \$true
                }
            }

            # 直接启动后端的 bash（含 Cursor 后台终端；排除 Agent 工具包装）
            if (-not \$shouldKill -and \$name -match 'bash') {
                if ((\$cmd -match 'riveredge-backend') -and (\$cmd -match 'uv run.*uvicorn.*server\.main:app') -and (\$cmd -match ('--port[\s=]' + \$port)) -and (\$cmd -notmatch 'CURSOR_STATE_INPUT_FILE')) {
                    \$shouldKill = \$true
                }
            }

            if (\$shouldKill) {
                Stop-Process -Id \$id -Force -ErrorAction SilentlyContinue
                \$killed += \$id
            }
        }

        if (\$killed.Count -gt 0) {
            Write-Output ('killed: ' + (\$killed -join ', '))
        }
    " 2>/dev/null || true
    sleep 2
}

kill_backend_by_command_line() {
    kill_uvicorn_reload_tree "${BACKEND_PORT}"
}

# Windows：清理 taskiq worker / scheduler 整棵树（uv run / taskiq.exe 会 fork，仅杀 pidfile 会残留占 PG 连接的子进程）
kill_taskiq_processes() {
    command -v powershell.exe >/dev/null 2>&1 || return 0
    local round=0
    while [ "$round" -lt 3 ]; do
        local killed
        killed="$(powershell.exe -NoProfile -Command "
            \$killed = @()
            Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | ForEach-Object {
                \$cmd = \$_.CommandLine
                if (-not \$cmd) { return }
                \$id = \$_.ProcessId
                \$name = \$_.Name
                \$shouldKill = \$false

                # taskiq.exe / taskiq worker|scheduler（Windows 命令行常为 taskiq.exe\" worker ...）
                if (\$cmd -match 'core\.tasks\.taskiq_app:(broker|scheduler)') {
                    \$shouldKill = \$true
                }
                if (-not \$shouldKill -and \$cmd -match 'taskiq(\.exe)?[\"'']?\s+(worker|scheduler)') {
                    \$shouldKill = \$true
                }
                if (-not \$shouldKill -and \$name -match '^(python|uv|nohup)(\.exe)?$') {
                    if ((\$cmd -match 'riveredge-backend') -and (\$cmd -match 'taskiq (worker|scheduler)')) {
                        \$shouldKill = \$true
                    }
                }
                if (-not \$shouldKill -and \$name -match 'bash') {
                    if ((\$cmd -match 'riveredge-backend') -and (\$cmd -match 'taskiq (worker|scheduler)')) {
                        \$shouldKill = \$true
                    }
                }

                if (\$shouldKill) {
                    Stop-Process -Id \$id -Force -ErrorAction SilentlyContinue
                    \$killed += \$id
                }
            }
            if (\$killed.Count -gt 0) { Write-Output (\$killed -join ', ') }
        " 2>/dev/null | tr -d '\r' || true)"
        if [ -n "$killed" ]; then
            log_warn "清理 taskiq 残留进程（第 $((round + 1)) 轮）: ${killed}"
        else
            break
        fi
        round=$((round + 1))
        sleep 2
    done
    sleep 1
}

taskiq_service_running() {
    local token=$1
    command -v powershell.exe >/dev/null 2>&1 || return 1
    powershell.exe -NoProfile -Command "
        \$found = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
            Where-Object { \$_.CommandLine -and (\$_.CommandLine -match 'core\.tasks\.taskiq_app:${token}') }
        if (\$found) { exit 0 } else { exit 1 }
    " >/dev/null 2>&1
}

cleanup_backend_processes() {
    log_info "清理后端进程 (port ${BACKEND_PORT})..."

    if [ -f ".logs/backend.pid" ]; then
        local pid
        pid="$(cat .logs/backend.pid 2>/dev/null)"
        [ -n "$pid" ] && graceful_kill_pid "$pid"
        rm -f .logs/backend.pid
    fi

    kill_backend_by_command_line
    kill_port "${BACKEND_PORT}" 1 || {
        log_error "8200 仍被占用。若 Cursor 里还有后台 uvicorn 终端，请手动关闭后重试。"
        return 1
    }
}

start_backend() {
    local skip_cleanup=${1:-0}
    log_info "正在拉起后端 (${BACKEND_PORT})..."
    if [ "$skip_cleanup" != "1" ]; then
        cleanup_backend_processes || { log_error "后端端口未释放，拒绝启动"; return 1; }
    elif backend_http_ready; then
        log_error "8200 仍被占用（/health 可访问），请先结束其他终端的 uvicorn 后重试"
        return 1
    fi

    cd riveredge-backend
    export RIVEREDGE_DB_POOL_MIN="${RIVEREDGE_DB_POOL_MIN:-1}"
    export RIVEREDGE_DB_POOL_MAX="${RIVEREDGE_DB_POOL_MAX:-5}"
    PYTHONPATH="src" nohup uv run --extra pdf uvicorn server.main:app --host 0.0.0.0 --port "${BACKEND_PORT}" --reload --reload-dir src > ../.logs/backend.log 2>&1 &
    local backend_launcher_pid=$!
    echo "${backend_launcher_pid}" > ../.logs/backend.pid
    cd ..

    local retries=0
    local ready_mode=""
    while [ "$retries" -lt "$BACKEND_START_TIMEOUT" ]; do
        if backend_http_ready; then
            ready_mode="health"
            break
        fi
        if backend_port_ready; then
            ready_mode="port"
            break
        fi
        if ! pid_is_alive "${backend_launcher_pid}"; then
            log_error "后端进程已退出，请查看 .logs/backend.log"
            return 1
        fi
        sleep 1
        retries=$((retries + 1))
    done
    if [ -z "${ready_mode}" ]; then
        log_error "后端启动超时 (${BACKEND_START_TIMEOUT}s)，请查看 .logs/backend.log"
        return 1
    fi

    local listeners
    listeners="$(get_listening_pids "${BACKEND_PORT}" | tr '\n' ' ')"
    if [ "${ready_mode}" = "health" ]; then
        log_success "后端就绪! (监听 PID: ${listeners:-unknown})"
    else
        log_success "后端已监听，健康检查将很快可用! (监听 PID: ${listeners:-unknown})"
    fi
}

start_worker() {
    log_info "正在拉起 Taskiq Worker/Scheduler..."
    kill_taskiq_processes
    cd riveredge-backend
    [ -f "../.logs/worker.pid" ] && rm -f "../.logs/worker.pid"
    # 开发环境默认 1 worker，避免 API reload + 多 worker 占满 PostgreSQL max_connections
    TASKIQ_WORKERS="${TASKIQ_WORKERS:-1}"
    export RIVEREDGE_TASKIQ_POOL_MIN="${RIVEREDGE_TASKIQ_POOL_MIN:-1}"
    export RIVEREDGE_TASKIQ_POOL_MAX="${RIVEREDGE_TASKIQ_POOL_MAX:-2}"
    PYTHONPATH="src" nohup uv run --extra pdf taskiq worker \
        --app-dir src \
        --fs-discover \
        --workers "$TASKIQ_WORKERS" \
        core.tasks.taskiq_app:broker > ../.logs/worker.log 2>&1 &
    echo $! > ../.logs/worker.pid
    local worker_launcher_pid=$!

    [ -f "../.logs/scheduler.pid" ] && rm -f "../.logs/scheduler.pid"
    PYTHONPATH="src" nohup uv run --extra pdf taskiq scheduler \
        --app-dir src \
        --fs-discover \
        core.tasks.taskiq_app:scheduler > ../.logs/scheduler.log 2>&1 &
    echo $! > ../.logs/scheduler.pid
    local scheduler_launcher_pid=$!

    sleep 5
    if ! taskiq_service_running broker; then
        cd ..
        log_error "Taskiq Worker 启动失败，请查看 .logs/worker.log"
        return 1
    fi
    if ! taskiq_service_running scheduler; then
        cd ..
        log_error "Taskiq Scheduler 启动失败，请查看 .logs/scheduler.log"
        return 1
    fi
    cd ..
    log_success "Taskiq 异步引擎已就绪!"
}

start_frontend() {
    log_info "正在拉起前端 (${FRONTEND_PORT})..."
    kill_port "${FRONTEND_PORT}" || true
    cd riveredge-frontend
    sed -i "s|target: 'http://localhost:[0-9]\+'|target: 'http://localhost:${BACKEND_PORT}'|g" vite.config.ts 2>/dev/null || true
    [ -f "../.logs/frontend.pid" ] && rm -f "../.logs/frontend.pid"
    nohup npx vite --port "${FRONTEND_PORT}" --host 127.0.0.1 > ../.logs/frontend.log 2>&1 &
    echo $! > ../.logs/frontend.pid
    cd ..
    log_success "前端已挂起!"
}

stop_all() {
    log_info "停止所有服务..."
    for pidfile in .logs/worker.pid .logs/scheduler.pid; do
        if [ -f "$pidfile" ]; then
            local pid
            pid="$(cat "$pidfile")"
            graceful_kill_pid "$pid"
            rm -f "$pidfile"
        fi
    done
    kill_taskiq_processes
    cleanup_backend_processes || log_warn "后端清理未完全成功，请检查 .logs/backend.log"
    kill_port "${FRONTEND_PORT}" || true
}

frontend_http_ready() {
    curl -sf --max-time 2 "http://127.0.0.1:${FRONTEND_PORT}/" >/dev/null 2>&1
}

pidfile_alive() {
    local pidfile=$1
    [ -f "$pidfile" ] || return 1
    local pid
    pid="$(cat "$pidfile" 2>/dev/null)"
    [ -n "$pid" ] || return 1
    pid_is_alive "$pid"
}

case "$1" in
    stop) stop_all ;;
    status)
        backend_http_ready && log_success "Backend [OK] ($(get_listening_pids "${BACKEND_PORT}" | tr '\n' ' '))" || log_warn "Backend [OFF]"
        frontend_http_ready && log_success "Frontend [OK]" || log_warn "Frontend [OFF]"
        if pidfile_alive ".logs/worker.pid" || taskiq_service_running broker; then
            log_success "Worker [OK]"
        else
            log_warn "Worker [OFF]"
        fi
        if pidfile_alive ".logs/scheduler.pid" || taskiq_service_running scheduler; then
            log_success "Scheduler [OK]"
        else
            log_warn "Scheduler [OFF]"
        fi
        ;;
    be) start_backend ;;
    fe) kill_port "${FRONTEND_PORT}"; start_frontend ;;
    *)
        mkdir -p .logs
        stop_all
        if start_backend 1 && start_worker && start_frontend; then
            log_success "🚀 RiverEdge 系统已恢复就绪!"
            echo "  - Web端: http://localhost:${FRONTEND_PORT}"
            echo "  - API: http://localhost:${BACKEND_PORT}"
        else
            log_error "启动未完成，请查看 .logs/backend.log / .logs/frontend.log"
            exit 1
        fi
        ;;
esac
