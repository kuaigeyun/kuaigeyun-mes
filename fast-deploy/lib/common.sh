#!/usr/bin/env bash
# RiverEdge fast-deploy 共享库（Linux / macOS / Git Bash）

set -euo pipefail

FAST_DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ROOT="$(cd "$FAST_DEPLOY_DIR/.." && pwd)"
INSTALL_SCRIPTS_JSON="$FAST_DEPLOY_DIR/install-scripts.json"
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

# Windows Git Bash 默认 locale 为 GBK，aerich 读 pyproject.toml（UTF-8 中文注释）会 UnicodeDecodeError
if is_windows_gitbash; then
    export PYTHONUTF8="${PYTHONUTF8:-1}"
    export PYTHONIOENCODING="${PYTHONIOENCODING:-utf-8}"
fi

# Windows 安装后补充常见路径（当前 Git Bash 会话内生效；含便携版 .tools/node）
refresh_windows_path() {
    is_windows_gitbash || return 0
    local p dir
    for p in \
        "$FAST_DEPLOY_DIR/.tools/node" \
        "/c/Program Files/nodejs" \
        "/c/Program Files (x86)/nodejs" \
        "$LOCALAPPDATA/Programs/Python/Python312" \
        "$LOCALAPPDATA/Programs/Python/Python312/Scripts" \
        "$LOCALAPPDATA/Programs/Python/Python313" \
        "$LOCALAPPDATA/Programs/Python/Python313/Scripts" \
        "$USERPROFILE/.local/bin" \
        "/c/Program Files/PostgreSQL/17/bin" \
        "/c/Program Files/PostgreSQL/16/bin" \
        "/c/Program Files/PostgreSQL/15/bin" \
        "$FAST_DEPLOY_DIR/.tools/caddy"
    do
        [ -d "$p" ] && PATH="$p:$PATH"
    done
    for dir in "$LOCALAPPDATA/Programs/Python"/Python3*; do
        [ -d "$dir" ] || continue
        PATH="$dir:$dir/Scripts:$PATH"
    done
    for dir in "/c/Program Files/Python"*; do
        [ -d "$dir" ] || continue
        PATH="$dir:$dir/Scripts:$PATH"
    done
    export PATH
}

if is_windows_gitbash; then
    refresh_windows_path
fi

run_windows_install_component() {
    local comp=$1
    local ps_script="$FAST_DEPLOY_DIR/windows/install-component.ps1"
    [ -f "$ps_script" ] || { log_error "缺少 $ps_script"; return 1; }
    log_info "Windows 安装 $comp（winget 或官方安装包）..."
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$ps_script" \
        -Component "$comp" -UseMirror "$USE_MIRROR" -FastDeployDir "$FAST_DEPLOY_DIR" || return 1
    refresh_windows_path
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

# 从 install-scripts.json 读取安装命令（Windows 无 Python 时用 PowerShell 解析）
_get_install_command_python() {
    local component="$1" platform="$2" py
    for py in python3.12 python3 python; do
        command -v "$py" >/dev/null 2>&1 || continue
        "$py" - "$INSTALL_SCRIPTS_JSON" "$component" "$platform" "$USE_MIRROR" <<'PY'
import json, sys
path, comp, plat, mirror = sys.argv[1:5]
with open(path, encoding="utf-8") as f:
    data = json.load(f)
if mirror == "1" and comp not in ("node", "python", "postgresql", "caddy") and plat in ("ubuntu22", "linux"):
    if comp in data.get("scripts_cn", {}):
        print(data["scripts_cn"][comp])
        sys.exit(0)
scripts = data.get("scripts", {}).get(comp, {})
cmd = scripts.get(plat) or scripts.get("linux") or scripts.get("windows") or ""
print(cmd)
PY
        return 0
    done
    return 1
}

_get_install_command_powershell() {
    local component="$1" platform="$2" json_path ps_path
    json_path="$INSTALL_SCRIPTS_JSON"
    if command -v cygpath >/dev/null 2>&1; then
        ps_path="$(cygpath -w "$json_path")"
    else
        ps_path="$json_path"
    fi
    ps_path="${ps_path//\'/''}"
    powershell.exe -NoProfile -Command "
        \$ErrorActionPreference = 'Stop'
        \$data = Get-Content -LiteralPath '$ps_path' -Raw -Encoding UTF8 | ConvertFrom-Json
        \$comp = '$component'
        \$plat = '$platform'
        if ('$USE_MIRROR' -eq '1' -and \$comp -notin @('node','python','postgresql','caddy') -and \$plat -in @('ubuntu22','linux') -and \$data.scripts_cn.PSObject.Properties.Name -contains \$comp) {
            Write-Output \$data.scripts_cn.\$comp
            exit 0
        }
        \$scripts = \$data.scripts.\$comp
        if (\$null -eq \$scripts) { exit 1 }
        \$cmd = \$scripts.\$plat
        if (-not \$cmd) { \$cmd = \$scripts.linux }
        if (-not \$cmd) { \$cmd = \$scripts.windows }
        if (\$cmd) { Write-Output \$cmd }
    " 2>/dev/null
}

get_install_command() {
    local component="$1"
    local platform
    platform="$(get_install_platform_key)"
    if is_windows_gitbash; then
        _get_install_command_powershell "$component" "$platform"
        return
    fi
    _get_install_command_python "$component" "$platform" || {
        log_error "需要 python3 读取 install-scripts.json"
        return 1
    }
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
    is_windows_gitbash && refresh_windows_path
    local node_bin="" v p
    if command -v node >/dev/null 2>&1; then
        node_bin="node"
    elif is_windows_gitbash; then
        for p in \
            "$FAST_DEPLOY_DIR/.tools/node/node.exe" \
            "/c/Program Files/nodejs/node.exe" \
            "/c/Program Files (x86)/nodejs/node.exe"
        do
            [ -x "$p" ] && { node_bin="$p"; break; }
        done
    fi
    [ -z "$node_bin" ] && { echo "missing"; return; }
    v="$("$node_bin" -v 2>/dev/null | sed 's/^v//' | tr -d '\r')"
    [ -z "$v" ] && { echo "missing"; return; }
    if version_ge "$v" "22.0.0"; then echo "ok"; else echo "old:$v"; fi
}

_python_version_output() {
    local py=$1
    case "$py" in
        "py -3.12") py -3.12 --version 2>&1 ;;
        *) "$py" --version 2>&1 ;;
    esac
}

check_python() {
    local py="" v p dir
    is_windows_gitbash && refresh_windows_path
    for c in python3.12 python3 python; do
        if command -v "$c" >/dev/null 2>&1; then py="$c"; break; fi
    done
    if [ -z "$py" ] && is_windows_gitbash && command -v py >/dev/null 2>&1; then
        if py -3.12 --version >/dev/null 2>&1; then
            py="py -3.12"
        elif py -3 --version >/dev/null 2>&1; then
            py="py -3"
        fi
    fi
    if [ -z "$py" ] && is_windows_gitbash; then
        for p in \
            "$LOCALAPPDATA/Programs/Python/Python312/python.exe" \
            "$LOCALAPPDATA/Programs/Python/Python313/python.exe" \
            "/c/Program Files/Python312/python.exe"
        do
            [ -x "$p" ] && { py="$p"; break; }
        done
        if [ -z "$py" ]; then
            for dir in "$LOCALAPPDATA/Programs/Python"/Python3* "/c/Program Files/Python"*; do
                [ -x "$dir/python.exe" ] || continue
                py="$dir/python.exe"
                break
            done
        fi
    fi
    [ -z "$py" ] && { echo "missing"; return; }
    v="$(_python_version_output "$py" | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -1)"
    [ -z "$v" ] && { echo "missing"; return; }
    [[ "$v" != *.*.* ]] && v="${v}.0"
    if version_ge "$v" "3.12.0"; then echo "ok"; else echo "old:$v"; fi
}

check_uv() {
    local uv_bin
    uv_bin="$(resolve_uv)"
    if ! "$uv_bin" --version >/dev/null 2>&1; then echo "missing"; else echo "ok"; fi
}

check_npm() {
    is_windows_gitbash && refresh_windows_path
    if ! command -v npm >/dev/null 2>&1; then echo "missing"; return; fi
    local v
    v="$(npm -v 2>/dev/null | tr -d '\r')"
    if version_ge "$v" "10.0.0"; then echo "ok"; else echo "old:$v"; fi
}

check_postgres() {
    local v="" bin best=""
    local candidates=(psql)
    if is_windows_gitbash; then
        refresh_windows_path
        candidates=(
            "/c/Program Files/PostgreSQL/17/bin/psql.exe"
            "/c/Program Files/PostgreSQL/16/bin/psql.exe"
            "/c/Program Files/PostgreSQL/15/bin/psql.exe"
            psql
        )
    fi
    for bin in "${candidates[@]}" /usr/lib/postgresql/*/bin/psql; do
        [ -x "$bin" ] 2>/dev/null || continue
        v="$("$bin" --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+' | head -1)"
        [ -n "$v" ] || continue
        if version_ge "$v" "15.0"; then
            echo "ok"
            return
        fi
        best="$v"
    done
    [ -n "$best" ] && { echo "old:$best"; return; }
    echo "missing"
}

check_caddy() {
    local c
    c="$(resolve_caddy)"
    [ -n "$c" ] && echo "ok" || echo "missing"
}

# Caddy 在 Windows 以原生 exe 运行，需 C:/... 路径（不能是 Git Bash 的 /c/...）
caddy_native_path() {
    local p=$1
    if is_windows_gitbash; then
        if command -v cygpath >/dev/null 2>&1; then
            cygpath -m "$p"
            return
        fi
        if [[ "$p" == /[a-zA-Z]/* ]]; then
            local drive="${p:1:1}"
            drive="$(echo "$drive" | tr 'a-z' 'A-Z')"
            echo "${drive}:${p:2}"
            return
        fi
    fi
    echo "$p"
}

check_port() {
    local port=$1
    if is_windows_gitbash; then
        netstat -an 2>/dev/null | grep -qiE "[:\.]${port}[[:space:]].*LISTENING" && return 0
        return 1
    fi
    if command -v ss >/dev/null 2>&1; then
        ss -ltn 2>/dev/null | grep -q ":${port} " && return 0
    elif command -v lsof >/dev/null 2>&1; then
        lsof -iTCP:"$port" -sTCP:LISTEN -t >/dev/null 2>&1 && return 0
    elif command -v netstat >/dev/null 2>&1; then
        netstat -tln 2>/dev/null | grep -q ":${port} " && return 0
    fi
    return 1
}

wait_for_backend_health() {
    local retries=0
    while [ $retries -lt "$BACKEND_START_TIMEOUT" ]; do
        if curl -sf "http://127.0.0.1:${BACKEND_PORT}/health" >/dev/null 2>&1; then
            return 0
        fi
        sleep 1
        retries=$((retries + 1))
    done
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
    local patterns=()
    case "$name" in
        caddy)
            patterns=("caddy run")
            ;;
        backend)
            patterns=("uvicorn server.main:app")
            ;;
        worker)
            patterns=("taskiq worker.*core.tasks.taskiq_app:broker")
            ;;
        scheduler)
            patterns=("taskiq scheduler.*core.tasks.taskiq_app:scheduler")
            ;;
    esac
    if [ "${#patterns[@]}" -gt 0 ]; then
        local pattern stragglers
        for pattern in "${patterns[@]}"; do
            stragglers="$(pgrep -f "$pattern" 2>/dev/null || true)"
            for spid in $stragglers; do
                [ -n "$spid" ] || continue
                if [ "$name" = "backend" ] || [ "$name" = "worker" ] || [ "$name" = "scheduler" ]; then
                    graceful_kill_pid "$spid"
                else
                    kill "$spid" 2>/dev/null || true
                fi
                log_info "已清理残留 $name (PID $spid)"
            done
        done
    fi
}

read_env_value() {
    local key=$1
    [ -f "$ENV_FILE" ] || return 1
    grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- | sed 's/^["'\'']//;s/["'\'']$//'
}

# 安全写入 .env（纯 shell，避免 sed 对 / & 等特殊字符失败；不依赖 Python，向导阶段 2 即可写入）
_env_file_set() {
    local key=$1 val=$2 path=$3
    local prefix="${key}=" tmp dir found=0
    dir="$(dirname "$path")"
    mkdir -p "$dir"
    tmp="$(mktemp "${dir}/.env-set.XXXXXX" 2>/dev/null || mktemp -t env-set.XXXXXX)"
    if [ -f "$path" ]; then
        while IFS= read -r line || [ -n "$line" ]; do
            if [[ "$line" == "${prefix}"* ]] && [ "$found" -eq 0 ]; then
                printf '%s%s\n' "$prefix" "$val" >> "$tmp"
                found=1
            else
                printf '%s\n' "$line" >> "$tmp"
            fi
        done < "$path"
    fi
    if [ "$found" -eq 0 ]; then
        printf '%s%s\n' "$prefix" "$val" >> "$tmp"
    fi
    mv "$tmp" "$path"
}

set_env_value() {
    local key=$1 val=$2
    ensure_env_file
    _env_file_set "$key" "$val" "$ENV_FILE"
}

env_value_nonempty() {
    local key=$1
    [ -n "$(read_env_value "$key" 2>/dev/null || true)" ]
}

read_deploy_env_value() {
    local key=$1
    [ -f "$DEPLOY_ENV_FILE" ] || return 1
    grep -E "^${key}=" "$DEPLOY_ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- | sed 's/^["'\'']//;s/["'\'']$//'
}

set_deploy_env_value() {
    local key=$1 val=$2
    [ -f "$DEPLOY_ENV_FILE" ] || cp "$FAST_DEPLOY_DIR/deploy.env.example" "$DEPLOY_ENV_FILE"
    _env_file_set "$key" "$val" "$DEPLOY_ENV_FILE"
}

admin_config_complete() {
    local pass user
    pass="$(read_env_value PLATFORM_SUPERADMIN_PASSWORD || true)"
    user="$(read_env_value PLATFORM_SUPERADMIN_USERNAME || true)"
    [ -z "$user" ] && user="infra_admin"
    [ -n "$pass" ] && [ ${#pass} -ge 6 ] && [ -n "$user" ]
}

server_access_configured() {
    [ -n "$(read_deploy_env_value SERVER_IP || true)" ]
}

env_needs_configure() {
    [ ! -f "$ENV_FILE" ] && return 0
    local jwt base_url
    if ! db_config_complete; then
        return 0
    fi
    if ! admin_config_complete; then
        return 0
    fi
    if ! server_access_configured; then
        return 0
    fi
    jwt="$(read_env_value JWT_SECRET_KEY || true)"
    if [ -z "$jwt" ] || [ "$jwt" = "your-secret-key-here-change-in-production" ]; then
        return 0
    fi
    if [ "$DEPLOY_MODE" = "prod" ]; then
        base_url="$(read_env_value BASE_URL || true)"
        [ -z "$base_url" ] && return 0
    fi
    return 1
}

ensure_env_file() {
    if [ ! -f "$ENV_FILE" ]; then
        cp "$BACKEND_DIR/.env.example" "$ENV_FILE"
    fi
}

db_target_is_remote() {
    [ "$(read_env_value DB_TARGET 2>/dev/null || true)" = "remote" ]
}

db_config_complete() {
    local pass host name user port target
    target="$(read_env_value DB_TARGET || true)"
    pass="$(read_env_value DB_PASSWORD || true)"
    host="$(read_env_value DB_HOST || true)"
    name="$(read_env_value DB_NAME || true)"
    user="$(read_env_value DB_USER || true)"
    port="$(read_env_value DB_PORT || true)"
    [ -n "$target" ] && [ -n "$pass" ] && [ -n "$host" ] && [ -n "$name" ] && [ -n "$user" ] && [ -n "$port" ]
}

read_password_twice() {
    local prompt=$1 p1 p2
    read -rsp "${prompt}: " p1; echo >&2
    read -rsp "再次确认: " p2; echo >&2
    if [ "$p1" != "$p2" ]; then
        log_error "两次密码不一致"
        return 1
    fi
    if [ ${#p1} -lt 1 ]; then
        log_error "密码不能为空"
        return 1
    fi
    printf '%s' "$p1"
}

check_postgres_deploy() {
    if db_target_is_remote; then
        if test_db_connection; then echo "ok"; else echo "conn_failed"; fi
        return
    fi
    check_postgres
}

postgres_bootstrap_local() {
    local db_user db_pass db_name db_port psql_bin escaped sql
    db_user="$(read_env_value DB_USER || echo postgres)"
    db_pass="$(read_env_value DB_PASSWORD)"
    db_name="$(read_env_value DB_NAME || echo riveredge)"
    db_port="$(read_env_value DB_PORT || echo "$(detect_postgres_port)")"
    psql_bin="$(resolve_psql)"

    [ -n "$db_pass" ] || { log_error "DB_PASSWORD 未配置"; return 1; }

    log_info "初始化本地 PostgreSQL (${db_user}@${db_port}/${db_name})..."

    postgres_run_alter_password "postgres" "$db_port" "$db_pass" || {
        log_error "设置 postgres 超级用户密码失败，请确认 PostgreSQL 已启动"
        return 1
    }

    if [ "$db_user" != "postgres" ]; then
        escaped="$(postgres_sql_escape "$db_pass")"
        sql="DO \$\$ BEGIN
IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${db_user}') THEN
  CREATE ROLE \"${db_user}\" LOGIN PASSWORD '${escaped}' CREATEDB;
ELSE
  ALTER ROLE \"${db_user}\" WITH PASSWORD '${escaped}';
END IF;
END \$\$;"
        if is_windows_gitbash; then
            postgres_psql_local "$db_port" -v ON_ERROR_STOP=1 -c "$sql" || return 1
        else
            sudo -u postgres psql -p "$db_port" -d postgres -v ON_ERROR_STOP=1 -c "$sql" 2>/dev/null || \
                sudo -u postgres psql -d postgres -v ON_ERROR_STOP=1 -c "$sql" || return 1
        fi
    fi

    if is_windows_gitbash; then
        if ! postgres_psql_local "$db_port" -tc "SELECT 1 FROM pg_database WHERE datname='${db_name}'" 2>/dev/null | grep -q 1; then
            postgres_psql_local "$db_port" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${db_name}\" OWNER \"${db_user}\";" || return 1
        fi
    elif ! sudo -u postgres psql -p "$db_port" -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='${db_name}'" 2>/dev/null | grep -q 1; then
        if ! sudo -u postgres psql -p "$db_port" -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${db_name}\" OWNER \"${db_user}\";" 2>/dev/null; then
            sudo -u postgres psql -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${db_name}\" OWNER \"${db_user}\";" || return 1
        fi
    fi

    export PGPASSWORD="$db_pass"
    if ! "$psql_bin" -h localhost -p "$db_port" -U "$db_user" -d "$db_name" -c "SELECT 1" >/dev/null 2>&1; then
        unset PGPASSWORD
        log_error "数据库初始化后连接验证失败"
        return 1
    fi
    unset PGPASSWORD
    log_ok "本地 PostgreSQL 已就绪"
}

resolve_psql() {
    local bin v
    if is_windows_gitbash; then
        refresh_windows_path
        for bin in \
            "/c/Program Files/PostgreSQL/17/bin/psql.exe" \
            "/c/Program Files/PostgreSQL/16/bin/psql.exe" \
            "/c/Program Files/PostgreSQL/15/bin/psql.exe"
        do
            [ -x "$bin" ] || continue
            v="$("$bin" --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+' | head -1)"
            [ -n "$v" ] && version_ge "$v" "15.0" && { echo "$bin"; return; }
        done
    fi
    for bin in /usr/lib/postgresql/*/bin/psql; do
        [ -x "$bin" ] 2>/dev/null || continue
        v="$("$bin" --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+' | head -1)"
        [ -n "$v" ] && version_ge "$v" "15.0" && { echo "$bin"; return; }
    done
    command -v psql 2>/dev/null || echo "psql"
}

postgres_psql_local() {
    local port=$1
    shift
    local psql_bin pass
    psql_bin="$(resolve_psql)"
    if is_windows_gitbash; then
        pass="$(read_env_value DB_PASSWORD || true)"
        export PGPASSWORD="$pass"
        "$psql_bin" -h localhost -p "$port" -U postgres -d postgres "$@"
        local rc=$?
        unset PGPASSWORD
        return $rc
    fi
    sudo -u postgres psql -p "$port" -d postgres "$@" 2>/dev/null || sudo -u postgres psql -d postgres "$@"
}

detect_postgres_port() {
    local from_env
    from_env="$(read_env_value DB_PORT 2>/dev/null || true)"
    [ -n "$from_env" ] && { echo "$from_env"; return; }
    if is_windows_gitbash; then
        echo "5432"
        return
    fi
    if command -v pg_lsclusters >/dev/null 2>&1; then
        local port
        port="$(pg_lsclusters -h 2>/dev/null | awk 'NR>1 && $1+0>=15 && $4=="online"{print $3; exit}')"
        [ -n "$port" ] && { echo "$port"; return; }
        port="$(pg_lsclusters -h 2>/dev/null | awk 'NR>1 && $4=="online"{print $3; exit}')"
        [ -n "$port" ] && { echo "$port"; return; }
    fi
    echo "5432"
}

test_db_connection() {
    local psql_bin host port user pass dbname err
    psql_bin="$(resolve_psql)"
    host="$(read_env_value DB_HOST || echo localhost)"
    port="$(read_env_value DB_PORT || echo "$(detect_postgres_port)")"
    user="$(read_env_value DB_USER || echo postgres)"
    pass="$(read_env_value DB_PASSWORD)"
    dbname="$(read_env_value DB_NAME || echo riveredge)"
    export PGPASSWORD="$pass"
    if "$psql_bin" -h "$host" -p "$port" -U "$user" -d "$dbname" -c "SELECT 1" >/dev/null 2>&1; then
        unset PGPASSWORD
        return 0
    fi
    if "$psql_bin" -h "$host" -p "$port" -U "$user" -d postgres -c "SELECT 1" >/dev/null 2>&1; then
        if [ "$host" = "localhost" ] || [ "$host" = "127.0.0.1" ]; then
            "$psql_bin" -h "$host" -p "$port" -U "$user" -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='${dbname}'" 2>/dev/null | grep -q 1 || \
                "$psql_bin" -h "$host" -p "$port" -U "$user" -d postgres -c "CREATE DATABASE \"${dbname}\";" >/dev/null 2>&1
        fi
        unset PGPASSWORD
        return 0
    fi
    err="$("$psql_bin" -h "$host" -p "$port" -U "$user" -d postgres -c "SELECT 1" 2>&1)" || true
    unset PGPASSWORD
    log_error "连接 ${user}@${host}:${port}/${dbname} 失败: ${err##*$'\n'}"
    log_error "常见原因: 端口不对(PG15 常为 5433)、密码与本机 postgres 不一致、服务未启动"
    return 1
}

postgres_can_local_reset() {
    local host=${1:-localhost}
    { [ "$host" = "localhost" ] || [ "$host" = "127.0.0.1" ]; } || return 1
    case "$(uname -s)" in
        Linux|Darwin) ;;
        *) return 1 ;;
    esac
    command -v sudo >/dev/null 2>&1 || return 1
    return 0
}

postgres_sql_escape() {
    local s=$1
    s="${s//\\/\\\\}"
    s="${s//\'/\'\'}"
    printf '%s' "$s"
}

postgres_run_alter_password() {
    local db_user=$1 db_port=$2 new_pass=$3
    local sql escaped psql_bin
    escaped="$(postgres_sql_escape "$new_pass")"
    sql="ALTER USER \"${db_user}\" WITH PASSWORD '${escaped}';"
    if is_windows_gitbash; then
        psql_bin="$(resolve_psql)"
        local pass
        pass="$(read_env_value DB_PASSWORD || true)"
        export PGPASSWORD="$pass"
        if "$psql_bin" -h localhost -p "$db_port" -U "$db_user" -d postgres -v ON_ERROR_STOP=1 -c "$sql" >/dev/null 2>&1; then
            unset PGPASSWORD
            return 0
        fi
        export PGPASSWORD="$new_pass"
        if "$psql_bin" -h localhost -p "$db_port" -U "$db_user" -d postgres -v ON_ERROR_STOP=1 -c "$sql" >/dev/null 2>&1; then
            unset PGPASSWORD
            return 0
        fi
        unset PGPASSWORD
        return 1
    fi
    if sudo -u postgres psql -p "$db_port" -d postgres -v ON_ERROR_STOP=1 -c "$sql" >/dev/null 2>&1; then
        return 0
    fi
    sudo -u postgres psql -d postgres -v ON_ERROR_STOP=1 -c "$sql" >/dev/null 2>&1
}

configure_postgres_password_manual() {
    local db_pass input
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
}

configure_postgres_password_reset() {
    local db_user=$1 db_host=$2 db_port=$3
    local confirm new_pass new_pass2

    if ! postgres_can_local_reset "$db_host"; then
        log_error "强制重置仅支持本机 localhost（Linux/macOS + sudo -u postgres）"
        exit 1
    fi

    echo ""
    log_warn "━━ 强制重置密码 · 风险须知 ━━"
    echo "  · 将修改 PostgreSQL 用户「${db_user}」的登录密码"
    echo "  · 使用旧密码的其他应用、脚本、副本/从库连接将立即失效"
    echo "  · 需 sudo 以系统 postgres 用户执行，无法用于远程数据库主机"
    echo "  · 若不确定影响范围，请选择「手动填写」模式"
    echo ""
    read -rp "确认强制重置请输入 yes: " confirm
    [ "$confirm" = "yes" ] || { log_error "已取消强制重置"; exit 1; }

    read -rsp "新的 PostgreSQL 密码: " new_pass; echo
    [ ${#new_pass} -lt 1 ] && { log_error "密码不能为空"; exit 1; }
    read -rsp "再次确认新密码: " new_pass2; echo
    [ "$new_pass" = "$new_pass2" ] || { log_error "两次输入的密码不一致"; exit 1; }

    log_info "正在重置 PostgreSQL 用户 ${db_user}@${db_host}:${db_port} 的密码..."
    if ! postgres_run_alter_password "$db_user" "$db_port" "$new_pass"; then
        log_error "密码重置失败，请确认 PostgreSQL 已启动且 sudo -u postgres psql 可用"
        exit 1
    fi
    set_env_value DB_PASSWORD "$new_pass"
    log_ok "密码已重置并写入 .env"
}

configure_postgres_password() {
    local db_user db_host db_port mode
    db_user="$(read_env_value DB_USER || echo postgres)"
    db_host="$(read_env_value DB_HOST || echo localhost)"
    db_port="$(read_env_value DB_PORT || echo "$(detect_postgres_port)")"

    echo ""
    log_info "PostgreSQL 密码配置方式:"
    echo "  1) 手动填写 — 使用你已知的数据库密码连接"
    if postgres_can_local_reset "$db_host"; then
        echo "  2) 强制重置 — 将本机 ${db_user} 用户密码改为你设置的新密码（有风险，见下文）"
        read -rp "请选择 [1/2] (默认 1): " mode
    else
        echo "  （本机 localhost 以外或当前系统不支持强制重置，请选手动填写）"
        mode=1
    fi
    mode="${mode:-1}"
    case "$mode" in
        2) configure_postgres_password_reset "$db_user" "$db_host" "$db_port" ;;
        *) configure_postgres_password_manual ;;
    esac
}

generate_jwt_secret() {
    local secret py
    if command -v openssl >/dev/null 2>&1; then
        secret="$(openssl rand -base64 32 2>/dev/null | tr -d '\n\r=')"
        if [ -n "$secret" ]; then
            echo "$secret"
            return 0
        fi
    fi
    for py in python3.12 python3 python; do
        command -v "$py" >/dev/null 2>&1 || continue
        secret="$("$py" -c 'import secrets; print(secrets.token_urlsafe(32))' 2>/dev/null || true)"
        if [ -n "$secret" ]; then
            echo "$secret"
            return 0
        fi
    done
    log_error "无法生成 JWT 密钥（需要 openssl 或 Python）"
    return 1
}

apply_app_config() {
    local jwt server_ip detected_ip base_url admin_user
    load_deploy_env

    admin_user="$(read_env_value PLATFORM_SUPERADMIN_USERNAME || true)"
    [ -z "$admin_user" ] && set_env_value PLATFORM_SUPERADMIN_USERNAME "infra_admin"

    jwt="$(read_env_value JWT_SECRET_KEY || true)"
    if [ -z "$jwt" ] || [ "$jwt" = "your-secret-key-here-change-in-production" ]; then
        jwt="$(generate_jwt_secret)"
        set_env_value JWT_SECRET_KEY "$jwt"
    fi

    detected_ip="$(detect_server_ip)"
    server_ip="$(read_deploy_env_value SERVER_IP || true)"
    [ -z "$server_ip" ] && server_ip="$detected_ip"
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
}

print_configure_summary() {
    local db_user db_host db_port db_name server_ip admin_user
    db_user="$(read_env_value DB_USER || echo postgres)"
    db_host="$(read_env_value DB_HOST || echo localhost)"
    db_port="$(read_env_value DB_PORT || echo "$(detect_postgres_port)")"
    db_name="$(read_env_value DB_NAME || echo riveredge)"
    server_ip="$(read_deploy_env_value SERVER_IP || detect_server_ip)"
    admin_user="$(read_env_value PLATFORM_SUPERADMIN_USERNAME || echo infra_admin)"
    echo "  数据库: ${db_user}@${db_host}:${db_port}/${db_name}"
    echo "  超管账号: ${admin_user}"
    if [ "$DEPLOY_MODE" = "prod" ]; then
        echo "  访问地址: http://${server_ip}:${PROXY_PORT}"
    else
        echo "  访问地址: http://${server_ip}:${FRONTEND_PORT} (Web) / http://${server_ip}:${BACKEND_PORT} (API)"
    fi
}

configure_prompt_database_edit() {
    local db_user db_host db_port db_name db_target input db_pass
    db_target="$(read_env_value DB_TARGET || true)"
    [ -z "$db_target" ] && db_target="local"
    log_info "当前数据库模式: ${db_target} (local=本地 / remote=远程)"
    read -rp "数据库部署 [local/remote，回车保持]: " input
    if [ -n "$input" ]; then
        case "$input" in
            remote|2) set_env_value DB_TARGET "remote" ;;
            *) set_env_value DB_TARGET "local"; set_env_value DB_HOST "localhost" ;;
        esac
    fi
    db_target="$(read_env_value DB_TARGET || echo local)"

    db_user="$(read_env_value DB_USER || echo postgres)"
    read -rp "PostgreSQL 用户名 [${db_user}]: " input
    db_user="${input:-$db_user}"
    set_env_value DB_USER "$db_user"

    if [ "$db_target" = "remote" ]; then
        db_host="$(read_env_value DB_HOST || true)"
        read -rp "PostgreSQL 主机 [${db_host}]: " input
        db_host="${input:-$db_host}"
        set_env_value DB_HOST "$db_host"
    else
        set_env_value DB_HOST "localhost"
    fi

    db_port="$(read_env_value DB_PORT || echo "$(detect_postgres_port)")"
    read -rp "PostgreSQL 端口 [${db_port}]: " input
    db_port="${input:-$db_port}"
    set_env_value DB_PORT "$db_port"

    db_name="$(read_env_value DB_NAME || echo riveredge)"
    read -rp "数据库名 [${db_name}]: " input
    db_name="${input:-$db_name}"
    set_env_value DB_NAME "$db_name"

    read -rsp "PostgreSQL 密码 [回车跳过 / 输入新密码]: " input; echo
    if [ -n "$input" ]; then
        set_env_value DB_PASSWORD "$input"
    fi
}

cmd_configure() {
    log_info "配置应用环境..."
    apply_cn_mirrors
    if [ ! -f "$ENV_FILE" ]; then
        cp "$BACKEND_DIR/.env.example" "$ENV_FILE"
        log_info "已从 .env.example 创建 $ENV_FILE"
    fi
    load_deploy_env

    local db_user db_host db_port db_name admin_pass admin_user input detected_ip server_ip

    if db_config_complete && [ "${CONFIGURE_ALLOW_DB_EDIT:-0}" = "1" ]; then
        configure_prompt_database_edit
        db_user="$(read_env_value DB_USER)"
        db_host="$(read_env_value DB_HOST)"
        db_port="$(read_env_value DB_PORT)"
        db_name="$(read_env_value DB_NAME)"
    elif db_config_complete; then
        log_info "数据库已在向导/此前步骤配置，跳过数据库问答"
        db_user="$(read_env_value DB_USER)"
        db_host="$(read_env_value DB_HOST)"
        db_port="$(read_env_value DB_PORT)"
        db_name="$(read_env_value DB_NAME)"
    else
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

        db_port="$(read_env_value DB_PORT || true)"
        [ -z "$db_port" ] && db_port="$(detect_postgres_port)"
        read -rp "PostgreSQL 端口 [${db_port}]: " input
        db_port="${input:-$db_port}"
        set_env_value DB_PORT "$db_port"

        db_name="$(read_env_value DB_NAME || true)"
        [ -z "$db_name" ] && db_name="riveredge"
        read -rp "数据库名 [${db_name}]: " input
        db_name="${input:-$db_name}"
        set_env_value DB_NAME "$db_name"

        configure_postgres_password
    fi

    admin_user="$(read_env_value PLATFORM_SUPERADMIN_USERNAME || true)"
    [ -z "$admin_user" ] && admin_user="infra_admin"
    if ! admin_config_complete; then
        read -rp "平台超级管理员用户名 [${admin_user}]: " input
        admin_user="${input:-$admin_user}"
        set_env_value PLATFORM_SUPERADMIN_USERNAME "$admin_user"
        read -rsp "平台超级管理员密码: " admin_pass; echo
        [ ${#admin_pass} -lt 8 ] && { log_error "超管密码至少 8 位"; exit 1; }
        set_env_value PLATFORM_SUPERADMIN_PASSWORD "$admin_pass"
    else
        read -rsp "平台超管密码 [已配置，回车跳过 / 输入新密码]: " input; echo
        if [ -n "$input" ]; then
            [ ${#input} -lt 8 ] && { log_error "超管密码至少 8 位"; exit 1; }
            set_env_value PLATFORM_SUPERADMIN_PASSWORD "$input"
        fi
        read -rp "平台超管用户名 [${admin_user}，回车跳过]: " input
        if [ -n "$input" ]; then
            set_env_value PLATFORM_SUPERADMIN_USERNAME "$input"
        fi
    fi

    detected_ip="$(detect_server_ip)"
    server_ip="$(read_deploy_env_value SERVER_IP || true)"
    [ -z "$server_ip" ] && server_ip="$detected_ip"
    log_info "检测到本机 IP: ${detected_ip}"
    read -rp "服务器 IP (浏览器访问地址) [${server_ip}]: " input
    server_ip="${input:-$server_ip}"
    set_deploy_env_value SERVER_IP "$server_ip"

    apply_app_config

    log_info "测试数据库连接..."
    if ! test_db_connection; then
        exit 1
    fi
    log_ok "配置完成"
    print_configure_summary
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
    ) || { log_error "Python 依赖同步失败"; exit 1; }
    if is_windows_gitbash; then
        ensure_pyzbar_windows_native
    fi
}

ensure_pyzbar_windows_native() {
    local dll="$BACKEND_DIR/.venv/Lib/site-packages/pyzbar/libzbar-64.dll"
    [ -f "$dll" ] && return 0
    log_warn "pyzbar 缺少 Windows 原生 DLL (libzbar-64.dll)，正在重装 pyzbar..."
    (
        cd "$BACKEND_DIR"
        "$(resolve_uv)" pip install --force-reinstall 'pyzbar>=0.1.9'
    ) || {
        log_warn "pyzbar 重装未成功，二维码图片解析不可用，但不影响后端启动"
        return 0
    }
    if [ -f "$dll" ]; then
        log_ok "pyzbar Windows 原生库已就绪"
    else
        log_warn "仍未找到 libzbar-64.dll，二维码图片解析不可用"
    fi
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
    frontend_root="$(caddy_native_path "$FRONTEND_DIR/dist")"
    [ -f "$FRONTEND_DIR/dist/index.html" ] || { log_error "缺少 $FRONTEND_DIR/dist/index.html，请先 build"; exit 1; }

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

stop_system_caddy() {
    if ! command -v systemctl >/dev/null 2>&1; then
        return 0
    fi
    if ! systemctl list-unit-files caddy.service >/dev/null 2>&1; then
        return 0
    fi
    if systemctl is-active --quiet caddy 2>/dev/null || systemctl is-enabled --quiet caddy 2>/dev/null; then
        log_info "停止系统 caddy.service（apt 安装后会自启，与本项目 Caddyfile 冲突）..."
        sudo systemctl stop caddy || {
            log_error "无法停止 caddy.service，请执行: sudo systemctl stop caddy"
            return 1
        }
        sudo systemctl disable caddy || {
            log_error "无法禁用 caddy.service 自启，请执行: sudo systemctl disable caddy"
            return 1
        }
        sleep 1
        if systemctl is-active --quiet caddy 2>/dev/null; then
            log_error "caddy.service 仍在运行，请执行: sudo systemctl stop caddy && sudo systemctl disable caddy"
            return 1
        fi
        log_ok "系统 caddy.service 已停止并禁用自启"
    fi
    return 0
}

ensure_linux_caddy_ready() {
    load_deploy_env
    stop_system_caddy || exit 1
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
    log_info "等待后端就绪（最多 ${BACKEND_START_TIMEOUT}s，首次启动可能较慢）..."
    if ! wait_for_backend_health; then
        log_error "后端启动超时或未通过 /health 检查，查看 $LOGS_DIR/backend.log"
        [ -f "$LOGS_DIR/backend.log" ] && tail -30 "$LOGS_DIR/backend.log" >&2
        exit 1
    fi
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
    local caddy_bin caddy_config
    caddy_bin="$(resolve_caddy)"
    caddy_config="$(caddy_native_path "$CADDYFILE")"
    if [ -f "$LOGS_DIR/caddy.pid" ] && kill -0 "$(cat "$LOGS_DIR/caddy.pid")" 2>/dev/null; then
        log_info "Caddy 已在运行"
        verify_caddy_serving || exit 1
        return 0
    fi
    stop_service caddy
    kill_port "$PROXY_PORT"
    log_info "启动 Caddy (:${PROXY_PORT})..."
    nohup "$caddy_bin" run --config "$caddy_config" >> "$LOGS_DIR/caddy.log" 2>&1 &
    echo $! > "$LOGS_DIR/caddy.pid"
    sleep 2
    kill -0 "$(cat "$LOGS_DIR/caddy.pid")" 2>/dev/null || {
        log_error "Caddy 启动失败，查看 $LOGS_DIR/caddy.log"
        tail -20 "$LOGS_DIR/caddy.log" >&2
        exit 1
    }
    check_port "$PROXY_PORT" || {
        log_error "Caddy 未监听端口 ${PROXY_PORT}，查看 $LOGS_DIR/caddy.log"
        tail -20 "$LOGS_DIR/caddy.log" >&2
        exit 1
    }
    verify_caddy_serving || exit 1
    log_ok "Caddy 已启动"
}

verify_caddy_serving() {
    local code
    code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PROXY_PORT}/" 2>/dev/null || echo "000")"
    if [ "$code" = "200" ]; then
        return 0
    fi
    log_error "Web 入口 http://127.0.0.1:${PROXY_PORT}/ 返回 HTTP ${code}（期望 200）"
    log_error "Caddyfile: $CADDYFILE"
    log_error "前端 dist: $FRONTEND_DIR/dist/index.html"
    [ -f "$LOGS_DIR/caddy.log" ] && tail -20 "$LOGS_DIR/caddy.log" >&2
    return 1
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
    # 清理未纳入 pid 文件管理的旧进程占用（如历史 uvicorn/caddy）
    kill_port "$PROXY_PORT"
    kill_port "$BACKEND_PORT"
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

pgdg_apt_base_url() {
    if [ "${USE_MIRROR}" = "1" ]; then
        echo "https://mirrors.aliyun.com/postgresql/repos/apt"
    else
        echo "https://apt.postgresql.org/pub/repos/apt"
    fi
}

install_postgresql_pgdg() {
    local pgdg_base codename key_path
    if [ ! -f /etc/debian_version ]; then
        log_error "PostgreSQL PGDG 安装仅支持 Debian/Ubuntu"
        return 1
    fi
    # shellcheck disable=SC1091
    . /etc/os-release
    codename="${VERSION_CODENAME:-}"
    [ -n "$codename" ] || { log_error "无法检测 VERSION_CODENAME"; return 1; }

    pgdg_base="$(pgdg_apt_base_url)"
    key_path="/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc"
    log_info "配置 PGDG 源: ${pgdg_base} (${codename}-pgdg)"
    sudo apt update || return 1
    sudo apt install -y ca-certificates curl gnupg postgresql-common || return 1
    sudo install -d /usr/share/postgresql-common/pgdg
    curl -fsSL "${pgdg_base}/ACCC4CF8.asc" | sudo tee "$key_path" > /dev/null || return 1
    echo "deb [signed-by=${key_path}] ${pgdg_base} ${codename}-pgdg main" | sudo tee /etc/apt/sources.list.d/pgdg.list > /dev/null
    sudo apt update || return 1
    sudo apt install -y postgresql-15 postgresql-contrib-15 || return 1
    log_ok "PostgreSQL 15 已安装"
}

caddy_apt_deb_base() {
    if [ "${USE_MIRROR}" = "1" ]; then
        echo "https://mirrors.china.12306.work/repository/caddy/stable/deb/debian"
    else
        echo "https://dl.cloudsmith.io/public/caddy/stable/deb/debian"
    fi
}

caddy_gpg_url() {
    if [ "${USE_MIRROR}" = "1" ]; then
        echo "https://getiot.tech/public/caddy/stable/gpg.key"
    else
        echo "https://dl.cloudsmith.io/public/caddy/stable/gpg.key"
    fi
}

install_caddy_apt() {
    local apt_base gpg_url keyring=/usr/share/keyrings/caddy-stable-archive-keyring.gpg
    apt_base="$(caddy_apt_deb_base)"
    gpg_url="$(caddy_gpg_url)"
    log_info "配置 Caddy apt 源: ${apt_base}"
    sudo apt update || return 1
    sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl ca-certificates gnupg || return 1
    curl -fsSL "$gpg_url" | sudo gpg --dearmor -o "$keyring" || return 1
    sudo chmod o+r "$keyring"
    echo "deb [signed-by=${keyring}] ${apt_base} any-version main" | sudo tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null
    sudo chmod o+r /etc/apt/sources.list.d/caddy-stable.list
    sudo apt update || return 1
    sudo apt install -y caddy || return 1
    stop_system_caddy || return 1
    command -v caddy >/dev/null 2>&1 || { log_error "apt 安装后未找到 caddy"; return 1; }
    log_ok "Caddy 已通过 apt 安装: $(command -v caddy)"
}

run_install_component() {
    local comp=$1 status=$2
    [ "$status" = "ok" ] && return 0
    if is_windows_gitbash; then
        case "$comp" in
            node|python|uv|postgresql|caddy)
                run_windows_install_component "$comp" || {
                    log_error "$comp 安装失败，详见上方日志"
                    return 1
                }
                return 0
                ;;
        esac
    fi
    if [ "$comp" = "caddy" ]; then
        log_info "安装 caddy..."
        if is_windows_gitbash; then
            run_windows_install_component caddy || return 1
            return 0
        elif [ -f /etc/debian_version ]; then
            install_caddy_apt || return 1
            return 0
        elif [[ "$(uname -s)" == "Darwin" ]]; then
            if command -v brew >/dev/null 2>&1; then
                brew install caddy || return 1
                log_ok "Caddy 已通过 Homebrew 安装"
                return 0
            fi
            log_error "macOS 请先安装 Homebrew 后执行: brew install caddy"
            return 1
        fi
        log_error "不支持的平台，请手动安装 Caddy"
        return 1
    fi
    if [ "$comp" = "postgresql" ] && [ -f /etc/debian_version ] && ! is_windows_gitbash; then
        log_info "安装 postgresql..."
        install_postgresql_pgdg || return 1
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
    bash -lc "$cmd" || {
        log_error "$comp 安装失败，请手动执行: $cmd"
        return 1
    }
}

cmd_check() {
    is_windows_gitbash && refresh_windows_path
    local need_caddy=0
    [ "$DEPLOY_MODE" = "prod" ] && need_caddy=1
    local failed=0

    local st
    st="$(check_node)"; [ "$st" = "ok" ] && log_ok "Node.js" || { log_warn "Node.js: $st"; failed=1; }
    st="$(check_python)"; [ "$st" = "ok" ] && log_ok "Python" || { log_warn "Python: $st"; failed=1; }
    st="$(check_uv)"; [ "$st" = "ok" ] && log_ok "uv" || { log_warn "uv: $st"; failed=1; }
    st="$(check_npm)"; [ "$st" = "ok" ] && log_ok "npm" || { log_warn "npm: $st"; failed=1; }
    if db_target_is_remote; then
        st="$(check_postgres_deploy)"; [ "$st" = "ok" ] && log_ok "PostgreSQL (远程)" || { log_warn "PostgreSQL (远程): $st"; failed=1; }
    else
        st="$(check_postgres)"; [ "$st" = "ok" ] && log_ok "PostgreSQL" || { log_warn "PostgreSQL: $st"; failed=1; }
    fi
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
        log_info "Windows 环境：优先 winget，不可用时走官方安装包..."
    fi
    run_install_component node "$(check_node)" || true
    run_install_component python "$(check_python)" || true
    run_install_component uv "$(check_uv)" || true
    if db_target_is_remote; then
        log_info "远程数据库模式 (DB_TARGET=remote)，跳过本地 PostgreSQL 安装"
    else
        local pg_st
        pg_st="$(check_postgres)"
        if [ "$pg_st" != "ok" ]; then
            run_install_component postgresql "$pg_st" || return 1
        fi
        if db_config_complete; then
            postgres_bootstrap_local || return 1
        fi
    fi
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
    cmd_wizard
}

fd_dispatch() {
    local cmd="${1:-}"
    case "$cmd" in
        check)     cmd_check ;;
        install)
            cmd_install
            log_info "install 仅安装系统依赖；完整部署请执行: ./fast-deploy/deploy.sh"
            ;;
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
        wizard|""|deploy) cmd_wizard ;;
        *)
            log_error "未知命令: $cmd"
            echo "用法: wizard | check | install | configure | migrate | build | start | stop | status | update"
            exit 1
            ;;
    esac
}

# shellcheck source=lib/wizard.sh
source "$FAST_DEPLOY_DIR/lib/wizard.sh"
