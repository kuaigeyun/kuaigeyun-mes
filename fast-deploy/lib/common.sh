#!/usr/bin/env bash
# RiverEdge fast-deploy 共享库（Linux / macOS / Git Bash）

set -euo pipefail

FAST_DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ROOT="$(cd "$FAST_DEPLOY_DIR/.." && pwd)"
INSTALL_SCRIPTS_JSON="$PROJECT_ROOT/riveredge-panel/install-scripts.json"
BACKEND_DIR="$PROJECT_ROOT/riveredge-backend"
FRONTEND_DIR="$PROJECT_ROOT/riveredge-frontend"
ENV_FILE="$BACKEND_DIR/.env"
DEPLOY_ENV_FILE="$FAST_DEPLOY_DIR/deploy.env"
LOGS_DIR="$PROJECT_ROOT/.logs"
CADDY_DIR="$FAST_DEPLOY_DIR/caddy"
CADDYFILE="$CADDY_DIR/Caddyfile"
CADDY_TEMPLATE="$FAST_DEPLOY_DIR/templates/Caddyfile.template"

# 由入口脚本设置：dev | prod
DEPLOY_MODE="${DEPLOY_MODE:-dev}"
USE_MIRROR="${USE_MIRROR:-1}"
BACKEND_START_TIMEOUT="${BACKEND_START_TIMEOUT:-30}"

log_info()  { echo -e "\033[0;34m[$(date +'%H:%M:%S')] INFO: $*\033[0m"; }
log_warn()  { echo -e "\033[1;33m[$(date +'%H:%M:%S')] WARN: $*\033[0m"; }
log_ok()    { echo -e "\033[0;32m[$(date +'%H:%M:%S')] OK: $*\033[0m"; }
log_error() { echo -e "\033[0;31m[$(date +'%H:%M:%S')] ERROR: $*\033[0m" >&2; }

ensure_logs_dir() { mkdir -p "$LOGS_DIR"; }

load_deploy_env() {
    if [ ! -f "$DEPLOY_ENV_FILE" ]; then
        if [ -f "$FAST_DEPLOY_DIR/deploy.env.example" ]; then
            cp "$FAST_DEPLOY_DIR/deploy.env.example" "$DEPLOY_ENV_FILE"
            log_info "已从 deploy.env.example 创建 deploy.env"
        fi
    fi
    if [ -f "$DEPLOY_ENV_FILE" ]; then
        # shellcheck disable=SC1090
        set -a
        source "$DEPLOY_ENV_FILE"
        set +a
    fi
    BACKEND_PORT="${BACKEND_PORT:-8200}"
    FRONTEND_PORT="${FRONTEND_PORT:-8100}"
    PROXY_PORT="${PROXY_PORT:-8080}"
    CADDY_DOMAIN="${CADDY_DOMAIN:-}"
    CADDY_ENABLE_LETSENCRYPT="${CADDY_ENABLE_LETSENCRYPT:-false}"
    NODE_BUILD_MEM="${NODE_BUILD_MEM:-4096}"
    SERVER_IP="${SERVER_IP:-}"
}

is_windows_gitbash() {
    case "$(uname -s)" in
        MINGW*|MSYS*|CYGWIN*) return 0 ;;
        *) return 1 ;;
    esac
}

apply_cn_mirrors() {
    [ "${USE_MIRROR}" = "0" ] && return 0
    export UV_INDEX_URL="${UV_INDEX_URL:-https://pypi.tuna.tsinghua.edu.cn/simple}"
    export npm_config_registry="${npm_config_registry:-https://registry.npmmirror.com}"
    if command -v npm >/dev/null 2>&1; then
        npm config set registry https://registry.npmmirror.com 2>/dev/null || true
    fi
    log_info "已启用国内镜像 (uv/npm)；Node 仍使用官方源以保证 22+ 版本"
}

detect_server_ip() {
    local ip=""
    case "$(uname -s)" in
        MINGW*|MSYS*|CYGWIN*)
            ip="$(ipconfig 2>/dev/null | grep -iE 'IPv4|IP Address' | head -1 | sed 's/.*: *//' | tr -d '\r' | awk '{print $NF}')"
            ;;
        Darwin*)
            ip="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
            ;;
        *)
            ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
            ;;
    esac
    ip="$(echo "$ip" | tr -d '[:space:]')"
    if [ -z "$ip" ] || [ "$ip" = "127.0.0.1" ]; then
        echo "127.0.0.1"
    else
        echo "$ip"
    fi
}

version_ge() {
    local a="${1#v}" b="${2#v}"
    [ "$(printf '%s\n%s\n' "$a" "$b" | sort -V | head -n1)" = "$b" ]
}

detect_linux_platform() {
    if [ -f /etc/os-release ]; then
        # shellcheck disable=SC1091
        . /etc/os-release
        if [ "${ID:-}" = "ubuntu" ] && { [ "${VERSION_ID:-}" = "22.04" ] || [ "${VERSION_ID:-}" = "24.04" ] || [[ "${VERSION_ID:-}" == 22.* ]] || [[ "${VERSION_ID:-}" == 24.* ]]; }; then
            echo "ubuntu22"
            return
        fi
    fi
    echo "linux"
}

get_install_platform_key() {
    case "$(uname -s)" in
        MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
        Darwin*) echo "linux" ;;
        *) detect_linux_platform ;;
    esac
}

# 从 install-scripts.json 读取安装命令
get_install_command() {
    local component="$1"
    local platform
    platform="$(get_install_platform_key)"
    python3 - "$INSTALL_SCRIPTS_JSON" "$component" "$platform" "$USE_MIRROR" <<'PY'
import json, sys
path, comp, plat, mirror = sys.argv[1:5]
with open(path, encoding="utf-8") as f:
    data = json.load(f)
if mirror == "1" and comp not in ("node", "python") and plat in ("ubuntu22", "linux"):
    if comp in data.get("scripts_cn", {}):
        print(data["scripts_cn"][comp])
        sys.exit(0)
scripts = data.get("scripts", {}).get(comp, {})
cmd = scripts.get(plat) or scripts.get("linux") or scripts.get("windows") or ""
print(cmd)
PY
}

resolve_uv() {
    if command -v uv >/dev/null 2>&1; then
        echo "uv"
        return
    fi
    local candidates=(
        "$HOME/.local/bin/uv"
        "$HOME/.cargo/bin/uv"
    )
    for p in "${candidates[@]}"; do
        [ -x "$p" ] && { echo "$p"; return; }
    done
    echo "uv"
}

resolve_caddy() {
    if command -v caddy >/dev/null 2>&1; then
        command -v caddy
        return
    fi
    local bundled="$FAST_DEPLOY_DIR/.tools/caddy/caddy"
    if [ ! -x "$bundled" ]; then
        bundled="$FAST_DEPLOY_DIR/.tools/caddy/caddy.exe"
    fi
    if [ -x "$bundled" ]; then
        echo "$bundled"
        return
    fi
    echo ""
}

check_node() {
    if ! command -v node >/dev/null 2>&1; then
        echo "missing"
        return
    fi
    local v
    v="$(node -v 2>/dev/null | sed 's/^v//')"
    if version_ge "$v" "22.0.0"; then echo "ok"; else echo "old:$v"; fi
}

check_python() {
    local py=""
    for c in python3.12 python3 python; do
        if command -v "$c" >/dev/null 2>&1; then py="$c"; break; fi
    done
    [ -z "$py" ] && { echo "missing"; return; }
    local v
    v="$("$py" --version 2>&1 | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -1)"
    [ -z "$v" ] && { echo "missing"; return; }
    # 补齐 patch 版本便于 sort -V
    [[ "$v" != *.*.* ]] && v="${v}.0"
    if version_ge "$v" "3.12.0"; then echo "ok"; else echo "old:$v"; fi
}

check_uv() {
    local uv_bin
    uv_bin="$(resolve_uv)"
    if ! "$uv_bin" --version >/dev/null 2>&1; then echo "missing"; else echo "ok"; fi
}

check_npm() {
    if ! command -v npm >/dev/null 2>&1; then echo "missing"; return; fi
    local v
    v="$(npm -v 2>/dev/null | tr -d '\r')"
    if version_ge "$v" "10.0.0"; then echo "ok"; else echo "old:$v"; fi
}

check_postgres() {
    if command -v psql >/dev/null 2>&1; then
        local v
        v="$(psql --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+' | head -1)"
        if version_ge "$v" "15.0"; then echo "ok"; else echo "old:$v"; fi
        return
    fi
    echo "missing"
}

check_caddy() {
    local c
    c="$(resolve_caddy)"
    [ -n "$c" ] && echo "ok" || echo "missing"
}

check_port() {
    local port=$1
    if command -v ss >/dev/null 2>&1; then
        ss -ltn 2>/dev/null | grep -q ":${port} " && return 0
    elif command -v lsof >/dev/null 2>&1; then
        lsof -iTCP:"$port" -sTCP:LISTEN -t >/dev/null 2>&1 && return 0
    elif command -v netstat >/dev/null 2>&1; then
        netstat -tln 2>/dev/null | grep -q ":${port} " && return 0
    fi
    return 1
}

kill_port() {
    local port=$1
    if ! check_port "$port"; then return 0; fi
    log_warn "清理端口 $port..."
    if command -v lsof >/dev/null 2>&1; then
        local pids
        pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
        for pid in $pids; do
            kill -INT "$pid" 2>/dev/null || true
        done
        sleep 2
        for pid in $pids; do
            kill -9 "$pid" 2>/dev/null || true
        done
    elif command -v fuser >/dev/null 2>&1; then
        fuser -k "${port}/tcp" 2>/dev/null || true
    fi
    sleep 1
}

graceful_kill_pid() {
    local pid=$1
    [ -z "$pid" ] && return 0
    kill -INT "$pid" 2>/dev/null || true
    sleep 3
    kill -9 "$pid" 2>/dev/null || true
}

stop_service() {
    local name=$1
    local pidf="$LOGS_DIR/${name}.pid"
    if [ -f "$pidf" ]; then
        local pid
        pid="$(cat "$pidf" 2>/dev/null || echo "")"
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            if [ "$name" = "backend" ] || [ "$name" = "worker" ] || [ "$name" = "scheduler" ]; then
                graceful_kill_pid "$pid"
            else
                kill "$pid" 2>/dev/null || true
            fi
            log_info "已停止 $name (PID $pid)"
        fi
        rm -f "$pidf"
    fi
    if [ "$name" = "caddy" ]; then
        local stragglers
        stragglers="$(pgrep -f "caddy run" 2>/dev/null || true)"
        for spid in $stragglers; do
            kill "$spid" 2>/dev/null && log_info "已清理残留 caddy (PID $spid)" || true
        done
    fi
}

read_env_value() {
    local key=$1
    [ -f "$ENV_FILE" ] || return 1
    grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- | sed 's/^["'\'']//;s/["'\'']$//'
}

set_env_value() {
    local key=$1 val=$2
    if grep -qE "^${key}=" "$ENV_FILE" 2>/dev/null; then
        if [[ "$(uname -s)" == "Darwin" ]]; then
            sed -i '' "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
        else
            sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
        fi
    else
        echo "${key}=${val}" >> "$ENV_FILE"
    fi
}

read_deploy_env_value() {
    local key=$1
    [ -f "$DEPLOY_ENV_FILE" ] || return 1
    grep -E "^${key}=" "$DEPLOY_ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- | sed 's/^["'\'']//;s/["'\'']$//'
}

set_deploy_env_value() {
    local key=$1 val=$2
    [ -f "$DEPLOY_ENV_FILE" ] || cp "$FAST_DEPLOY_DIR/deploy.env.example" "$DEPLOY_ENV_FILE"
    if grep -qE "^${key}=" "$DEPLOY_ENV_FILE" 2>/dev/null; then
        if [[ "$(uname -s)" == "Darwin" ]]; then
            sed -i '' "s|^${key}=.*|${key}=${val}|" "$DEPLOY_ENV_FILE"
        else
            sed -i "s|^${key}=.*|${key}=${val}|" "$DEPLOY_ENV_FILE"
        fi
    else
        echo "${key}=${val}" >> "$DEPLOY_ENV_FILE"
    fi
}

env_needs_configure() {
    [ ! -f "$ENV_FILE" ] && return 0
    local db_pass admin_pass jwt base_url
    db_pass="$(read_env_value DB_PASSWORD || true)"
    admin_pass="$(read_env_value PLATFORM_SUPERADMIN_PASSWORD || true)"
    jwt="$(read_env_value JWT_SECRET_KEY || true)"
    if [ -z "$db_pass" ] || [ -z "$admin_pass" ] || [ "$jwt" = "your-secret-key-here-change-in-production" ] || [ -z "$jwt" ]; then
        return 0
    fi
    if [ "$DEPLOY_MODE" = "prod" ]; then
        base_url="$(read_env_value BASE_URL || true)"
        [ -z "$base_url" ] && return 0
        [ -z "$(read_deploy_env_value SERVER_IP || true)" ] && return 0
    fi
    return 1
}

test_db_connection() {
    local host port user pass dbname
    host="$(read_env_value DB_HOST || echo localhost)"
    port="$(read_env_value DB_PORT || echo 5432)"
    user="$(read_env_value DB_USER || echo postgres)"
    pass="$(read_env_value DB_PASSWORD)"
    dbname="$(read_env_value DB_NAME || echo riveredge)"
    export PGPASSWORD="$pass"
    if psql -h "$host" -p "$port" -U "$user" -d "$dbname" -c "SELECT 1" >/dev/null 2>&1; then
        unset PGPASSWORD
        return 0
    fi
    if psql -h "$host" -p "$port" -U "$user" -d postgres -c "SELECT 1" >/dev/null 2>&1; then
        if [ "$host" = "localhost" ] || [ "$host" = "127.0.0.1" ]; then
            psql -h "$host" -p "$port" -U "$user" -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='${dbname}'" 2>/dev/null | grep -q 1 || \
                psql -h "$host" -p "$port" -U "$user" -d postgres -c "CREATE DATABASE \"${dbname}\";" >/dev/null 2>&1
        fi
        unset PGPASSWORD
        return 0
    fi
    unset PGPASSWORD
    return 1
}

cmd_configure() {
    log_info "配置应用环境..."
    apply_cn_mirrors
    if [ ! -f "$ENV_FILE" ]; then
        cp "$BACKEND_DIR/.env.example" "$ENV_FILE"
        log_info "已从 .env.example 创建 $ENV_FILE"
    fi
    if [ ! -f "$DEPLOY_ENV_FILE" ]; then
        cp "$FAST_DEPLOY_DIR/deploy.env.example" "$DEPLOY_ENV_FILE"
    fi
    load_deploy_env

    local db_user db_host db_name db_pass admin_pass jwt server_ip detected_ip input base_url

    db_user="$(read_env_value DB_USER || true)"
    [ -z "$db_user" ] && db_user="postgres"
    read -rp "PostgreSQL 用户名 [${db_user}]: " input
    db_user="${input:-$db_user}"
    set_env_value DB_USER "$db_user"

    db_host="$(read_env_value DB_HOST || true)"
    [ -z "$db_host" ] && db_host="localhost"
    read -rp "PostgreSQL 主机 [${db_host}] (本地填 localhost，远程填 IP): " input
    db_host="${input:-$db_host}"
    set_env_value DB_HOST "$db_host"

    db_name="$(read_env_value DB_NAME || true)"
    [ -z "$db_name" ] && db_name="riveredge"
    read -rp "数据库名 [${db_name}]: " input
    db_name="${input:-$db_name}"
    set_env_value DB_NAME "$db_name"

    db_pass="$(read_env_value DB_PASSWORD || true)"
    if [ -z "$db_pass" ]; then
        read -rsp "PostgreSQL 密码 (DB_PASSWORD): " db_pass; echo
        [ ${#db_pass} -lt 1 ] && { log_error "DB_PASSWORD 不能为空"; exit 1; }
        set_env_value DB_PASSWORD "$db_pass"
    else
        read -rsp "PostgreSQL 密码 [已配置，回车跳过 / 输入新密码]: " input; echo
        if [ -n "$input" ]; then
            set_env_value DB_PASSWORD "$input"
        fi
    fi

    admin_pass="$(read_env_value PLATFORM_SUPERADMIN_PASSWORD || true)"
    if [ -z "$admin_pass" ]; then
        read -rsp "平台超级管理员密码 (登录用户名 infra_admin): " admin_pass; echo
        [ ${#admin_pass} -lt 6 ] && { log_error "超管密码至少 6 位"; exit 1; }
        set_env_value PLATFORM_SUPERADMIN_PASSWORD "$admin_pass"
    else
        read -rsp "平台超管密码 [已配置，回车跳过 / 输入新密码]: " input; echo
        if [ -n "$input" ]; then
            [ ${#input} -lt 6 ] && { log_error "超管密码至少 6 位"; exit 1; }
            set_env_value PLATFORM_SUPERADMIN_PASSWORD "$input"
        fi
    fi

    jwt="$(read_env_value JWT_SECRET_KEY || true)"
    if [ -z "$jwt" ] || [ "$jwt" = "your-secret-key-here-change-in-production" ]; then
        jwt="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))' 2>/dev/null || python -c 'import secrets; print(secrets.token_urlsafe(32))')"
        set_env_value JWT_SECRET_KEY "$jwt"
        log_info "已自动生成 JWT_SECRET_KEY"
    fi

    detected_ip="$(detect_server_ip)"
    server_ip="$(read_deploy_env_value SERVER_IP || true)"
    [ -z "$server_ip" ] && server_ip="$detected_ip"
    log_info "检测到本机 IP: ${detected_ip}"
    read -rp "服务器 IP (浏览器访问地址) [${server_ip}]: " input
    server_ip="${input:-$server_ip}"
    set_deploy_env_value SERVER_IP "$server_ip"
    load_deploy_env

    if [ "$DEPLOY_MODE" = "prod" ]; then
        set_env_value ENVIRONMENT production
        set_env_value DEBUG false
        if [ -n "$CADDY_DOMAIN" ]; then
            if [ "$CADDY_ENABLE_LETSENCRYPT" = "true" ]; then
                base_url="https://${CADDY_DOMAIN}"
            else
                base_url="http://${CADDY_DOMAIN}:${PROXY_PORT}"
            fi
        else
            base_url="http://${server_ip}:${PROXY_PORT}"
        fi
        set_env_value BASE_URL "$base_url"
        set_env_value CORS_ORIGINS "http://${server_ip}:${PROXY_PORT},http://127.0.0.1:${PROXY_PORT},http://localhost:${PROXY_PORT}"
    else
        set_env_value HOST "0.0.0.0"
        set_env_value CORS_ORIGINS "http://${server_ip}:${FRONTEND_PORT},http://127.0.0.1:${FRONTEND_PORT},http://localhost:${FRONTEND_PORT}"
    fi

    log_info "测试数据库连接..."
    if ! test_db_connection; then
        log_error "数据库连接失败，请确认 PostgreSQL 已启动且 DB_* 配置正确"
        exit 1
    fi
    log_ok "配置完成"
    echo "  数据库: ${db_user}@${db_host}/${db_name}"
    echo "  超管账号: infra_admin"
    if [ "$DEPLOY_MODE" = "prod" ]; then
        echo "  访问地址: http://${server_ip}:${PROXY_PORT}"
    else
        echo "  访问地址: http://${server_ip}:${FRONTEND_PORT} (Web) / http://${server_ip}:${BACKEND_PORT} (API)"
    fi
}

sync_backend_deps() {
    apply_cn_mirrors
    log_info "同步 Python 依赖..."
    (
        cd "$BACKEND_DIR"
        export SETUPTOOLS_EGG_INFO_DIR="$LOGS_DIR"
        export UV_LINK_MODE="${UV_LINK_MODE:-copy}"
        export UV_HTTP_TIMEOUT="${UV_HTTP_TIMEOUT:-600}"
        "$(resolve_uv)" sync --no-install-project
    )
}

cmd_migrate() {
    sync_backend_deps
    log_info "执行数据库迁移..."
    (
        cd "$BACKEND_DIR"
        export PYTHONPATH="$BACKEND_DIR/src"
        PYTHONUNBUFFERED=1 AERICH_MIGRATE=1 "$(resolve_uv)" run aerich upgrade
    ) || { log_error "数据库迁移失败"; exit 1; }
    log_ok "迁移完成"
}

ensure_frontend_deps() {
    apply_cn_mirrors
    if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
        log_info "安装前端依赖..."
        (cd "$FRONTEND_DIR" && npm install --legacy-peer-deps)
    fi
}

cmd_build() {
    ensure_frontend_deps
    log_info "构建 Web 前端..."
    (
        cd "$FRONTEND_DIR"
        export NODE_OPTIONS="--max-old-space-size=${NODE_BUILD_MEM}"
        npm run build
    ) || { log_error "前端构建失败"; exit 1; }
    [ -f "$FRONTEND_DIR/dist/index.html" ] || { log_error "缺少 dist/index.html"; exit 1; }
    log_ok "前端构建完成"
}

gen_caddyfile() {
    load_deploy_env
    mkdir -p "$CADDY_DIR"
    [ -f "$CADDY_TEMPLATE" ] || { log_error "缺少模板 $CADDY_TEMPLATE"; exit 1; }

    local addr backend_addr frontend_root
    backend_addr="127.0.0.1:${BACKEND_PORT}"
    frontend_root="$FRONTEND_DIR/dist"

    if [ -n "$CADDY_DOMAIN" ]; then
        if [ "$CADDY_ENABLE_LETSENCRYPT" = "true" ]; then
            addr="$CADDY_DOMAIN"
        else
            addr="http://${CADDY_DOMAIN}:${PROXY_PORT}"
        fi
    else
        addr=":${PROXY_PORT}"
    fi

    sed -e "s|{{ADDR}}|${addr}|g" \
        -e "s|{{BACKEND_ADDR}}|${backend_addr}|g" \
        -e "s|{{FRONTEND_ROOT}}|${frontend_root}|g" \
        "$CADDY_TEMPLATE" > "$CADDYFILE.tmp"

    if ! grep -qE '^[A-Za-z0-9.:_/-][^{]*\{' "$CADDYFILE.tmp"; then
        log_error "生成的 Caddyfile 无效"
        rm -f "$CADDYFILE.tmp"
        exit 1
    fi
    mv "$CADDYFILE.tmp" "$CADDYFILE"
    log_ok "已生成 Caddyfile"
}

ensure_linux_caddy_ready() {
    if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet caddy 2>/dev/null; then
        log_error "systemd caddy.service 正在运行，与本项目冲突。请执行: sudo systemctl stop caddy && sudo systemctl disable caddy"
        exit 1
    fi
    local caddy_bin
    caddy_bin="$(resolve_caddy)"
    [ -n "$caddy_bin" ] || { log_error "未安装 Caddy，请运行: $0 install"; exit 1; }

    if [ "$PROXY_PORT" -lt 1024 ] || { [ -n "$CADDY_DOMAIN" ] && [ "$CADDY_ENABLE_LETSENCRYPT" = "true" ]; }; then
        local caps
        caps="$(getcap "$caddy_bin" 2>/dev/null || echo "")"
        if ! echo "$caps" | grep -q "cap_net_bind_service"; then
            if sudo -n setcap 'cap_net_bind_service=+ep' "$caddy_bin" 2>/dev/null; then
                log_ok "已为 caddy 配置 cap_net_bind_service"
            else
                log_error "caddy 需要 bind <1024 端口权限，请执行: sudo setcap 'cap_net_bind_service=+ep' $caddy_bin"
                exit 1
            fi
        fi
    fi
}

start_backend_dev() {
    kill_port "$BACKEND_PORT"
    log_info "启动后端 (dev, :${BACKEND_PORT})..."
    (
        cd "$BACKEND_DIR"
        export PYTHONPATH="$BACKEND_DIR/src"
        export SETUPTOOLS_EGG_INFO_DIR="$LOGS_DIR"
        nohup "$(resolve_uv)" run --extra pdf uvicorn server.main:app \
            --host 0.0.0.0 --port "$BACKEND_PORT" --reload --reload-dir src \
            > "$LOGS_DIR/backend.log" 2>&1 &
        echo $! > "$LOGS_DIR/backend.pid"
    )
    local retries=0
    while [ $retries -lt "$BACKEND_START_TIMEOUT" ]; do
        check_port "$BACKEND_PORT" && break
        sleep 1
        retries=$((retries + 1))
    done
    check_port "$BACKEND_PORT" || { log_error "后端启动超时"; exit 1; }
    log_ok "后端就绪"
}

start_worker_dev() {
    log_info "启动 Taskiq Worker/Scheduler (dev)..."
    stop_service worker
    stop_service scheduler
    (
        cd "$BACKEND_DIR"
        export PYTHONPATH="$BACKEND_DIR/src"
        export SETUPTOOLS_EGG_INFO_DIR="$LOGS_DIR"
        nohup "$(resolve_uv)" run --extra pdf taskiq worker core.tasks.taskiq_app:broker --fs-discover \
            core.tasks.taskiq_app core.tasks.data_backup_handlers core.inngest.functions \
            apps.master_data.inngest.functions apps.kuaizhizao.inngest.functions \
            > "$LOGS_DIR/worker.log" 2>&1 &
        echo $! > "$LOGS_DIR/worker.pid"
        nohup "$(resolve_uv)" run --extra pdf taskiq scheduler core.tasks.taskiq_app:scheduler --fs-discover \
            core.tasks.taskiq_app core.inngest.functions \
            apps.master_data.inngest.functions apps.kuaizhizao.inngest.functions \
            > "$LOGS_DIR/scheduler.log" 2>&1 &
        echo $! > "$LOGS_DIR/scheduler.pid"
    )
    log_ok "Taskiq 已启动"
}

start_frontend_dev() {
    kill_port "$FRONTEND_PORT"
    ensure_frontend_deps
    log_info "启动前端 (dev, :${FRONTEND_PORT})..."
    if [ -f "$FRONTEND_DIR/vite.config.ts" ]; then
        sed -i "s|target: 'http://localhost:[0-9]\+'|target: 'http://localhost:${BACKEND_PORT}'|g" "$FRONTEND_DIR/vite.config.ts" 2>/dev/null || \
        sed -i '' "s|target: 'http://localhost:[0-9]\+'|target: 'http://localhost:${BACKEND_PORT}'|g" "$FRONTEND_DIR/vite.config.ts" 2>/dev/null || true
    fi
    (
        cd "$FRONTEND_DIR"
        nohup npx vite --port "$FRONTEND_PORT" --host 127.0.0.1 > "$LOGS_DIR/frontend.log" 2>&1 &
        echo $! > "$LOGS_DIR/frontend.pid"
    )
    log_ok "前端已启动"
}

start_backend_prod() {
    if [ -f "$LOGS_DIR/backend.pid" ] && kill -0 "$(cat "$LOGS_DIR/backend.pid")" 2>/dev/null; then
        log_info "后端已在运行"
        return 0
    fi
    sync_backend_deps
    log_info "启动后端 (prod, :${BACKEND_PORT})..."
    (
        cd "$BACKEND_DIR"
        export PORT="$BACKEND_PORT"
        export HOST=127.0.0.1
        export ENVIRONMENT=production
        export DEBUG=false
        export SETUPTOOLS_EGG_INFO_DIR="$LOGS_DIR"
        export PYTHONPATH="$BACKEND_DIR/src"
        nohup "$(resolve_uv)" run uvicorn server.main:app \
            --host 127.0.0.1 --port "$BACKEND_PORT" --workers 1 \
            > "$LOGS_DIR/backend.log" 2>&1 &
        echo $! > "$LOGS_DIR/backend.pid"
    )
    sleep 3
    curl -sf "http://127.0.0.1:${BACKEND_PORT}/health" >/dev/null || {
        log_error "后端启动失败，查看 $LOGS_DIR/backend.log"
        exit 1
    }
    log_ok "后端已启动"
}

start_worker_prod() {
    sync_backend_deps
    if [ -f "$LOGS_DIR/worker.pid" ] && kill -0 "$(cat "$LOGS_DIR/worker.pid")" 2>/dev/null; then
        log_info "Worker 已在运行"
    else
        log_info "启动 Taskiq Worker..."
        rm -f "$LOGS_DIR/worker.pid"
        (
            cd "$BACKEND_DIR"
            export ENVIRONMENT=production
            export SETUPTOOLS_EGG_INFO_DIR="$LOGS_DIR"
            export PYTHONPATH="$BACKEND_DIR/src"
            nohup "$(resolve_uv)" run taskiq worker --app-dir src --fs-discover core.tasks.taskiq_app:broker \
                > "$LOGS_DIR/worker.log" 2>&1 &
            echo $! > "$LOGS_DIR/worker.pid"
        )
        sleep 2
    fi
    if [ -f "$LOGS_DIR/scheduler.pid" ] && kill -0 "$(cat "$LOGS_DIR/scheduler.pid")" 2>/dev/null; then
        log_info "Scheduler 已在运行"
    else
        log_info "启动 Taskiq Scheduler..."
        rm -f "$LOGS_DIR/scheduler.pid"
        (
            cd "$BACKEND_DIR"
            export ENVIRONMENT=production
            export SETUPTOOLS_EGG_INFO_DIR="$LOGS_DIR"
            export PYTHONPATH="$BACKEND_DIR/src"
            nohup "$(resolve_uv)" run taskiq scheduler --app-dir src --fs-discover core.tasks.taskiq_app:scheduler \
                > "$LOGS_DIR/scheduler.log" 2>&1 &
            echo $! > "$LOGS_DIR/scheduler.pid"
        )
        sleep 2
    fi
    log_ok "Taskiq 已启动"
}

start_caddy_prod() {
    ensure_linux_caddy_ready
    gen_caddyfile
    local caddy_bin
    caddy_bin="$(resolve_caddy)"
    if [ -f "$LOGS_DIR/caddy.pid" ] && kill -0 "$(cat "$LOGS_DIR/caddy.pid")" 2>/dev/null; then
        log_info "Caddy 已在运行"
        return 0
    fi
    log_info "启动 Caddy (:${PROXY_PORT})..."
    nohup "$caddy_bin" run --config "$CADDYFILE" >> "$LOGS_DIR/caddy.log" 2>&1 &
    echo $! > "$LOGS_DIR/caddy.pid"
    sleep 2
    kill -0 "$(cat "$LOGS_DIR/caddy.pid")" 2>/dev/null || {
        log_error "Caddy 启动失败，查看 $LOGS_DIR/caddy.log"
        tail -20 "$LOGS_DIR/caddy.log" >&2
        exit 1
    }
    log_ok "Caddy 已启动"
}

cmd_start_dev() {
    ensure_logs_dir
    load_deploy_env
    cmd_migrate
    start_backend_dev
    start_worker_dev
    start_frontend_dev
    log_ok "RiverEdge 开发环境已就绪"
    echo "  Web:  http://127.0.0.1:${FRONTEND_PORT}"
    echo "  API:  http://127.0.0.1:${BACKEND_PORT}"
}

cmd_start_prod() {
    ensure_logs_dir
    load_deploy_env
    [ -f "$FRONTEND_DIR/dist/index.html" ] || { log_error "缺少前端 dist，请先运行 build"; exit 1; }
    start_backend_prod
    start_worker_prod
    start_caddy_prod
    log_ok "RiverEdge 生产环境已就绪"
    local access_ip="${SERVER_IP:-127.0.0.1}"
    if [ -n "$CADDY_DOMAIN" ]; then
        echo "  访问: http://${CADDY_DOMAIN}:${PROXY_PORT} （或 HTTPS 域名）"
    else
        echo "  本机: http://127.0.0.1:${PROXY_PORT}"
        echo "  局域网: http://${access_ip}:${PROXY_PORT}"
    fi
}

cmd_stop_dev() {
    kill_port "$BACKEND_PORT"
    kill_port "$FRONTEND_PORT"
    stop_service worker
    stop_service scheduler
    log_ok "开发服务已停止"
}

cmd_stop_prod() {
    stop_service caddy
    stop_service worker
    stop_service scheduler
    stop_service backend
    log_ok "生产服务已停止"
}

cmd_status() {
    load_deploy_env
    echo "=== RiverEdge ${DEPLOY_MODE} 状态 ==="
    for name in backend frontend worker scheduler caddy; do
        local pidf="$LOGS_DIR/${name}.pid"
        if [ -f "$pidf" ] && kill -0 "$(cat "$pidf")" 2>/dev/null; then
            echo "  $name: 运行中 (PID $(cat "$pidf"))"
        else
            echo "  $name: 未运行"
        fi
    done
    echo ""
    check_port "$BACKEND_PORT" && echo "  端口 ${BACKEND_PORT}: 监听中" || echo "  端口 ${BACKEND_PORT}: 空闲"
    if [ "$DEPLOY_MODE" = "dev" ]; then
        check_port "$FRONTEND_PORT" && echo "  端口 ${FRONTEND_PORT}: 监听中" || echo "  端口 ${FRONTEND_PORT}: 空闲"
    else
        check_port "$PROXY_PORT" && echo "  端口 ${PROXY_PORT}: 监听中" || echo "  端口 ${PROXY_PORT}: 空闲"
    fi
}

run_install_component() {
    local comp=$1 status=$2
    [ "$status" = "ok" ] && return 0
    if [ "$comp" = "caddy" ]; then
        log_info "安装 caddy..."
        install_caddy_bundled || return 1
        return 0
    fi
    local cmd
    cmd="$(get_install_command "$comp")"
    [ -n "$cmd" ] || { log_error "无 $comp 的安装命令"; return 1; }
    if [[ "$cmd" == *"从 https"* ]]; then
        log_error "请手动安装 $comp: $cmd"
        return 1
    fi
    log_info "安装 $comp..."
    log_info "执行: $cmd"
    if is_windows_gitbash; then
        cmd.exe //c "$cmd" || {
            log_error "$comp 安装失败，请用管理员 Git Bash 重试，或手动执行: $cmd"
            return 1
        }
        return 0
    fi
    bash -lc "$cmd" || {
        log_error "$comp 安装失败，请手动执行: $cmd"
        return 1
    }
}

caddy_github_latest_tag() {
    curl -fsSL "https://api.github.com/repos/caddyserver/caddy/releases/latest" \
        | python3 -c 'import sys,json; print(json.load(sys.stdin)["tag_name"])'
}

caddy_bundled_asset_url() {
    local tag version os arch ext
    tag="$(caddy_github_latest_tag)"
    version="${tag#v}"
    if is_windows_gitbash; then
        os="windows"
        arch="amd64"
        ext="zip"
    else
        os="linux"
        arch="amd64"
        if [[ "$(uname -m)" == "aarch64" ]] || [[ "$(uname -m)" == "arm64" ]]; then
            arch="arm64"
        fi
        ext="tar.gz"
    fi
    echo "https://github.com/caddyserver/caddy/releases/download/${tag}/caddy_${version}_${os}_${arch}.${ext}"
}

install_caddy_bundled() {
    local tools_dir="$FAST_DEPLOY_DIR/.tools/caddy"
    mkdir -p "$tools_dir"
    local url archive
    url="$(caddy_bundled_asset_url)"
    log_info "下载 Caddy: $url"
    if is_windows_gitbash; then
        archive="$tools_dir/caddy.zip"
        curl -fsSL "$url" -o "$archive"
        unzip -o "$archive" -d "$tools_dir" caddy.exe
        rm -f "$archive"
        [ -f "$tools_dir/caddy.exe" ] || { log_error "Caddy 下载后未找到 caddy.exe"; return 1; }
        chmod +x "$tools_dir/caddy.exe"
        log_ok "Caddy 已安装到 $tools_dir/caddy.exe"
        return 0
    fi
    archive="$tools_dir/caddy.tar.gz"
    curl -fsSL "$url" -o "$archive"
    tar -xzf "$archive" -C "$tools_dir" caddy
    rm -f "$archive"
    [ -f "$tools_dir/caddy" ] || { log_error "Caddy 下载后未找到 caddy 二进制"; return 1; }
    chmod +x "$tools_dir/caddy"
    log_ok "Caddy 已安装到 $tools_dir/caddy"
}

cmd_check() {
    local need_caddy=0
    [ "$DEPLOY_MODE" = "prod" ] && need_caddy=1
    local failed=0

    local st
    st="$(check_node)"; [ "$st" = "ok" ] && log_ok "Node.js" || { log_warn "Node.js: $st"; failed=1; }
    st="$(check_python)"; [ "$st" = "ok" ] && log_ok "Python" || { log_warn "Python: $st"; failed=1; }
    st="$(check_uv)"; [ "$st" = "ok" ] && log_ok "uv" || { log_warn "uv: $st"; failed=1; }
    st="$(check_npm)"; [ "$st" = "ok" ] && log_ok "npm" || { log_warn "npm: $st"; failed=1; }
    st="$(check_postgres)"; [ "$st" = "ok" ] && log_ok "PostgreSQL" || { log_warn "PostgreSQL: $st"; failed=1; }
    if [ "$need_caddy" -eq 1 ]; then
        st="$(check_caddy)"; [ "$st" = "ok" ] && log_ok "Caddy" || { log_warn "Caddy: $st"; failed=1; }
    fi
    return $failed
}

cmd_install() {
    [ -f "$INSTALL_SCRIPTS_JSON" ] || { log_error "缺少 $INSTALL_SCRIPTS_JSON"; exit 1; }
    apply_cn_mirrors
    log_info "安装缺失依赖（可能需要 sudo / 管理员权限）..."
    if is_windows_gitbash; then
        log_info "Windows 环境：通过 cmd/winget 安装系统组件..."
    fi
    run_install_component node "$(check_node)" || true
    run_install_component python "$(check_python)" || true
    run_install_component uv "$(check_uv)" || true
    run_install_component postgresql "$(check_postgres)" || true
    if [ "$DEPLOY_MODE" = "prod" ]; then
        run_install_component caddy "$(check_caddy)" || return 1
    fi
    log_warn "若刚安装系统软件，请重新打开终端或刷新 PATH 后再次 check"
    cmd_check || exit 1
}

cmd_update_dev() {
    cmd_migrate
    cmd_stop_dev
    cmd_start_dev
}

cmd_update_prod() {
    local branch="${GIT_BRANCH:-develop}"
    log_info "拉取代码 (origin/$branch)..."
    (cd "$PROJECT_ROOT" && git fetch origin && git checkout "$branch" && git pull origin "$branch") || {
        log_error "git pull 失败"
        exit 1
    }
    cmd_migrate
    cmd_stop_prod
    cmd_build
    cmd_start_prod
    log_ok "生产环境已更新"
}

cmd_default() {
    apply_cn_mirrors
    if ! cmd_check; then
        log_warn "环境未就绪，尝试 install..."
        cmd_install
    fi
    if env_needs_configure; then
        cmd_configure
    fi
    if [ "$DEPLOY_MODE" = "dev" ]; then
        cmd_start_dev
    else
        cmd_migrate
        [ -f "$FRONTEND_DIR/dist/index.html" ] || cmd_build
        cmd_start_prod
    fi
}

fd_dispatch() {
    local cmd="${1:-}"
    case "$cmd" in
        check)     cmd_check ;;
        install)   cmd_install ;;
        configure) cmd_configure ;;
        migrate)   cmd_migrate ;;
        build)     cmd_build ;;
        start)
            if [ "$DEPLOY_MODE" = "dev" ]; then cmd_start_dev; else cmd_start_prod; fi
            ;;
        stop)
            if [ "$DEPLOY_MODE" = "dev" ]; then cmd_stop_dev; else cmd_stop_prod; fi
            ;;
        status)    cmd_status ;;
        update)
            if [ "$DEPLOY_MODE" = "dev" ]; then cmd_update_dev; else cmd_update_prod; fi
            ;;
        ""|deploy) cmd_default ;;
        *)
            log_error "未知命令: $cmd"
            echo "用法: check | install | configure | migrate | build | start | stop | status | update | deploy"
            exit 1
            ;;
    esac
}
