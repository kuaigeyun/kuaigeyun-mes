#!/usr/bin/env bash
# RiverEdge fast-deploy 共享库（Linux / macOS / Git Bash）

set -euo pipefail

FAST_DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ROOT="$(cd "$FAST_DEPLOY_DIR/.." && pwd)"
FAST_DEPLOY_CONFIG_DIR="$FAST_DEPLOY_DIR/config"
INSTALL_SCRIPTS_JSON="$FAST_DEPLOY_CONFIG_DIR/install-scripts.json"
BACKEND_DIR="$PROJECT_ROOT/riveredge-backend"
FRONTEND_DIR="$PROJECT_ROOT/riveredge-frontend"
MOBILE_APP_DIR="$PROJECT_ROOT/riveredge-app/mobile"
MOBILE_WEB_DIR="$MOBILE_APP_DIR/web-dist"
ENV_FILE="$BACKEND_DIR/.env"
DEPLOY_ENV_FILE="$FAST_DEPLOY_CONFIG_DIR/deploy.env"
DEPLOY_ENV_EXAMPLE="$FAST_DEPLOY_CONFIG_DIR/deploy.env.example"
LOGS_DIR="$PROJECT_ROOT/.logs"
CADDY_DIR="$FAST_DEPLOY_DIR/caddy"
CADDYFILE="$CADDY_DIR/Caddyfile"
CADDY_TEMPLATE="$FAST_DEPLOY_DIR/templates/Caddyfile.template"
# 项目 Caddy 管理 API（非默认 2019，避免与 apt caddy.service 冲突；reload 依赖此端口）
CADDY_PROD_ADMIN_ADDR="${CADDY_PROD_ADMIN_ADDR:-127.0.0.1:2018}"
CADDY_DEV_API_ADMIN_ADDR="${CADDY_DEV_API_ADMIN_ADDR:-127.0.0.1:2017}"
SYSTEMD_UNIT_NAME="riveredge.service"
SYSTEMD_UNIT_PATH="/etc/systemd/system/${SYSTEMD_UNIT_NAME}"
SYSTEMD_UNIT_TEMPLATE="$FAST_DEPLOY_DIR/templates/riveredge.service.template"
SYSTEMD_SERVICE_SCRIPT="$FAST_DEPLOY_DIR/linux/riveredge-service.sh"
WINDOWS_BOOT_TASK_NAME="RiverEdge"
WINDOWS_BOOT_TASK_STOP_NAME="RiverEdge-Stop"
WINDOWS_BOOT_ENV_FILE="$FAST_DEPLOY_CONFIG_DIR/boot-service.env"

# 由入口脚本设置：dev | prod
DEPLOY_MODE="${DEPLOY_MODE:-dev}"
USE_MIRROR="${USE_MIRROR:-1}"
if [ "$DEPLOY_MODE" = "prod" ]; then
    BACKEND_START_TIMEOUT="${BACKEND_START_TIMEOUT:-90}"
else
    BACKEND_START_TIMEOUT="${BACKEND_START_TIMEOUT:-30}"
fi
# Vite 冷启动 / optimizeDeps 偏慢；仅开发前端就绪探测使用
FRONTEND_START_TIMEOUT="${FRONTEND_START_TIMEOUT:-90}"

log_info()  { echo -e "\033[0;34m[$(date +'%H:%M:%S')] INFO: $*\033[0m"; }
log_warn()  { echo -e "\033[1;33m[$(date +'%H:%M:%S')] WARN: $*\033[0m"; }
log_ok()    { echo -e "\033[0;32m[$(date +'%H:%M:%S')] OK: $*\033[0m"; }
log_error() { echo -e "\033[0;31m[$(date +'%H:%M:%S')] ERROR: $*\033[0m" >&2; }

print_support_contact() {
    echo "  联系反馈: WeChat lu_dingjie"
}

ensure_logs_dir() { mkdir -p "$LOGS_DIR"; }

ensure_logs_dir_writable() {
    local run_user="${1:-$(id -un)}"
    ensure_logs_dir
    if [ -w "$LOGS_DIR" ] && { [ ! -f "$LOGS_DIR/backend.pid" ] || [ -w "$LOGS_DIR/backend.pid" ]; }; then
        return 0
    fi
    log_error ".logs 目录对 ${run_user} 不可写: ${LOGS_DIR}"
    log_error "若曾用 sudo 启动过服务，请执行:"
    log_error "  sudo chown -R ${run_user}:${run_user} ${LOGS_DIR}"
    if [ -f "$ENV_FILE" ] && [ ! -r "$ENV_FILE" ]; then
        log_error "  sudo chown ${run_user}:${run_user} ${ENV_FILE}"
    fi
    return 1
}

fix_systemd_runtime_permissions() {
    local service_user=$1
    local service_home service_group
    service_home="$(getent passwd "$service_user" | cut -d: -f6)"
    service_group="$(id -gn "$service_user" 2>/dev/null || echo "$service_user")"
    [ -n "$service_home" ] || { log_error "用户不存在: $service_user"; return 1; }
    ensure_logs_dir
    log_info "修复运行时目录归属 (${service_user})..."
    sudo chown -R "${service_user}:${service_group}" "$LOGS_DIR" || return 1
    if [ -f "$ENV_FILE" ]; then
        sudo chown "${service_user}:${service_group}" "$ENV_FILE" || return 1
        sudo chmod u+rw "$ENV_FILE" || return 1
    fi
    for dir in "${service_home}/.local/share/caddy" "${service_home}/.config/caddy"; do
        if [ -d "$dir" ]; then
            sudo chown -R "${service_user}:${service_group}" "$dir" 2>/dev/null || true
        fi
    done
    load_deploy_env
    local pw_dir caddy_data caddy_config
    pw_dir="$(resolve_playwright_browsers_path)"
    mkdir -p "$pw_dir"
    sudo chown -R "${service_user}:${service_group}" "$pw_dir" 2>/dev/null || true
    caddy_data="${CADDY_DATA_DIR:-$PROJECT_ROOT/.caddy-data}"
    caddy_config="${CADDY_CONFIG_DIR:-$PROJECT_ROOT/.caddy-config}"
    mkdir -p "$caddy_data" "$caddy_config"
    sudo chown -R "${service_user}:${service_group}" "$caddy_data" "$caddy_config" 2>/dev/null || true
    log_ok "运行时目录权限已就绪"
    return 0
}

load_deploy_env() {
    if [ ! -f "$DEPLOY_ENV_FILE" ]; then
        if [ -f "$DEPLOY_ENV_EXAMPLE" ]; then
            cp "$DEPLOY_ENV_EXAMPLE" "$DEPLOY_ENV_FILE"
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
    ALLOW_SERVER_BUILD="${ALLOW_SERVER_BUILD:-0}"
    SERVER_IP="${SERVER_IP:-}"
    # Taskiq 子进程数：生产默认 1（CLI 内置默认为 2，每子进程约 +200MB RSS）
    if [ -z "${TASKIQ_WORKERS:-}" ]; then
        if [ "$DEPLOY_MODE" = "prod" ]; then
            TASKIQ_WORKERS=1
        else
            TASKIQ_WORKERS=2
        fi
    fi
    PLAYWRIGHT_POSTINSTALL_ENABLE="${PLAYWRIGHT_POSTINSTALL_ENABLE:-1}"
    PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$PROJECT_ROOT/.playwright-browsers}"
    CADDY_DATA_DIR="${CADDY_DATA_DIR:-$PROJECT_ROOT/.caddy-data}"
    CADDY_CONFIG_DIR="${CADDY_CONFIG_DIR:-$PROJECT_ROOT/.caddy-config}"
    CADDY_START_TIMEOUT="${CADDY_START_TIMEOUT:-45}"
    GIT_BRANCH="${GIT_BRANCH:-develop}"
    GIT_REMOTE="${GIT_REMOTE:-origin}"
    BLUE_GREEN_DEPLOY="${BLUE_GREEN_DEPLOY:-0}"
    BACKEND_PORT_BLUE="${BACKEND_PORT_BLUE:-8201}"
    BACKEND_PORT_GREEN="${BACKEND_PORT_GREEN:-8202}"
    WORKER_DRAIN_TIMEOUT="${WORKER_DRAIN_TIMEOUT:-60}"
    BLUE_GREEN_HEALTH_TIMEOUT="${BLUE_GREEN_HEALTH_TIMEOUT:-120}"
    # Taskiq worker/scheduler 就绪等待（低内存机 import 慢，sleep 也会因 swap 被拉长）
    TASKIQ_START_TIMEOUT="${TASKIQ_START_TIMEOUT:-180}"
}

# shellcheck source=lib/blue_green.sh
source "$FAST_DEPLOY_DIR/lib/blue_green.sh"

is_windows_gitbash() {
    case "$(uname -s)" in
        MINGW*|MSYS*|CYGWIN*) return 0 ;;
        *) return 1 ;;
    esac
}

# Git Bash / MSYS 路径 (/d/foo) 转为 PowerShell 可识别的 D:/foo 或 D:\foo
to_powershell_path() {
    local p="${1:-}"
    [ -n "$p" ] || return 1
    if command -v cygpath >/dev/null 2>&1; then
        cygpath -m "$p"
        return
    fi
    if [[ "$p" =~ ^/([a-zA-Z])/(.*)$ ]]; then
        local drive="${BASH_REMATCH[1]}"
        drive="$(echo "$drive" | tr 'a-z' 'A-Z')"
        echo "${drive}:/${BASH_REMATCH[2]}"
        return
    fi
    echo "$p"
}

# Windows Git Bash 默认 locale 为 GBK，aerich 读 pyproject.toml（UTF-8 中文注释）会 UnicodeDecodeError
if is_windows_gitbash; then
    export PYTHONUTF8="${PYTHONUTF8:-1}"
    export PYTHONIOENCODING="${PYTHONIOENCODING:-utf-8}"
fi

# nvm-windows：settings.txt 的 path（如 C:\nvm4w\nodejs）+ root 下最新 v* 目录
_prepend_nvm_windows_paths() {
    local nvm_root nvm_link settings win_path unix_path ver best=""
    nvm_root="${NVM_HOME:-}"
    [ -n "$nvm_root" ] || nvm_root="${LOCALAPPDATA}/nvm"
    # Git Bash 下 LOCALAPPDATA 可能是 C:\Users\...，统一成 /c/Users/...
    if [[ "$nvm_root" == [A-Za-z]:* ]]; then
        nvm_root="$(cygpath -u "$nvm_root" 2>/dev/null || echo "$nvm_root")"
    fi
    settings="${nvm_root}/settings.txt"
    if [ -f "$settings" ]; then
        win_path="$(grep -E '^path:' "$settings" 2>/dev/null | head -1 | sed 's/^path:[[:space:]]*//;s/\r$//')"
        if [ -n "$win_path" ]; then
            unix_path="$(cygpath -u "$win_path" 2>/dev/null || true)"
            [ -n "$unix_path" ] && [ -d "$unix_path" ] && PATH="$unix_path:$PATH"
        fi
        win_path="$(grep -E '^root:' "$settings" 2>/dev/null | head -1 | sed 's/^root:[[:space:]]*//;s/\r$//')"
        if [ -n "$win_path" ]; then
            unix_path="$(cygpath -u "$win_path" 2>/dev/null || true)"
            [ -n "$unix_path" ] && [ -d "$unix_path" ] && nvm_root="$unix_path"
        fi
    fi
    for nvm_link in "/c/nvm4w/nodejs" "/d/nvm4w/nodejs"; do
        [ -d "$nvm_link" ] && PATH="$nvm_link:$PATH"
    done
    if [ -d "$nvm_root" ]; then
        for ver in "$nvm_root"/v*; do
            [ -x "$ver/node.exe" ] || [ -x "$ver/node" ] || continue
            best="$ver"
        done
        [ -n "$best" ] && PATH="$best:$PATH"
    fi
}

# Windows 安装后补充常见路径（当前 Git Bash 会话内生效；含便携版 .tools/node、nvm-windows）
refresh_windows_path() {
    is_windows_gitbash || return 0
    local p dir
    _prepend_nvm_windows_paths
    for p in \
        "$FAST_DEPLOY_DIR/.tools/node" \
        "/c/Program Files/nodejs" \
        "/c/Program Files (x86)/nodejs" \
        "$LOCALAPPDATA/Programs/Python/Python312" \
        "$LOCALAPPDATA/Programs/Python/Python312/Scripts" \
        "$LOCALAPPDATA/Programs/Python/Python313" \
        "$LOCALAPPDATA/Programs/Python/Python313/Scripts" \
        "$USERPROFILE/.local/bin" \
        "$FAST_DEPLOY_DIR/.tools/caddy"
    do
        [ -d "$p" ] && PATH="$p:$PATH"
    done
    for dir in "/c/Program Files/PostgreSQL/"*/bin; do
        [ -d "$dir" ] && PATH="$dir:$PATH"
    done
    for dir in "$LOCALAPPDATA/Programs/Python"/Python3*; do
        [ -d "$dir" ] || continue
        PATH="$dir:$dir/Scripts:$PATH"
    done
    for dir in "/c/Program Files/Python"* "/c/Program Files/python"*; do
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
    local ps_script_win fast_deploy_win
    [ -f "$ps_script" ] || { log_error "缺少 $ps_script"; return 1; }
    ps_script_win="$(to_powershell_path "$ps_script")"
    fast_deploy_win="$(to_powershell_path "$FAST_DEPLOY_DIR")"
    log_info "Windows 安装 $comp（winget 或官方安装包）..."
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$ps_script_win" \
        -Component "$comp" -UseMirror "$USE_MIRROR" -FastDeployDir "$fast_deploy_win" || return 1
    refresh_windows_path
}

run_windows_boot_task_action() {
    local action=$1
    local ps_script="$FAST_DEPLOY_DIR/windows/install-boot-task.ps1"
    local ps_script_win project_root_win fast_deploy_win
    [ -f "$ps_script" ] || { log_error "缺少 $ps_script"; return 1; }
    ps_script_win="$(to_powershell_path "$ps_script")"
    project_root_win="$(to_powershell_path "$PROJECT_ROOT")"
    fast_deploy_win="$(to_powershell_path "$FAST_DEPLOY_DIR")"
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$ps_script_win" \
        -Action "$action" -FastDeployDir "$fast_deploy_win" -ProjectRoot "$project_root_win"
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

# Windows: C:\foo → /c/foo（Git Bash 路径）
_unix_path_from_win32() {
    local p="${1//\\/\/}"
    p="$(echo "$p" | tr -d '\r')"
    if [[ "$p" =~ ^([A-Za-z]):/(.*)$ ]]; then
        echo "/$(echo "${BASH_REMATCH[1]}" | tr 'A-Z' 'a-z')/${BASH_REMATCH[2]}"
    fi
}

_is_windows_store_stub() {
    [[ "${1:-}" == *WindowsApps* ]]
}

# where.exe 发现已安装可执行文件（跳过 Microsoft Store 占位符）
_discover_exes_via_where() {
    local name=$1 line unix
    is_windows_gitbash || return 0
    command -v where.exe >/dev/null 2>&1 || return 0
    while IFS= read -r line; do
        line="$(echo "$line" | tr -d '\r')"
        [ -n "$line" ] || continue
        _is_windows_store_stub "$line" && continue
        unix="$(_unix_path_from_win32 "$line")"
        [ -n "$unix" ] && [ -x "$unix" ] && echo "$unix"
    done < <(where.exe "$name" 2>/dev/null)
}

# py -0p 列出 Python Launcher 已注册的解释器
_discover_python_via_launcher() {
    local line path unix spec
    is_windows_gitbash || return 0
    command -v py >/dev/null 2>&1 || return 0
    while IFS= read -r line; do
        line="$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//;s/\r$//')"
        [ -n "$line" ] || continue
        path="${line##*[[:space:]]}"
        [[ "$path" == *\\* ]] || continue
        _is_windows_store_stub "$path" && continue
        unix="$(_unix_path_from_win32 "$path")"
        [ -n "$unix" ] && [ -x "$unix" ] && echo "$unix"
        if [[ "$line" =~ -V:([0-9]+\.[0-9]+) ]]; then
            spec="${BASH_REMATCH[1]}"
            py "-V:${spec}" --version >/dev/null 2>&1 && echo "py -V:${spec}"
        fi
    done < <(py -0p 2>/dev/null)
}

_collect_python_candidates() {
    local item
    if is_windows_gitbash; then
        refresh_windows_path
        _discover_exes_via_where python
        _discover_exes_via_where python3
        _discover_python_via_launcher
        for item in \
            "$LOCALAPPDATA/Programs/Python/Python312/python.exe" \
            "$LOCALAPPDATA/Programs/Python/Python313/python.exe" \
            "$LOCALAPPDATA/Programs/Python/Python314/python.exe" \
            "/c/Program Files/Python312/python.exe" \
            "/c/Program Files/python/python.exe"
        do
            [ -x "$item" ] && echo "$item"
        done
        for item in "$LOCALAPPDATA/Programs/Python"/Python3* "/c/Program Files/Python"* "/c/Program Files/python"*; do
            [ -x "$item/python.exe" ] && echo "$item/python.exe"
        done
    fi
    for item in python3.12 python3 python; do
        command -v "$item" >/dev/null 2>&1 && echo "$item"
    done
    if is_windows_gitbash && command -v py >/dev/null 2>&1; then
        for item in -3.12 -3; do
            py "$item" --version >/dev/null 2>&1 && echo "py $item"
        done
    fi
}

_collect_psql_candidates() {
    local item
    if is_windows_gitbash; then
        refresh_windows_path
        _discover_exes_via_where psql
        for item in "/c/Program Files/PostgreSQL/"*/bin/psql.exe; do
            [ -x "$item" ] && echo "$item"
        done
        command -v psql >/dev/null 2>&1 && echo "$(command -v psql)"
    fi
    for item in \
        /www/server/pgsql/bin/psql \
        /usr/pgsql-*/bin/psql \
        /usr/lib/postgresql/*/bin/psql
    do
        [ -x "$item" ] 2>/dev/null && echo "$item"
    done
    command -v psql >/dev/null 2>&1 && echo "$(command -v psql)"
}

load_os_release() {
    if [ -f /etc/os-release ]; then
        # shellcheck disable=SC1091
        . /etc/os-release
    fi
}

is_linux_debian_family() {
    load_os_release
    case "${ID:-}" in
        debian|ubuntu|linuxmint|pop|elementary|zorin) return 0 ;;
    esac
    [[ "${ID_LIKE:-}" == *debian* ]]
}

is_linux_rhel_family() {
    load_os_release
    case "${ID:-}" in
        rhel|centos|rocky|almalinux|ol|scientific|eurolinux|virtuozzo|opencloudos|anolis|tencentos) return 0 ;;
    esac
    [[ "${ID_LIKE:-}" == *rhel* ]] || [[ "${ID_LIKE:-}" == *centos* ]]
}

is_linux_fedora() {
    load_os_release
    [ "${ID:-}" = "fedora" ]
}

linux_pkg_manager() {
    if command -v dnf >/dev/null 2>&1; then
        echo dnf
    elif command -v yum >/dev/null 2>&1; then
        echo yum
    elif command -v apt-get >/dev/null 2>&1; then
        echo apt
    else
        echo ""
    fi
}

linux_machine_arch() {
    case "$(uname -m)" in
        x86_64|amd64) echo x86_64 ;;
        aarch64|arm64) echo aarch64 ;;
        *) uname -m ;;
    esac
}

get_rhel_el_version() {
    load_os_release
    local ver="${VERSION_ID:-}"
    ver="${ver%%.*}"
    if [ -n "$ver" ] && [ "$ver" != "n/a" ]; then
        echo "$ver"
        return
    fi
    if command -v rpm >/dev/null 2>&1; then
        ver="$(rpm -E '%{rhel}' 2>/dev/null || true)"
        if [ -n "$ver" ] && [ "$ver" != "%{rhel}" ]; then
            echo "$ver"
            return
        fi
    fi
    echo "9"
}

linux_platform_label() {
    load_os_release
    echo "${PRETTY_NAME:-Linux}"
}

detect_linux_platform() {
    if [ ! -f /etc/os-release ]; then
        echo "linux"
        return
    fi
    load_os_release
    if [ "${ID:-}" = "ubuntu" ] && { [ "${VERSION_ID:-}" = "22.04" ] || [ "${VERSION_ID:-}" = "24.04" ] || [[ "${VERSION_ID:-}" == 22.* ]] || [[ "${VERSION_ID:-}" == 24.* ]]; }; then
        echo "ubuntu22"
        return
    fi
    if is_linux_rhel_family; then
        echo "rhel"
        return
    fi
    if is_linux_fedora; then
        echo "fedora"
        return
    fi
    if is_linux_debian_family; then
        echo "debian"
        return
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
if mirror == "1" and comp not in ("node", "python", "postgresql", "caddy") and plat in ("ubuntu22", "debian", "rhel", "fedora", "linux"):
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
        if ('$USE_MIRROR' -eq '1' -and \$comp -notin @('node','python','postgresql','caddy') -and \$plat -in @('ubuntu22','debian','rhel','fedora','linux') -and \$data.scripts_cn.PSObject.Properties.Name -contains \$comp) {
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
    if [ -n "${RIVEREDGE_UV:-}" ] && [ -x "${RIVEREDGE_UV}" ]; then
        echo "${RIVEREDGE_UV}"
        return
    fi
    if command -v uv >/dev/null 2>&1; then
        command -v uv
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
    if [ -n "${RIVEREDGE_CADDY:-}" ] && [ -x "${RIVEREDGE_CADDY}" ]; then
        echo "${RIVEREDGE_CADDY}"
        return
    fi
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
    local node_bin="" v p nvm_root ver
    if command -v node >/dev/null 2>&1; then
        node_bin="node"
    elif is_windows_gitbash; then
        nvm_root="${NVM_HOME:-${LOCALAPPDATA}/nvm}"
        if [[ "$nvm_root" == [A-Za-z]:* ]]; then
            nvm_root="$(cygpath -u "$nvm_root" 2>/dev/null || echo "$nvm_root")"
        fi
        for p in \
            "$FAST_DEPLOY_DIR/.tools/node/node.exe" \
            "/c/nvm4w/nodejs/node.exe" \
            "/c/Program Files/nodejs/node.exe" \
            "/c/Program Files (x86)/nodejs/node.exe"
        do
            [ -x "$p" ] && { node_bin="$p"; break; }
        done
        if [ -z "$node_bin" ] && [ -d "$nvm_root" ]; then
            for ver in "$nvm_root"/v*; do
                if [ -x "$ver/node.exe" ]; then
                    node_bin="$ver/node.exe"
                elif [ -x "$ver/node" ]; then
                    node_bin="$ver/node"
                fi
            done
        fi
    fi
    [ -z "$node_bin" ] && { echo "missing"; return; }
    v="$("$node_bin" -v 2>/dev/null | sed 's/^v//' | tr -d '\r')"
    [ -z "$v" ] && { echo "missing"; return; }
    if version_ge "$v" "22.0.0"; then echo "ok"; else echo "old:$v"; fi
}

_python_version_output() {
    local py=$1
    case "$py" in
        py\ -*) "$py" --version 2>&1 ;;
        *) "$py" --version 2>&1 ;;
    esac
}

check_python() {
    local py v best="" seen="" item
    while IFS= read -r py; do
        [ -n "$py" ] || continue
        _is_windows_store_stub "$py" && continue
        [[ " $seen " == *" $py "* ]] && continue
        seen="$seen $py"
        v="$(_python_version_output "$py" 2>/dev/null | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -1)"
        [ -n "$v" ] || continue
        [[ "$v" != *.*.* ]] && v="${v}.0"
        if version_ge "$v" "3.12.0"; then echo "ok"; return; fi
        best="$v"
    done < <(_collect_python_candidates | awk '!seen[$0]++')
    [ -n "$best" ] && { echo "old:$best"; return; }
    echo "missing"
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
    while IFS= read -r bin; do
        [ -n "$bin" ] || continue
        _is_windows_store_stub "$bin" && continue
        [ -x "$bin" ] 2>/dev/null || continue
        v="$("$bin" --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+' | head -1)"
        [ -n "$v" ] || continue
        if version_ge "$v" "15.0"; then
            echo "ok"
            return
        fi
        best="$v"
    done < <(_collect_psql_candidates | awk '!seen[$0]++')
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

# reload 与 run 须使用同一绝对路径，否则 caddy reload 找不到进程
caddy_resolved_config_path() {
    local p
    p="$(caddy_native_path "$CADDYFILE")"
    if command -v realpath >/dev/null 2>&1; then
        realpath "$p" 2>/dev/null || echo "$p"
        return
    fi
    echo "$p"
}

caddy_prod_admin_address() {
    echo "$CADDY_PROD_ADMIN_ADDR"
}

caddy_dev_api_admin_address() {
    echo "$CADDY_DEV_API_ADMIN_ADDR"
}

caddy_reload_with_admin() {
    local caddy_bin=$1 caddy_config=$2 admin_addr=$3
    "$caddy_bin" reload --config "$caddy_config" --address "$admin_addr"
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

caddy_https_enabled() {
    [ -n "${CADDY_DOMAIN:-}" ] && [ "${CADDY_ENABLE_LETSENCRYPT:-false}" = "true" ]
}

kill_all_caddy_processes() {
    local pid
    for pid in $(pgrep -f '[c]addy' 2>/dev/null || true); do
        [ -n "$pid" ] || continue
        kill -TERM "$pid" 2>/dev/null || true
    done
    sleep 2
    for pid in $(pgrep -f '[c]addy' 2>/dev/null || true); do
        [ -n "$pid" ] || continue
        kill -9 "$pid" 2>/dev/null || true
    done
}

ensure_port_free() {
    local port=$1
    local round
    if ! check_port "$port"; then
        return 0
    fi
    log_warn "清理端口 ${port}..."
    for round in 1 2 3 4 5 6; do
        kill_all_caddy_processes
        kill_port "$port"
        if ! check_port "$port"; then
            return 0
        fi
        if [ "$round" -ge 3 ] && sudo -n true 2>/dev/null; then
            sudo -n fuser -k "${port}/tcp" 2>/dev/null || true
            sleep 2
        fi
        if ! check_port "$port"; then
            return 0
        fi
        sleep 1
    done
    log_error "端口 ${port} 仍被占用："
    if command -v ss >/dev/null 2>&1; then
        ss -tlnp 2>/dev/null | grep -E ":${port}\s" || true
    elif command -v lsof >/dev/null 2>&1; then
        lsof -iTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true
    fi
    log_error "若占用者为系统 caddy 或其它 root 进程，请执行:"
    log_error "  sudo systemctl stop caddy && sudo systemctl disable caddy"
    log_error "  sudo fuser -k ${port}/tcp"
    return 1
}

caddy_prepare_listen_ports() {
    load_deploy_env
    if caddy_https_enabled; then
        ensure_port_free 80 || exit 1
        ensure_port_free 443 || exit 1
    else
        ensure_port_free "$PROXY_PORT" || exit 1
    fi
}

caddy_check_listening() {
    load_deploy_env
    if caddy_https_enabled; then
        check_port 443
    else
        check_port "$PROXY_PORT"
    fi
}

caddy_listen_port_label() {
    load_deploy_env
    if caddy_https_enabled; then
        echo "443 (+80 跳转)"
    else
        echo "$PROXY_PORT"
    fi
}

caddy_export_env() {
    load_deploy_env
    export XDG_DATA_HOME="${CADDY_DATA_DIR:-$PROJECT_ROOT/.caddy-data}"
    export XDG_CONFIG_HOME="${CADDY_CONFIG_DIR:-$PROJECT_ROOT/.caddy-config}"
    mkdir -p "$XDG_DATA_HOME" "$XDG_CONFIG_HOME"
}

ensure_caddy_data_migrated() {
    caddy_export_env
    local dest="$XDG_DATA_HOME/caddy"
    if [ -d "$dest" ] && [ -n "$(ls -A "$dest" 2>/dev/null)" ]; then
        return 0
    fi
    local legacy
    for legacy in \
        "${HOME}/.local/share/caddy" \
        "/root/.local/share/caddy"; do
        [ -d "$legacy" ] || continue
        [ -n "$(ls -A "$legacy" 2>/dev/null)" ] || continue
        log_info "迁移 Caddy TLS 数据: ${legacy} -> ${dest}"
        mkdir -p "$(dirname "$dest")"
        if cp -a "$legacy" "$dest" 2>/dev/null || cp -a "$legacy/." "$dest/" 2>/dev/null; then
            [ -n "$(ls -A "$dest" 2>/dev/null)" ] && log_ok "Caddy TLS 数据已迁移至 ${XDG_DATA_HOME}"
            return 0
        fi
        log_warn "Caddy TLS 数据迁移未成功，将重新申请证书（需 80 端口公网可达）"
    done
}

wait_for_caddy_listening() {
    load_deploy_env
    local timeout="${CADDY_START_TIMEOUT:-45}"
    local retries=0
    while [ "$retries" -lt "$timeout" ]; do
        if caddy_check_listening; then
            return 0
        fi
        if [ -f "$LOGS_DIR/caddy.pid" ]; then
            local pid
            pid="$(tr -d '[:space:]' < "$LOGS_DIR/caddy.pid" 2>/dev/null || true)"
            if [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null; then
                return 1
            fi
        fi
        sleep 1
        retries=$((retries + 1))
    done
    return 1
}

caddy_diagnose_start_failure() {
    local caddy_bin=$1 caddy_config=$2
    log_error "Caddy 启动诊断："
    if [ -f "$LOGS_DIR/caddy.log" ]; then
        tail -30 "$LOGS_DIR/caddy.log" >&2
    fi
    if [ -n "$caddy_bin" ] && [ -f "$caddy_config" ]; then
        caddy_export_env
        log_error "Caddyfile 校验:"
        "$caddy_bin" validate --config "$caddy_config" 2>&1 | tail -15 >&2 || true
    fi
    if caddy_https_enabled; then
        log_error "HTTPS 需 caddy 绑定 80/443：sudo setcap 'cap_net_bind_service=+ep' $(command -v caddy 2>/dev/null || echo caddy)"
        log_error "并确认 80/443 公网可达、系统 caddy.service 已 stop+disable"
        log_error "HTTPS 需 apex 与 www 均解析到本机（例如 kuaigeyun.com 与 www.kuaigeyun.com）"
    fi
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

wait_for_frontend_ready() {
    local retries=0
    local pid=""
    while [ $retries -lt "$FRONTEND_START_TIMEOUT" ]; do
        if [ -f "$LOGS_DIR/frontend.pid" ]; then
            pid="$(cat "$LOGS_DIR/frontend.pid" 2>/dev/null || true)"
            if [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null; then
                log_error "前端进程已退出，查看 $LOGS_DIR/frontend.log"
                return 1
            fi
        fi
        if curl -sf --max-time 2 "http://127.0.0.1:${FRONTEND_PORT}/" >/dev/null 2>&1; then
            return 0
        fi
        sleep 1
        retries=$((retries + 1))
    done
    return 1
}

wait_for_local_postgres_ready() {
    local max_wait="${1:-120}"
    db_target_is_remote && return 0
    load_deploy_env
    local db_host db_port db_user db_name db_pass psql_bin elapsed=0
    db_host="$(read_env_value DB_HOST || echo localhost)"
    case "$db_host" in
        localhost|127.0.0.1|"") ;;
        *)
            log_info "远程数据库 (${db_host})，跳过本地 PostgreSQL 等待"
            return 0
            ;;
    esac
    db_port="$(read_env_value DB_PORT || echo 5432)"
    db_user="$(read_env_value DB_USER || echo postgres)"
    db_name="$(read_env_value DB_NAME || echo riveredge)"
    db_pass="$(read_env_value DB_PASSWORD || true)"
    log_info "等待 PostgreSQL 就绪（最多 ${max_wait}s）..."
    while [ "$elapsed" -lt "$max_wait" ]; do
        if command -v pg_isready >/dev/null 2>&1; then
            if pg_isready -h 127.0.0.1 -p "$db_port" -q 2>/dev/null; then
                log_ok "PostgreSQL 已就绪"
                return 0
            fi
        else
            psql_bin="$(resolve_psql)"
            export PGPASSWORD="$db_pass"
            if "$psql_bin" -h 127.0.0.1 -p "$db_port" -U "$db_user" -d "$db_name" -c "SELECT 1" >/dev/null 2>&1; then
                unset PGPASSWORD
                log_ok "PostgreSQL 已就绪"
                return 0
            fi
            unset PGPASSWORD
        fi
        sleep 2
        elapsed=$((elapsed + 2))
    done
    log_error "PostgreSQL 在 ${max_wait}s 内未就绪，无法启动"
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

pidfile_alive() {
    local pidf="$1"
    [ -f "$pidf" ] || return 1
    local pid
    pid="$(cat "$pidf" 2>/dev/null || true)"
    [ -n "$pid" ] || return 1
    kill -0 "$pid" 2>/dev/null
}

wait_process_stable() {
    local name="$1"
    local pidf="$2"
    local logfile="$3"
    local stable_seconds="${4:-12}"
    local i=0
    while [ "$i" -lt "$stable_seconds" ]; do
        if ! pidfile_alive "$pidf"; then
            log_error "${name} 启动后很快退出，查看 ${logfile}"
            [ -f "$logfile" ] && tail -30 "$logfile" >&2
            return 1
        fi
        sleep 1
        i=$((i + 1))
    done
    return 0
}

# Taskiq 就绪检测：低内存机上 pid 存活不等于 import 完成；定期打进度避免误以为卡死
wait_taskiq_service_ready() {
    local name="$1"
    local pidf="$2"
    local logfile="$3"
    local ready_pattern="${4:-}"
    local timeout
    local i=0
    local last_progress=0
    load_deploy_env
    timeout="${5:-${TASKIQ_START_TIMEOUT:-180}}"
    while [ "$i" -lt "$timeout" ]; do
        if ! pidfile_alive "$pidf"; then
            log_error "${name} 启动后退出，查看 ${logfile}"
            [ -f "$logfile" ] && tail -30 "$logfile" >&2
            return 1
        fi
        if [ -n "$ready_pattern" ] && [ -f "$logfile" ] && grep -qE "$ready_pattern" "$logfile" 2>/dev/null; then
            return 0
        fi
        if [ $((i - last_progress)) -ge 15 ]; then
            log_info "${name} 仍在启动（${i}s / 最多 ${timeout}s；低内存机可能较慢）..."
            if [ -f "$logfile" ]; then
                tail -3 "$logfile" | while IFS= read -r line; do
                    [ -n "$line" ] && log_info "  ${line}"
                done
            fi
            last_progress=$i
        fi
        sleep 1
        i=$((i + 1))
    done
    if pidfile_alive "$pidf"; then
        log_warn "${name} 在 ${timeout}s 内未检测到就绪日志，进程仍在运行，继续..."
        return 0
    fi
    log_error "${name} 启动超时，查看 ${logfile}"
    [ -f "$logfile" ] && tail -30 "$logfile" >&2
    return 1
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
        dev-api-proxy)
            patterns=("caddy run.*Caddyfile.dev-api")
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
    [ -f "$DEPLOY_ENV_FILE" ] || cp "$DEPLOY_ENV_EXAMPLE" "$DEPLOY_ENV_FILE"
    _env_file_set "$key" "$val" "$DEPLOY_ENV_FILE"
}

# 由 deploy.sh update / 向导安装·更新写入 riveredge-backend/.env，供工作台版本 API 读取。
# 须在启动后端前调用，以便新进程加载 PLATFORM_BUILD_TIME / GIT_SHA。
record_deploy_release_metadata() {
    ensure_env_file
    load_deploy_env
    local sha build_time install_id remote branch git_remote
    git_remote="${GIT_REMOTE:-origin}"
    sha="$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null | tr -d '[:space:]')"
    build_time="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    remote="$(git -C "$PROJECT_ROOT" remote get-url "$git_remote" 2>/dev/null | tr -d '[:space:]' || true)"
    if [ -z "$remote" ]; then
        remote="$(git -C "$PROJECT_ROOT" remote get-url origin 2>/dev/null | tr -d '[:space:]' || true)"
    fi
    branch="$(git -C "$PROJECT_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null | tr -d '[:space:]' || true)"
    install_id="$(read_env_value INSTALL_INSTANCE_ID 2>/dev/null || true)"
    if [ -z "$install_id" ]; then
        install_id="$(python -c "import uuid; print(uuid.uuid4())" 2>/dev/null || true)"
        [ -n "$install_id" ] && set_env_value INSTALL_INSTANCE_ID "$install_id"
    fi
    [ -n "$sha" ] && set_env_value GIT_SHA "$sha"
    set_env_value PLATFORM_BUILD_TIME "$build_time"
    [ -n "$remote" ] && set_env_value BUILD_GIT_REMOTE "$remote"
    [ -n "$branch" ] && [ "$branch" != "HEAD" ] && set_env_value BUILD_GIT_BRANCH "$branch"
    log_info "发版记录: install_id=${install_id:-unknown} commit=${sha:-unknown} remote=${remote:-unknown} branch=${branch:-unknown} deploy_time=${build_time}"
}

# update / 向导 [3] 更新后强制重启后端，避免 .env 已写入 GIT_SHA 但旧进程仍持有旧环境。
ensure_backend_restarted_for_release() {
    stop_service backend
    kill_port "$BACKEND_PORT"
    if bg_enabled; then
        kill_port "$BACKEND_PORT_BLUE" 2>/dev/null || true
        kill_port "$BACKEND_PORT_GREEN" 2>/dev/null || true
    fi
    export FORCE_BACKEND_RESTART=1
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
    local bin v best_bin="" best_v=""
    while IFS= read -r bin; do
        [ -n "$bin" ] || continue
        _is_windows_store_stub "$bin" && continue
        [ -x "$bin" ] 2>/dev/null || continue
        v="$("$bin" --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+' | head -1)"
        [ -n "$v" ] || continue
        version_ge "$v" "15.0" || continue
        if [ -z "$best_v" ] || version_ge "$v" "$best_v"; then
            best_v="$v"
            best_bin="$bin"
        fi
    done < <(_collect_psql_candidates | awk '!seen[$0]++')
    [ -n "$best_bin" ] && { echo "$best_bin"; return; }
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

normalize_domain_input() {
    local raw="${1:-}"
    raw="$(echo "$raw" | tr '[:upper:]' '[:lower:]' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's|^https\?://||' -e 's|/.*$||' -e 's|:.*$||')"
    printf '%s' "$raw"
}

caddy_domain_apex() {
    local d
    d="$(normalize_domain_input "${1:-}")"
    case "$d" in
        www.*) printf '%s' "${d#www.}" ;;
        *) printf '%s' "$d" ;;
    esac
}

caddy_domain_www() {
    local apex
    apex="$(caddy_domain_apex "${1:-}")"
    printf 'www.%s' "$apex"
}

caddy_site_addr_for_domain() {
    local domain="${1:-}"
    load_deploy_env
    domain="$(normalize_domain_input "$domain")"
    if [ -z "$domain" ]; then
        echo ":${PROXY_PORT}"
        return 0
    fi
    if [ "$CADDY_ENABLE_LETSENCRYPT" = "true" ]; then
        local apex www_host
        apex="$(caddy_domain_apex "$domain")"
        www_host="$(caddy_domain_www "$domain")"
        echo "${apex}, ${www_host}"
    else
        echo "http://${domain}:${PROXY_PORT}"
    fi
}

prod_cors_origins() {
    local server_ip="${1:-}"
    load_deploy_env
    [ -n "$server_ip" ] || server_ip="$(read_deploy_env_value SERVER_IP || true)"
    [ -n "$server_ip" ] || server_ip="$(detect_server_ip)"
    local base_url cors apex www_host
    if [ -n "$CADDY_DOMAIN" ]; then
        if [ "$CADDY_ENABLE_LETSENCRYPT" = "true" ]; then
            apex="$(caddy_domain_apex "$CADDY_DOMAIN")"
            www_host="$(caddy_domain_www "$CADDY_DOMAIN")"
            base_url="https://${apex}"
            cors="${base_url},https://${www_host},http://${apex}:${PROXY_PORT},http://${www_host}:${PROXY_PORT},http://${server_ip}:${PROXY_PORT},http://127.0.0.1:${PROXY_PORT},http://localhost:${PROXY_PORT}"
        else
            base_url="http://${CADDY_DOMAIN}:${PROXY_PORT}"
            cors="${base_url},http://${server_ip}:${PROXY_PORT},http://127.0.0.1:${PROXY_PORT},http://localhost:${PROXY_PORT}"
        fi
    else
        base_url="http://${server_ip}:${PROXY_PORT}"
        cors="${base_url},http://127.0.0.1:${PROXY_PORT},http://localhost:${PROXY_PORT}"
    fi
    printf '%s\n%s' "$base_url" "$cors"
}

sync_prod_app_urls() {
    load_deploy_env
    [ "$DEPLOY_MODE" = "prod" ] || return 0
    [ -f "$ENV_FILE" ] || return 0
    local server_ip base_url cors cur_base cur_cors
    server_ip="$(read_deploy_env_value SERVER_IP || true)"
    [ -n "$server_ip" ] || server_ip="$(detect_server_ip)"
    mapfile -t _prod_cors < <(prod_cors_origins "$server_ip")
    base_url="${_prod_cors[0]:-}"
    cors="${_prod_cors[1]:-}"
    cur_base="$(read_env_value BASE_URL || true)"
    cur_cors="$(read_env_value CORS_ORIGINS || true)"
    if [ "$cur_base" != "$base_url" ] || [ "$cur_cors" != "$cors" ]; then
        set_env_value BASE_URL "$base_url"
        set_env_value CORS_ORIGINS "$cors"
        log_info "已同步 BASE_URL / CORS_ORIGINS（含 www 域名）"
    fi
}

is_ipv4_address() {
    [[ "${1:-}" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]
}

resolve_prod_web_url() {
    local server_ip="${1:-}"
    load_deploy_env
    [ -n "$server_ip" ] || server_ip="$(read_deploy_env_value SERVER_IP || true)"
    [ -n "$server_ip" ] || server_ip="$(detect_server_ip)"
    if [ -n "$CADDY_DOMAIN" ]; then
        if [ "$CADDY_ENABLE_LETSENCRYPT" = "true" ]; then
            echo "https://$(caddy_domain_apex "$CADDY_DOMAIN")"
            return 0
        fi
        echo "http://${CADDY_DOMAIN}:${PROXY_PORT}"
        return 0
    fi
    echo "http://${server_ip}:${PROXY_PORT}"
}

collect_prod_domain_https_config() {
    local current_domain current_le choice domain input enable_input enable_le default_le
    load_deploy_env
    [ "$DEPLOY_MODE" = "prod" ] || return 0
    [ -f "$DEPLOY_ENV_FILE" ] || cp "$DEPLOY_ENV_EXAMPLE" "$DEPLOY_ENV_FILE"

    current_domain="$(read_deploy_env_value CADDY_DOMAIN || true)"
    current_le="$(read_deploy_env_value CADDY_ENABLE_LETSENCRYPT || echo false)"

    log_info "生产环境 Web 访问方式："
    echo "    1) 仅 IP — http://服务器IP:${PROXY_PORT}"
    if [ -n "$current_domain" ]; then
        echo "    2) 使用域名 — 当前: ${current_domain} (HTTPS: ${current_le})"
    else
        echo "    2) 使用域名 — 可自动申请 Let's Encrypt HTTPS 证书"
    fi
    read -rp "请选择 [1/2] (默认 1): " choice
    case "${choice:-1}" in
        2|domain|https)
            if [ -n "$current_domain" ]; then
                read -rp "生产域名 [${current_domain}]: " input
                domain="${input:-$current_domain}"
            else
                read -rp "请输入生产域名 (例如 app.example.com): " domain
            fi
            domain="$(normalize_domain_input "$domain")"
            [ -n "$domain" ] || { log_error "域名不能为空"; return 1; }
            domain="$(caddy_domain_apex "$domain")"

            if is_ipv4_address "$domain"; then
                log_warn "Let's Encrypt 不支持 IP 证书，域名已保存但仅使用 HTTP"
                set_deploy_env_value CADDY_DOMAIN "$domain"
                set_deploy_env_value CADDY_ENABLE_LETSENCRYPT "false"
                log_ok "已配置: http://${domain}:${PROXY_PORT}"
                return 0
            fi

            default_le="Y"
            [ "$current_le" = "false" ] && default_le="n"
            read -rp "是否启用 HTTPS (Let's Encrypt)? [Y/n]: " enable_input
            enable_input="${enable_input:-$default_le}"
            case "$enable_input" in
                n|N|no|No|NO|false) enable_le="false" ;;
                *) enable_le="true" ;;
            esac
            set_deploy_env_value CADDY_DOMAIN "$domain"
            set_deploy_env_value CADDY_ENABLE_LETSENCRYPT "$enable_le"
            load_deploy_env
            if [ "$enable_le" = "true" ]; then
                log_ok "已配置: https://${domain} 与 https://$(caddy_domain_www "$domain")（${domain} 与 www 均需 DNS 指向本机且公网 80 可达）"
            else
                log_ok "已配置: http://${domain}:${PROXY_PORT}"
            fi
            ;;
        *)
            set_deploy_env_value CADDY_DOMAIN ""
            set_deploy_env_value CADDY_ENABLE_LETSENCRYPT "false"
            load_deploy_env
            log_ok "已选择 IP 访问模式"
            ;;
    esac
}

apply_app_config() {
    local jwt server_ip detected_ip base_url admin_user cors
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
        base_url=""
        cors=""
        mapfile -t _prod_cors < <(prod_cors_origins "$server_ip")
        base_url="${_prod_cors[0]:-}"
        cors="${_prod_cors[1]:-}"
        set_env_value BASE_URL "$base_url"
        set_env_value CORS_ORIGINS "$cors"
    else
        set_env_value HOST "0.0.0.0"
        # PC 前端 / Expo Web / 工位 Vite：loopback + 局域网 IP
        set_env_value CORS_ORIGINS "http://${server_ip}:${FRONTEND_PORT},http://127.0.0.1:${FRONTEND_PORT},http://localhost:${FRONTEND_PORT},http://${server_ip}:8098,http://127.0.0.1:8098,http://localhost:8098,http://${server_ip}:8081,http://127.0.0.1:8081,http://localhost:8081,http://${server_ip}:8300,http://127.0.0.1:8300,http://localhost:8300"
    fi
}

blue_green_deploy_status_label() {
    load_deploy_env
    if [ -f "$BG_STATE_FILE" ]; then
        echo "已启用 (active=$(bg_active_slot 2>/dev/null || echo ?), 槽位 ${BACKEND_PORT_BLUE}/${BACKEND_PORT_GREEN})"
        return
    fi
    if [ "${BLUE_GREEN_DEPLOY:-0}" = "1" ]; then
        echo "配置开启 (槽位 ${BACKEND_PORT_BLUE}/${BACKEND_PORT_GREEN})"
        return
    fi
    echo "未启用 (update 时可选蓝绿，默认传统)"
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
    echo "  蓝绿部署: $(blue_green_deploy_status_label)"
    if [ "$DEPLOY_MODE" = "prod" ]; then
        echo "  访问地址: $(resolve_prod_web_url "$server_ip")"
        if [ -n "$CADDY_DOMAIN" ] && [ "$CADDY_ENABLE_LETSENCRYPT" = "true" ]; then
            echo "  备用 IP: http://${server_ip}:${PROXY_PORT}"
        fi
    else
        echo "  访问地址: http://${server_ip}:${FRONTEND_PORT} (Web) / http://${server_ip}:${BACKEND_PORT} (API)"
    fi
    print_support_contact
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

    if [ "$DEPLOY_MODE" = "prod" ]; then
        echo ""
        collect_prod_domain_https_config || exit 1
    fi

    apply_app_config

    log_info "测试数据库连接..."
    if ! test_db_connection; then
        exit 1
    fi
    log_ok "配置完成"
    print_configure_summary
}

# 后端 uv sync/run extras：ocr 始终开启（发票 PDF）；pdf 由 Playwright 开关控制
backend_uv_extra_args() {
    local extras=(--extra ocr)
    if playwright_postinstall_enabled; then
        extras+=(--extra pdf)
    fi
    printf '%s' "${extras[*]}"
}

sync_backend_deps() {
    if [ "${_BACKEND_DEPS_SYNCED:-0}" = "1" ]; then
        return 0
    fi
    apply_cn_mirrors
    log_info "同步 Python 依赖（含发票 OCR：pymupdf + rapidocr）..."
    (
        cd "$BACKEND_DIR"
        export SETUPTOOLS_EGG_INFO_DIR="$LOGS_DIR"
        export UV_LINK_MODE="${UV_LINK_MODE:-copy}"
        export UV_HTTP_TIMEOUT="${UV_HTTP_TIMEOUT:-600}"
        # shellcheck disable=SC2046
        "$(resolve_uv)" sync --no-install-project $(backend_uv_extra_args)
    ) || { log_error "Python 依赖同步失败"; exit 1; }
    if is_windows_gitbash; then
        ensure_pyzbar_windows_native
    elif [ "$(uname -s)" = "Linux" ]; then
        ensure_linux_invoice_parse_runtime
    fi
    _BACKEND_DEPS_SYNCED=1
}

playwright_postinstall_enabled() {
    [ "${PLAYWRIGHT_POSTINSTALL_ENABLE:-1}" != "0" ]
}

resolve_playwright_browsers_path() {
    load_deploy_env
    echo "${PLAYWRIGHT_BROWSERS_PATH:-$PROJECT_ROOT/.playwright-browsers}"
}

playwright_export_env() {
    if ! playwright_postinstall_enabled; then
        return 0
    fi
    export PLAYWRIGHT_BROWSERS_PATH="$(resolve_playwright_browsers_path)"
    mkdir -p "$PLAYWRIGHT_BROWSERS_PATH"
}

playwright_uv_extra_args() {
    # 兼容旧调用：与 backend_uv_extra_args 一致（含 ocr）
    backend_uv_extra_args
}

_playwright_chromium_probe() {
    local uv_bin="$1"
    playwright_export_env
    (cd "$BACKEND_DIR" && export PYTHONPATH="$BACKEND_DIR/src" && \
        "$uv_bin" run --extra pdf python - <<'PY' >/dev/null 2>&1
import os
import sys
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    exe = p.chromium.executable_path
    if exe and os.path.isfile(exe):
        sys.exit(0)
sys.exit(1)
PY
    )
}

playwright_current_version() {
    local uv_bin
    uv_bin="$(resolve_uv)"
    playwright_export_env
    (cd "$BACKEND_DIR" && export PYTHONPATH="$BACKEND_DIR/src" && \
        "$uv_bin" run --extra pdf python -m playwright --version 2>/dev/null | head -1 | awk '{print $2}') || true
}

playwright_write_chromium_marker() {
    local marker="$LOGS_DIR/playwright-chromium.ready"
    local ver
    ver="$(playwright_current_version)"
    { echo "${ver:-unknown}"; date -u +%Y-%m-%dT%H:%M:%SZ; } > "$marker"
}

playwright_chromium_marker_stale() {
    local marker="$LOGS_DIR/playwright-chromium.ready"
    local cur marker_ver
    [ -f "$marker" ] || return 0
    cur="$(playwright_current_version)"
    marker_ver="$(head -1 "$marker" 2>/dev/null | tr -d '[:space:]')"
    [ -z "$cur" ] && return 0
    [ "$cur" != "$marker_ver" ]
}

_wait_playwright_install_job() {
    local pidf="$LOGS_DIR/playwright-install.pid"
    local timeout="${1:-600}"
    local waited=0
    while [ $waited -lt "$timeout" ]; do
        if [ ! -f "$pidf" ]; then
            return 0
        fi
        local pid
        pid="$(tr -d '[:space:]' < "$pidf" 2>/dev/null || true)"
        if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
            rm -f "$pidf"
            return 0
        fi
        sleep 2
        waited=$((waited + 2))
    done
    log_warn "Playwright 补装等待超时（${timeout}s），详见 $LOGS_DIR/playwright-install.log"
    return 1
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

# Linux：发票 PDF 解析系统库 — zbar + libgomp + libGL（opencv/cv2）
_linux_has_shared_lib() {
    # $1 = 库名片段，如 libzbar / libgomp / libGL（不含 .so）
    local stem=$1
    if command -v ldconfig >/dev/null 2>&1; then
        if ldconfig -p 2>/dev/null | grep -F "${stem}.so" >/dev/null 2>&1; then
            return 0
        fi
    fi
    if find /usr/lib /usr/lib64 /lib /lib64 -maxdepth 3 -type f \( -name "${stem}.so*" -o -name "${stem}-*.so*" \) 2>/dev/null | grep -q .; then
        return 0
    fi
    # Debian/Ubuntu 包已装但 ldconfig 缓存未刷新时
    if command -v dpkg-query >/dev/null 2>&1; then
        case "$stem" in
            libzbar)
                dpkg-query -W -f='${Status}' libzbar0 2>/dev/null | grep -q 'install ok installed' && return 0
                ;;
            libgomp)
                dpkg-query -W -f='${Status}' libgomp1 2>/dev/null | grep -q 'install ok installed' && return 0
                ;;
            libGL)
                dpkg-query -W -f='${Status}' libgl1 2>/dev/null | grep -q 'install ok installed' && return 0
                dpkg-query -W -f='${Status}' libgl1-mesa-glx 2>/dev/null | grep -q 'install ok installed' && return 0
                ;;
        esac
    fi
    if command -v rpm >/dev/null 2>&1; then
        case "$stem" in
            libzbar)
                if rpm -q zbar >/dev/null 2>&1 || rpm -q zbar-libs >/dev/null 2>&1; then
                    return 0
                fi
                ;;
            libgomp)
                if rpm -q libgomp >/dev/null 2>&1; then
                    return 0
                fi
                ;;
            libGL)
                if rpm -q mesa-libGL >/dev/null 2>&1 || rpm -q libglvnd-glx >/dev/null 2>&1; then
                    return 0
                fi
                ;;
        esac
    fi
    return 1
}

_sudo_can_run() {
    # 非交互：已有缓存凭据或 NOPASSWD
    if sudo -n true >/dev/null 2>&1; then
        return 0
    fi
    return 1
}

check_zbar() {
    if is_windows_gitbash; then
        local dll="$BACKEND_DIR/.venv/Lib/site-packages/pyzbar/libzbar-64.dll"
        if [ -f "$dll" ]; then
            echo "ok"
        else
            echo "missing"
        fi
        return
    fi
    if [ "$(uname -s)" != "Linux" ]; then
        echo "ok"
        return
    fi
    if _linux_has_shared_lib libzbar; then
        echo "ok"
    else
        echo "missing"
    fi
}

check_invoice_parse_runtime() {
    # 系统侧：zbar + OpenMP + libGL（opencv-python 仍可能需要；headless 可不依赖但保留兼容）
    if is_windows_gitbash; then
        check_zbar
        return
    fi
    if [ "$(uname -s)" != "Linux" ]; then
        echo "ok"
        return
    fi
    if ! _linux_has_shared_lib libzbar; then
        echo "missing"
        return
    fi
    if ! _linux_has_shared_lib libgomp; then
        echo "missing"
        return
    fi
    # libGL：opencv-python 需要；若已切到 opencv-python-headless 可缺省，但仍建议安装
    if ! _linux_has_shared_lib libGL; then
        echo "missing"
        return
    fi
    echo "ok"
}

check_ocr() {
    # Python 侧：pymupdf + rapidocr（需 uv sync --extra ocr 之后）
    [ -d "$BACKEND_DIR" ] || { echo "missing"; return; }
    local uv_bin
    uv_bin="$(resolve_uv 2>/dev/null || true)"
    [ -n "$uv_bin" ] || { echo "missing"; return; }
    # shellcheck disable=SC2046
    if (cd "$BACKEND_DIR" && export PYTHONPATH="$BACKEND_DIR/src" && \
        "$uv_bin" run $(backend_uv_extra_args) python - <<'PY' >/dev/null 2>&1
import fitz
from rapidocr_onnxruntime import RapidOCR
PY
    ); then
        echo "ok"
    else
        echo "missing"
    fi
}

install_invoice_parse_runtime() {
    if is_windows_gitbash; then
        ensure_pyzbar_windows_native
        return 0
    fi
    if [ "$(uname -s)" != "Linux" ]; then
        log_warn "当前平台无需安装发票解析系统运行库"
        return 0
    fi
    if [ "$(check_invoice_parse_runtime)" = "ok" ]; then
        log_ok "发票解析系统库已就绪（zbar + libgomp）"
        return 0
    fi
    log_info "安装发票解析系统库（zbar + libgomp + libGL）..."
    if ! _sudo_can_run; then
        log_error "需要 sudo 权限安装系统库（当前无免密/缓存凭据，apt 会卡住）"
        if [ -f /etc/debian_version ]; then
            log_error "请先手动执行: sudo apt-get update && sudo apt-get install -y libzbar0 libgomp1 libgl1"
        else
            log_error "请先手动执行: sudo dnf install -y zbar libgomp mesa-libGL  （或 yum）"
        fi
        log_error "装完后重新执行: ./fast-deploy/deploy.sh migrate"
        return 1
    fi
    export DEBIAN_FRONTEND=noninteractive
    if [ -f /etc/debian_version ]; then
        # Ubuntu 22.04+: libgl1；旧版兼容 libgl1-mesa-glx
        local deb_pkgs=(libzbar0 libgomp1 libgl1)
        if ! sudo -n apt-get install -y "${deb_pkgs[@]}"; then
            log_warn "直接安装失败，尝试 apt-get update 后重试（含 libgl1-mesa-glx 兼容）..."
            sudo -n apt-get update -y || true
            sudo -n apt-get install -y libzbar0 libgomp1 libgl1 \
                || sudo -n apt-get install -y libzbar0 libgomp1 libgl1-mesa-glx \
                || {
                    log_error "安装失败，请手动执行: sudo apt-get install -y libzbar0 libgomp1 libgl1"
                    return 1
                }
        fi
    elif is_linux_rhel_family || is_linux_fedora; then
        local pkg_mgr
        pkg_mgr="$(linux_pkg_manager)"
        [ -n "$pkg_mgr" ] || { log_error "未找到 dnf/yum"; return 1; }
        sudo -n "$pkg_mgr" install -y zbar libgomp mesa-libGL 2>/dev/null \
            || sudo -n "$pkg_mgr" install -y zbar-libs libgomp libglvnd-glx 2>/dev/null \
            || sudo -n "$pkg_mgr" install -y zbar zbar-libs libgomp mesa-libGL \
            || {
                log_error "安装失败，请手动执行: sudo $pkg_mgr install -y zbar libgomp mesa-libGL"
                return 1
            }
    else
        log_error "不支持的 Linux 发行版，请手动安装 libzbar0、libgomp1、libgl1"
        return 1
    fi
    if command -v ldconfig >/dev/null 2>&1; then
        sudo -n ldconfig >/dev/null 2>&1 || true
    fi
    if [ "$(check_invoice_parse_runtime)" = "ok" ]; then
        log_ok "发票解析系统库已就绪（zbar + libgomp + libGL）"
        return 0
    fi
    log_warn "包已尝试安装，但检测仍未通过。请检查: ldconfig -p | grep -E 'zbar|gomp|libGL'"
    log_warn "Debian/Ubuntu: dpkg -l libzbar0 libgomp1 libgl1"
    return 0
}

# 兼容旧函数名
install_zbar_runtime() {
    install_invoice_parse_runtime
}

ensure_linux_invoice_parse_runtime() {
    [ "$(uname -s)" = "Linux" ] || return 0
    if [ "$(check_invoice_parse_runtime)" = "ok" ]; then
        return 0
    fi
    log_warn "发票解析系统库不完整，正在补装（zbar + libgomp）..."
    if ! install_invoice_parse_runtime; then
        log_warn "发票解析系统库安装未成功，二维码/OCR 可能不可用，但不影响后端启动"
        return 0
    fi
}

ensure_linux_zbar_runtime() {
    ensure_linux_invoice_parse_runtime
}

check_playwright() {
    if ! playwright_postinstall_enabled; then
        echo "skipped"
        return
    fi
    [ -d "$BACKEND_DIR" ] || { echo "missing"; return; }
    local uv_bin
    uv_bin="$(resolve_uv)"
    playwright_export_env
    if (cd "$BACKEND_DIR" && export PYTHONPATH="$BACKEND_DIR/src" && \
        "$uv_bin" run --extra pdf python -m playwright --version >/dev/null 2>&1); then
        echo "ok"
    else
        echo "missing"
    fi
}

check_playwright_chromium() {
    if ! playwright_postinstall_enabled; then
        echo "skipped"
        return
    fi
    ensure_logs_dir
    local pidf="$LOGS_DIR/playwright-install.pid"
    if [ -f "$pidf" ]; then
        local pid
        pid="$(tr -d '[:space:]' < "$pidf" 2>/dev/null || true)"
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            echo "installing"
            return
        fi
    fi

    local pw_st uv_bin
    pw_st="$(check_playwright)"
    case "$pw_st" in
        ok) ;;
        installing|missing|skipped|old:*) echo "$pw_st"; return ;;
        *) echo "missing"; return ;;
    esac

    uv_bin="$(resolve_uv)"
    if _playwright_chromium_probe "$uv_bin"; then
        if playwright_chromium_marker_stale; then
            playwright_write_chromium_marker
        fi
        echo "ok"
    else
        echo "missing"
    fi
}

ensure_playwright_chromium_sync() {
    if ! playwright_postinstall_enabled; then
        return 0
    fi
    ensure_logs_dir
    [ -d "$BACKEND_DIR" ] || return 0

    local st
    st="$(check_playwright_chromium)"
    case "$st" in
        ok|skipped) return 0 ;;
        installing)
            log_info "等待 Playwright Chromium 补装完成..."
            _wait_playwright_install_job 600 || true
            st="$(check_playwright_chromium)"
            [ "$st" = "ok" ] && return 0
            ;;
    esac

    local uv_bin logf marker
    uv_bin="$(resolve_uv)"
    logf="$LOGS_DIR/playwright-install.log"
    marker="$LOGS_DIR/playwright-chromium.ready"
    playwright_export_env

    log_info "安装 Playwright Chromium（生产同步，路径: ${PLAYWRIGHT_BROWSERS_PATH}）..."
    (
        cd "$BACKEND_DIR" || exit 1
        export PYTHONPATH="$BACKEND_DIR/src"
        if ! "$uv_bin" run --extra pdf python -m playwright --version >>"$logf" 2>&1; then
            echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] skip: Playwright 模块不可用" >>"$logf"
            exit 1
        fi
        echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] start: playwright install chromium (sync)" >>"$logf"
        if "$uv_bin" run --extra pdf python -m playwright install chromium >>"$logf" 2>&1; then
            playwright_write_chromium_marker
            echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] ok: Playwright Chromium 安装完成" >>"$logf"
        else
            echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] fail: Playwright Chromium 安装失败" >>"$logf"
            exit 1
        fi
    ) || {
        log_error "Playwright Chromium 安装失败，详见 $logf"
        return 1
    }
    log_ok "Playwright Chromium 已就绪"
    return 0
}

ensure_playwright_chromium_postinstall() {
    # 后台补装 Chromium，不阻塞 start / deploy 主流程（PDF 打印就绪前可能短暂不可用）
    if ! playwright_postinstall_enabled; then
        return 0
    fi
    ensure_logs_dir
    local marker="$LOGS_DIR/playwright-chromium.ready"
    local logf="$LOGS_DIR/playwright-install.log"
    local pidf="$LOGS_DIR/playwright-install.pid"
    [ -d "$BACKEND_DIR" ] || return 0

    local uv_bin
    uv_bin="$(resolve_uv)"
    if _playwright_chromium_probe "$uv_bin"; then
        if playwright_chromium_marker_stale; then
            playwright_write_chromium_marker
        fi
        return 0
    fi

    if [ -f "$pidf" ]; then
        local pid
        pid="$(tr -d '[:space:]' < "$pidf" 2>/dev/null || true)"
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            log_info "Playwright Chromium 后台补装进行中（PID $pid），详见 $logf"
            return 0
        fi
        rm -f "$pidf"
    fi

    rm -f "$marker"
    playwright_export_env

    log_info "补装 Playwright Chromium 运行时（后台执行，不阻塞启动）..."
    (
        cd "$BACKEND_DIR" || exit 1
        export PYTHONPATH="$BACKEND_DIR/src"
        export PLAYWRIGHT_BROWSERS_PATH
        if ! "$uv_bin" run --extra pdf python -m playwright --version >>"$logf" 2>&1; then
            echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] skip: Playwright 模块不可用" >>"$logf"
            exit 0
        fi
        echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] start: playwright install chromium" >>"$logf"
        if "$uv_bin" run --extra pdf python -m playwright install chromium >>"$logf" 2>&1; then
            playwright_write_chromium_marker
            echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] ok: Playwright Chromium 补装完成" >>"$logf"
        else
            echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] fail: Playwright Chromium 补装失败" >>"$logf"
        fi
        rm -f "$pidf"
    ) &
    echo $! > "$pidf"
    log_info "Playwright 补装已在后台运行（PID $(cat "$pidf")），详见 $logf"
    return 0
}

# 敏感词 lexicon.pack 不入库；部署机须生成，否则 SensitiveWordMiddleware 初始化失败、/health 500。
ensure_sensitive_lexicon_pack() {
    local pack="$BACKEND_DIR/src/core/data/sensitive_words/lexicon.pack"
    if [ "${FORCE_LEXICON_REPACK:-0}" != "1" ] && [ -f "$pack" ] && [ -s "$pack" ]; then
        log_info "敏感词 lexicon.pack 已存在"
        return 0
    fi
    log_info "生成敏感词 lexicon.pack（未入库，须部署机生成）..."
    (
        cd "$BACKEND_DIR"
        export PYTHONPATH="$BACKEND_DIR/src"
        "$(resolve_uv)" run python scripts/pack_sensitive_words.py
    ) || {
        log_error "生成 lexicon.pack 失败。检查出网或手动执行: cd riveredge-backend && uv run python scripts/pack_sensitive_words.py"
        return 1
    }
    if [ ! -f "$pack" ] || [ ! -s "$pack" ]; then
        log_error "lexicon.pack 未生成: $pack"
        return 1
    fi
    log_ok "敏感词 lexicon.pack 已就绪"
}

cmd_migrate() {
    sync_backend_deps
    ensure_postgresql_pgvector || { log_error "pgvector 未就绪，无法执行依赖 vector 的迁移"; exit 1; }
    ensure_vector_extension_created || { log_error "无法在应用库创建 vector 扩展（需要超级用户）"; exit 1; }
    ensure_sensitive_lexicon_pack || { log_error "敏感词 lexicon.pack 未就绪，后端无法启动"; exit 1; }
    log_info "执行数据库迁移..."
    (
        cd "$BACKEND_DIR"
        export PYTHONPATH="$BACKEND_DIR/src"
        PYTHONUNBUFFERED=1 AERICH_MIGRATE=1 "$(resolve_uv)" run aerich upgrade
    ) || { log_error "数据库迁移失败"; exit 1; }
    log_ok "迁移完成"
}

host_mem_summary() {
    if command -v free >/dev/null 2>&1; then
        free -h | awk '/^Mem:/ {printf "已用 %s / 总计 %s (可用 %s)", $3, $2, $7}'
        return 0
    fi
    echo "—"
}

cmd_free_memory() {
    local before after
    before="$(host_mem_summary)"
    log_info "当前内存: ${before}"

    if is_windows_gitbash; then
        log_warn "Windows 不支持 Linux 式 drop_caches；可通过菜单 [6] 重启服务释放进程内存"
        return 0
    fi

    if [ ! -f /proc/sys/vm/drop_caches ]; then
        log_error "当前系统不支持 /proc/sys/vm/drop_caches"
        return 1
    fi

    sync
    if [ -w /proc/sys/vm/drop_caches ]; then
        echo 3 > /proc/sys/vm/drop_caches
    elif sudo -n true 2>/dev/null; then
        sudo -n sh -c 'sync; echo 3 > /proc/sys/vm/drop_caches' || {
            log_error "释放内存失败（sudo drop_caches 未成功）"
            return 1
        }
    else
        log_warn "需要 root 权限清理 pagecache / dentries / inodes"
        log_info "请执行: sudo sync && sudo sh -c 'echo 3 > /proc/sys/vm/drop_caches'"
        return 1
    fi

    after="$(host_mem_summary)"
    log_info "释放后内存: ${after}"
    log_ok "内存释放完成（仅清理可回收缓存，不影响运行中进程堆内存）"
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

# 生产 update/start 前确保 dist 可用：默认使用 Git 中的 dist，跳过服务器构建（弱机友好）。
# 显式 ALLOW_SERVER_BUILD=1 时强制 npm build；dist 缺失且无该开关则报错退出。
cmd_ensure_frontend_dist() {
    load_deploy_env
    local frontend_index="$FRONTEND_DIR/dist/index.html"

    if [ "${ALLOW_SERVER_BUILD:-0}" = "1" ]; then
        log_warn "ALLOW_SERVER_BUILD=1，执行服务器构建（内存占用高，不推荐）..."
        cmd_build
        return
    fi

    if [ -f "$frontend_index" ]; then
        if [ ! -f "$FRONTEND_DIR/dist/login.html" ]; then
            log_error "缺少 $FRONTEND_DIR/dist/login.html（登录 MPA）。请重新执行 fast-deploy/build.web.sh 并推送"
            exit 1
        fi
        log_ok "已检测到 Web dist（含 login.html），跳过服务器构建（Caddy 直接代理 Git 中的 dist）"
        return 0
    fi

    log_error "缺少 ${frontend_index}"
    log_error "请在本地执行 fast-deploy/build.web.sh 构建并推送 dist，或设置 ALLOW_SERVER_BUILD=1 后在服务器构建"
    exit 1
}

# 主仓无 H5 时写入占位页，保证 Caddy /mobile 可挂载且不依赖私仓。
write_mobile_web_dist_placeholder() {
    mkdir -p "$MOBILE_WEB_DIR"
    cat >"$MOBILE_WEB_DIR/index.html" <<'EOF'
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>移动端 H5 未安装</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; line-height: 1.6; color: #222; }
    code { background: #f4f4f5; padding: 0.1em 0.35em; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>移动端 H5 尚未安装</h1>
  <p>主仓已正常运行。手机端为可选扩展，需私仓 <code>kuaigeyun-client</code>。</p>
  <p>安装：<code>./fast-deploy/deploy.sh install-h5</code><br />
  或向导菜单 <strong>[4] 扩展应用 → [3] 安装 H5</strong></p>
</body>
</html>
EOF
    log_warn "已写入 H5 占位页 → $MOBILE_WEB_DIR（不影响主仓启动）"
}

# 确保 Caddy /mobile 可挂载：已有产物则跳过；可选从私仓安装；失败仅警告并写占位页。
# 绝不因扩展仓阻断主仓 install / update / start。
ensure_mobile_web_dist() {
    if [ -f "$MOBILE_WEB_DIR/index.html" ]; then
        return 0
    fi
    load_deploy_env
    local path client_en
    path="$(read_deploy_env_value CLIENT_REPO_PATH || true)"
    [ -n "$path" ] || path="$(_client_default_repo_path)"
    if _resolve_client_web_dist_dir "$path" >/dev/null 2>&1; then
        log_info "检测到私仓 H5 产物，正在安装到 ${MOBILE_WEB_DIR}…"
        if install_mobile_h5_from_client_repo "$path"; then
            return 0
        fi
        log_warn "从私仓安装 H5 失败，改用占位页（不阻断主仓）"
    fi
    client_en="$(read_deploy_env_value CLIENT_ENABLED || echo 0)"
    if [ "$client_en" = "1" ]; then
        log_info "CLIENT_ENABLED=1 且缺少 web-dist，尝试安装 H5…"
        if cmd_install_client_repo; then
            return 0
        fi
        log_warn "H5 私仓同步失败，改用占位页（不阻断主仓；可稍后 ./fast-deploy/deploy.sh install-h5）"
    else
        log_warn "未部署移动端 H5（可选扩展）。主仓继续启动；需要时执行 ./fast-deploy/deploy.sh install-h5"
    fi
    write_mobile_web_dist_placeholder
    return 0
}

gen_caddyfile() {
    load_deploy_env
    sync_prod_app_urls
    mkdir -p "$CADDY_DIR"
    [ -f "$CADDY_TEMPLATE" ] || { log_error "缺少模板 $CADDY_TEMPLATE"; exit 1; }

    local addr backend_addr frontend_root mobile_web_root
    if bg_enabled; then
        bg_init_frontend_slots
        backend_addr="127.0.0.1:$(bg_active_port)"
        frontend_root="$(bg_get_frontend_root_for_caddy)"
        [ -f "$(bg_frontend_live_link)/index.html" ] || [ -f "$FRONTEND_DIR/dist/index.html" ] || {
            log_error "缺少前端 dist，请先 build"
            exit 1
        }
        [ -f "$(bg_frontend_live_link)/login.html" ] || [ -f "$FRONTEND_DIR/dist/login.html" ] || {
            log_error "缺少 login.html（登录 MPA），请先 build.web"
            exit 1
        }
    else
        backend_addr="127.0.0.1:${BACKEND_PORT}"
        frontend_root="$(caddy_native_path "$FRONTEND_DIR/dist")"
        [ -f "$FRONTEND_DIR/dist/index.html" ] || { log_error "缺少 $FRONTEND_DIR/dist/index.html，请先 build"; exit 1; }
        [ -f "$FRONTEND_DIR/dist/login.html" ] || { log_error "缺少 $FRONTEND_DIR/dist/login.html（登录 MPA），请先 build.web"; exit 1; }
    fi
    ensure_mobile_web_dist
    mobile_web_root="$(caddy_native_path "$MOBILE_WEB_DIR")"

    if [ -n "$CADDY_DOMAIN" ]; then
        addr="$(caddy_site_addr_for_domain "$CADDY_DOMAIN")"
    else
        addr=":${PROXY_PORT}"
    fi

    local client_release_root="${CLIENT_RELEASE_ROOT:-$PROJECT_ROOT/riveredge-backend/uploads/clients}"
    client_release_root="${client_release_root//\\//}"
    local file_upload_root="${FILE_UPLOAD_ROOT:-${client_release_root%/clients}}"
    file_upload_root="${file_upload_root//\\//}"

    sed -e "s|{{ADDR}}|${addr}|g" \
        -e "s|{{BACKEND_ADDR}}|${backend_addr}|g" \
        -e "s|{{FRONTEND_ROOT}}|${frontend_root}|g" \
        -e "s|{{MOBILE_WEB_ROOT}}|${mobile_web_root}|g" \
        -e "s|{{CLIENT_RELEASE_ROOT}}|${client_release_root}|g" \
        -e "s|{{FILE_UPLOAD_ROOT}}|${file_upload_root}|g" \
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
        if [ "${RIVEREDGE_SYSTEMD:-0}" = "1" ]; then
            if systemctl is-active --quiet caddy 2>/dev/null; then
                log_error "系统 caddy.service 仍在运行，与项目 Caddy 冲突"
                log_error "请执行: sudo systemctl stop caddy && sudo systemctl disable caddy"
                log_error "然后: sudo systemctl restart riveredge"
                return 1
            fi
            log_warn "系统 caddy.service 仍 enabled，建议在注册开机自启时已 disable"
            return 0
        fi
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

ensure_caddy_bind_caps() {
    local caddy_bin=$1
    [ -n "$caddy_bin" ] || return 1
    load_deploy_env
    if [ "$PROXY_PORT" -ge 1024 ] && { [ -z "$CADDY_DOMAIN" ] || [ "$CADDY_ENABLE_LETSENCRYPT" != "true" ]; }; then
        return 0
    fi
    local caps
    caps="$(getcap "$caddy_bin" 2>/dev/null || echo "")"
    if echo "$caps" | grep -q "cap_net_bind_service"; then
        return 0
    fi
    if [ "${RIVEREDGE_SYSTEMD:-0}" = "1" ]; then
        log_error "caddy 缺少 cap_net_bind_service，无法绑定 80/443 端口"
        log_error "请执行: sudo setcap 'cap_net_bind_service=+ep' $caddy_bin"
        log_error "然后: sudo systemctl restart riveredge"
        return 1
    fi
    if sudo -n setcap 'cap_net_bind_service=+ep' "$caddy_bin" 2>/dev/null; then
        log_ok "已为 caddy 配置 cap_net_bind_service"
        return 0
    fi
    log_error "caddy 需要 bind <1024 端口权限，请执行: sudo setcap 'cap_net_bind_service=+ep' $caddy_bin"
    return 1
}

ensure_linux_caddy_ready() {
    load_deploy_env
    stop_system_caddy || exit 1
    local caddy_bin
    caddy_bin="$(resolve_caddy)"
    [ -n "$caddy_bin" ] || { log_error "未安装 Caddy，请运行: $0 install"; exit 1; }
    ensure_caddy_bind_caps "$caddy_bin" || exit 1
}

start_backend_dev() {
    ensure_sensitive_lexicon_pack || { log_error "敏感词 lexicon.pack 未就绪，后端无法启动"; exit 1; }
    if bg_enabled; then
        bg_init_state
        bg_start_backend_slot "$(bg_active_slot)" dev || exit 1
        bg_start_dev_api_proxy || exit 1
        return 0
    fi
    kill_port "$BACKEND_PORT"
    log_info "启动后端 (dev, :${BACKEND_PORT})..."
    (
        cd "$BACKEND_DIR"
        export PYTHONPATH="$BACKEND_DIR/src"
        export SETUPTOOLS_EGG_INFO_DIR="$LOGS_DIR"
        nohup "$(resolve_uv)" run $(backend_uv_extra_args) uvicorn server.main:app \
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
        nohup "$(resolve_uv)" run $(backend_uv_extra_args) taskiq worker core.tasks.taskiq_app:broker \
            --workers "$TASKIQ_WORKERS" \
            core.tasks.taskiq_app core.tasks.ai_tasks core.tasks.worker_bootstrap core.tasks.data_backup_handlers \
            > "$LOGS_DIR/worker.log" 2>&1 &
        echo $! > "$LOGS_DIR/worker.pid"
        nohup "$(resolve_uv)" run $(backend_uv_extra_args) taskiq scheduler core.tasks.taskiq_app:scheduler \
            core.tasks.taskiq_app \
            > "$LOGS_DIR/scheduler.log" 2>&1 &
        echo $! > "$LOGS_DIR/scheduler.pid"
    )
    log_ok "Taskiq 已启动"
}

start_frontend_dev() {
    kill_port "$FRONTEND_PORT"
    ensure_frontend_deps
    log_info "启动前端 (dev, :${FRONTEND_PORT})..."
    (
        cd "$FRONTEND_DIR"
        # 0.0.0.0：与 package.json dev / vite 默认一致，局域网可访问
        export VITE_BACKEND_HOST="${VITE_BACKEND_HOST:-127.0.0.1}"
        export VITE_BACKEND_PORT="${VITE_BACKEND_PORT:-$BACKEND_PORT}"
        nohup npx vite --port "$FRONTEND_PORT" --host 0.0.0.0 > "$LOGS_DIR/frontend.log" 2>&1 &
        echo $! > "$LOGS_DIR/frontend.pid"
    )
    log_info "等待前端就绪（最多 ${FRONTEND_START_TIMEOUT}s，首次依赖预构建可能较慢）..."
    if ! wait_for_frontend_ready; then
        log_error "前端启动超时或未响应 HTTP，查看 $LOGS_DIR/frontend.log"
        [ -f "$LOGS_DIR/frontend.log" ] && tail -30 "$LOGS_DIR/frontend.log" >&2
        exit 1
    fi
    log_ok "前端已启动"
}

start_backend_prod() {
    ensure_sensitive_lexicon_pack || { log_error "敏感词 lexicon.pack 未就绪，后端无法启动"; exit 1; }
    if bg_enabled; then
        bg_init_state
        bg_start_backend_slot "$(bg_active_slot)" prod || exit 1
        return 0
    fi
    if [ "${FORCE_BACKEND_RESTART:-0}" != "1" ] \
        && [ -f "$LOGS_DIR/backend.pid" ] \
        && kill -0 "$(cat "$LOGS_DIR/backend.pid")" 2>/dev/null; then
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
        playwright_export_env
        nohup "$(resolve_uv)" run $(backend_uv_extra_args) uvicorn server.main:app \
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
    if pidfile_alive "$LOGS_DIR/worker.pid"; then
        log_info "Worker 已在运行"
    else
        log_info "启动 Taskiq Worker..."
        rm -f "$LOGS_DIR/worker.pid"
        (
            cd "$BACKEND_DIR"
            export ENVIRONMENT=production
            export SETUPTOOLS_EGG_INFO_DIR="$LOGS_DIR"
            export PYTHONPATH="$BACKEND_DIR/src"
            playwright_export_env
            nohup "$(resolve_uv)" run $(backend_uv_extra_args) taskiq worker --app-dir src \
                --workers "$TASKIQ_WORKERS" \
                core.tasks.taskiq_app:broker \
                core.tasks.taskiq_app core.tasks.ai_tasks core.tasks.worker_bootstrap core.tasks.data_backup_handlers \
                > "$LOGS_DIR/worker.log" 2>&1 &
            echo $! > "$LOGS_DIR/worker.pid"
        )
        wait_taskiq_service_ready "Worker" "$LOGS_DIR/worker.pid" "$LOGS_DIR/worker.log" \
            'Taskiq worker 已注册任务|Starting [0-9]+ worker processes' || exit 1
    fi
    if pidfile_alive "$LOGS_DIR/scheduler.pid"; then
        log_info "Scheduler 已在运行"
    else
        log_info "启动 Taskiq Scheduler..."
        rm -f "$LOGS_DIR/scheduler.pid"
        (
            cd "$BACKEND_DIR"
            export ENVIRONMENT=production
            export SETUPTOOLS_EGG_INFO_DIR="$LOGS_DIR"
            export PYTHONPATH="$BACKEND_DIR/src"
            playwright_export_env
            nohup "$(resolve_uv)" run $(backend_uv_extra_args) taskiq scheduler --app-dir src \
                core.tasks.taskiq_app:scheduler \
                core.tasks.taskiq_app \
                > "$LOGS_DIR/scheduler.log" 2>&1 &
            echo $! > "$LOGS_DIR/scheduler.pid"
        )
        wait_taskiq_service_ready "Scheduler" "$LOGS_DIR/scheduler.pid" "$LOGS_DIR/scheduler.log" \
            'Startup completed|Starting scheduler' || exit 1
    fi
    log_ok "Taskiq 已启动"
}

reload_caddy_prod_config() {
    ensure_linux_caddy_ready
    gen_caddyfile
    load_deploy_env
    caddy_export_env
    ensure_caddy_data_migrated
    local caddy_bin caddy_config reload_err
    caddy_bin="$(resolve_caddy)"
    caddy_config="$(caddy_resolved_config_path)"
    if ! "$caddy_bin" validate --config "$caddy_config" >/dev/null 2>&1; then
        log_error "Caddyfile 校验失败"
        "$caddy_bin" validate --config "$caddy_config" 2>&1 | tail -20 >&2
        return 1
    fi
    if [ -f "$LOGS_DIR/caddy.pid" ] && kill -0 "$(cat "$LOGS_DIR/caddy.pid")" 2>/dev/null; then
        reload_err="$LOGS_DIR/caddy-reload.err"
        : >"$reload_err"
        if caddy_reload_with_admin "$caddy_bin" "$caddy_config" "$(caddy_prod_admin_address)" 2>"$reload_err"; then
            if verify_caddy_serving; then
                log_ok "Caddy 已 reload"
                return 0
            fi
            log_warn "Caddy reload 完成但服务校验未通过"
        else
            if [ -s "$reload_err" ]; then
                log_warn "Caddy reload 失败: $(tail -3 "$reload_err" | tr '\n' ' ')"
            else
                log_warn "Caddy reload 失败（无 stderr 输出）"
            fi
        fi
    fi
    log_info "正在重启 Caddy 以应用配置..."
    CADDY_START_FORCE=1 start_caddy_prod
}

start_caddy_prod() {
    ensure_linux_caddy_ready
    gen_caddyfile
    load_deploy_env
    caddy_export_env
    ensure_caddy_data_migrated
    local caddy_bin caddy_config listen_label
    caddy_bin="$(resolve_caddy)"
    caddy_config="$(caddy_resolved_config_path)"
    listen_label="$(caddy_listen_port_label)"
    if [ -f "$LOGS_DIR/caddy.pid" ] && kill -0 "$(cat "$LOGS_DIR/caddy.pid")" 2>/dev/null; then
        if [ "${CADDY_START_FORCE:-0}" = "1" ]; then
            log_info "强制重启 Caddy..."
            stop_service caddy
            kill_all_caddy_processes
            rm -f "$LOGS_DIR/caddy.pid"
        else
            log_info "Caddy 已在运行"
            verify_caddy_serving || return 1
            return 0
        fi
    fi
    stop_service caddy
    kill_all_caddy_processes
    caddy_prepare_listen_ports
    if ! "$caddy_bin" validate --config "$caddy_config" >/dev/null 2>&1; then
        log_error "Caddyfile 校验失败"
        "$caddy_bin" validate --config "$caddy_config" 2>&1 | tail -20 >&2
        return 1
    fi
    if caddy_https_enabled; then
        log_info "启动 Caddy (HTTPS :443 + HTTP :80, 域名 ${CADDY_DOMAIN}, 数据 ${XDG_DATA_HOME})..."
    else
        log_info "启动 Caddy (:${PROXY_PORT})..."
    fi
    nohup env XDG_DATA_HOME="$XDG_DATA_HOME" XDG_CONFIG_HOME="$XDG_CONFIG_HOME" \
        "$caddy_bin" run --config "$caddy_config" >> "$LOGS_DIR/caddy.log" 2>&1 &
    echo $! > "$LOGS_DIR/caddy.pid"
    if ! wait_for_caddy_listening; then
        if [ -f "$LOGS_DIR/caddy.pid" ] && kill -0 "$(cat "$LOGS_DIR/caddy.pid")" 2>/dev/null; then
            log_error "Caddy 进程在运行但未监听端口 ${listen_label}（等待 ${CADDY_START_TIMEOUT}s 超时）"
        else
            log_error "Caddy 启动失败"
        fi
        caddy_diagnose_start_failure "$caddy_bin" "$caddy_config"
        rm -f "$LOGS_DIR/caddy.pid"
        kill_all_caddy_processes
        return 1
    fi
    if ! verify_caddy_serving; then
        rm -f "$LOGS_DIR/caddy.pid"
        kill_all_caddy_processes
        return 1
    fi
    log_ok "Caddy 已启动"
}

rollback_partial_prod_start() {
    load_deploy_env
    log_warn "回滚已启动的生产服务..."
    stop_service caddy
    stop_service backend
    if bg_enabled; then
        bg_stop_all_backends
    fi
    stop_service worker
    stop_service scheduler
    kill_all_caddy_processes
    kill_port "$BACKEND_PORT"
    if bg_enabled; then
        kill_port "$BACKEND_PORT_BLUE" 2>/dev/null || true
        kill_port "$BACKEND_PORT_GREEN" 2>/dev/null || true
    fi
    if caddy_https_enabled; then
        ensure_port_free 80 || true
        ensure_port_free 443 || true
    else
        ensure_port_free "$PROXY_PORT" || true
    fi
}

verify_caddy_serving() {
    load_deploy_env
    local code
    if caddy_https_enabled; then
        local apex
        apex="$(caddy_domain_apex "$CADDY_DOMAIN")"
        code="$(curl -s -o /dev/null -w '%{http_code}' -H "Host: ${apex}" "http://127.0.0.1/" 2>/dev/null || echo "000")"
        case "$code" in
            200|301|302|308)
                return 0
                ;;
        esac
        if caddy_check_listening; then
            log_warn "Caddy 已在 :443 监听，TLS 证书可能仍在申请中（HTTP ${code}）"
            return 0
        fi
        log_error "Caddy HTTPS 未就绪（Host: ${CADDY_DOMAIN} HTTP ${code}）"
    else
        code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PROXY_PORT}/" 2>/dev/null || echo "000")"
        if [ "$code" = "200" ]; then
            return 0
        fi
        log_error "Web 入口 http://127.0.0.1:${PROXY_PORT}/ 返回 HTTP ${code}（期望 200）"
    fi
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
    ensure_playwright_chromium_postinstall
    log_ok "RiverEdge 开发环境已就绪"
    local lan_ip
    lan_ip="$(detect_server_ip)"
    echo "  Web:  http://127.0.0.1:${FRONTEND_PORT}  |  http://localhost:${FRONTEND_PORT}"
    echo "  API:  http://127.0.0.1:${BACKEND_PORT}  |  http://localhost:${BACKEND_PORT}"
    if [ -n "$lan_ip" ] && [ "$lan_ip" != "127.0.0.1" ]; then
        echo "  局域网 Web: http://${lan_ip}:${FRONTEND_PORT}"
        echo "  局域网 API: http://${lan_ip}:${BACKEND_PORT}"
    fi
    print_support_contact
}

cmd_start_prod() {
    ensure_logs_dir
    load_deploy_env
    [ -f "$FRONTEND_DIR/dist/index.html" ] || { log_error "缺少前端 dist，请先运行 build"; exit 1; }
    if [ "${RIVEREDGE_SYSTEMD:-0}" = "1" ]; then
        wait_for_local_postgres_ready 120 || exit 1
        ensure_logs_dir_writable "$(id -un)" || exit 1
        if [ -f "$ENV_FILE" ] && [ ! -r "$ENV_FILE" ]; then
            log_error "无法读取 ${ENV_FILE}（可能被 root 占用）"
            log_error "请执行: sudo chown \$(whoami):\$(whoami) ${ENV_FILE} ${LOGS_DIR}"
            exit 1
        fi
    fi
    cmd_migrate
    record_deploy_release_metadata
    start_backend_prod
    start_worker_prod
    if ! start_caddy_prod; then
        rollback_partial_prod_start
        exit 1
    fi
    ensure_playwright_chromium_postinstall
    log_ok "RiverEdge 生产环境已就绪"
    local access_ip="${SERVER_IP:-127.0.0.1}"
    local web_url
    web_url="$(resolve_prod_web_url "$access_ip")"
    echo "  访问: ${web_url}"
    if [ -n "$CADDY_DOMAIN" ] && [ "$CADDY_ENABLE_LETSENCRYPT" = "true" ]; then
        echo "  备用 IP: http://${access_ip}:${PROXY_PORT}"
    elif [ -z "$CADDY_DOMAIN" ]; then
        echo "  本机: http://127.0.0.1:${PROXY_PORT}"
    fi
    print_support_contact
}

cmd_stop_dev() {
    load_deploy_env
    if bg_enabled; then
        bg_stop_dev_api_proxy
        bg_stop_all_backends
    else
        kill_port "$BACKEND_PORT"
    fi
    kill_port "$FRONTEND_PORT"
    stop_service worker
    stop_service scheduler
    log_ok "开发服务已停止"
}

cmd_stop_prod() {
    load_deploy_env
    stop_service caddy
    stop_service worker
    stop_service scheduler
    stop_service backend
    if bg_enabled; then
        bg_stop_all_backends
    fi
    kill_all_caddy_processes
    if caddy_https_enabled; then
        ensure_port_free 80 || true
        ensure_port_free 443 || true
    else
        ensure_port_free "$PROXY_PORT" || true
    fi
    kill_port "$BACKEND_PORT"
    if bg_enabled; then
        kill_port "$BACKEND_PORT_BLUE" 2>/dev/null || true
        kill_port "$BACKEND_PORT_GREEN" 2>/dev/null || true
    fi
    log_ok "生产服务已停止"
}

is_linux_systemd() {
    [ "$(uname -s)" = "Linux" ] && command -v systemctl >/dev/null 2>&1
}

boot_service_supported() {
    [ "$DEPLOY_MODE" = "prod" ] || return 1
    is_linux_systemd && return 0
    is_windows_gitbash && return 0
    return 1
}

is_windows_boot_enabled() {
    is_windows_gitbash || return 1
    powershell.exe -NoProfile -Command "
        \$t = Get-ScheduledTask -TaskName '${WINDOWS_BOOT_TASK_NAME}' -ErrorAction SilentlyContinue
        if (-not \$t) { exit 1 }
        if (\$t.State -eq 'Disabled') { exit 1 }
        exit 0
    " 2>/dev/null
}

is_boot_service_enabled() {
    if is_linux_systemd && [ -f "$SYSTEMD_UNIT_PATH" ]; then
        systemctl is-enabled --quiet "$SYSTEMD_UNIT_NAME" 2>/dev/null
        return
    fi
    if is_windows_gitbash; then
        is_windows_boot_enabled
        return
    fi
    return 1
}

is_boot_service_active() {
    local pidf="$LOGS_DIR/backend.pid" pid
    [ -f "$pidf" ] || return 1
    pid="$(tr -d '[:space:]' < "$pidf" 2>/dev/null || true)"
    [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

windows_boot_status_label() {
    local mode_label=""
    if ! is_windows_boot_enabled; then
        echo "未配置"
        return 0
    fi
    if powershell.exe -NoProfile -Command "
        \$t = Get-ScheduledTask -TaskName '${WINDOWS_BOOT_TASK_NAME}' -ErrorAction SilentlyContinue
        foreach (\$tr in \$t.Triggers) {
            if (\$tr.CimClass.CimClassName -eq 'MSFT_TaskBootTrigger') { exit 0 }
        }
        exit 1
    " 2>/dev/null; then
        mode_label="开机启动"
    else
        mode_label="登录时启动"
    fi
    if is_boot_service_active; then
        echo "已启用 · ${mode_label} · 运行中"
    else
        echo "已启用 · ${mode_label} · 未运行"
    fi
}

boot_service_status_label() {
    if [ "$DEPLOY_MODE" != "prod" ]; then
        echo "仅生产模式可用"
        return 0
    fi
    if is_windows_gitbash; then
        windows_boot_status_label
        return 0
    fi
    if ! is_linux_systemd; then
        echo "不支持 (非 Linux systemd / Windows)"
        return 0
    fi
    systemd_boot_status_label
}

is_systemd_boot_enabled() {
    is_linux_systemd || return 1
    [ -f "$SYSTEMD_UNIT_PATH" ] || return 1
    systemctl is-enabled --quiet "$SYSTEMD_UNIT_NAME" 2>/dev/null
}

is_systemd_service_active() {
    is_linux_systemd || return 1
    systemctl is-active --quiet "$SYSTEMD_UNIT_NAME" 2>/dev/null
}

systemd_boot_status_label() {
    if ! is_linux_systemd; then
        echo "不支持 (非 Linux systemd)"
        return 0
    fi
    if [ "$DEPLOY_MODE" != "prod" ]; then
        echo "仅生产模式可用"
        return 0
    fi
    if [ ! -f "$SYSTEMD_UNIT_PATH" ]; then
        echo "未配置"
        return 0
    fi
    if is_systemd_boot_enabled; then
        if is_systemd_service_active; then
            echo "已启用 · 运行中"
        else
            echo "已启用 · 未运行（可能启动失败，见 journalctl -b -u riveredge）"
        fi
    else
        echo "已安装，未 enable"
    fi
}

resolve_service_user() {
    local u
    if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
        u="$SUDO_USER"
    elif [ "$(id -u)" -eq 0 ] && command -v logname >/dev/null 2>&1; then
        u="$(logname 2>/dev/null || echo "")"
    else
        u="${USER:-}"
    fi
    if [ -z "$u" ] || [ "$u" = "root" ]; then
        log_error "请用部署用户执行: ./fast-deploy/deploy.sh install-service"
        log_error "或: sudo ./fast-deploy/deploy.sh install-service（将使用原登录用户运行服务）"
        return 1
    fi
    echo "$u"
}

render_systemd_unit() {
    local service_user=$1 uv_bin=$2 caddy_bin=$3
    local service_home service_group pw_path
    service_home="$(getent passwd "$service_user" | cut -d: -f6)"
    [ -n "$service_home" ] || { log_error "用户不存在: $service_user"; return 1; }
    service_group="$(id -gn "$service_user")"
    pw_path="$(resolve_playwright_browsers_path)"
    load_deploy_env
    local caddy_data="${CADDY_DATA_DIR:-$PROJECT_ROOT/.caddy-data}"
    local caddy_config_dir="${CADDY_CONFIG_DIR:-$PROJECT_ROOT/.caddy-config}"
    sed \
        -e "s|{{SERVICE_USER}}|${service_user}|g" \
        -e "s|{{SERVICE_GROUP}}|${service_group}|g" \
        -e "s|{{SERVICE_HOME}}|${service_home}|g" \
        -e "s|{{PROJECT_ROOT}}|${PROJECT_ROOT}|g" \
        -e "s|{{SERVICE_SCRIPT}}|${SYSTEMD_SERVICE_SCRIPT}|g" \
        -e "s|{{UV_BIN}}|${uv_bin}|g" \
        -e "s|{{CADDY_BIN}}|${caddy_bin}|g" \
        -e "s|{{PLAYWRIGHT_BROWSERS_PATH}}|${pw_path}|g" \
        -e "s|{{CADDY_DATA_DIR}}|${caddy_data}|g" \
        -e "s|{{CADDY_CONFIG_DIR}}|${caddy_config_dir}|g" \
        "$SYSTEMD_UNIT_TEMPLATE"
}

show_systemd_start_failure() {
    log_error "服务启动失败，最近日志："
    if command -v journalctl >/dev/null 2>&1; then
        local journal_tail
        journal_tail="$(sudo journalctl -u "$SYSTEMD_UNIT_NAME" -n 40 --no-pager 2>/dev/null || true)"
        printf '%s\n' "$journal_tail"
        if printf '%s\n' "$journal_tail" | grep -q 'Permission denied'; then
            local run_user="${SUDO_USER:-${USER:-ubuntu}}"
            log_error "检测到权限问题：请勿使用 sudo 运行 deploy.sh start"
            log_error "修复命令: sudo chown -R ${run_user}:${run_user} ${LOGS_DIR} ${ENV_FILE}"
        fi
    fi
    if [ -f "$LOGS_DIR/backend.log" ]; then
        log_error "backend.log 末尾："
        tail -20 "$LOGS_DIR/backend.log" >&2 || true
    fi
    if [ -f "$LOGS_DIR/caddy.log" ]; then
        log_error "caddy.log 末尾："
        tail -20 "$LOGS_DIR/caddy.log" >&2 || true
    fi
    log_error "完整日志: journalctl -u ${SYSTEMD_UNIT_NAME} -e"
}

resolve_systemd_tool_path() {
    local service_user=$1 tool=$2
    local service_home path
    service_home="$(getent passwd "$service_user" | cut -d: -f6)"
    [ -n "$service_home" ] || return 1
    path="$(sudo -u "$service_user" -H env \
        HOME="$service_home" \
        PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin:${service_home}/.local/bin:${service_home}/.cargo/bin" \
        bash -c "command -v ${tool} 2>/dev/null || true")"
    if [ -n "$path" ]; then
        echo "$path"
        return 0
    fi
    if [ "$tool" = "uv" ] && [ -x "${service_home}/.local/bin/uv" ]; then
        echo "${service_home}/.local/bin/uv"
        return 0
    fi
    if [ "$tool" = "uv" ] && [ -x "${service_home}/.cargo/bin/uv" ]; then
        echo "${service_home}/.cargo/bin/uv"
        return 0
    fi
    return 1
}

prepare_systemd_prerequisites() {
    local service_user=$1
    local uv_bin caddy_bin
    load_deploy_env
    stop_system_caddy || return 1
    if caddy_https_enabled; then
        log_info "释放 80/443 端口（避免与系统 caddy 冲突）..."
        sudo fuser -k 443/tcp 80/tcp 2>/dev/null || true
        sleep 1
    fi
    caddy_bin="$(resolve_systemd_tool_path "$service_user" caddy)" || caddy_bin="$(resolve_caddy)"
    [ -n "$caddy_bin" ] || { log_error "未安装 Caddy，请先执行 install"; return 1; }
    ensure_caddy_bind_caps "$caddy_bin" || return 1
    uv_bin="$(resolve_systemd_tool_path "$service_user" uv)" || true
    if [ -z "$uv_bin" ]; then
        log_error "未找到用户 ${service_user} 的 uv，请先为该用户安装 uv"
        return 1
    fi
    if [ ! -x "$uv_bin" ]; then
        log_error "uv 不可执行: $uv_bin"
        return 1
    fi
    echo "${uv_bin}|${caddy_bin}"
}

cmd_install_service() {
    [ "$DEPLOY_MODE" = "prod" ] || { log_error "install-service 仅用于生产模式"; exit 1; }
    if is_windows_gitbash; then
        log_info "Windows 环境：注册计划任务开机自启..."
        run_windows_boot_task_action install || exit 1
        return 0
    fi
    is_linux_systemd || { log_error "install-service 仅支持 Linux (systemd) 或 Windows"; exit 1; }
    [ -f "$SYSTEMD_UNIT_TEMPLATE" ] || { log_error "缺少模板 $SYSTEMD_UNIT_TEMPLATE"; exit 1; }
    [ -f "$SYSTEMD_SERVICE_SCRIPT" ] || { log_error "缺少 $SYSTEMD_SERVICE_SCRIPT"; exit 1; }
    chmod +x "$SYSTEMD_SERVICE_SCRIPT" "$FAST_DEPLOY_DIR/linux/prod.sh" 2>/dev/null || true

    local service_user
    service_user="$(resolve_service_user)" || exit 1

    load_deploy_env
    [ -f "$FRONTEND_DIR/dist/index.html" ] || {
        log_error "缺少前端 dist，请先执行: ./fast-deploy/deploy.sh build"
        exit 1
    }

    if ! sudo -v; then
        log_error "需要 sudo 权限写入 ${SYSTEMD_UNIT_PATH}"
        exit 1
    fi

    log_info "准备 systemd 运行前提（停止系统 caddy、检查端口权限）..."
    local prereq uv_bin caddy_bin
    prereq="$(prepare_systemd_prerequisites "$service_user")" || exit 1
    uv_bin="${prereq%%|*}"
    caddy_bin="${prereq#*|}"

    log_info "注册 systemd 服务 (${SYSTEMD_UNIT_NAME})，运行用户: ${service_user}"
    log_info "uv: ${uv_bin}"
    log_info "caddy: ${caddy_bin}"
    local unit_content tmp
    unit_content="$(render_systemd_unit "$service_user" "$uv_bin" "$caddy_bin")" || exit 1
    tmp="$(mktemp)"
    printf '%s\n' "$unit_content" > "$tmp"

    sudo cp "$tmp" "$SYSTEMD_UNIT_PATH"
    rm -f "$tmp"
    sudo systemctl daemon-reload
    sudo systemctl enable "$SYSTEMD_UNIT_NAME"
    if ! sudo systemctl is-enabled --quiet "$SYSTEMD_UNIT_NAME" 2>/dev/null; then
        log_error "systemctl enable 未成功，开机自启未注册"
        exit 1
    fi
    log_ok "开机自启已注册: $(systemctl is-enabled "$SYSTEMD_UNIT_NAME" 2>/dev/null || echo unknown)"
    fix_systemd_runtime_permissions "$service_user" || exit 1
    if ! sudo systemctl is-active --quiet "$SYSTEMD_UNIT_NAME" 2>/dev/null; then
        log_info "正在启动 ${SYSTEMD_UNIT_NAME}..."
        if ! sudo systemctl start "$SYSTEMD_UNIT_NAME"; then
            show_systemd_start_failure
            log_error "可尝试: sudo systemctl reset-failed riveredge && sudo systemctl start riveredge"
            exit 1
        fi
    fi

    log_ok "服务已运行: ${SYSTEMD_UNIT_NAME}"
    echo "  开机自启: sudo systemctl is-enabled riveredge"
    echo "  立即启动: sudo systemctl start riveredge"
    echo "  查看状态: sudo systemctl status riveredge"
    echo "  停止服务: sudo systemctl stop riveredge"
    echo "  本次启动日志: journalctl -b -u riveredge --no-pager"
    echo "  完整日志: journalctl -u riveredge -e"
    echo ""
    echo "  提示: 请勿使用 sudo ./fast-deploy/deploy.sh start（会导致 .logs/.env 归属 root）"
    echo "  提示: 启用 systemd 后，日常启停建议用 systemctl，避免与手动 start/stop 混用导致状态不一致"
}

cmd_uninstall_service() {
    if is_windows_gitbash; then
        run_windows_boot_task_action uninstall || exit 1
        return 0
    fi
    is_linux_systemd || { log_error "uninstall-service 仅支持 Linux (systemd) 或 Windows"; exit 1; }

    if [ ! -f "$SYSTEMD_UNIT_PATH" ]; then
        log_warn "未安装 ${SYSTEMD_UNIT_NAME}"
        return 0
    fi

    log_info "移除 systemd 服务 ${SYSTEMD_UNIT_NAME}..."
    if ! sudo -v; then
        log_error "需要 sudo 权限"
        exit 1
    fi
    sudo systemctl stop "$SYSTEMD_UNIT_NAME" 2>/dev/null || true
    sudo systemctl disable "$SYSTEMD_UNIT_NAME" 2>/dev/null || true
    sudo rm -f "$SYSTEMD_UNIT_PATH"
    sudo systemctl daemon-reload
    log_ok "已移除 ${SYSTEMD_UNIT_NAME} 开机自启"
}

cmd_restart_backend() {
    load_deploy_env
    stop_service backend
    kill_port "$BACKEND_PORT"
    if [ "$DEPLOY_MODE" = "dev" ]; then
        start_backend_dev
    else
        start_backend_prod
    fi
}

cmd_restart_frontend() {
    load_deploy_env
    if [ "$DEPLOY_MODE" = "dev" ]; then
        kill_port "$FRONTEND_PORT"
        rm -f "$LOGS_DIR/frontend.pid"
        start_frontend_dev
    else
        stop_service caddy
        start_caddy_prod
    fi
}

cmd_restart_worker() {
    load_deploy_env
    stop_service worker
    stop_service scheduler
    if [ "$DEPLOY_MODE" = "dev" ]; then
        start_worker_dev
    else
        start_worker_prod
    fi
}

cmd_restart_postgres() {
    load_deploy_env
    local db_target db_host psql_bin pg_ctl_bin data_dir native_data
    db_target="$(read_env_value DB_TARGET || echo local)"
    db_host="$(read_env_value DB_HOST || echo localhost)"
    case "$db_host" in
        localhost|127.0.0.1|"") ;;
        *)
            log_error "远程 PostgreSQL (${db_host}) 无法在本机重启"
            return 1
            ;;
    esac
    if [ "$db_target" = "remote" ]; then
        log_error "DB_TARGET=remote 时请在数据库服务器上重启 PostgreSQL"
        return 1
    fi

    if is_windows_gitbash; then
        psql_bin="$(resolve_psql)"
        pg_ctl_bin="$(dirname "$psql_bin")/pg_ctl.exe"
        data_dir="$(dirname "$(dirname "$psql_bin")")/data"
        if [ -x "$pg_ctl_bin" ] && [ -d "$data_dir" ]; then
            native_data="$(caddy_native_path "$data_dir")"
            log_info "正在重启 PostgreSQL..."
            if "$pg_ctl_bin" restart -D "$native_data" -m fast -t 60 >/dev/null 2>&1; then
                log_ok "PostgreSQL 已重启"
                return 0
            fi
        fi
        if powershell.exe -NoProfile -Command "
            \$s = Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Where-Object { \$_.Status -ne \$null } | Select-Object -First 1
            if (\$null -eq \$s) { exit 1 }
            Restart-Service \$s.Name -Force
        " >/dev/null 2>&1; then
            log_ok "PostgreSQL 服务已重启"
            return 0
        fi
        log_error "未能重启 PostgreSQL，请检查服务是否已安装"
        return 1
    fi

    if command -v pg_ctlcluster >/dev/null 2>&1; then
        local ver name cluster
        cluster="$(pg_lsclusters -h 2>/dev/null | awk 'NR>1 && $4=="online"{print $1" "$2; exit}')"
        if [ -n "$cluster" ]; then
            ver="${cluster%% *}"
            name="${cluster#* }"
            log_info "正在重启 PostgreSQL 集群 ${ver}/${name}..."
            if sudo pg_ctlcluster "$ver" "$name" restart; then
                log_ok "PostgreSQL 已重启"
                return 0
            fi
        fi
    fi
    if command -v systemctl >/dev/null 2>&1; then
        local unit
        for unit in postgresql postgresql@15-main postgresql@16-main; do
            if systemctl list-units --type=service --all 2>/dev/null | grep -q "$unit"; then
                log_info "正在重启 ${unit}..."
                if sudo systemctl restart "$unit"; then
                    log_ok "PostgreSQL 已重启"
                    return 0
                fi
            fi
        done
    fi
    if command -v brew >/dev/null 2>&1; then
        local svc
        for svc in postgresql@15 postgresql@16 postgresql; do
            if brew services list 2>/dev/null | awk '{print $1}' | grep -qx "$svc"; then
                log_info "正在重启 ${svc}..."
                if brew services restart "$svc"; then
                    log_ok "PostgreSQL 已重启"
                    return 0
                fi
            fi
        done
    fi
    log_error "未能重启 PostgreSQL，请手动重启本机 postgres 服务"
    return 1
}

cmd_details() {
    load_deploy_env
    cmd_status
    echo ""
    echo "=== 环境依赖 ==="
    cmd_check || true
    if [ "$DEPLOY_MODE" = "prod" ]; then
        echo ""
        echo "=== 开机自启 ==="
        if is_windows_gitbash; then
            echo "  ${WINDOWS_BOOT_TASK_NAME}: $(boot_service_status_label)"
        else
            echo "  riveredge.service: $(boot_service_status_label)"
        fi
    fi
}

cmd_status() {
    load_deploy_env
    local server_ip web_url
    echo "=== RiverEdge ${DEPLOY_MODE} 状态 ==="
    for name in backend frontend worker scheduler caddy; do
        local pidf="$LOGS_DIR/${name}.pid"
        if [ -f "$pidf" ] && kill -0 "$(cat "$pidf")" 2>/dev/null; then
            echo "  $name: 运行中 (PID $(cat "$pidf"))"
        elif [ "$name" = "frontend" ] && [ "$DEPLOY_MODE" = "prod" ]; then
            if [ -f "$FRONTEND_DIR/dist/index.html" ]; then
                echo "  frontend: 静态 dist（由 Caddy 提供，无需独立进程）"
            else
                echo "  frontend: 缺少 dist/index.html"
            fi
        else
            echo "  $name: 未运行"
        fi
    done
    echo ""
    check_port "$BACKEND_PORT" && echo "  端口 ${BACKEND_PORT}: 监听中" || echo "  端口 ${BACKEND_PORT}: 空闲"
    if [ "$DEPLOY_MODE" = "dev" ]; then
        check_port "$FRONTEND_PORT" && echo "  端口 ${FRONTEND_PORT}: 监听中" || echo "  端口 ${FRONTEND_PORT}: 空闲"
    elif caddy_https_enabled; then
        check_port 443 && echo "  端口 443 (HTTPS): 监听中" || echo "  端口 443 (HTTPS): 空闲"
        check_port 80 && echo "  端口 80 (HTTP 跳转): 监听中" || echo "  端口 80 (HTTP 跳转): 空闲"
    else
        check_port "$PROXY_PORT" && echo "  端口 ${PROXY_PORT}: 监听中" || echo "  端口 ${PROXY_PORT}: 空闲"
    fi
    if [ "$DEPLOY_MODE" = "prod" ]; then
        server_ip="$(read_deploy_env_value SERVER_IP || detect_server_ip)"
        web_url="$(resolve_prod_web_url "$server_ip")"
        echo "  访问地址: ${web_url}"
        if ! caddy_https_enabled; then
            echo "  说明: 当前未启用域名 HTTPS；浏览器请用上述地址（勿用未配置的 https://域名）"
            echo "  若要用域名 HTTPS: 向导配置开启 CADDY_DOMAIN + Let's Encrypt，或宝塔 Nginx 反代到 :${PROXY_PORT}"
        fi
    fi
    echo "  蓝绿部署: $(blue_green_deploy_status_label)"
    if bg_enabled; then
        echo ""
        bg_print_status
    fi
}

pgdg_apt_base_url() {
    if [ "${USE_MIRROR}" = "1" ]; then
        echo "https://mirrors.aliyun.com/postgresql/repos/apt"
    else
        echo "https://apt.postgresql.org/pub/repos/apt"
    fi
}

pgdg_yum_base_url() {
    if [ "${USE_MIRROR}" = "1" ]; then
        echo "https://mirrors.aliyun.com/postgresql/repos/yum"
    else
        echo "https://download.postgresql.org/pub/repos/yum"
    fi
}

# 应用库是否本机（远程库无法在本机 apt/源码装扩展）
is_app_db_local_host() {
    local host
    host="$(read_env_value DB_HOST 2>/dev/null || echo localhost)"
    [ -z "$host" ] && host=localhost
    case "$host" in
        localhost|127.0.0.1|::1) return 0 ;;
        *) return 1 ;;
    esac
}

# 用 .env 中的应用库执行 SQL（stdout 为查询结果）
app_db_psql() {
    local psql_bin host port user pass dbname
    psql_bin="$(resolve_psql)"
    host="$(read_env_value DB_HOST 2>/dev/null || echo localhost)"
    port="$(read_env_value DB_PORT 2>/dev/null || echo "$(detect_postgres_port)")"
    user="$(read_env_value DB_USER 2>/dev/null || echo postgres)"
    pass="$(read_env_value DB_PASSWORD 2>/dev/null || true)"
    dbname="$(read_env_value DB_NAME 2>/dev/null || echo riveredge)"
    export PGPASSWORD="$pass"
    "$psql_bin" -h "$host" -p "$port" -U "$user" -d "$dbname" -v ON_ERROR_STOP=1 "$@"
    local rc=$?
    unset PGPASSWORD
    return $rc
}

# 应用库中 vector 扩展是否已对 CREATE EXTENSION 可用
pgvector_available_in_app_db() {
    local out
    out="$(app_db_psql -tAc "SELECT 1 FROM pg_available_extensions WHERE name = 'vector'" 2>/dev/null | tr -d '[:space:]')" || return 1
    [ "$out" = "1" ]
}

# 检测应用库 PostgreSQL 主版本（供匹配包 / 编译）
detect_postgresql_server_major() {
    local ver major d best=""
    ver="$(app_db_psql -tAc "SHOW server_version" 2>/dev/null | head -1 | tr -d '[:space:]')"
    if [[ "$ver" =~ ^([0-9]+) ]]; then
        echo "${BASH_REMATCH[1]}"
        return 0
    fi
    if command -v sudo >/dev/null 2>&1 && getent passwd postgres >/dev/null 2>&1; then
        ver="$(sudo -u postgres psql -tAc "SHOW server_version" 2>/dev/null | head -1 | tr -d '[:space:]')"
        if [[ "$ver" =~ ^([0-9]+) ]]; then
            echo "${BASH_REMATCH[1]}"
            return 0
        fi
    fi
    if [ -x /www/server/pgsql/bin/pg_config ]; then
        ver="$(/www/server/pgsql/bin/pg_config --version 2>/dev/null | sed -n 's/.* \([0-9][0-9]*\)\..*/\1/p')"
        [ -n "$ver" ] && echo "$ver" && return 0
    fi
    if command -v psql >/dev/null 2>&1; then
        ver="$(psql -V 2>/dev/null | sed -n 's/^psql (PostgreSQL) \([0-9][0-9]*\).*/\1/p')"
        [ -n "$ver" ] && echo "$ver" && return 0
    fi
    for d in /www/server/pgsql /usr/share/postgresql/[0-9]* /usr/pgsql-[0-9]*; do
        [ -d "$d" ] || continue
        if [ "$d" = "/www/server/pgsql" ]; then
            continue
        fi
        major="$(basename "$d" | grep -oE '[0-9]+$' || true)"
        [ -n "$major" ] || continue
        if [ -z "$best" ] || [ "$major" -gt "$best" ]; then
            best="$major"
        fi
    done
    [ -n "$best" ] && echo "$best"
}

# 解析与应用库实例匹配的 pg_config（按 data_directory，避免误装到旁路 PG）
resolve_pg_config() {
    local major=${1:-} candidate datadir
    datadir="$(app_db_psql -tAc "SHOW data_directory" 2>/dev/null | head -1 | tr -d '[:space:]')"
    if [[ "$datadir" == /www/server/pgsql* ]] && [ -x /www/server/pgsql/bin/pg_config ]; then
        echo /www/server/pgsql/bin/pg_config
        return 0
    fi
    if [ -n "$major" ]; then
        for candidate in \
            "/usr/lib/postgresql/${major}/bin/pg_config" \
            "/usr/pgsql-${major}/bin/pg_config"
        do
            if [ -x "$candidate" ]; then
                echo "$candidate"
                return 0
            fi
        done
    fi
    # 未连上库时的兜底：本机仅宝塔 PG
    if [ -x /www/server/pgsql/bin/pg_config ]; then
        echo /www/server/pgsql/bin/pg_config
        return 0
    fi
    if command -v pg_config >/dev/null 2>&1; then
        command -v pg_config
        return 0
    fi
    return 1
}

postgresql_pgvector_control_for_pg_config() {
    local pg_config=$1 sharedir
    sharedir="$("$pg_config" --sharedir 2>/dev/null)" || return 1
    [ -n "$sharedir" ] || return 1
    if [ -f "${sharedir}/extension/vector.control" ]; then
        echo "${sharedir}/extension/vector.control"
        return 0
    fi
    return 1
}

# 确保 PGDG APT 源可用（不安装服务端，仅供扩展包）
ensure_pgdg_apt_repo() {
    local pgdg_base codename key_path
    [ -f /etc/debian_version ] || return 1
    # shellcheck disable=SC1091
    . /etc/os-release
    codename="${VERSION_CODENAME:-}"
    [ -n "$codename" ] || return 1
    key_path="/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc"
    if [ -f /etc/apt/sources.list.d/pgdg.list ] && [ -f "$key_path" ]; then
        return 0
    fi
    pgdg_base="$(pgdg_apt_base_url)"
    log_info "配置 PGDG 源以安装 pgvector: ${pgdg_base} (${codename}-pgdg)"
    sudo apt-get update || return 1
    sudo apt-get install -y ca-certificates curl gnupg postgresql-common || return 1
    sudo install -d /usr/share/postgresql-common/pgdg
    curl -fsSL "${pgdg_base}/ACCC4CF8.asc" | sudo tee "$key_path" > /dev/null || return 1
    echo "deb [signed-by=${key_path}] ${pgdg_base} ${codename}-pgdg main" | sudo tee /etc/apt/sources.list.d/pgdg.list > /dev/null
    sudo apt-get update || return 1
}

# 确保 PGDG yum/dnf 源可用（不安装服务端）
ensure_pgdg_yum_repo() {
    local pkg_mgr pgdg_base arch repo_rpm el_ver
    is_linux_rhel_family || is_linux_fedora || return 1
    pkg_mgr="$(linux_pkg_manager)"
    [ "$pkg_mgr" = "dnf" ] || [ "$pkg_mgr" = "yum" ] || return 1
    if [ -f /etc/yum.repos.d/pgdg-redhat-all.repo ] || [ -f /etc/yum.repos.d/pgdg-fedora-all.repo ] \
        || ls /etc/yum.repos.d/pgdg*.repo >/dev/null 2>&1; then
        return 0
    fi
    pgdg_base="$(pgdg_yum_base_url)"
    arch="$(linux_machine_arch)"
    if is_linux_fedora; then
        load_os_release
        repo_rpm="${pgdg_base}/reporpms/F-${VERSION_ID}-${arch}/pgdg-fedora-repo-latest.noarch.rpm"
    else
        el_ver="$(get_rhel_el_version)"
        repo_rpm="${pgdg_base}/reporpms/EL-${el_ver}-${arch}/pgdg-redhat-repo-latest.noarch.rpm"
    fi
    log_info "配置 PGDG 源以安装 pgvector: ${repo_rpm}"
    sudo "$pkg_mgr" install -y "$repo_rpm" || return 1
}

install_pgvector_deb_package() {
    local major=$1 pkg
    pkg="postgresql-${major}-pgvector"
    if ! apt-cache show "$pkg" >/dev/null 2>&1; then
        ensure_pgdg_apt_repo || return 1
    fi
    sudo apt-get install -y "$pkg"
}

install_pgvector_rpm_package() {
    local major=$1 pkg pkg_mgr
    pkg="pgvector_${major}"
    pkg_mgr="$(linux_pkg_manager)"
    ensure_pgdg_yum_repo || true
    sudo "$pkg_mgr" install -y "$pkg"
}

# 按目标 pg_config 源码编译安装（宝塔 /www/server/pgsql 等无系统包时）
install_pgvector_from_source() {
    local pg_config=$1
    local work src_dir url rc=1
    local -a urls=()
    [ -x "$pg_config" ] || {
        log_error "pg_config 不可用: ${pg_config}"
        return 1
    }

    if [ -f /etc/debian_version ] || is_linux_debian_family; then
        sudo apt-get install -y build-essential git ca-certificates || return 1
    elif is_linux_rhel_family || is_linux_fedora; then
        sudo "$(linux_pkg_manager)" install -y gcc make git ca-certificates || return 1
    else
        log_error "当前平台无法自动编译 pgvector，请安装 gcc/make/git 后重试"
        return 1
    fi

    urls=(
        "https://github.com/pgvector/pgvector.git"
        "https://ghproxy.net/https://github.com/pgvector/pgvector.git"
        "https://mirror.ghproxy.com/https://github.com/pgvector/pgvector.git"
    )

    work="$(mktemp -d /tmp/pgvector-build.XXXXXX)" || return 1
    src_dir="${work}/pgvector"
    for url in "${urls[@]}"; do
        log_info "克隆 pgvector: ${url}"
        rm -rf "$src_dir"
        if git clone --depth 1 "$url" "$src_dir" >/dev/null 2>&1; then
            log_info "编译安装 pgvector（PG_CONFIG=${pg_config}）..."
            if (
                cd "$src_dir" || exit 1
                make clean >/dev/null 2>&1 || true
                make PG_CONFIG="$pg_config" && sudo make PG_CONFIG="$pg_config" install
            ); then
                rc=0
                break
            fi
            log_warn "pgvector 编译失败（${url}）"
        else
            log_warn "克隆失败: ${url}"
        fi
    done
    rm -rf "$work"
    return $rc
}

# 安装与应用库匹配的 pgvector（迁移 517 CREATE EXTENSION vector 前置条件）
# 以应用库 pg_available_extensions 为准；宝塔路径用源码安装，勿仅看 apt 包 control 文件。
ensure_postgresql_pgvector() {
    local major pg_config sharedir control host
    if is_windows_gitbash; then
        log_warn "Windows 不自动安装 pgvector；若迁移需要 vector，请在目标 PostgreSQL 主机安装扩展"
        return 0
    fi
    if [[ "$(uname -s)" == "Darwin" ]]; then
        log_warn "macOS 请自行安装 pgvector（如 brew install pgvector）后再迁移"
        return 0
    fi

    if pgvector_available_in_app_db; then
        log_ok "应用库已具备 pgvector（pg_available_extensions）"
        return 0
    fi

    host="$(read_env_value DB_HOST 2>/dev/null || echo localhost)"
    if ! is_app_db_local_host; then
        log_error "应用库 ${host} 为远程主机，无法在本机安装 pgvector"
        log_error "请在 PostgreSQL 所在机器安装 vector 扩展后重试迁移"
        return 1
    fi

    major="$(detect_postgresql_server_major || true)"
    if [ -z "$major" ]; then
        log_error "无法检测 PostgreSQL 主版本，无法安装 pgvector"
        return 1
    fi

    if ! pg_config="$(resolve_pg_config "$major")"; then
        log_error "未找到 pg_config（已查宝塔 /www/server/pgsql 与系统路径）"
        return 1
    fi
    sharedir="$("$pg_config" --sharedir 2>/dev/null || true)"
    log_info "安装 pgvector（PostgreSQL ${major}, pg_config=${pg_config}, sharedir=${sharedir:-?}）..."

    # 系统包路径的 PG：优先 apt/yum；宝塔或 sharedir 已是自定义前缀则走源码
    if [[ "$pg_config" == /www/server/pgsql/* ]] || [[ "${sharedir}" == /www/server/pgsql* ]]; then
        install_pgvector_from_source "$pg_config" || {
            log_error "宝塔 PostgreSQL 源码安装 pgvector 失败"
            return 1
        }
    elif [ -f /etc/debian_version ] || is_linux_debian_family; then
        if ! install_pgvector_deb_package "$major"; then
            log_warn "系统包 postgresql-${major}-pgvector 安装失败，改源码编译"
            install_pgvector_from_source "$pg_config" || {
                log_error "pgvector 安装失败（KU-AI 向量列迁移需要）"
                return 1
            }
        fi
    elif is_linux_rhel_family || is_linux_fedora; then
        if ! install_pgvector_rpm_package "$major"; then
            log_warn "系统包 pgvector_${major} 安装失败，改源码编译"
            install_pgvector_from_source "$pg_config" || {
                log_error "pgvector 安装失败（KU-AI 向量列迁移需要）"
                return 1
            }
        fi
    else
        install_pgvector_from_source "$pg_config" || {
            log_error "当前平台 pgvector 安装失败"
            return 1
        }
    fi

    if control="$(postgresql_pgvector_control_for_pg_config "$pg_config")"; then
        log_info "已写入 ${control}"
    else
        log_warn "未在 sharedir 找到 vector.control，仍将校验应用库"
    fi

    if pgvector_available_in_app_db; then
        log_ok "pgvector 已对应用库可用 (PostgreSQL ${major})"
        return 0
    fi
    log_error "pgvector 安装后应用库仍无 vector（pg_available_extensions 无条目）"
    log_error "请确认 DB_HOST/DB_PORT 指向本机刚安装扩展的实例，并重试迁移"
    return 1
}

# 应用库是否已 CREATE EXTENSION vector
vector_extension_installed_in_app_db() {
    local out
    out="$(app_db_psql -tAc "SELECT 1 FROM pg_extension WHERE extname = 'vector'" 2>/dev/null | tr -d '[:space:]')" || return 1
    [ "$out" = "1" ]
}

# 以超级用户在应用库执行 SQL（业务用户通常无 CREATE EXTENSION 权限）
postgres_superuser_sql_on_app_db() {
    local sql=$1
    local db_name db_port pass psql_bin
    db_name="$(read_env_value DB_NAME 2>/dev/null || echo riveredge)"
    db_port="$(read_env_value DB_PORT 2>/dev/null || echo "$(detect_postgres_port)")"
    pass="$(read_env_value DB_PASSWORD 2>/dev/null || true)"

    if is_windows_gitbash; then
        psql_bin="$(resolve_psql)"
        export PGPASSWORD="$pass"
        "$psql_bin" -h localhost -p "$db_port" -U postgres -d "$db_name" -v ON_ERROR_STOP=1 -c "$sql"
        local rc=$?
        unset PGPASSWORD
        return $rc
    fi

    if [ -x /www/server/pgsql/bin/psql ]; then
        if sudo -u postgres /www/server/pgsql/bin/psql -p "$db_port" -d "$db_name" -v ON_ERROR_STOP=1 -c "$sql" >/dev/null 2>&1; then
            return 0
        fi
        if sudo -u postgres /www/server/pgsql/bin/psql -d "$db_name" -v ON_ERROR_STOP=1 -c "$sql" >/dev/null 2>&1; then
            return 0
        fi
    fi

    if sudo -u postgres psql -p "$db_port" -d "$db_name" -v ON_ERROR_STOP=1 -c "$sql" >/dev/null 2>&1; then
        return 0
    fi
    if sudo -u postgres psql -d "$db_name" -v ON_ERROR_STOP=1 -c "$sql" >/dev/null 2>&1; then
        return 0
    fi

    # 宝塔等环境 peer 失败时，用本机 TCP + postgres 口令（与 bootstrap 常为同一 DB_PASSWORD）
    psql_bin="$(resolve_psql)"
    if [ -x /www/server/pgsql/bin/psql ]; then
        psql_bin=/www/server/pgsql/bin/psql
    fi
    export PGPASSWORD="$pass"
    if "$psql_bin" -h 127.0.0.1 -p "$db_port" -U postgres -d "$db_name" -v ON_ERROR_STOP=1 -c "$sql" >/dev/null 2>&1; then
        unset PGPASSWORD
        return 0
    fi
    unset PGPASSWORD
    return 1
}

# 迁移前由超级用户创建 vector，避免业务账号 permission denied to create extension
ensure_vector_extension_created() {
    if is_windows_gitbash || [[ "$(uname -s)" == "Darwin" ]]; then
        if vector_extension_installed_in_app_db; then
            return 0
        fi
        log_warn "非 Linux 部署：请确认应用库已执行 CREATE EXTENSION vector"
        return 0
    fi

    if vector_extension_installed_in_app_db; then
        log_ok "应用库已启用 vector 扩展"
        return 0
    fi

    if ! pgvector_available_in_app_db; then
        log_error "应用库尚无 pgvector 系统扩展，无法 CREATE EXTENSION"
        return 1
    fi

    if ! is_app_db_local_host; then
        log_error "远程库需超级用户执行: CREATE EXTENSION IF NOT EXISTS vector;"
        return 1
    fi

    log_info "以超级用户在应用库创建 vector 扩展..."
    if ! postgres_superuser_sql_on_app_db "CREATE EXTENSION IF NOT EXISTS vector;"; then
        log_error "超级用户 CREATE EXTENSION vector 失败"
        log_error "请手动以 postgres 连接应用库执行: CREATE EXTENSION IF NOT EXISTS vector;"
        return 1
    fi

    if vector_extension_installed_in_app_db; then
        log_ok "已在应用库创建 vector 扩展"
        return 0
    fi
    log_error "CREATE EXTENSION 后应用库仍无 vector"
    return 1
}

curl_pipe_bash_fallback() {
    local url
    for url in "$@"; do
        log_info "run setup script: $url"
        if curl -fsSL "$url" | sudo bash -; then
            return 0
        fi
        log_warn "setup script failed: $url"
    done
    return 1
}

curl_download_fallback() {
    local dest=$1
    shift
    local url
    for url in "$@"; do
        log_info "download: $url"
        if curl -fsSL "$url" -o "$dest"; then
            return 0
        fi
        log_warn "download failed: $url"
    done
    return 1
}

nodesource_setup_urls() {
    local kind=$1
    if [ "$kind" = "rpm" ]; then
        if [ "${USE_MIRROR}" = "1" ]; then
            printf '%s\n' \
                "https://rpm.nodesource.com/setup_22.x" \
                "https://mirrors.tuna.tsinghua.edu.cn/nodesource/rpm/setup_22.x" \
                "https://mirrors.huaweicloud.com/nodesource/setup_22.x"
        else
            echo "https://rpm.nodesource.com/setup_22.x"
        fi
        return
    fi
    if [ "${USE_MIRROR}" = "1" ]; then
        printf '%s\n' \
            "https://deb.nodesource.com/setup_22.x" \
            "https://mirrors.tuna.tsinghua.edu.cn/nodesource/deb/setup_22.x"
    else
        echo "https://deb.nodesource.com/setup_22.x"
    fi
}

install_node_nodesource_rpm() {
    local pkg_mgr urls
    pkg_mgr="$(linux_pkg_manager)"
    [ "$pkg_mgr" = "dnf" ] || [ "$pkg_mgr" = "yum" ] || { log_error "未找到 dnf/yum"; return 1; }
    mapfile -t urls < <(nodesource_setup_urls rpm)
    curl_pipe_bash_fallback "${urls[@]}" || return 1
    sudo "$pkg_mgr" install -y nodejs || return 1
    log_ok "Node.js 已通过 NodeSource (dnf/yum) 安装"
}

install_node_nodesource_deb() {
    local urls
    mapfile -t urls < <(nodesource_setup_urls deb)
    curl_pipe_bash_fallback "${urls[@]}" || return 1
    sudo apt update || return 1
    sudo apt install -y nodejs || return 1
    log_ok "Node.js 已通过 NodeSource (apt) 安装"
}

install_python_rhel() {
    local pkg_mgr pip_urls tmp
    pkg_mgr="$(linux_pkg_manager)"
    [ "$pkg_mgr" = "dnf" ] || [ "$pkg_mgr" = "yum" ] || { log_error "未找到 dnf/yum"; return 1; }

    if is_linux_rhel_family; then
        local el_ver="${1:-$(get_rhel_el_version)}"
        if [ "$el_ver" -le 8 ] 2>/dev/null; then
            sudo "$pkg_mgr" config-manager --set-enabled powertools 2>/dev/null || \
                sudo "$pkg_mgr" config-manager --set-enabled crb 2>/dev/null || \
                sudo "$pkg_mgr" config-manager --set-enabled PowerTools 2>/dev/null || true
        fi
    fi

    sudo "$pkg_mgr" install -y python3.12 python3.12-devel 2>/dev/null || \
        sudo "$pkg_mgr" install -y python3.12 || {
        log_error "无法安装 python3.12，请确认系统为 EL 9+ / Fedora 38+ 或已启用 CRB/PowerTools"
        return 1
    }

    if ! python3.12 -m pip --version >/dev/null 2>&1; then
        pip_urls=(
            "https://bootstrap.pypa.io/get-pip.py"
            "https://npmmirror.com/mirrors/pypi/get-pip.py"
        )
        tmp="$(mktemp)"
        if curl_download_fallback "$tmp" "${pip_urls[@]}"; then
            python3.12 "$tmp"
        fi
        rm -f "$tmp"
    fi
    log_ok "Python 3.12 已通过 dnf/yum 安装"
}

install_uv_shell() {
    local urls=(
        "https://astral.sh/uv/install.sh"
        "https://ghproxy.net/https://raw.githubusercontent.com/astral-sh/uv/main/scripts/install.sh"
        "https://mirror.ghproxy.com/https://raw.githubusercontent.com/astral-sh/uv/main/scripts/install.sh"
    )
    local url
    for url in "${urls[@]}"; do
        log_info "install uv: $url"
        if curl -LsSf "$url" | sh; then
            if [ "$(check_uv)" = "ok" ]; then
                log_ok "uv 已安装"
                return 0
            fi
            log_warn "uv 脚本执行后未检测到 uv"
        else
            log_warn "uv 安装脚本失败: $url"
        fi
    done
    return 1
}

install_postgresql_pgdg_rhel() {
    local pkg_mgr pgdg_base arch repo_rpm el_ver
    is_linux_rhel_family || is_linux_fedora || {
        log_error "PostgreSQL PGDG (dnf/yum) 安装仅支持 RHEL/CentOS/Rocky/Alma/Fedora"
        return 1
    }
    pkg_mgr="$(linux_pkg_manager)"
    [ "$pkg_mgr" = "dnf" ] || [ "$pkg_mgr" = "yum" ] || { log_error "未找到 dnf/yum"; return 1; }
    pgdg_base="$(pgdg_yum_base_url)"
    arch="$(linux_machine_arch)"

    if is_linux_fedora; then
        load_os_release
        repo_rpm="${pgdg_base}/reporpms/F-${VERSION_ID}-${arch}/pgdg-fedora-repo-latest.noarch.rpm"
    else
        el_ver="$(get_rhel_el_version)"
        repo_rpm="${pgdg_base}/reporpms/EL-${el_ver}-${arch}/pgdg-redhat-repo-latest.noarch.rpm"
    fi

    log_info "配置 PGDG 源 (dnf/yum): ${repo_rpm}"
    sudo "$pkg_mgr" install -y "$repo_rpm" || return 1
    if [ "$pkg_mgr" = "dnf" ]; then
        sudo dnf -qy module disable postgresql 2>/dev/null || true
    fi
    sudo "$pkg_mgr" install -y postgresql15-server postgresql15-contrib pgvector_15 || return 1

    if [ ! -f /var/lib/pgsql/15/data/PG_VERSION ]; then
        sudo /usr/pgsql-15/bin/postgresql-15-setup initdb || return 1
    fi
    sudo systemctl enable postgresql-15 || true
    sudo systemctl start postgresql-15 || return 1
    log_ok "PostgreSQL 15 已安装 (/usr/pgsql-15/bin，含 pgvector)"
}

caddy_rpm_repo_urls() {
    local distro=$1 codename=$2
    if [ "${USE_MIRROR}" = "1" ]; then
        printf '%s\n' \
            "https://dl.cloudsmith.io/public/caddy/stable/config.rpm.txt?distro=${distro}&codename=${codename}" \
            "https://mirrors.china.12306.work/repository/caddy/stable/config.rpm.txt?distro=${distro}&codename=${codename}"
    else
        echo "https://dl.cloudsmith.io/public/caddy/stable/config.rpm.txt?distro=${distro}&codename=${codename}"
    fi
}

install_caddy_dnf() {
    local pkg_mgr distro codename repo_urls url gpg_url keyring=/etc/pki/rpm-gpg/RPM-GPG-KEY-caddy
    is_linux_rhel_family || is_linux_fedora || {
        log_error "Caddy dnf/yum 安装仅支持 RHEL/CentOS/Rocky/Alma/Fedora"
        return 1
    }
    pkg_mgr="$(linux_pkg_manager)"
    [ "$pkg_mgr" = "dnf" ] || [ "$pkg_mgr" = "yum" ] || { log_error "未找到 dnf/yum"; return 1; }

    if is_linux_fedora; then
        load_os_release
        distro=fedora
        codename="${VERSION_ID:-}"
    else
        distro=el
        codename="$(get_rhel_el_version)"
    fi
    [ -n "$codename" ] || { log_error "无法检测发行版版本号"; return 1; }

    mapfile -t repo_urls < <(caddy_rpm_repo_urls "$distro" "$codename")
    gpg_url="$(caddy_gpg_url)"
    sudo "$pkg_mgr" install -y "dnf-command(config-manager)" curl ca-certificates 2>/dev/null || \
        sudo "$pkg_mgr" install -y curl ca-certificates || return 1

    local configured=0
    for url in "${repo_urls[@]}"; do
        log_info "配置 Caddy dnf/yum 源: $url"
        if curl -fsSL "$url" | sudo tee /etc/yum.repos.d/caddy-stable.repo >/dev/null; then
            configured=1
            break
        fi
        log_warn "Caddy 源配置失败: $url"
    done
    if [ "$configured" -eq 0 ]; then
        log_info "尝试手动写入 Caddy 源 (备用)"
        local base
        if [ "${USE_MIRROR}" = "1" ]; then
            base="https://mirrors.china.12306.work/repository/caddy/stable/rpm/${distro}/${codename}/\$basearch"
        else
            base="https://dl.cloudsmith.io/public/caddy/stable/rpm/${distro}/${codename}/\$basearch"
        fi
        sudo tee /etc/yum.repos.d/caddy-stable.repo >/dev/null <<EOF
[caddy-stable]
name=Caddy Stable
baseurl=${base}
gpgcheck=1
gpgkey=${gpg_url}
enabled=1
EOF
    fi

    curl -fsSL "$gpg_url" | sudo tee "$keyring" >/dev/null || return 1
    sudo "$pkg_mgr" makecache -y 2>/dev/null || sudo "$pkg_mgr" makecache || true
    sudo "$pkg_mgr" install -y caddy || return 1
    stop_system_caddy || return 1
    command -v caddy >/dev/null 2>&1 || { log_error "dnf/yum 安装后未找到 caddy"; return 1; }
    log_ok "Caddy 已通过 dnf/yum 安装: $(command -v caddy)"
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
    sudo apt install -y postgresql-15 postgresql-contrib-15 postgresql-15-pgvector || return 1
    log_ok "PostgreSQL 15 已安装（含 pgvector）"
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
        elif is_linux_rhel_family || is_linux_fedora; then
            install_caddy_dnf || return 1
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
    if [ "$comp" = "postgresql" ] && ! is_windows_gitbash; then
        if [ -f /etc/debian_version ]; then
            log_info "安装 postgresql..."
            install_postgresql_pgdg || return 1
            return 0
        fi
        if is_linux_rhel_family || is_linux_fedora; then
            log_info "安装 postgresql..."
            install_postgresql_pgdg_rhel || return 1
            return 0
        fi
    fi
    if [ "$comp" = "node" ] && ! is_windows_gitbash; then
        if is_linux_rhel_family || is_linux_fedora; then
            log_info "安装 node..."
            install_node_nodesource_rpm || return 1
            return 0
        fi
        if [ "$(get_install_platform_key)" = "debian" ]; then
            log_info "安装 node..."
            install_node_nodesource_deb || return 1
            return 0
        fi
    fi
    if [ "$comp" = "python" ] && ! is_windows_gitbash; then
        if is_linux_rhel_family || is_linux_fedora; then
            log_info "安装 python..."
            install_python_rhel || return 1
            return 0
        fi
    fi
    if [ "$comp" = "uv" ] && ! is_windows_gitbash; then
        log_info "安装 uv..."
        install_uv_shell || return 1
        return 0
    fi
    if [ "$comp" = "zbar" ] || [ "$comp" = "invoice-runtime" ]; then
        install_invoice_parse_runtime || return 1
        return 0
    fi
    local cmd
    cmd="$(get_install_command "$comp")"
    [ -n "$cmd" ] || { log_error "无 $comp 的安装命令"; return 1; }
    if [[ "$cmd" == *"fast-deploy"* ]] || [[ "$cmd" == *"从 https"* ]]; then
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
    st="$(check_playwright)"
    case "$st" in
        ok) log_ok "Playwright" ;;
        skipped) log_ok "Playwright — 已跳过 (PLAYWRIGHT_POSTINSTALL_ENABLE=0)" ;;
        *) log_warn "Playwright: $st（需 uv sync --extra pdf）"; failed=1 ;;
    esac
    st="$(check_playwright_chromium)"
    case "$st" in
        ok) log_ok "Chromium (Playwright)" ;;
        skipped) log_ok "Chromium — 已跳过 (PLAYWRIGHT_POSTINSTALL_ENABLE=0)" ;;
        installing) log_warn "Chromium — 后台补装进行中（见 .logs/playwright-install.log）" ;;
        missing) log_warn "Chromium — 未安装（生产 start 会同步安装）" ;;
        *) log_warn "Chromium: $st" ;;
    esac
    st="$(check_invoice_parse_runtime)"
    if [ "$st" = "ok" ]; then
        log_ok "发票解析系统库 (zbar + libgomp)"
    else
        log_warn "发票解析系统库: $st（需 libzbar0/zbar + libgomp1/libgomp）"
        failed=1
    fi
    st="$(check_ocr)"
    if [ "$st" = "ok" ]; then
        log_ok "发票 OCR (pymupdf + rapidocr)"
    else
        log_warn "发票 OCR: $st（需 uv sync --extra ocr，执行 migrate 会自动同步）"
        failed=1
    fi
    return $failed
}

cmd_install() {
    [ -f "$INSTALL_SCRIPTS_JSON" ] || { log_error "缺少 $INSTALL_SCRIPTS_JSON"; exit 1; }
    apply_cn_mirrors
    log_info "安装缺失依赖（可能需要 sudo / 管理员权限）..."
    if is_windows_gitbash; then
        log_info "Windows 环境：优先 winget，不可用时走官方安装包..."
    elif [ "$(uname -s)" = "Linux" ]; then
        log_info "Linux 发行版: $(linux_platform_label) · 平台标识: $(get_install_platform_key)"
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
    # 发票 PDF：系统库 zbar+libgomp；Python OCR 包在 migrate/sync_backend_deps 中 --extra ocr
    run_install_component invoice-runtime "$(check_invoice_parse_runtime)" || true
    log_warn "若刚安装系统软件，请重新打开终端或刷新 PATH 后再次 check"
    cmd_check || exit 1
}

_git_clean_untracked_safe() {
    local enabled="${GIT_CLEAN_ON_UPDATE:-}"
    if [ -z "$enabled" ]; then
        [ "$DEPLOY_MODE" = "prod" ] || return 0
    elif [ "$enabled" != "1" ]; then
        return 0
    fi
    log_info "清理未跟踪文件（保留 .env / uploads / .logs / 扩展组装产物）..."
    # workspace.yaml 与 compose 进 apps 的目录在 .gitignore 中；若不排除，
    # 主仓 update 的 git clean 会删掉它们，造成「扩展已启用但 manifest 不存在」。
    git clean -fd \
        -e '.logs' \
        -e '.logs/' \
        -e 'riveredge-backend/.env' \
        -e 'fast-deploy/config/deploy.env' \
        -e 'fast-deploy/tools/workspace/workspace.yaml' \
        -e '.playwright-browsers' \
        -e '.playwright-browsers/' \
        -e '.caddy-data' \
        -e '.caddy-data/' \
        -e '.caddy-config' \
        -e '.caddy-config/' \
        -e 'riveredge-backend/uploads' \
        -e 'riveredge-backend/uploads/' \
        -e 'riveredge-backend/src/apps/haoligo' \
        -e 'riveredge-backend/src/apps/haoligo/' \
        -e 'riveredge-backend/src/apps/kuaiai' \
        -e 'riveredge-backend/src/apps/kuaiai/' \
        -e 'riveredge-backend/src/apps/kuaireport' \
        -e 'riveredge-backend/src/apps/kuaireport/' \
        -e 'riveredge-backend/src/apps/kuaiiot' \
        -e 'riveredge-backend/src/apps/kuaiiot/' \
        -e 'riveredge-frontend/src/apps/haoligo' \
        -e 'riveredge-frontend/src/apps/haoligo/' \
        -e 'riveredge-frontend/src/apps/kuaiai' \
        -e 'riveredge-frontend/src/apps/kuaiai/' \
        -e 'riveredge-frontend/src/apps/kuaireport' \
        -e 'riveredge-frontend/src/apps/kuaireport/' \
        -e 'riveredge-frontend/src/apps/kuaiiot' \
        -e 'riveredge-frontend/src/apps/kuaiiot/' \
        || true
}

# 扩展应用已启用时，与 update 同步拉取专业/定制私仓（避免生产后端仍跑旧 haoligo 等）
sync_extension_git_repos_if_enabled() {
    load_deploy_env
    local pro_en custom_en
    pro_en="$(read_deploy_env_value PRO_ENABLED || echo 0)"
    custom_en="$(read_deploy_env_value CUSTOM_ENABLED || echo 0)"
    if [ "$pro_en" != "1" ] && [ "$custom_en" != "1" ]; then
        return 0
    fi

    local pro_url pro_path pro_branch pro_token
    local custom_url custom_path custom_branch custom_token

    if [ "$pro_en" = "1" ]; then
        pro_url="$(read_deploy_env_value PRO_REPO_URL || echo "$DEFAULT_PRO_REPO_URL")"
        pro_path="$(read_deploy_env_value PRO_REPO_PATH || true)"
        [ -n "$pro_path" ] || pro_path="$(_pro_default_repo_path)"
        pro_branch="$(read_deploy_env_value PRO_GIT_BRANCH || echo develop)"
        pro_token="$(read_deploy_env_value PRO_GIT_TOKEN || true)"
        _warn_missing_https_token "专业仓" "$pro_url" "$pro_token" "PRO_GIT_TOKEN"
        sync_sibling_git_repo "kuaigeyun-pro" "$pro_url" "$pro_path" "$pro_branch" "$pro_token" || return 1
    fi

    if [ "$custom_en" = "1" ]; then
        custom_url="$(read_deploy_env_value CUSTOM_REPO_URL || echo "$DEFAULT_CUSTOM_REPO_URL")"
        custom_path="$(read_deploy_env_value CUSTOM_REPO_PATH || true)"
        [ -n "$custom_path" ] || custom_path="$(_custom_default_repo_path)"
        custom_branch="$(read_deploy_env_value CUSTOM_GIT_BRANCH || echo develop)"
        custom_token="$(read_deploy_env_value CUSTOM_GIT_TOKEN || true)"
        [ -n "$custom_token" ] || custom_token="$(read_deploy_env_value PRO_GIT_TOKEN || true)"
        _warn_missing_https_token "定制仓" "$custom_url" "$custom_token" "CUSTOM_GIT_TOKEN"
        sync_sibling_git_repo "kuaigeyun-custom" "$custom_url" "$custom_path" "$custom_branch" "$custom_token" || return 1
    fi
}

# 主仓 update 后或扩展开关已开时，同步私仓并按 deploy.env 重新 compose
recompose_extension_apps_if_enabled() {
    load_deploy_env
    local pro_en custom_en
    pro_en="$(read_deploy_env_value PRO_ENABLED || echo 0)"
    custom_en="$(read_deploy_env_value CUSTOM_ENABLED || echo 0)"
    if [ "$pro_en" != "1" ] && [ "$custom_en" != "1" ]; then
        return 0
    fi
    log_info "扩展应用已启用，同步私仓并重新组装（workspace compose）..."
    sync_extension_git_repos_if_enabled || return 1
    run_workspace_compose || {
        log_error "扩展应用组装失败。请检查私仓路径与 PyYAML，或执行: ./fast-deploy/deploy.sh pro-apps all"
        return 1
    }
}

# 面板展示用：基于上次 fetch 的 origin/<branch> 比较（不额外 fetch）
git_sync_status_hint() {
    load_deploy_env
    local branch="${GIT_BRANCH:-develop}" remote="${GIT_REMOTE:-origin}"
    local behind ahead
    if ! git -C "$PROJECT_ROOT" rev-parse --verify "${remote}/${branch}" >/dev/null 2>&1; then
        echo " · 待 fetch"
        return 0
    fi
    behind="$(git -C "$PROJECT_ROOT" rev-list --count "HEAD..${remote}/${branch}" 2>/dev/null || echo 0)"
    ahead="$(git -C "$PROJECT_ROOT" rev-list --count "${remote}/${branch}..HEAD" 2>/dev/null || echo 0)"
    if [ "${behind:-0}" != "0" ]; then
        echo " · 滞后 ${behind}"
    elif [ "${ahead:-0}" != "0" ]; then
        echo " · 超前 ${ahead}"
    fi
}

sync_git_from_origin() {
    load_deploy_env
    local branch="${GIT_BRANCH:-develop}" remote="${GIT_REMOTE:-origin}"
    local old_head old_ref new_head

    if ! command -v git >/dev/null 2>&1 || [ ! -d "$PROJECT_ROOT/.git" ]; then
        log_error "当前目录不是 Git 仓库: $PROJECT_ROOT"
        return 1
    fi
    if ! git -C "$PROJECT_ROOT" remote get-url "$remote" >/dev/null 2>&1; then
        log_error "未配置 Git 远程 ${remote}，请先 git remote add ${remote} <url>"
        return 1
    fi

    old_head="$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo "?")"
    old_ref="$(git -C "$PROJECT_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?")"
    log_info "同步远程代码 (${remote}/${branch}，fetch + reset --hard，无需手动 git pull)..."
    log_info "当前: ${old_ref} @ ${old_head}"

    (
        cd "$PROJECT_ROOT"
        git fetch "$remote" --prune --tags
        git fetch "$remote" "$branch"
        if ! git rev-parse --verify "${remote}/${branch}" >/dev/null 2>&1; then
            log_error "远程分支 ${remote}/${branch} 不存在，请检查 GIT_BRANCH 或是否已 push"
            exit 1
        fi
        # checkout 在 reset 之前会因本地改动失败；-B 直接对齐 origin/<branch>
        git checkout -B "$branch" "${remote}/${branch}"
        _git_clean_untracked_safe
    ) || {
        log_error "同步远程代码失败 (${remote}/${branch})"
        log_error "排查: git remote -v · 网络 · ${remote} 凭据 · deploy.env 中 GIT_BRANCH"
        return 1
    }

    new_head="$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo "?")"
    if [ "$old_head" = "$new_head" ]; then
        log_ok "代码已是最新 (${new_head})"
    else
        log_ok "代码已更新: ${old_head} → ${new_head}"
    fi
}

# ---------- 专业 / 定制应用（私有仓 + workspace compose）----------

# 私有配套仓默认地址（与 Gitee 仓库名一致）
DEFAULT_PRO_REPO_URL='https://gitee.com/kuaigeyun/kuaigeyun-pro.git'
DEFAULT_CUSTOM_REPO_URL='https://gitee.com/kuaigeyun/kuaigeyun-custom.git'
DEFAULT_CLIENT_REPO_URL='https://gitee.com/kuaigeyun/kuaigeyun-client.git'

_pro_default_repo_path() {
    echo "$(cd "$PROJECT_ROOT/.." && pwd)/kuaigeyun-pro"
}

_custom_default_repo_path() {
    echo "$(cd "$PROJECT_ROOT/.." && pwd)/kuaigeyun-custom"
}

_client_default_repo_path() {
    echo "$(cd "$PROJECT_ROOT/.." && pwd)/kuaigeyun-client"
}

_git_auth_url() {
    # 将 https URL 注入 oauth2:token（Gitee/GitHub 常见写法）；SSH 原样返回
    local url="$1" token="$2"
    if [ -z "$token" ]; then
        echo "$url"
        return 0
    fi
    case "$url" in
        git@*|ssh://*)
            echo "$url"
            ;;
        https://*)
            echo "$url" | sed -E "s#https://([^/]+)/#https://oauth2:${token}@\1/#"
            ;;
        http://*)
            echo "$url" | sed -E "s#http://([^/]+)/#http://oauth2:${token}@\1/#"
            ;;
        *)
            echo "$url"
            ;;
    esac
}

_git_strip_auth_url() {
    local url="$1"
    echo "$url" | sed -E 's#(https?://)[^/@]+@#\1#'
}

sync_sibling_git_repo() {
    # 参数: name url path branch token
    local name="$1" url="$2" path="$3" branch="${4:-develop}" token="${5:-}"
    local auth_url clean_url
    [ -n "$url" ] || { log_error "${name}: 未配置仓库 URL"; return 1; }
    [ -n "$path" ] || { log_error "${name}: 未配置本地路径"; return 1; }
    auth_url="$(_git_auth_url "$url" "$token")"
    clean_url="$(_git_strip_auth_url "$url")"

    if [ ! -d "$path/.git" ]; then
        log_info "克隆 ${name}: ${clean_url} → ${path}（分支 ${branch}）"
        mkdir -p "$(dirname "$path")"
        # 主仓 / 专业包 / 定制包 / 终端仓统一默认 develop；禁止回落到 main
        if ! git clone --branch "$branch" --single-branch "$auth_url" "$path"; then
            log_error "克隆 ${name} 失败：请确认私仓存在分支 ${branch}，以及 Token/SSH 权限"
            rm -rf "$path"
            return 1
        fi
        git -C "$path" remote set-url origin "$clean_url"
    else
        log_info "同步 ${name}: ${path}（分支 ${branch}）"
        (
            cd "$path"
            # 临时注入鉴权 URL，同步后立刻还原，避免 Token 落在 .git/config
            git remote set-url origin "$auth_url"
            git fetch origin --prune --tags
            git fetch origin "$branch" || {
                git remote set-url origin "$clean_url"
                log_error "${name}: 拉取分支 ${branch} 失败"
                exit 1
            }
            git remote set-url origin "$clean_url"
            if ! git rev-parse --verify "origin/${branch}" >/dev/null 2>&1; then
                log_error "${name}: 远程无分支 ${branch}（已统一使用 develop，勿再配置 main）"
                exit 1
            fi
            git checkout -B "$branch" "origin/${branch}"
        ) || {
            git -C "$path" remote set-url origin "$clean_url" 2>/dev/null || true
            log_error "同步 ${name} 失败"
            return 1
        }
    fi
    log_ok "${name} @ $(git -C "$path" rev-parse --short HEAD 2>/dev/null || echo '?') [${branch}]"
}

write_workspace_yaml_from_deploy_env() {
    load_deploy_env
    local mode pro_path custom_path pro_rel custom_rel yaml pro_en custom_en plugin_count=0
    mode="$(read_deploy_env_value WORKSPACE_COMPOSE_MODE || echo copy)"
    pro_en="$(read_deploy_env_value PRO_ENABLED || echo 0)"
    custom_en="$(read_deploy_env_value CUSTOM_ENABLED || echo 0)"
    pro_path="$(read_deploy_env_value PRO_REPO_PATH || true)"
    [ -n "$pro_path" ] || pro_path="$(_pro_default_repo_path)"
    custom_path="$(read_deploy_env_value CUSTOM_REPO_PATH || true)"
    [ -n "$custom_path" ] || custom_path="$(_custom_default_repo_path)"

    # workspace.yaml 中 repo 用相对主仓根的路径（优先 venv/python3，避免仅有 python3 的机器写失败）
    local py_rel="python3"
    if [ -x "$PROJECT_ROOT/riveredge-backend/.venv/bin/python" ]; then
        py_rel="$PROJECT_ROOT/riveredge-backend/.venv/bin/python"
    elif [ -x "$PROJECT_ROOT/riveredge-backend/.venv/Scripts/python.exe" ]; then
        py_rel="$PROJECT_ROOT/riveredge-backend/.venv/Scripts/python.exe"
    elif command -v python3 >/dev/null 2>&1; then
        py_rel="python3"
    elif command -v python >/dev/null 2>&1; then
        py_rel="python"
    fi
    pro_rel="$("$py_rel" -c "import os.path; print(os.path.relpath(r'''$pro_path''', r'''$PROJECT_ROOT'''))" 2>/dev/null \
        || echo "../kuaigeyun-pro")"
    custom_rel="$("$py_rel" -c "import os.path; print(os.path.relpath(r'''$custom_path''', r'''$PROJECT_ROOT'''))" 2>/dev/null \
        || echo "../kuaigeyun-custom")"

    if [ "$pro_en" != "1" ] && [ "$custom_en" != "1" ]; then
        log_error "PRO_ENABLED / CUSTOM_ENABLED 均为未启用，无法生成 workspace.yaml"
        return 1
    fi

    yaml="$PROJECT_ROOT/fast-deploy/tools/workspace/workspace.yaml"
    {
        echo "# generated by fast-deploy — do not commit secrets"
        echo "mode: ${mode}"
        echo ""
        echo "plugins:"
        if [ "$pro_en" = "1" ]; then
            echo "  - repo: ${pro_rel}"
            echo "    apps:"
            echo "      - kuaiai"
            echo "      - kuaireport"
            echo "      - kuaiiot"
            plugin_count=$((plugin_count + 1))
        fi
        if [ "$custom_en" = "1" ]; then
            echo "  - repo: ${custom_rel}"
            echo "    apps:"
            echo "      - haoligo"
            plugin_count=$((plugin_count + 1))
        fi
    } >"$yaml"
    log_ok "已写入 ${yaml} (mode=${mode}, plugins=${plugin_count})"
}

run_workspace_compose() {
    local py="$PROJECT_ROOT/fast-deploy/tools/workspace/compose.py" python_bin=""
    [ -f "$py" ] || { log_error "缺少 ${py}"; return 1; }
    if [ -x "$PROJECT_ROOT/riveredge-backend/.venv/bin/python" ]; then
        python_bin="$PROJECT_ROOT/riveredge-backend/.venv/bin/python"
    elif [ -x "$PROJECT_ROOT/riveredge-backend/.venv/Scripts/python.exe" ]; then
        python_bin="$PROJECT_ROOT/riveredge-backend/.venv/Scripts/python.exe"
    elif command -v python3 >/dev/null 2>&1; then
        python_bin="python3"
    elif command -v python >/dev/null 2>&1; then
        python_bin="python"
    else
        log_error "未找到 Python，无法执行 compose"
        return 1
    fi
    if ! "$python_bin" -c "import yaml" 2>/dev/null; then
        log_info "安装 PyYAML..."
        "$python_bin" -m pip install -q pyyaml || {
            log_error "请先安装 PyYAML: ${python_bin} -m pip install pyyaml"
            return 1
        }
    fi
    write_workspace_yaml_from_deploy_env || return 1
    log_info "执行 workspace compose..."
    (cd "$PROJECT_ROOT" && "$python_bin" "$py") || return 1
}

cmd_pro_apps_status() {
    load_deploy_env
    local py="$PROJECT_ROOT/fast-deploy/tools/workspace/compose.py" python_bin="python3"
    local pro_en custom_en yaml
    pro_en="$(read_deploy_env_value PRO_ENABLED || echo 0)"
    custom_en="$(read_deploy_env_value CUSTOM_ENABLED || echo 0)"
    yaml="$PROJECT_ROOT/fast-deploy/tools/workspace/workspace.yaml"
    if [ -x "$PROJECT_ROOT/riveredge-backend/.venv/bin/python" ]; then
        python_bin="$PROJECT_ROOT/riveredge-backend/.venv/bin/python"
    elif [ -x "$PROJECT_ROOT/riveredge-backend/.venv/Scripts/python.exe" ]; then
        python_bin="$PROJECT_ROOT/riveredge-backend/.venv/Scripts/python.exe"
    elif command -v python >/dev/null 2>&1; then
        python_bin="python"
    fi
    if [ ! -f "$yaml" ]; then
        if [ "$pro_en" = "1" ] || [ "$custom_en" = "1" ]; then
            log_warn "扩展包已启用，但缺少 ${yaml}（未组装或曾被主仓 git clean 清掉）"
            log_warn "请执行: ./fast-deploy/deploy.sh pro-apps all   或向导扩展应用 → 更新"
        else
            log_warn "尚无 ${yaml}（扩展应用未组装；与主仓 install/update 无关）"
        fi
        return 1
    fi
    (cd "$PROJECT_ROOT" && "$python_bin" "$py" --status)
}

_warn_missing_https_token() {
    local label="$1" url="$2" token="$3" hint="$4"
    [ -n "$token" ] && return 0
    case "$url" in
        git@*|ssh://*) return 0 ;;
    esac
    log_warn "未配置 ${label} Token，且 URL 非 SSH；私仓可能拉取失败"
    log_warn "请先菜单 [4]→配置，或在 deploy.env 写入 ${hint}"
}

cmd_install_extension_apps() {
    # 参数: pro | custom | all（默认 all = 按已启用标志同步；若均未启用则装全部）
    load_deploy_env
    local scope="${1:-all}"
    local do_pro=0 do_custom=0
    local pro_url pro_path pro_branch pro_token
    local custom_url custom_path custom_branch custom_token

    case "$scope" in
        pro)
            do_pro=1
            ;;
        custom)
            do_custom=1
            ;;
        all)
            if [ "$(read_deploy_env_value PRO_ENABLED || echo 0)" = "1" ]; then
                do_pro=1
            fi
            if [ "$(read_deploy_env_value CUSTOM_ENABLED || echo 0)" = "1" ]; then
                do_custom=1
            fi
            # 首次「安装全部」或标志皆空：两仓都装
            if [ "$do_pro" = "0" ] && [ "$do_custom" = "0" ]; then
                do_pro=1
                do_custom=1
            fi
            ;;
        *)
            log_error "未知范围: ${scope}（可用 pro|custom|all）"
            return 1
            ;;
    esac

    pro_url="$(read_deploy_env_value PRO_REPO_URL || echo "$DEFAULT_PRO_REPO_URL")"
    pro_path="$(read_deploy_env_value PRO_REPO_PATH || true)"
    [ -n "$pro_path" ] || pro_path="$(_pro_default_repo_path)"
    pro_branch="$(read_deploy_env_value PRO_GIT_BRANCH || echo develop)"
    pro_token="$(read_deploy_env_value PRO_GIT_TOKEN || true)"
    custom_url="$(read_deploy_env_value CUSTOM_REPO_URL || echo "$DEFAULT_CUSTOM_REPO_URL")"
    custom_path="$(read_deploy_env_value CUSTOM_REPO_PATH || true)"
    [ -n "$custom_path" ] || custom_path="$(_custom_default_repo_path)"
    custom_branch="$(read_deploy_env_value CUSTOM_GIT_BRANCH || echo develop)"
    custom_token="$(read_deploy_env_value CUSTOM_GIT_TOKEN || true)"
    [ -n "$custom_token" ] || custom_token="$pro_token"

    [ -n "$(read_deploy_env_value WORKSPACE_COMPOSE_MODE || true)" ] \
        || set_deploy_env_value WORKSPACE_COMPOSE_MODE "copy"

    if [ "$do_pro" = "1" ]; then
        _warn_missing_https_token "专业仓" "$pro_url" "$pro_token" "PRO_GIT_TOKEN"
        set_deploy_env_value PRO_ENABLED "1"
        set_deploy_env_value PRO_REPO_URL "$pro_url"
        set_deploy_env_value PRO_REPO_PATH "$pro_path"
        set_deploy_env_value PRO_GIT_BRANCH "$pro_branch"
        sync_sibling_git_repo "kuaigeyun-pro" "$pro_url" "$pro_path" "$pro_branch" "$pro_token" || return 1
    fi

    if [ "$do_custom" = "1" ]; then
        _warn_missing_https_token "定制仓" "$custom_url" "$custom_token" "CUSTOM_GIT_TOKEN"
        set_deploy_env_value CUSTOM_ENABLED "1"
        set_deploy_env_value CUSTOM_REPO_URL "$custom_url"
        set_deploy_env_value CUSTOM_REPO_PATH "$custom_path"
        set_deploy_env_value CUSTOM_GIT_BRANCH "$custom_branch"
        sync_sibling_git_repo "kuaigeyun-custom" "$custom_url" "$custom_path" "$custom_branch" "$custom_token" || return 1
    fi

    # compose 时保留「先前已启用、本次未改」的另一侧
    run_workspace_compose || return 1
    log_ok "扩展应用已组装（scope=${scope}）。请重启后端/前端。"
}

# 兼容旧入口名
cmd_install_pro_apps() {
    cmd_install_extension_apps "${1:-all}"
}

# 从私仓 kuaigeyun-client 定位已入库的 Expo Web 产物目录
_resolve_client_web_dist_dir() {
    local client_root="$1" candidate
    for candidate in \
        "$client_root/riveredge-app-mobile/web-dist" \
        "$client_root/mobile/web-dist" \
        "$client_root/riveredge-app/mobile/web-dist"
    do
        if [ -f "$candidate/index.html" ]; then
            echo "$candidate"
            return 0
        fi
    done
    return 1
}

# 将私仓 web-dist 安装到主仓 Caddy 路径 riveredge-app/mobile/web-dist
install_mobile_h5_from_client_repo() {
    local client_root="$1"
    local src_dist dest_dist
    src_dist="$(_resolve_client_web_dist_dir "$client_root")" || {
        log_error "私仓中未找到 web-dist/index.html（期望 riveredge-app-mobile/web-dist）"
        log_error "请先在有 Node 的环境执行 ./fast-deploy/build.mobile.web.sh 并推送到 kuaigeyun-client"
        return 1
    }
    dest_dist="$MOBILE_WEB_DIR"
    mkdir -p "$(dirname "$dest_dist")"
    rm -rf "$dest_dist"
    mkdir -p "$dest_dist"
    if ! cp -a "$src_dist/." "$dest_dist/"; then
        log_error "复制 H5 失败: $src_dist → $dest_dist"
        return 1
    fi
    [ -f "$dest_dist/index.html" ] || {
        log_error "安装后缺少 $dest_dist/index.html"
        return 1
    }
    log_ok "移动端 H5 已安装 → $dest_dist（Caddy /mobile）"
}

cmd_install_client_repo() {
    load_deploy_env
    local url path branch token
    url="$(read_deploy_env_value CLIENT_REPO_URL || echo "$DEFAULT_CLIENT_REPO_URL")"
    path="$(read_deploy_env_value CLIENT_REPO_PATH || true)"
    [ -n "$path" ] || path="$(_client_default_repo_path)"
    branch="$(read_deploy_env_value CLIENT_GIT_BRANCH || echo develop)"
    token="$(read_deploy_env_value CLIENT_GIT_TOKEN || true)"
    [ -n "$token" ] || token="$(read_deploy_env_value PRO_GIT_TOKEN || true)"

    _warn_missing_https_token "移动端 H5 仓" "$url" "$token" "CLIENT_GIT_TOKEN"
    set_deploy_env_value CLIENT_ENABLED "1"
    set_deploy_env_value CLIENT_REPO_URL "$url"
    set_deploy_env_value CLIENT_REPO_PATH "$path"
    set_deploy_env_value CLIENT_GIT_BRANCH "$branch"
    sync_sibling_git_repo "kuaigeyun-client" "$url" "$path" "$branch" "$token" || return 1
    install_mobile_h5_from_client_repo "$path" || return 1
    log_ok "移动端 H5 源仓已同步: ${path}"
}

run_update_dev() {
    load_deploy_env
    if prompt_update_blue_green; then
        bg_run_update_dev || return 1
        if ! pidfile_alive "$LOGS_DIR/frontend.pid" 2>/dev/null; then
            start_frontend_dev || return 1
        else
            log_info "Vite 仍在运行，跳过前端重启（蓝绿 update）"
        fi
        return 0
    fi
    # SKIP_GIT_SYNC=1：调用方已 sync（如向导拉取后 reload 脚本）
    if [ "${SKIP_GIT_SYNC:-0}" != "1" ]; then
        sync_git_from_origin || return 1
    fi
    recompose_extension_apps_if_enabled || return 1
    cmd_stop_dev || return 1
    cmd_migrate || return 1
    record_deploy_release_metadata || return 1
    ensure_backend_restarted_for_release
    cmd_start_dev || return 1
    unset FORCE_BACKEND_RESTART
}

run_update_prod() {
    load_deploy_env
    if prompt_update_blue_green; then
        bg_run_update_prod || return 1
        return 0
    fi
    if [ "${SKIP_GIT_SYNC:-0}" != "1" ]; then
        sync_git_from_origin || return 1
    fi
    recompose_extension_apps_if_enabled || return 1
    cmd_stop_prod || return 1
    cmd_migrate || return 1
    cmd_ensure_frontend_dist || return 1
    if bg_enabled; then
        bg_sync_all_frontend_slots_from_dist || return 1
    fi
    record_deploy_release_metadata || return 1
    ensure_backend_restarted_for_release
    cmd_start_prod || return 1
    unset FORCE_BACKEND_RESTART
}

cmd_update_dev() {
    run_update_dev || exit 1
    log_ok "开发环境已更新"
}

cmd_update_prod() {
    run_update_prod || exit 1
    log_ok "生产环境已更新"
}

cmd_default() {
    cmd_wizard
}

fd_dispatch() {
    local cmd="${1:-}"
    shift || true
    case "$cmd" in
        check)     cmd_check ;;
        install)
            cmd_install
            log_info "install 仅安装系统依赖；完整部署请执行: ./fast-deploy/deploy.sh"
            ;;
        configure) cmd_configure ;;
        migrate)   cmd_migrate ;;
        free-memory|free_memory) cmd_free_memory ;;
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
        install-service)   cmd_install_service ;;
        uninstall-service) cmd_uninstall_service ;;
        pro-apps|install-pro|ext-apps)
            cmd_install_extension_apps "${1:-all}"
            ;;
        install-custom)
            cmd_install_extension_apps custom
            ;;
        install-client|install-h5)
            cmd_install_client_repo
            ;;
        pro-apps-status|ext-apps-status)
            cmd_pro_apps_status
            ;;
        wizard|""|deploy) cmd_wizard ;;
        *)
            log_error "未知命令: $cmd"
            echo "用法: wizard | check | install | configure | migrate | free-memory | build | start | stop | status | update | pro-apps [pro|custom|all] | install-custom | install-service | uninstall-service"
            exit 1
            ;;
    esac
}

# shellcheck source=lib/wizard.sh
source "$FAST_DEPLOY_DIR/lib/wizard.sh"
