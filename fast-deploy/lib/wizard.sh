#!/usr/bin/env bash
# RiverEdge 对话式部署向导

WIZARD_TOTAL_STAGES=8
WIZARD_CURRENT=0

WIZARD_RESET='\033[0m'
WIZARD_BOLD='\033[1m'
WIZARD_DIM='\033[2m'
WIZARD_CYAN=''
WIZARD_GREEN=''
WIZARD_LOGO_COLOR=''
WIZARD_YELLOW=''
WIZARD_RED=''
WIZARD_BLUE=''
WIZARD_PANEL_BORDER=''

# KUAIGE LOGO 宽 48；主面板宽度按 CJK 双宽字符对齐（横线不少于正文显示宽度）
WIZARD_PANEL_W=120
WIZARD_LOGO_W=48

WIZARD_OFFICIAL_REPO_GITEE='https://gitee.com/kuaigeyun/kuaigeyun'
WIZARD_OFFICIAL_REPO_GITHUB='https://github.com/kuaigeyun/kuaigeyun-mes'
WIZARD_PRO_REPO_GITEE='https://gitee.com/kuaigeyun/kuaigeyun-pro'
WIZARD_CUSTOM_REPO_GITEE='https://gitee.com/kuaigeyun/kuaigeyun-custom'
WIZARD_CLIENT_REPO_GITEE='https://gitee.com/kuaigeyun/kuaigeyun-client'

wizard_supports_truecolor() {
    case "${COLORTERM:-}" in
        truecolor|24bit) return 0 ;;
    esac
    case "${TERM:-}" in
        *256color*|*direct*) return 0 ;;
    esac
    [ -n "${WT_SESSION:-}" ] && return 0
    # Git Bash 的 mintty 与 Win10+ 控制台均支持 24-bit，但默认 TERM=xterm 且不设 COLORTERM
    is_windows_gitbash && return 0
    return 1
}

# 固定主题色：优先 24-bit RGB（各终端观感一致），否则退回标准 16 色（不用 90–97 亮色系）
wizard_init_theme() {
    WIZARD_RESET='\033[0m'
    WIZARD_BOLD='\033[1m'
    WIZARD_DIM='\033[2m'
    if [ -n "${NO_COLOR:-}" ]; then
        WIZARD_CYAN=''
        WIZARD_GREEN=''
        WIZARD_LOGO_COLOR=''
        WIZARD_YELLOW=''
        WIZARD_RED=''
        WIZARD_BLUE=''
        WIZARD_PANEL_BORDER=''
        return 0
    fi
    if wizard_supports_truecolor; then
        WIZARD_CYAN=$'\033[38;2;56;188;210m'
        WIZARD_LOGO_COLOR="${WIZARD_CYAN}"
        WIZARD_GREEN=$'\033[38;2;88;176;104m'
        WIZARD_YELLOW=$'\033[38;2;196;168;72m'
        WIZARD_RED=$'\033[38;2;208;96;96m'
        WIZARD_BLUE=$'\033[38;2;96;144;208m'
    else
        WIZARD_CYAN='\033[36m'
        WIZARD_LOGO_COLOR="${WIZARD_CYAN}"
        WIZARD_GREEN='\033[32m'
        WIZARD_YELLOW='\033[33m'
        WIZARD_RED='\033[31m'
        WIZARD_BLUE='\033[34m'
    fi
    WIZARD_PANEL_BORDER="${WIZARD_DIM}"
}

wizard_panel_init() {
    WIZARD_P_H='-'
    WIZARD_PANEL_BORDER="${WIZARD_DIM}"
}

wizard_init_theme
wizard_panel_init

wizard_block_margin() {
    echo 0
}

wizard_panel_margin() {
    wizard_block_margin "$WIZARD_LOGO_W"
}

wizard_panel_prefix() {
    printf '%*s' "${WIZARD_PANEL_MARGIN:-$(wizard_panel_margin)}" ''
}

wizard_panel_begin() {
    WIZARD_PANEL_MARGIN="$(wizard_panel_margin)"
}

# 终端实际列数：从 /dev/tty 读，避免向导输出被 tee 管道时误判为 80
wizard_term_cols() {
    local cols=''
    cols="$( { stty size < /dev/tty; } 2>/dev/null | awk '{print $2}')"
    if [ -z "$cols" ] && command -v tput >/dev/null 2>&1; then
        cols="$(tput cols 2>/dev/null)"
    fi
    case "$cols" in
        ''|*[!0-9]*) cols=0 ;;
    esac
    echo "$cols"
}

# 分隔线不得超过终端宽度，否则会折行成「一长一短两条」（Git Bash 默认 80 列）
wizard_panel_rule_width() {
    local cols
    cols="$(wizard_term_cols)"
    if [ "$cols" -gt 0 ] && [ "$cols" -lt "$WIZARD_PANEL_W" ]; then
        echo "$cols"
    else
        echo "$WIZARD_PANEL_W"
    fi
}

wizard_panel_top() {
    wizard_panel_prefix
    echo -e "${WIZARD_PANEL_BORDER}$(wizard_panel_repeat "$WIZARD_P_H" "$(wizard_panel_rule_width)")${WIZARD_RESET}"
}

wizard_panel_mid() {
    wizard_panel_top
}

wizard_panel_bot() {
    wizard_panel_top
}

wizard_panel_line() {
    wizard_panel_prefix
    echo -e "$1"
}

# 彩色用 %b，LOGO 正文用 %s；整块按 WIZARD_LOGO_W 左对齐（与面板同列顶格）
wizard_logo_print_line() {
    local line=$1
    local pad
    pad="$(wizard_block_margin "$WIZARD_LOGO_W")"
    printf '%*s' "$pad" ''
    printf '%b%-*s%b\n' "${WIZARD_BOLD}${WIZARD_LOGO_COLOR}" "$WIZARD_LOGO_W" "$line" "${WIZARD_RESET}"
}

wizard_logo_print_caption() {
    local text=$1
    local block_margin
    block_margin="$(wizard_block_margin "$WIZARD_LOGO_W")"
    printf '%*s' "$block_margin" ''
    printf '%b%s%b\n' "${WIZARD_DIM}" "$text" "${WIZARD_RESET}"
}

wizard_print_kuaige_logo() {
    while IFS= read -r line || [ -n "$line" ]; do
        line="${line%"${line##*[![:space:]]}"}"
        [ -z "$line" ] && continue
        wizard_logo_print_line "$line"
    done <<'EOF'                                                                            
██ ▄█▀ ██  ██ ▄████▄ ██  ▄████  ██████ 
████   ██  ██ ██▄▄██ ██ ██  ▄▄▄ ██▄▄   
██ ▀█▄ ▀████▀ ██  ██ ██  ▀███▀  ██▄▄▄▄ 
                                                                                                       
EOF
}

wizard_print_kuaige_header() {
    echo ""
    wizard_print_kuaige_logo
    echo ""
    wizard_logo_print_caption "RiverEdge · Intelligent Deploy Console"
}

wizard_show_official_repo_notice() {
    wizard_panel_line "${WIZARD_BOLD}${WIZARD_CYAN}OFFICIAL 正版仓库${WIZARD_RESET}  ${WIZARD_DIM}Gitee${WIZARD_RESET}  ${WIZARD_OFFICIAL_REPO_GITEE}  ${WIZARD_DIM}GitHub${WIZARD_RESET}  ${WIZARD_OFFICIAL_REPO_GITHUB}"
    wizard_panel_line "${WIZARD_BOLD}${WIZARD_CYAN}NOTICE 渠道警示${WIZARD_RESET}  ${WIZARD_DIM}非上述官方仓库来源的分发、收费推广或所谓「官方授权版」，均与快格云制造无关联，请自行甄别。${WIZARD_RESET}"
    wizard_panel_mid
}

wizard_panel_repeat() {
    local ch=$1 n=$2
    printf "%*s" "$n" "" | tr ' ' "$ch"
}

wizard_panel_blank() {
    wizard_panel_line ""
}

wizard_panel_title() {
    wizard_panel_line "${WIZARD_BOLD}${WIZARD_CYAN}${1}${WIZARD_RESET}"
}

wizard_panel_section() {
    wizard_panel_title "$1"
}

wizard_panel_heading() {
    wizard_panel_title "$1"
}

wizard_panel_kv() {
    local key=$1 val=$2
    wizard_panel_line "${WIZARD_DIM}${key}${WIZARD_RESET}  ${val}"
}

wizard_panel_menu_item() {
    local num=$1 title=$2 desc=$3
    wizard_panel_line "${WIZARD_CYAN}[${num}]${WIZARD_RESET} ${WIZARD_BOLD}${title}${WIZARD_RESET}  ${WIZARD_DIM}${desc}${WIZARD_RESET}"
}

wizard_panel_menu_short() {
    wizard_panel_line "$*"
}

wizard_panel_line_center() {
    wizard_panel_line "$1"
}

wizard_say() {
    echo -e "${WIZARD_CYAN}RiverEdge${WIZARD_RESET} ${WIZARD_DIM}›${WIZARD_RESET} $*"
    [ "${WIZARD_TYPING:-1}" = "1" ] && sleep 0.12
}

wizard_say_ok() {
    echo -e "  ${WIZARD_GREEN}✓${WIZARD_RESET} $*"
}

wizard_say_warn() {
    echo -e "  ${WIZARD_YELLOW}!${WIZARD_RESET} $*"
}

wizard_say_fail() {
    echo -e "  ${WIZARD_RED}✗${WIZARD_RESET} $*" >&2
}

wizard_stage() {
    WIZARD_CURRENT=$1
    echo ""
    wizard_panel_begin
    wizard_panel_top
    wizard_panel_line "${WIZARD_BOLD}STAGE ${1}/${WIZARD_TOTAL_STAGES}${WIZARD_RESET}  ${WIZARD_DIM}·${WIZARD_RESET}  $2"
    wizard_panel_bot
    echo ""
}

wizard_banner() {
    : # 首屏由 wizard_show_home_panel 统一绘制
}

wizard_host_mem_value() {
    if command -v free >/dev/null 2>&1; then
        free -h | awk '/^Mem:/ {printf "%s / %s", $3, $2}'
        return
    fi
    if is_windows_gitbash && command -v wmic >/dev/null 2>&1; then
        local mem
        mem="$(wmic OS get FreePhysicalMemory,TotalVisibleMemorySize /format:list 2>/dev/null | awk -F= '
            /^FreePhysicalMemory=/ { free=$2+0 }
            /^TotalVisibleMemorySize=/ { total=$2+0 }
            END {
                if (total > 0) printf "%.1fG / %.1fG", (total-free)/1048576, total/1048576
            }')"
        if [ -n "$mem" ]; then
            echo "$mem"
            return
        fi
    fi
    if is_windows_gitbash && command -v powershell.exe >/dev/null 2>&1; then
        powershell.exe -NoProfile -Command "
            \$os = Get-CimInstance Win32_OperatingSystem
            \$total = [math]::Round(\$os.TotalVisibleMemorySize/1MB, 1)
            \$used = [math]::Round((\$os.TotalVisibleMemorySize - \$os.FreePhysicalMemory)/1MB, 1)
            Write-Output (\"\${used}G / \${total}G\")
        " 2>/dev/null | tr -d '\r'
        return
    fi
    echo "—"
}

wizard_host_disk_value() {
    df -h "$PROJECT_ROOT" 2>/dev/null | awk 'NR==2 {printf "%s / %s (%s)", $3, $2, $5}' || echo "—"
}

wizard_git_value() {
    if ! command -v git >/dev/null 2>&1 || [ ! -d "$PROJECT_ROOT/.git" ]; then
        echo "—"
        return
    fi
    local branch head hint
    branch="$(git -C "$PROJECT_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?")"
    head="$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo "?")"
    hint="$(git_sync_status_hint 2>/dev/null || true)"
    echo "${branch} @ ${head}${hint}"
}

wizard_service_running() {
    local name=$1
    local pidf="$LOGS_DIR/${name}.pid"
    [ -f "$pidf" ] && kill -0 "$(cat "$pidf")" 2>/dev/null
}

wizard_service_badge() {
    local name=$1 label=${2:-$1}
    if wizard_service_running "$name"; then
        printf "${WIZARD_GREEN}●${WIZARD_RESET} %s  " "$label"
    else
        printf "${WIZARD_DIM}○${WIZARD_RESET} %s  " "$label"
    fi
}

wizard_access_urls() {
    local server_ip web_url api_hint
    server_ip="$(read_deploy_env_value SERVER_IP || true)"
    [ -n "$server_ip" ] || server_ip="$(detect_server_ip || true)"
    if [ -z "$server_ip" ]; then
        WIZARD_ACCESS_WEB="—"
        WIZARD_ACCESS_API="—"
        WIZARD_ACCESS_PLATFORM="—"
        return
    fi
    if [ "$DEPLOY_MODE" = "prod" ]; then
        web_url="$(resolve_prod_web_url "$server_ip")"
        api_hint="${web_url}/api"
    else
        web_url="http://${server_ip}:${FRONTEND_PORT}"
        api_hint="http://${server_ip}:${BACKEND_PORT}"
    fi
    WIZARD_ACCESS_WEB="$web_url"
    WIZARD_ACCESS_API="$api_hint"
    WIZARD_ACCESS_PLATFORM="${web_url}/infra"
}

wizard_prefetch_home_status() {
    local tmp
    tmp="$(mktemp -d 2>/dev/null || mktemp -d -t wizard)"
    wizard_host_mem_value >"$tmp/mem" 2>/dev/null &
    wizard_host_disk_value >"$tmp/disk" 2>/dev/null &
    wizard_git_value >"$tmp/git" 2>/dev/null &
    wait
    WIZARD_HOME_MEM="$(cat "$tmp/mem" 2>/dev/null || echo '—')"
    WIZARD_HOME_DISK="$(cat "$tmp/disk" 2>/dev/null || echo '—')"
    WIZARD_HOME_GIT="$(cat "$tmp/git" 2>/dev/null || echo '—')"
    rm -rf "$tmp"
}

wizard_show_home_panel() {
    local os_label arch mode_label mirror_label svc_line
    os_label="$(wizard_runtime_label)"
    arch="$(uname -m)"
    mode_label="$([ "$DEPLOY_MODE" = "dev" ] && echo "开发 dev" || echo "生产 prod")"
    mirror_label="$([ "$USE_MIRROR" = "1" ] && echo "国内镜像" || echo "官方源")"

    WIZARD_HOME_MEM='—'
    WIZARD_HOME_DISK='—'
    WIZARD_HOME_GIT='—'

    wizard_access_urls

    echo ""
    wizard_print_kuaige_header
    wizard_prefetch_home_status

    wizard_panel_begin
    wizard_panel_top
    wizard_show_official_repo_notice

    wizard_panel_heading "SYSTEM 系统"
    wizard_panel_line "${WIZARD_DIM}Host${WIZARD_RESET}  ${os_label} · ${arch}  ${WIZARD_DIM}Mode${WIZARD_RESET}  ${mode_label} · ${mirror_label}"
    wizard_panel_line "${WIZARD_DIM}Memory${WIZARD_RESET}  ${WIZARD_HOME_MEM:-—}  ${WIZARD_DIM}Disk${WIZARD_RESET}  ${WIZARD_HOME_DISK:-—}  ${WIZARD_DIM}Git${WIZARD_RESET}  ${WIZARD_HOME_GIT:-—}"
    wizard_panel_line "${WIZARD_DIM}LowSpec${WIZARD_RESET}  $(low_spec_mode_status_label)"

    wizard_panel_heading "SERVICES 服务"
    wizard_panel_line "${WIZARD_DIM}用户登录${WIZARD_RESET}  ${WIZARD_ACCESS_WEB:-—}  ${WIZARD_DIM}平台超管登录${WIZARD_RESET}  ${WIZARD_ACCESS_PLATFORM:-—}"
    svc_line="$(wizard_service_badge backend) $(wizard_service_badge worker)"
    if [ "$DEPLOY_MODE" = "dev" ]; then
        svc_line="${svc_line} $(wizard_service_badge frontend)"
    else
        svc_line="${svc_line} $(wizard_service_badge caddy)"
    fi
    wizard_panel_line "${WIZARD_DIM}Status${WIZARD_RESET}  ${svc_line}"

    wizard_panel_mid
    wizard_panel_section "DEPLOY 部署"
    wizard_panel_menu_item "1" "全新安装" "检测环境与依赖，完成配置后启动"
    wizard_panel_menu_item "2" "修改配置" "修改数据库、超管账号与访问地址"
    wizard_panel_menu_item "3" "更新系统" "fetch+reset 拉最新 → 迁移重启（低配固定传统部署）"
    wizard_panel_menu_item "4" "扩展应用" "专业包 / 定制包 / 移动端 H5（私有仓，需凭证）"
    wizard_panel_section "OPS 运维"
    wizard_panel_menu_item "5" "详情" "服务状态 · 基线依赖 · 特殊依赖（PDF/OCR/向量/敏感词）"
    wizard_panel_menu_short "${WIZARD_CYAN}[6]${WIZARD_RESET} 服务  ${WIZARD_CYAN}[7]${WIZARD_RESET} 开机自启  ${WIZARD_CYAN}[8]${WIZARD_RESET} 数据库迁移  ${WIZARD_CYAN}[9]${WIZARD_RESET} 低配模式  ${WIZARD_CYAN}[0]${WIZARD_RESET} 退出"
    wizard_panel_bot
    echo ""
}

wizard_show_system_status() {
    wizard_show_home_panel
}

wizard_show_main_menu() {
    : # 菜单已并入 wizard_show_home_panel
}

wizard_run_quick_action() {
    load_deploy_env
    case "$1" in
        start)
            if [ "$DEPLOY_MODE" = "dev" ]; then cmd_start_dev; else cmd_start_prod; fi
            ;;
        stop)
            if [ "$DEPLOY_MODE" = "dev" ]; then cmd_stop_dev; else cmd_stop_prod; fi
            ;;
        restart)
            if [ "$DEPLOY_MODE" = "dev" ]; then
                cmd_stop_dev
                cmd_start_dev
            else
                cmd_stop_prod
                cmd_start_prod
            fi
            ;;
        restart-frontend) cmd_restart_frontend ;;
        restart-backend) cmd_restart_backend ;;
        restart-worker) cmd_restart_worker ;;
        restart-postgres) cmd_restart_postgres ;;
        status) cmd_status ;;
        details) cmd_details ;;
        check) cmd_check ;;
        migrate) cmd_migrate ;;
        free-memory|free_memory) cmd_free_memory ;;
        setup-swap|setup_swap|swap) cmd_setup_swap ;;
        low-spec-mode|low_spec_mode|lowspec) cmd_low_spec_mode_cli "${2:-}" ;;
        *) wizard_say_fail "未知快捷操作: $1"; return 1 ;;
    esac
}

wizard_pause_return_menu() {
    echo ""
    read -rp "$(echo -e "${WIZARD_DIM}Enter 返回主菜单${WIZARD_RESET} › ")" _ || true
}

wizard_show_service_menu() {
    echo ""
    wizard_panel_begin
    wizard_panel_top
    wizard_panel_section "SERVICE 服务"
    wizard_panel_menu_item "1" "启动" "启动当前环境全部服务"
    wizard_panel_menu_item "2" "停止" "停止当前环境全部服务"
    wizard_panel_menu_item "3" "重启…" "全部或按组件重启"
    wizard_panel_line "${WIZARD_DIM}[0]${WIZARD_RESET} 返回主菜单"
    wizard_panel_bot
    echo ""
}

wizard_show_restart_menu() {
    echo ""
    wizard_panel_begin
    wizard_panel_top
    wizard_panel_section "RESTART 重启"
    wizard_panel_menu_item "1" "全部重启" "停止后启动当前环境全部服务"
    wizard_panel_menu_item "2" "重启前端" "开发 Vite，生产 Caddy"
    wizard_panel_menu_item "3" "重启后端" "API 服务"
    wizard_panel_menu_item "4" "重启 worker" "Taskiq Worker 与 Scheduler"
    wizard_panel_menu_item "5" "重启 PostgreSQL" "本机数据库服务"
    wizard_panel_line "${WIZARD_DIM}[0]${WIZARD_RESET} 返回上级"
    wizard_panel_bot
    echo ""
}

wizard_ext_repo_git_label() {
    local path="$1"
    if _git_is_work_tree "$path"; then
        git -C "$path" rev-parse --short HEAD 2>/dev/null || echo present
    else
        echo "未克隆"
    fi
}

wizard_ext_default_path() {
    # 参数: pro|custom|client → 打印本地路径
    case "$1" in
        pro)
            local p
            p="$(read_deploy_env_value PRO_REPO_PATH || true)"
            [ -n "$p" ] || p="$(cd "$PROJECT_ROOT/.." && pwd)/kuaigeyun-pro"
            echo "$p"
            ;;
        custom)
            local p
            p="$(read_deploy_env_value CUSTOM_REPO_PATH || true)"
            [ -n "$p" ] || p="$(cd "$PROJECT_ROOT/.." && pwd)/kuaigeyun-custom"
            echo "$p"
            ;;
        client|h5)
            local p
            p="$(read_deploy_env_value CLIENT_REPO_PATH || true)"
            [ -n "$p" ] || p="$(cd "$PROJECT_ROOT/.." && pwd)/kuaigeyun-client"
            echo "$p"
            ;;
        *)
            return 1
            ;;
    esac
}

wizard_ext_require_cloned() {
    # 更新前要求源仓已存在；参数: pro|custom|client 显示名
    local kind="$1" label="$2" path
    load_deploy_env
    path="$(wizard_ext_default_path "$kind")" || return 1
    if ! _git_is_work_tree "$path"; then
        wizard_say_warn "${label}尚未安装（源仓未克隆）。请先到「安装」完成首次部署。"
        return 1
    fi
    return 0
}

wizard_show_ext_status_lines() {
    local pro_path custom_path client_path pro_url custom_url client_url pro_en custom_en client_en
    load_deploy_env
    pro_path="$(wizard_ext_default_path pro)"
    custom_path="$(wizard_ext_default_path custom)"
    client_path="$(wizard_ext_default_path client)"
    pro_url="$(read_deploy_env_value PRO_REPO_URL || echo "${WIZARD_PRO_REPO_GITEE}.git")"
    custom_url="$(read_deploy_env_value CUSTOM_REPO_URL || echo "${WIZARD_CUSTOM_REPO_GITEE}.git")"
    client_url="$(read_deploy_env_value CLIENT_REPO_URL || echo "${WIZARD_CLIENT_REPO_GITEE}.git")"
    pro_en="$(read_deploy_env_value PRO_ENABLED || echo 0)"
    custom_en="$(read_deploy_env_value CUSTOM_ENABLED || echo 0)"
    client_en="$(read_deploy_env_value CLIENT_ENABLED || echo 0)"
    wizard_panel_kv "专业包" "$([ "$pro_en" = "1" ] && echo 已启用 || echo 未启用) · $(wizard_ext_repo_git_label "$pro_path")"
    wizard_panel_line "${WIZARD_DIM}  ${pro_url}${WIZARD_RESET}"
    wizard_panel_kv "定制包" "$([ "$custom_en" = "1" ] && echo 已启用 || echo 未启用) · $(wizard_ext_repo_git_label "$custom_path")"
    wizard_panel_line "${WIZARD_DIM}  ${custom_url}${WIZARD_RESET}"
    wizard_panel_kv "移动端 H5" "$([ "$client_en" = "1" ] && echo 已启用 || echo 未启用) · 源仓 $(wizard_ext_repo_git_label "$client_path") · $([ -f "$MOBILE_WEB_DIR/index.html" ] && echo 已部署 || echo 未部署)"
    wizard_panel_line "${WIZARD_DIM}  ${client_url}${WIZARD_RESET}"
}

wizard_show_pro_apps_menu() {
    echo ""
    wizard_panel_begin
    wizard_panel_top
    wizard_panel_section "EXT 扩展应用"
    wizard_show_ext_status_lines
    wizard_panel_blank
    wizard_panel_menu_item "1" "安装" "首次克隆并组装 / 部署（单项互不影响）"
    wizard_panel_menu_item "2" "更新" "拉取最新并重新组装 / 部署（单项互不影响）"
    wizard_panel_menu_item "3" "配置" "各仓 URL / 路径 / Token"
    wizard_panel_menu_item "4" "状态" "源仓摘要 + compose --status"
    wizard_panel_line "${WIZARD_DIM}[0]${WIZARD_RESET} 返回主菜单"
    wizard_panel_bot
    echo ""
}

wizard_show_ext_install_menu() {
    echo ""
    wizard_panel_begin
    wizard_panel_top
    wizard_panel_section "INSTALL 安装"
    wizard_panel_line "${WIZARD_DIM}三项独立；互不影响（H5 与专业/定制无绑定）${WIZARD_RESET}"
    wizard_panel_blank
    wizard_panel_menu_item "1" "专业包" "kuaigeyun-pro → compose"
    wizard_panel_menu_item "2" "定制包" "kuaigeyun-custom → compose"
    wizard_panel_menu_item "3" "移动端 H5" "拉 kuaigeyun-client → /mobile web-dist"
    wizard_panel_line "${WIZARD_DIM}[0]${WIZARD_RESET} 返回上级"
    wizard_panel_bot
    echo ""
}

wizard_show_ext_update_menu() {
    echo ""
    wizard_panel_begin
    wizard_panel_top
    wizard_panel_section "UPDATE 更新"
    wizard_panel_line "${WIZARD_DIM}三项独立；互不影响（H5 与专业/定制无绑定）${WIZARD_RESET}"
    wizard_panel_blank
    wizard_panel_menu_item "1" "专业包" "sync kuaigeyun-pro → compose"
    wizard_panel_menu_item "2" "定制包" "sync kuaigeyun-custom → compose"
    wizard_panel_menu_item "3" "移动端 H5" "sync client → 重新部署 web-dist"
    wizard_panel_line "${WIZARD_DIM}[0]${WIZARD_RESET} 返回上级"
    wizard_panel_bot
    echo ""
}

wizard_show_ext_config_menu() {
    echo ""
    wizard_panel_begin
    wizard_panel_top
    wizard_panel_section "CONFIG 配置"
    wizard_panel_blank
    wizard_panel_menu_item "1" "专业仓" "URL / 路径 / Token"
    wizard_panel_menu_item "2" "定制仓" "URL / 路径 / Token"
    wizard_panel_menu_item "3" "H5 仓" "URL / 路径 / Token"
    wizard_panel_line "${WIZARD_DIM}[0]${WIZARD_RESET} 返回上级"
    wizard_panel_bot
    echo ""
}

wizard_show_ext_status_menu() {
    echo ""
    wizard_panel_begin
    wizard_panel_top
    wizard_panel_section "STATUS 状态"
    wizard_show_ext_status_lines
    wizard_panel_blank
    wizard_panel_line "${WIZARD_DIM}下方为 workspace compose --status（未安装专业/定制时可能为空）${WIZARD_RESET}"
    wizard_panel_bot
    echo ""
}

wizard_show_boot_service_menu() {
    local status_label boot_name
    load_deploy_env
    status_label="$(boot_service_status_label)"
    if is_windows_gitbash; then
        boot_name="$WINDOWS_BOOT_TASK_NAME (计划任务)"
    else
        boot_name="riveredge.service"
    fi
    echo ""
    wizard_panel_begin
    wizard_panel_top
    wizard_panel_section "BOOT 开机自启"
    wizard_panel_kv "Service" "${boot_name}"
    wizard_panel_kv "Status" "${status_label}"
    wizard_panel_blank
    if boot_service_supported; then
        if is_boot_service_enabled; then
            wizard_panel_menu_item "1" "关闭开机自启" "disable 并移除自启配置"
        else
            wizard_panel_menu_item "1" "开启开机自启" "注册自启任务并 enable"
        fi
        if is_windows_gitbash; then
            wizard_panel_line "${WIZARD_DIM}Windows: 管理员=开机启动(SYSTEM)；普通用户=登录时启动${WIZARD_RESET}"
        fi
    else
        wizard_panel_line "${WIZARD_DIM}仅 Linux/Windows 生产模式支持开机自启${WIZARD_RESET}"
    fi
    wizard_panel_line "${WIZARD_DIM}[0]${WIZARD_RESET} 返回主菜单"
    wizard_panel_bot
    echo ""
}

wizard_ask_boot_service_choice() {
    local choice
    while true; do
        wizard_show_boot_service_menu
        if ! boot_service_supported; then
            wizard_pause_return_menu
            return 0
        fi
        wizard_panel_prefix
        echo -e "${WIZARD_BOLD}请选择${WIZARD_RESET} ${WIZARD_DIM}[0-1 · 默认 0]${WIZARD_RESET}"
        wizard_panel_prefix
        read -rp "$(echo -e "${WIZARD_DIM}›${WIZARD_RESET} ")" choice || true
        case "${choice:-0}" in
            0|q|Q|back)
                return 0
                ;;
            1)
                if is_boot_service_enabled; then
                    cmd_uninstall_service || true
                else
                    cmd_install_service || true
                fi
                wizard_pause_return_menu
                return 0
                ;;
            *)
                wizard_say_warn "无效选项，请重新选择"
                ;;
        esac
    done
}

wizard_ask_service_choice() {
    local choice
    while true; do
        wizard_show_service_menu
        wizard_panel_prefix
        echo -e "${WIZARD_BOLD}请选择${WIZARD_RESET} ${WIZARD_DIM}[0-3 · 默认 0]${WIZARD_RESET}"
        wizard_panel_prefix
        read -rp "$(echo -e "${WIZARD_DIM}›${WIZARD_RESET} ")" choice || true
        case "${choice:-0}" in
            0|q|Q|back)
                return 0
                ;;
            1)
                wizard_run_quick_action start || true
                wizard_pause_return_menu
                return 0
                ;;
            2)
                wizard_run_quick_action stop || true
                wizard_pause_return_menu
                return 0
                ;;
            3|restart)
                wizard_ask_restart_choice
                return 0
                ;;
            *)
                wizard_say_warn "无效选项，请重新选择"
                ;;
        esac
    done
}

wizard_ask_restart_choice() {
    local choice
    while true; do
        wizard_show_restart_menu
        wizard_panel_prefix
        echo -e "${WIZARD_BOLD}请选择${WIZARD_RESET} ${WIZARD_DIM}[0-5 · 默认 0]${WIZARD_RESET}"
        wizard_panel_prefix
        read -rp "$(echo -e "${WIZARD_DIM}›${WIZARD_RESET} ")" choice || true
        case "${choice:-0}" in
            0|q|Q|back)
                return 0
                ;;
            1)
                wizard_run_quick_action restart || true
                wizard_pause_return_menu
                return 0
                ;;
            2)
                wizard_run_quick_action restart-frontend || true
                wizard_pause_return_menu
                return 0
                ;;
            3)
                wizard_run_quick_action restart-backend || true
                wizard_pause_return_menu
                return 0
                ;;
            4)
                wizard_run_quick_action restart-worker || true
                wizard_pause_return_menu
                return 0
                ;;
            5)
                wizard_run_quick_action restart-postgres || true
                wizard_pause_return_menu
                return 0
                ;;
            *)
                wizard_say_warn "无效选项，请重新选择"
                ;;
        esac
    done
}

wizard_reload_deploy_libs() {
    # 菜单 [4] 可能在 [3] 更新后执行；须读磁盘脚本，避免仍用启动时装入的旧 sync_sibling_git_repo
    # shellcheck source=/dev/null
    source "$PROJECT_ROOT/fast-deploy/lib/common.sh"
    load_deploy_env
}

wizard_run_ext_pro() {
    echo ""
    wizard_reload_deploy_libs
    if cmd_install_extension_apps pro; then
        wizard_say_ok "专业包已同步并组装。应用中心仍需 License Key；请重启服务后同步菜单。"
        return 0
    fi
    wizard_say_warn "专业包安装/更新失败（见上方日志）。常见原因：Token、分支、PyYAML、compose 源目录缺失。"
    return 1
}

wizard_run_ext_custom() {
    echo ""
    wizard_reload_deploy_libs
    if cmd_install_extension_apps custom; then
        wizard_say_ok "定制包已同步并组装。请重启服务后同步菜单；租户侧按需启用应用。"
        return 0
    fi
    wizard_say_warn "定制包安装/更新失败（见上方日志）。常见原因：Token、分支、PyYAML、compose 源目录缺失。"
    return 1
}

wizard_run_ext_h5() {
    echo ""
    wizard_reload_deploy_libs
    if cmd_install_client_repo; then
        wizard_say_ok "移动端 H5 已同步并部署到 riveredge-app/mobile/web-dist（Caddy /mobile）。生产环境请再执行 start/update 以刷新网关。"
        return 0
    fi
    wizard_say_warn "移动端 H5 安装/更新失败（见上方日志）。需私仓中已有 web-dist，或先执行 build.mobile.web.sh。"
    return 1
}

wizard_ask_ext_install_choice() {
    local choice
    while true; do
        wizard_show_ext_install_menu
        wizard_panel_prefix
        echo -e "${WIZARD_BOLD}请选择${WIZARD_RESET} ${WIZARD_DIM}[0-3 · 默认 0]${WIZARD_RESET}"
        wizard_panel_prefix
        read -rp "$(echo -e "${WIZARD_DIM}›${WIZARD_RESET} ")" choice || true
        case "${choice:-0}" in
            0|q|Q|back) return 0 ;;
            1)
                wizard_run_ext_pro
                wizard_pause_return_menu
                return 0
                ;;
            2)
                wizard_run_ext_custom
                wizard_pause_return_menu
                return 0
                ;;
            3)
                wizard_run_ext_h5
                wizard_pause_return_menu
                return 0
                ;;
            *) wizard_say_warn "无效选项，请重新选择" ;;
        esac
    done
}

wizard_ask_ext_update_choice() {
    local choice
    while true; do
        wizard_show_ext_update_menu
        wizard_panel_prefix
        echo -e "${WIZARD_BOLD}请选择${WIZARD_RESET} ${WIZARD_DIM}[0-3 · 默认 0]${WIZARD_RESET}"
        wizard_panel_prefix
        read -rp "$(echo -e "${WIZARD_DIM}›${WIZARD_RESET} ")" choice || true
        case "${choice:-0}" in
            0|q|Q|back) return 0 ;;
            1)
                wizard_ext_require_cloned pro "专业包" || { wizard_pause_return_menu; return 0; }
                wizard_run_ext_pro
                wizard_pause_return_menu
                return 0
                ;;
            2)
                wizard_ext_require_cloned custom "定制包" || { wizard_pause_return_menu; return 0; }
                wizard_run_ext_custom
                wizard_pause_return_menu
                return 0
                ;;
            3)
                wizard_ext_require_cloned client "移动端 H5" || { wizard_pause_return_menu; return 0; }
                wizard_run_ext_h5
                wizard_pause_return_menu
                return 0
                ;;
            *) wizard_say_warn "无效选项，请重新选择" ;;
        esac
    done
}

wizard_ask_ext_config_choice() {
    local choice
    while true; do
        wizard_show_ext_config_menu
        wizard_panel_prefix
        echo -e "${WIZARD_BOLD}请选择${WIZARD_RESET} ${WIZARD_DIM}[0-3 · 默认 0]${WIZARD_RESET}"
        wizard_panel_prefix
        read -rp "$(echo -e "${WIZARD_DIM}›${WIZARD_RESET} ")" choice || true
        case "${choice:-0}" in
            0|q|Q|back) return 0 ;;
            1)
                wizard_configure_pro_repo || true
                wizard_pause_return_menu
                return 0
                ;;
            2)
                wizard_configure_custom_repo || true
                wizard_pause_return_menu
                return 0
                ;;
            3)
                wizard_configure_client_repo || true
                wizard_pause_return_menu
                return 0
                ;;
            *) wizard_say_warn "无效选项，请重新选择" ;;
        esac
    done
}

wizard_ask_ext_status_choice() {
    wizard_show_ext_status_menu
    echo ""
    cmd_pro_apps_status || true
    wizard_pause_return_menu
    return 0
}

wizard_ask_pro_apps_choice() {
    local choice
    while true; do
        wizard_show_pro_apps_menu
        wizard_panel_prefix
        echo -e "${WIZARD_BOLD}请选择${WIZARD_RESET} ${WIZARD_DIM}[0-4 · 默认 0]${WIZARD_RESET}"
        wizard_panel_prefix
        read -rp "$(echo -e "${WIZARD_DIM}›${WIZARD_RESET} ")" choice || true
        case "${choice:-0}" in
            0|q|Q|back)
                return 0
                ;;
            1)
                wizard_ask_ext_install_choice
                ;;
            2)
                wizard_ask_ext_update_choice
                ;;
            3)
                wizard_ask_ext_config_choice
                ;;
            4)
                wizard_ask_ext_status_choice
                ;;
            *)
                wizard_say_warn "无效选项，请重新选择"
                ;;
        esac
    done
}

wizard_prompt_git_token() {
    # 用法: wizard_prompt_git_token <当前值> <提示前缀> → 结果写入 REPLY
    local cur_token="$1" label="$2" input=""
    if [ -n "$cur_token" ]; then
        read -rsp "$(echo -e "${WIZARD_DIM}${label} Token [已配置，回车保留]${WIZARD_RESET} › ")" input || true
        echo ""
        if [ -n "${input:-}" ]; then
            REPLY="$input"
        else
            REPLY="$cur_token"
        fi
    else
        read -rsp "$(echo -e "${WIZARD_DIM}${label} Token（HTTPS 私仓；SSH 可留空）${WIZARD_RESET} › ")" input || true
        echo ""
        REPLY="${input:-}"
    fi
}

wizard_configure_pro_repo() {
    load_deploy_env
    local cur_url cur_path cur_branch cur_token input
    cur_url="$(read_deploy_env_value PRO_REPO_URL || echo "${WIZARD_PRO_REPO_GITEE}.git")"
    cur_path="$(read_deploy_env_value PRO_REPO_PATH || true)"
    [ -n "$cur_path" ] || cur_path="$(cd "$PROJECT_ROOT/.." && pwd)/kuaigeyun-pro"
    cur_branch="$(read_deploy_env_value PRO_GIT_BRANCH || echo develop)"
    cur_token="$(read_deploy_env_value PRO_GIT_TOKEN || true)"

    echo ""
    wizard_say "配置专业仓 → fast-deploy/config/deploy.env（勿提交 Token）"
    read -rp "$(echo -e "${WIZARD_DIM}仓库 URL [${cur_url}]${WIZARD_RESET} › ")" input || true
    [ -n "${input:-}" ] && cur_url="$input"
    read -rp "$(echo -e "${WIZARD_DIM}本地路径 [${cur_path}]${WIZARD_RESET} › ")" input || true
    [ -n "${input:-}" ] && cur_path="$input"
    read -rp "$(echo -e "${WIZARD_DIM}分支 [${cur_branch}，须与私仓 develop 一致]${WIZARD_RESET} › ")" input || true
    [ -n "${input:-}" ] && cur_branch="$input"
    [ -n "$cur_branch" ] || cur_branch="develop"
    wizard_prompt_git_token "$cur_token" "专业仓"
    cur_token="$REPLY"

    set_deploy_env_value PRO_REPO_URL "$cur_url"
    set_deploy_env_value PRO_REPO_PATH "$cur_path"
    set_deploy_env_value PRO_GIT_BRANCH "$cur_branch"
    set_deploy_env_value PRO_GIT_TOKEN "$cur_token"
    [ -n "$(read_deploy_env_value WORKSPACE_COMPOSE_MODE || true)" ] \
        || set_deploy_env_value WORKSPACE_COMPOSE_MODE "copy"
    wizard_say_ok "专业仓配置已保存（安装时再标记 PRO_ENABLED=1）"
}

wizard_configure_custom_repo() {
    load_deploy_env
    local cur_url cur_path cur_branch cur_token input
    cur_url="$(read_deploy_env_value CUSTOM_REPO_URL || echo "${WIZARD_CUSTOM_REPO_GITEE}.git")"
    cur_path="$(read_deploy_env_value CUSTOM_REPO_PATH || true)"
    [ -n "$cur_path" ] || cur_path="$(cd "$PROJECT_ROOT/.." && pwd)/kuaigeyun-custom"
    cur_branch="$(read_deploy_env_value CUSTOM_GIT_BRANCH || echo develop)"
    cur_token="$(read_deploy_env_value CUSTOM_GIT_TOKEN || true)"
    [ -n "$cur_token" ] || cur_token="$(read_deploy_env_value PRO_GIT_TOKEN || true)"

    echo ""
    wizard_say "配置定制仓 → fast-deploy/config/deploy.env（勿提交 Token）"
    read -rp "$(echo -e "${WIZARD_DIM}仓库 URL [${cur_url}]${WIZARD_RESET} › ")" input || true
    [ -n "${input:-}" ] && cur_url="$input"
    read -rp "$(echo -e "${WIZARD_DIM}本地路径 [${cur_path}]${WIZARD_RESET} › ")" input || true
    [ -n "${input:-}" ] && cur_path="$input"
    read -rp "$(echo -e "${WIZARD_DIM}分支 [${cur_branch}，须与私仓 develop 一致]${WIZARD_RESET} › ")" input || true
    [ -n "${input:-}" ] && cur_branch="$input"
    [ -n "$cur_branch" ] || cur_branch="develop"
    wizard_prompt_git_token "$cur_token" "定制仓"
    cur_token="$REPLY"

    set_deploy_env_value CUSTOM_REPO_URL "$cur_url"
    set_deploy_env_value CUSTOM_REPO_PATH "$cur_path"
    set_deploy_env_value CUSTOM_GIT_BRANCH "$cur_branch"
    set_deploy_env_value CUSTOM_GIT_TOKEN "$cur_token"
    [ -n "$(read_deploy_env_value WORKSPACE_COMPOSE_MODE || true)" ] \
        || set_deploy_env_value WORKSPACE_COMPOSE_MODE "copy"
    wizard_say_ok "定制仓配置已保存（安装时再标记 CUSTOM_ENABLED=1）"
}

wizard_configure_client_repo() {
    load_deploy_env
    local cur_url cur_path cur_branch cur_token input
    cur_url="$(read_deploy_env_value CLIENT_REPO_URL || echo "${WIZARD_CLIENT_REPO_GITEE}.git")"
    cur_path="$(read_deploy_env_value CLIENT_REPO_PATH || true)"
    [ -n "$cur_path" ] || cur_path="$(cd "$PROJECT_ROOT/.." && pwd)/kuaigeyun-client"
    cur_branch="$(read_deploy_env_value CLIENT_GIT_BRANCH || echo develop)"
    cur_token="$(read_deploy_env_value CLIENT_GIT_TOKEN || true)"
    [ -n "$cur_token" ] || cur_token="$(read_deploy_env_value PRO_GIT_TOKEN || true)"

    echo ""
    wizard_say "配置移动端 H5 源仓（kuaigeyun-client）→ fast-deploy/config/deploy.env（勿提交 Token）"
    read -rp "$(echo -e "${WIZARD_DIM}仓库 URL [${cur_url}]${WIZARD_RESET} › ")" input || true
    [ -n "${input:-}" ] && cur_url="$input"
    read -rp "$(echo -e "${WIZARD_DIM}本地路径 [${cur_path}]${WIZARD_RESET} › ")" input || true
    [ -n "${input:-}" ] && cur_path="$input"
    read -rp "$(echo -e "${WIZARD_DIM}分支 [${cur_branch}，须与私仓 develop 一致]${WIZARD_RESET} › ")" input || true
    [ -n "${input:-}" ] && cur_branch="$input"
    [ -n "$cur_branch" ] || cur_branch="develop"
    wizard_prompt_git_token "$cur_token" "H5 仓"
    cur_token="$REPLY"

    set_deploy_env_value CLIENT_REPO_URL "$cur_url"
    set_deploy_env_value CLIENT_REPO_PATH "$cur_path"
    set_deploy_env_value CLIENT_GIT_BRANCH "$cur_branch"
    set_deploy_env_value CLIENT_GIT_TOKEN "$cur_token"
    wizard_say_ok "H5 仓配置已保存（安装时再标记 CLIENT_ENABLED=1）"
}

wizard_prompt_choice() {
    wizard_panel_prefix
    echo -e "${WIZARD_BOLD}请选择${WIZARD_RESET} ${WIZARD_DIM}[0-9 · 默认 1]${WIZARD_RESET}"
    wizard_panel_prefix
    read -rp "$(echo -e "${WIZARD_DIM}›${WIZARD_RESET} ")" choice || true
    REPLY="${choice:-1}"
}

wizard_intent_label() {
    case "${WIZARD_INTENT:-fresh}" in
        configure) echo "修改配置" ;;
        update) echo "更新系统" ;;
        *) echo "全新安装" ;;
    esac
}

wizard_ask_intent_hint() {
    case "${WIZARD_INTENT:-fresh}" in
        configure)
            wizard_say "将逐项展示当前配置，回车保持原值（密码可回车跳过）"
            ;;
        update)
            wizard_say "将执行与 ./fast-deploy/deploy.sh update 相同的流程（仅主仓 fetch+reset、迁移并重启；扩展/H5 请用菜单 [4]）"
            ;;
        *)
            wizard_say "阶段 2 填写数据库、超管账号、访问 IP/域名 后，其余步骤将自动执行"
            ;;
    esac
}

wizard_ask_intent() {
    if [ -n "${WIZARD_INTENT:-}" ]; then
        wizard_say_ok "操作: $(wizard_intent_label)"
        wizard_ask_intent_hint
        return 0
    fi

    wizard_show_main_menu
    wizard_prompt_choice
    local choice="$REPLY"
    case "${choice:-1}" in
        0|q|Q|exit)
            wizard_say "已退出。"
            exit 0
            ;;
        2|config|configure) export WIZARD_INTENT=configure ;;
        3|update) export WIZARD_INTENT=update ;;
        4|pro|pro-apps|ext|ext-apps)
            wizard_ask_pro_apps_choice
            return 2
            ;;
        5|details|status)
            echo ""
            wizard_run_quick_action details || true
            wizard_pause_return_menu
            return 2
            ;;
        6|service|svc)
            wizard_ask_service_choice
            return 2
            ;;
        7|boot|autostart)
            wizard_ask_boot_service_choice
            return 2
            ;;
        8|migrate)
            echo ""
            wizard_run_quick_action migrate || true
            wizard_pause_return_menu
            return 2
            ;;
        9|low-spec-mode|low_spec_mode|lowspec|mem)
            echo ""
            cmd_low_spec_mode || true
            wizard_pause_return_menu
            return 2
            ;;
        1|fresh|"") export WIZARD_INTENT=fresh ;;
        *)
            wizard_say_warn "无效选项，请重新选择"
            sleep 0.4
            return 2
            ;;
    esac
    wizard_say_ok "已选择: $(wizard_intent_label)"
    wizard_ask_intent_hint
    return 0
}

wizard_runtime_label() {
    if is_windows_gitbash; then
        echo "Windows (Git Bash)"
        return
    fi
    case "$(uname -s)" in
        Darwin*) echo "macOS" ;;
        Linux*)
            if [ -f /etc/os-release ]; then
                # shellcheck disable=SC1091
                . /etc/os-release
                echo "${PRETTY_NAME:-Linux}"
            else
                echo "Linux"
            fi
            ;;
        *) echo "$(uname -s)" ;;
    esac
}

wizard_detect_system() {
    local os_label arch mode_label mirror_label
    os_label="$(wizard_runtime_label)"
    arch="$(uname -m)"
    mode_label="$([ "$DEPLOY_MODE" = "dev" ] && echo "开发 (dev)" || echo "生产 (prod)")"
    mirror_label="$([ "$USE_MIRROR" = "1" ] && echo "已启用国内镜像" || echo "官方源")"

    wizard_say "正在识别运行环境..."
    wizard_say_ok "操作系统: ${os_label}"
    if [ "$(uname -s)" = "Linux" ] && [ -f /etc/os-release ]; then
        wizard_say_ok "Linux 平台: $(get_install_platform_key)"
    fi
    wizard_say_ok "CPU 架构: ${arch}"
    wizard_say_ok "部署模式: ${mode_label}"
    wizard_say_ok "软件源: ${mirror_label}"
    wizard_say_ok "项目路径: ${PROJECT_ROOT}"
}

wizard_ask_mode() {
    if [ "${WIZARD_MODE_LOCKED:-0}" = "1" ]; then
        return 0
    fi
    wizard_say "请选择本次部署模式："
    echo "    1) 生产环境 — 构建静态前端 + Caddy 反代"
    echo "    2) 开发环境 — Vite 热重载 + 后端 reload"
    local choice
    read -rp "$(echo -e "${WIZARD_CYAN}RiverEdge${WIZARD_RESET} ${WIZARD_DIM}›${WIZARD_RESET} 输入 1 或 2 [默认 1]: ")" choice
    case "${choice:-1}" in
        2|dev) export DEPLOY_MODE=dev ;;
        *) export DEPLOY_MODE=prod ;;
    esac
    wizard_say_ok "已选择: $([ "$DEPLOY_MODE" = "dev" ] && echo "开发模式" || echo "生产模式")"
}

wizard_report_component() {
    local name=$1 status=$2
    case "$status" in
        ok) wizard_say_ok "${name} — 就绪" ;;
        missing) wizard_say_warn "${name} — 未安装" ;;
        installing) wizard_say_warn "${name} — 后台补装进行中" ;;
        skipped) wizard_say_ok "${name} — 已禁用补装 (PLAYWRIGHT_POSTINSTALL_ENABLE=0)" ;;
        disabled-present) wizard_say_ok "${name} — 补装已关，浏览器仍在" ;;
        disabled-missing) wizard_say_warn "${name} — 补装已关且浏览器未装" ;;
        old:*) wizard_say_warn "${name} — 版本 ${status#old:}，需要升级" ;;
        *) wizard_say_warn "${name} — ${status}" ;;
    esac
}

wizard_env_scan() {
    local failed=0 st
    wizard_say "正在扫描基线依赖..."
    st="$(check_node)"; wizard_report_component "Node.js 22+" "$st"; [ "$st" = "ok" ] || failed=1
    st="$(check_python)"; wizard_report_component "Python 3.12+" "$st"; [ "$st" = "ok" ] || failed=1
    st="$(check_uv)"; wizard_report_component "uv" "$st"; [ "$st" = "ok" ] || failed=1
    st="$(check_npm)"; wizard_report_component "npm 10+" "$st"; [ "$st" = "ok" ] || failed=1
    if db_target_is_remote; then
        wizard_say_ok "PostgreSQL — 远程模式，跳过本地安装检测"
        st="$(check_postgres_deploy)"
        if [ "$st" = "ok" ]; then
            wizard_say_ok "远程数据库连接 — 正常"
        else
            wizard_say_warn "远程数据库连接 — 失败，请检查阶段 2 的配置"
            failed=1
        fi
    else
        st="$(check_postgres)"; wizard_report_component "PostgreSQL 15+" "$st"; [ "$st" = "ok" ] || failed=1
    fi
    if [ "$DEPLOY_MODE" = "prod" ]; then
        st="$(check_caddy)"; wizard_report_component "Caddy" "$st"; [ "$st" = "ok" ] || failed=1
    fi
    if [ "$failed" -eq 0 ]; then
        wizard_say_ok "基线依赖检测通过"
    else
        wizard_say "部分基线依赖尚未就绪，下一阶段将自动安装"
    fi
    wizard_say "特殊依赖（Playwright / 发票 OCR / pgvector / 敏感词）安装时仍会处理，状态见菜单 [5] 详情"
    return $failed
}

wizard_read_password_twice() {
    local prompt=$1 p1 p2
    read -rsp "${prompt}: " p1; echo >&2
    read -rsp "再次确认: " p2; echo >&2
    if [ "$p1" != "$p2" ]; then
        wizard_say_fail "两次密码不一致"
        return 1
    fi
    if [ ${#p1} -lt 1 ]; then
        wizard_say_fail "密码不能为空"
        return 1
    fi
    printf '%s' "$p1"
}

wizard_collect_local_db_config() {
    local db_user db_name db_port db_pass input
    set_env_value DB_TARGET "local"
    set_env_value DB_HOST "localhost"

    db_user="$(read_env_value DB_USER || true)"
    [ -z "$db_user" ] && db_user="postgres"
    wizard_say "本地安装将创建/使用该 PostgreSQL 用户（建议 postgres）"
    read -rp "$(echo -e "${WIZARD_CYAN}RiverEdge${WIZARD_RESET} ${WIZARD_DIM}›${WIZARD_RESET} PostgreSQL 用户名 [${db_user}]: ")" input
    db_user="${input:-$db_user}"
    set_env_value DB_USER "$db_user"

    db_port="$(read_env_value DB_PORT || true)"
    [ -z "$db_port" ] && db_port="$(detect_postgres_port)"
    read -rp "$(echo -e "${WIZARD_CYAN}RiverEdge${WIZARD_RESET} ${WIZARD_DIM}›${WIZARD_RESET} PostgreSQL 端口 [${db_port}]: ")" input
    db_port="${input:-$db_port}"
    set_env_value DB_PORT "$db_port"

    db_name="$(read_env_value DB_NAME || true)"
    [ -z "$db_name" ] && db_name="riveredge"
    read -rp "$(echo -e "${WIZARD_CYAN}RiverEdge${WIZARD_RESET} ${WIZARD_DIM}›${WIZARD_RESET} 数据库名 [${db_name}]: ")" input
    db_name="${input:-$db_name}"
    set_env_value DB_NAME "$db_name"

    wizard_say "请预先设定数据库密码（安装 PostgreSQL 后将自动应用，无需事后再改）"
    db_pass="$(wizard_read_password_twice "PostgreSQL 密码")" || return 1
    set_env_value DB_PASSWORD "$db_pass"
    if ! env_value_nonempty DB_PASSWORD; then
        wizard_say_fail "数据库密码未能写入 ${ENV_FILE}，请确认 riveredge-backend 目录可写"
        return 1
    fi
    wizard_say_ok "本地库规划: ${db_user}@localhost:${db_port}/${db_name}"
}

wizard_collect_remote_db_config() {
    local db_host db_port db_user db_name db_pass input
    set_env_value DB_TARGET "remote"

    db_host="$(read_env_value DB_HOST || true)"
    read -rp "$(echo -e "${WIZARD_CYAN}RiverEdge${WIZARD_RESET} ${WIZARD_DIM}›${WIZARD_RESET} 远程 PostgreSQL 主机 (IP/域名): ")" db_host
    [ -n "$db_host" ] || { wizard_say_fail "主机不能为空"; return 1; }
    set_env_value DB_HOST "$db_host"

    db_port="$(read_env_value DB_PORT || true)"
    [ -z "$db_port" ] && db_port="5432"
    read -rp "$(echo -e "${WIZARD_CYAN}RiverEdge${WIZARD_RESET} ${WIZARD_DIM}›${WIZARD_RESET} 端口 [${db_port}]: ")" input
    db_port="${input:-$db_port}"
    set_env_value DB_PORT "$db_port"

    db_user="$(read_env_value DB_USER || true)"
    [ -z "$db_user" ] && db_user="postgres"
    read -rp "$(echo -e "${WIZARD_CYAN}RiverEdge${WIZARD_RESET} ${WIZARD_DIM}›${WIZARD_RESET} 用户名 [${db_user}]: ")" input
    db_user="${input:-$db_user}"
    set_env_value DB_USER "$db_user"

    db_name="$(read_env_value DB_NAME || true)"
    [ -z "$db_name" ] && db_name="riveredge"
    read -rp "$(echo -e "${WIZARD_CYAN}RiverEdge${WIZARD_RESET} ${WIZARD_DIM}›${WIZARD_RESET} 数据库名 [${db_name}]: ")" input
    db_name="${input:-$db_name}"
    set_env_value DB_NAME "$db_name"

    db_pass="$(wizard_read_password_twice "PostgreSQL 密码")" || return 1
    set_env_value DB_PASSWORD "$db_pass"
    if ! env_value_nonempty DB_PASSWORD; then
        wizard_say_fail "数据库密码未能写入 ${ENV_FILE}，请确认 riveredge-backend 目录可写"
        return 1
    fi

    wizard_say "正在测试远程数据库连接..."
    if test_db_connection; then
        wizard_say_ok "远程库连接成功: ${db_user}@${db_host}:${db_port}/${db_name}"
    else
        wizard_say_fail "远程库连接失败，请检查地址、端口、账号与密码"
        return 1
    fi
}

wizard_collect_admin_config() {
    local admin_user admin_pass input
    admin_user="$(read_env_value PLATFORM_SUPERADMIN_USERNAME || true)"
    [ -z "$admin_user" ] && admin_user="infra_admin"
    wizard_say "请设定平台超级管理员（首次登录使用）"
    read -rp "$(echo -e "${WIZARD_CYAN}RiverEdge${WIZARD_RESET} ${WIZARD_DIM}›${WIZARD_RESET} 超管用户名 [${admin_user}]: ")" input
    admin_user="${input:-$admin_user}"
    set_env_value PLATFORM_SUPERADMIN_USERNAME "$admin_user"

    admin_pass="$(wizard_read_password_twice "超管密码（至少 8 位）")" || return 1
    if [ ${#admin_pass} -lt 8 ]; then
        wizard_say_fail "超管密码至少 8 位"
        return 1
    fi
    set_env_value PLATFORM_SUPERADMIN_PASSWORD "$admin_pass"
    if ! env_value_nonempty PLATFORM_SUPERADMIN_PASSWORD; then
        wizard_say_fail "超管密码未能写入 ${ENV_FILE}，请确认 riveredge-backend 目录可写"
        return 1
    fi
    wizard_say_ok "超管账号: ${admin_user}（密码已写入 .env）"
}

wizard_collect_server_access() {
    local detected_ip server_ip input choice
    load_deploy_env
    detected_ip="$(detect_server_ip)"
    server_ip="$(read_deploy_env_value SERVER_IP || true)"

    wizard_say "浏览器访问本系统时使用的服务器 IP"
    echo "    已检测: ${detected_ip}"
    if [ -n "$server_ip" ] && [ "$server_ip" != "$detected_ip" ]; then
        echo "    已配置: ${server_ip}"
    fi
    echo ""
    echo "    1) 使用检测到的 IP (${detected_ip})"
    echo "    2) 手动输入"
    read -rp "$(echo -e "${WIZARD_CYAN}RiverEdge${WIZARD_RESET} ${WIZARD_DIM}›${WIZARD_RESET} 请选择 [1/2] (默认 1): ")" choice
    case "${choice:-1}" in
        2|manual|input)
            read -rp "$(echo -e "${WIZARD_CYAN}RiverEdge${WIZARD_RESET} ${WIZARD_DIM}›${WIZARD_RESET} 请输入服务器 IP: ")" input
            input="$(echo "$input" | tr -d '[:space:]')"
            if [ -z "$input" ]; then
                wizard_say_fail "服务器 IP 不能为空"
                return 1
            fi
            server_ip="$input"
            ;;
        *)
            server_ip="$detected_ip"
            ;;
    esac
    set_deploy_env_value SERVER_IP "$server_ip"
    if [ "$DEPLOY_MODE" = "prod" ]; then
        echo ""
        wizard_say "配置生产域名与 HTTPS（可选）"
        collect_prod_domain_https_config || return 1
        wizard_say_ok "Web 访问: $(resolve_prod_web_url "$server_ip")"
    else
        wizard_say_ok "Web 访问: http://${server_ip}:${FRONTEND_PORT}"
    fi
}

wizard_plan_database() {
    wizard_say "在安装依赖之前，请先确定数据库部署方式："
    echo "    1) 本地安装 PostgreSQL — 本机安装 PG15，使用你此刻指定的账号/密码/库名"
    echo "    2) 使用远程数据库 — 跳过本地 PostgreSQL 安装，连接已有库"
    local mode
    read -rp "$(echo -e "${WIZARD_CYAN}RiverEdge${WIZARD_RESET} ${WIZARD_DIM}›${WIZARD_RESET} 请选择 [1/2] (默认 1): ")" mode
    mode="${mode:-1}"
    case "$mode" in
        2|remote)
            wizard_say "已选择: 远程数据库（将跳过本地 PostgreSQL 安装）"
            wizard_collect_remote_db_config || exit 1
            ;;
        *)
            wizard_say "已选择: 本地安装 PostgreSQL"
            wizard_collect_local_db_config || exit 1
            ;;
    esac
    wizard_say_ok "数据库规划已保存"
}

wizard_show_existing_env_summary() {
    local db_target db_host db_port db_name db_user admin_user
    db_target="$(read_env_value DB_TARGET || true)"
    db_host="$(read_env_value DB_HOST || true)"
    db_port="$(read_env_value DB_PORT || true)"
    db_name="$(read_env_value DB_NAME || true)"
    db_user="$(read_env_value DB_USER || true)"
    admin_user="$(read_env_value PLATFORM_SUPERADMIN_USERNAME || true)"
    [ -z "$admin_user" ] && admin_user="infra_admin"
    if [ "$db_target" = "remote" ]; then
        echo "    数据库: 远程 ${db_user}@${db_host}:${db_port}/${db_name}"
    else
        echo "    数据库: 本地 ${db_user}@${db_host:-localhost}:${db_port}/${db_name}"
    fi
    echo "    超管: ${admin_user}"
}

wizard_plan_preinstall() {
    ensure_env_file
    load_deploy_env

    if db_config_complete && admin_config_complete; then
        wizard_say "检测到 riveredge-backend/.env 中已有完整配置："
        wizard_show_existing_env_summary
        echo ""
        echo "    1) 使用已有配置继续"
        echo "    2) 重新填写数据库与超管"
        local choice
        read -rp "$(echo -e "${WIZARD_CYAN}RiverEdge${WIZARD_RESET} ${WIZARD_DIM}›${WIZARD_RESET} 请选择 [1/2] (默认 1): ")" choice
        case "${choice:-1}" in
            2|reconfig|new)
                wizard_say "将重新填写安装规划..."
                ;;
            *)
                wizard_say_ok "已使用已有 .env 配置"
                echo ""
                wizard_collect_server_access || exit 1
                wizard_say_ok "安装规划已全部保存，后续将自动安装，无需再输入"
                return 0
                ;;
        esac
    fi

    wizard_plan_database
    echo ""
    wizard_collect_admin_config || exit 1
    echo ""
    wizard_collect_server_access || exit 1
    wizard_say_ok "安装规划已全部保存，后续将自动安装，无需再输入"
}

wizard_finalize_local_database() {
    db_target_is_remote && return 0
    wizard_say "正在按预先指定的账号初始化本地 PostgreSQL..."
    if postgres_bootstrap_local; then
        wizard_say_ok "本地数据库已就绪"
        return 0
    fi
    wizard_say_fail "本地数据库初始化失败"
    return 1
}

wizard_prepare_env() {
    wizard_say "本阶段将完成以下准备："
    echo "    · 创建日志目录"
    echo "    · 加载或生成 deploy.env"
    if [ "${USE_MIRROR}" = "1" ]; then
        echo "    · 启用国内镜像 (uv / npm)"
    fi
    wizard_say "开始执行..."
    ensure_logs_dir
    load_deploy_env
    apply_cn_mirrors
    if [ ! -f "$DEPLOY_ENV_FILE" ] && [ -f "$DEPLOY_ENV_EXAMPLE" ]; then
        cp "$DEPLOY_ENV_EXAMPLE" "$DEPLOY_ENV_FILE"
        wizard_say_ok "已创建 deploy.env"
    fi
    wizard_say_ok "日志目录: ${LOGS_DIR}"
    wizard_say_ok "部署配置: ${DEPLOY_ENV_FILE}"
    wizard_say_ok "环境准备已完成"
}

wizard_component_display_name() {
    case "$1" in
        node) echo "Node.js 22+" ;;
        python) echo "Python 3.12+" ;;
        uv) echo "uv" ;;
        postgresql) echo "PostgreSQL 15+" ;;
        caddy) echo "Caddy" ;;
        zbar|invoice-runtime) echo "发票解析系统库 (zbar+libgomp)" ;;
        *) echo "$1" ;;
    esac
}

wizard_install_reason() {
    local st=$1
    case "$st" in
        missing) echo "未安装" ;;
        old:*) echo "当前 ${st#old:}，需升级" ;;
        *) echo "$st" ;;
    esac
}

wizard_install_method_hint() {
    local plat
    plat="$(get_install_platform_key 2>/dev/null || echo linux)"
    case "$1" in
        node|python)
            case "$plat" in
                rhel|fedora) echo "NodeSource / dnf 官方源 + 国内备用" ;;
                debian|ubuntu22) echo "NodeSource / apt 官方源 + 国内备用" ;;
                *) echo "官方源安装" ;;
            esac
            ;;
        uv) echo "官方安装脚本 + ghproxy 备用" ;;
        postgresql)
            case "$plat" in
                rhel|fedora)
                    if [ "${USE_MIRROR}" = "1" ]; then echo "阿里云 PGDG yum 镜像"; else echo "PGDG 官方 yum 源"; fi
                    ;;
                *)
                    if [ "${USE_MIRROR}" = "1" ]; then echo "阿里云 PGDG 镜像"; else echo "PGDG 官方源"; fi
                    ;;
            esac
            ;;
        caddy)
            case "$plat" in
                rhel|fedora)
                    if [ "${USE_MIRROR}" = "1" ]; then echo "dnf 国内 rpm 镜像"; else echo "Cloudsmith rpm 官方源"; fi
                    ;;
                *)
                    if [ "${USE_MIRROR}" = "1" ]; then echo "apt 国内镜像"; else echo "apt 官方源"; fi
                    ;;
            esac
            ;;
        zbar|invoice-runtime)
            case "$plat" in
                rhel|fedora) echo "dnf/yum 安装 zbar + libgomp" ;;
                *) echo "apt 安装 libzbar0 + libgomp1" ;;
            esac
            ;;
        *) echo "" ;;
    esac
}

wizard_install_deps() {
    ensure_logs_dir
    local log="$LOGS_DIR/wizard-deps.log"
    : >"$log"

    local -a plan=()
    local st comp status name hint item

    st="$(check_node)"; [ "$st" != "ok" ] && plan+=("node:$st")
    st="$(check_python)"; [ "$st" != "ok" ] && plan+=("python:$st")
    st="$(check_uv)"; [ "$st" != "ok" ] && plan+=("uv:$st")
    if ! db_target_is_remote; then
        st="$(check_postgres)"; [ "$st" != "ok" ] && plan+=("postgresql:$st")
    fi
    if [ "$DEPLOY_MODE" = "prod" ]; then
        st="$(check_caddy)"; [ "$st" != "ok" ] && plan+=("caddy:$st")
    fi
    st="$(check_invoice_parse_runtime)"; [ "$st" != "ok" ] && plan+=("invoice-runtime:$st")

    if [ "${#plan[@]}" -eq 0 ]; then
        wizard_say_ok "所有依赖已就绪，无需安装"
        wizard_finalize_local_database || return 1
        return 0
    fi

    if db_target_is_remote; then
        wizard_say_ok "远程数据库模式，安装计划不含 PostgreSQL"
    fi

    wizard_say "以下组件需要安装或升级（可能需要 sudo / 管理员权限）："
    for item in "${plan[@]}"; do
        comp="${item%%:*}"
        status="${item#*:}"
        hint="$(wizard_install_method_hint "$comp")"
        echo "    · $(wizard_component_display_name "$comp") — $(wizard_install_reason "$status")${hint:+ · ${hint}}"
    done
    wizard_say "安装过程可能较慢，完成后会逐项提示；详细日志: ${log}"
    echo ""

    [ -f "$INSTALL_SCRIPTS_JSON" ] || { wizard_say_fail "缺少 $INSTALL_SCRIPTS_JSON"; return 1; }
    apply_cn_mirrors

    for item in "${plan[@]}"; do
        comp="${item%%:*}"
        status="${item#*:}"
        name="$(wizard_component_display_name "$comp")"
        hint="$(wizard_install_method_hint "$comp")"
        wizard_say "正在安装 ${name}${hint:+（${hint}）}，请稍候..."
        if run_install_component "$comp" "$status" >>"$log" 2>&1; then
            wizard_say_ok "${name} 已安装完成"
            if [ "$comp" = "caddy" ]; then
                stop_system_caddy >>"$log" 2>&1 || {
                    wizard_say_fail "Caddy 已安装但无法停止系统服务"
                    tail -15 "$log" >&2
                    return 1
                }
                wizard_say_ok "系统 caddy.service 已停止，将在项目启动时使用项目 Caddyfile"
            fi
        else
            wizard_say_fail "${name} 安装失败"
            wizard_say "详见日志末尾："
            tail -15 "$log" >&2
            return 1
        fi
    done

    wizard_say "正在复核基线依赖..."
    if cmd_check_baseline >>"$log" 2>&1; then
        wizard_finalize_local_database || return 1
        wizard_say_ok "环境软件安装全部完成"
        wizard_say "特殊依赖将在迁移/启动时处理，状态见菜单 [5] 详情"
        return 0
    fi
    wizard_say_fail "环境复核未通过"
    tail -15 "$log" >&2
    return 1
}

wizard_apply_config() {
    wizard_say "正在应用安装规划（JWT、访问地址、CORS）..."
    apply_app_config
    wizard_say "正在验证数据库连接..."
    if test_db_connection; then
        wizard_say_ok "数据库连接正常"
    else
        wizard_say_fail "数据库连接失败"
        return 1
    fi
    wizard_say_ok "应用配置已就绪"
}

wizard_show_log_tail() {
    local file=$1 lines=${2:-40} title=${3:-日志末尾}
    [ -f "$file" ] || return 0
    echo "" >&2
    echo -e "${WIZARD_RED}--- ${title} (${file}) ---${WIZARD_RESET}" >&2
    tail -n "$lines" "$file" >&2
    echo -e "${WIZARD_RED}--- ---${WIZARD_RESET}" >&2
}

wizard_show_deploy_failure() {
    local step=$1 log=$2
    wizard_say_fail "系统安装失败 · 步骤: ${step}"
    wizard_say "完整日志: ${log}"
    wizard_show_log_tail "$log" 40 "安装日志末尾"
    case "$step" in
        pull)
            wizard_say "若 fetch 失败，请检查 git remote -v、网络与 Gitee 凭据"
            wizard_say "分支可在 fast-deploy/config/deploy.env 设置 GIT_BRANCH"
            ;;
        start_prod|start_dev)
            wizard_show_log_tail "$LOGS_DIR/backend.log" 30 "后端日志"
            wizard_show_log_tail "$LOGS_DIR/caddy.log" 20 "Caddy 日志"
            wizard_show_log_tail "$LOGS_DIR/worker.log" 15 "Worker 日志"
            ;;
    esac
    echo "" >&2
    wizard_say "修复后可单独重试:"
    echo "    ./fast-deploy/deploy.sh migrate   # 仅迁移"
    echo "    ./fast-deploy/deploy.sh build     # 仅构建前端"
    echo "    ./fast-deploy/deploy.sh start     # 仅启动服务"
    echo "" >&2
}

wizard_run_deploy_step() {
    local step=$1 label=$2 log=$3 rc
    shift 3
    wizard_say "${label}..."
    set +e
    "$@" 2>&1 | tee -a "$log"
    rc=${PIPESTATUS[0]}
    set -e
    if [ "$rc" -eq 0 ]; then
        wizard_say_ok "${label} — 完成"
        return 0
    fi
    wizard_show_deploy_failure "$step" "$log"
    return 1
}

wizard_deploy_app() {
    ensure_logs_dir
    local log="$LOGS_DIR/wizard-deploy.log"
    : >"$log"

    if [ "$DEPLOY_MODE" = "dev" ]; then
        wizard_say "开发模式：迁移并启动后端、Worker 与 Vite 前端..."
        wizard_say "详细日志: ${log}"
        wizard_run_deploy_step release_meta "记录发版信息" "$log" record_deploy_release_metadata || return 1
        wizard_run_deploy_step start_dev "启动开发环境" "$log" cmd_start_dev || return 1
        return 0
    fi

    wizard_say "生产模式：迁移 → 构建（如需）→ 启动服务"
    wizard_say "详细日志: ${log}"
    echo ""

    wizard_run_deploy_step migrate "执行数据库迁移" "$log" cmd_migrate || return 1
    wizard_run_deploy_step ensure_dist "检查 Web dist（有则跳过构建）" "$log" cmd_ensure_frontend_dist || return 1
    wizard_run_deploy_step release_meta "记录发版信息" "$log" record_deploy_release_metadata || return 1
    wizard_run_deploy_step start_prod "启动生产服务（后端 + Worker + Caddy）" "$log" cmd_start_prod || return 1
}

wizard_update_app() {
    ensure_logs_dir
    load_deploy_env
    local log="$LOGS_DIR/wizard-update.log" branch="${GIT_BRANCH:-develop}"
    : >"$log"

    wizard_say "更新分支: ${GIT_REMOTE:-origin}/${branch}"
    wizard_say "拉代码步骤等价于: git fetch ${GIT_REMOTE:-origin} && git reset --hard ${GIT_REMOTE:-origin}/${branch}"
    wizard_say "流程与 ./fast-deploy/deploy.sh update 一致（拉代码后会重新加载脚本，避免用内存旧逻辑）"
    wizard_say "详细日志: ${log}"
    echo ""

    wizard_run_deploy_step pull "同步远程代码（git fetch + reset --hard）" "$log" sync_git_from_origin || return 1

    # reset 后磁盘脚本已变；必须重新 source，否则仍执行本次启动时装入的旧函数
    # shellcheck source=/dev/null
    source "$PROJECT_ROOT/fast-deploy/lib/common.sh"
    load_deploy_env

    wizard_run_deploy_step release_meta_pull "对齐发版 commit/remote（写入 .env）" "$log" record_deploy_release_metadata || return 1

    # 与 deploy.sh update 共用 run_update_*（SKIP_GIT_SYNC：上面已 pull）
    if [ "$DEPLOY_MODE" = "prod" ]; then
        SKIP_GIT_SYNC=1 wizard_run_deploy_step update \
            "迁移 → 启动（同 deploy.sh update，不含扩展/H5）" "$log" run_update_prod || return 1
    else
        SKIP_GIT_SYNC=1 wizard_run_deploy_step update \
            "迁移 → 启动（同 deploy.sh update，不含扩展/H5）" "$log" run_update_dev || return 1
    fi

    wizard_run_deploy_step release_meta_final "确认发版信息与运行 commit 一致" "$log" record_deploy_release_metadata || return 1
    wizard_say_ok "系统更新已全部完成（特殊依赖状态见菜单 [5] 详情）"
}

wizard_show_summary() {
    load_deploy_env
    local server_ip web_url api_hint db_host db_port db_name mode_label
    server_ip="$(read_deploy_env_value SERVER_IP || detect_server_ip)"
    db_host="$(read_env_value DB_HOST || echo localhost)"
    db_port="$(read_env_value DB_PORT || echo "$(detect_postgres_port)")"
    db_name="$(read_env_value DB_NAME || echo riveredge)"
    mode_label="$([ "$DEPLOY_MODE" = "dev" ] && echo "开发 dev" || echo "生产 prod")"

    if [ "$DEPLOY_MODE" = "prod" ]; then
        web_url="$(resolve_prod_web_url "$server_ip")"
        api_hint="${web_url}/api"
    else
        web_url="http://${server_ip}:${FRONTEND_PORT}"
        api_hint="http://${server_ip}:${BACKEND_PORT}"
    fi

    echo ""
    wizard_panel_begin
    wizard_panel_top
    wizard_panel_line "${WIZARD_BOLD}COMPLETE${WIZARD_RESET}  ${WIZARD_DIM}·${WIZARD_RESET}  部署完成"
    wizard_panel_mid
    wizard_panel_kv "Mode" "${mode_label}"
    wizard_panel_kv "Web" "${web_url}"
    if [ "$DEPLOY_MODE" = "prod" ] && [ -n "$(read_deploy_env_value CADDY_DOMAIN || true)" ]; then
        wizard_panel_kv "Domain" "$(read_deploy_env_value CADDY_DOMAIN)"
        wizard_panel_kv "HTTPS" "$(read_deploy_env_value CADDY_ENABLE_LETSENCRYPT || echo false)"
    fi
    wizard_panel_kv "API" "${api_hint}"
    wizard_panel_kv "Database" "$(read_env_value DB_USER || echo postgres)@${db_host}:${db_port}/${db_name}"
    wizard_panel_kv "Admin" "$(read_env_value PLATFORM_SUPERADMIN_USERNAME || echo infra_admin)"
    wizard_panel_kv "BlueGreen" "$(blue_green_deploy_status_label)"
    local deploy_sha deploy_time
    deploy_sha="$(read_env_value GIT_SHA 2>/dev/null || true)"
    deploy_time="$(read_env_value PLATFORM_BUILD_TIME 2>/dev/null || true)"
    if [ -n "$deploy_sha" ]; then
        wizard_panel_kv "Release commit" "${deploy_sha}"
    fi
    if [ -n "$deploy_time" ]; then
        wizard_panel_kv "Release time" "${deploy_time}"
    fi
    wizard_panel_mid
    wizard_panel_section "COMMANDS 常用命令"
    wizard_panel_line "${WIZARD_DIM}./fast-deploy/deploy.sh status${WIZARD_RESET}  查看状态"
    wizard_panel_line "${WIZARD_DIM}./fast-deploy/deploy.sh stop${WIZARD_RESET}    停止服务"
    wizard_panel_line "${WIZARD_DIM}./deploy update${WIZARD_RESET}   或 ./fast-deploy/deploy.sh update"
    wizard_panel_line "${WIZARD_DIM}./fast-deploy/deploy.sh check${WIZARD_RESET}    环境检测"
    wizard_panel_mid
    wizard_panel_section "SUPPORT 联系反馈"
    wizard_panel_kv "WeChat" "lu_dingjie"
    wizard_panel_bot
    echo ""
    wizard_say "感谢使用 RiverEdge，祝运行顺利。"
    echo ""
}

cmd_wizard_fresh() {
    WIZARD_TOTAL_STAGES=8

    wizard_stage 1 "系统识别"
    wizard_detect_system
    wizard_ask_mode

    wizard_stage 2 "安装规划"
    wizard_plan_preinstall

    wizard_stage 3 "环境监测"
    local need_install=0
    if ! wizard_env_scan; then
        need_install=1
    fi

    wizard_stage 4 "环境准备"
    wizard_prepare_env

    if [ "$need_install" -eq 1 ] || ! cmd_check_baseline >/dev/null 2>&1; then
        wizard_stage 5 "环境软件安装"
        wizard_install_deps || exit 1
    else
        wizard_stage 5 "环境软件安装"
        wizard_say_ok "基线依赖已齐全，跳过安装"
        wizard_finalize_local_database || exit 1
    fi

    wizard_stage 6 "应用配置"
    if env_needs_configure; then
        wizard_apply_config || exit 1
    else
        wizard_say_ok "应用配置已存在，跳过"
        apply_app_config
    fi

    wizard_stage 7 "系统安装"
    wizard_deploy_app || exit 1

    wizard_stage 8 "安装完成"
    wizard_show_summary
}

cmd_wizard_configure() {
    WIZARD_TOTAL_STAGES=3

    wizard_stage 1 "系统识别"
    wizard_detect_system
    wizard_ask_mode

    wizard_stage 2 "修改配置"
    ensure_logs_dir
    load_deploy_env
    apply_cn_mirrors
    CONFIGURE_ALLOW_DB_EDIT=1 cmd_configure

    wizard_stage 3 "完成"
    wizard_show_summary
}

cmd_wizard_update() {
    WIZARD_TOTAL_STAGES=3

    wizard_stage 1 "系统识别"
    wizard_detect_system
    wizard_ask_mode

    wizard_stage 2 "更新系统"
    wizard_update_app || exit 1

    wizard_stage 3 "完成"
    wizard_show_summary
}

wizard_dispatch_intent() {
    case "${WIZARD_INTENT:-fresh}" in
        configure) cmd_wizard_configure ;;
        update) cmd_wizard_update ;;
        *) cmd_wizard_fresh ;;
    esac
}

cmd_wizard() {
    load_deploy_env
    ensure_logs_dir

    while true; do
        unset WIZARD_INTENT
        wizard_banner
        wizard_show_system_status
        local rc=0 intent
        wizard_ask_intent || rc=$?
        if [ "$rc" = "2" ]; then
            continue
        fi
        intent="${WIZARD_INTENT:-fresh}"
        wizard_dispatch_intent
        case "$intent" in
            update|configure)
                wizard_pause_return_menu
                ;;
            *)
                break
                ;;
        esac
    done
}
