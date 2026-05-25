#!/usr/bin/env bash
# RiverEdge 对话式部署向导

WIZARD_TOTAL_STAGES=7
WIZARD_CURRENT=0

WIZARD_BOLD='\033[1m'
WIZARD_DIM='\033[2m'
WIZARD_CYAN='\033[36m'
WIZARD_GREEN='\033[32m'
WIZARD_YELLOW='\033[33m'
WIZARD_RED='\033[31m'
WIZARD_RESET='\033[0m'

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
    echo -e "${WIZARD_BOLD}━━━ 阶段 ${1}/${WIZARD_TOTAL_STAGES} · ${2} ━━━${WIZARD_RESET}"
    echo ""
}

wizard_banner() {
    echo ""
    echo -e "${WIZARD_BOLD}╔════════════════════════════════════════╗${WIZARD_RESET}"
    echo -e "${WIZARD_BOLD}║      RiverEdge 智能部署向导              ║${WIZARD_RESET}"
    echo -e "${WIZARD_BOLD}╚════════════════════════════════════════╝${WIZARD_RESET}"
    echo ""
    wizard_say "你好，我将引导你完成 RiverEdge 的检测、安装与启动。"
    wizard_say "整个过程分为 ${WIZARD_TOTAL_STAGES} 个阶段，请按提示操作即可。"
    echo ""
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
        old:*) wizard_say_warn "${name} — 版本 ${status#old:}，需要升级" ;;
        *) wizard_say_warn "${name} — ${status}" ;;
    esac
}

wizard_env_scan() {
    local failed=0 st
    wizard_say "正在扫描依赖组件..."
    st="$(check_node)"; wizard_report_component "Node.js 22+" "$st"; [ "$st" = "ok" ] || failed=1
    st="$(check_python)"; wizard_report_component "Python 3.12+" "$st"; [ "$st" = "ok" ] || failed=1
    st="$(check_uv)"; wizard_report_component "uv" "$st"; [ "$st" = "ok" ] || failed=1
    st="$(check_npm)"; wizard_report_component "npm 10+" "$st"; [ "$st" = "ok" ] || failed=1
    st="$(check_postgres)"; wizard_report_component "PostgreSQL 15+" "$st"; [ "$st" = "ok" ] || failed=1
    if [ "$DEPLOY_MODE" = "prod" ]; then
        st="$(check_caddy)"; wizard_report_component "Caddy" "$st"; [ "$st" = "ok" ] || failed=1
    fi
    if [ "$failed" -eq 0 ]; then
        wizard_say_ok "环境检测通过，所有依赖已满足"
    else
        wizard_say "部分依赖尚未就绪，下一阶段将自动安装"
    fi
    return $failed
}

wizard_prepare_env() {
    wizard_say "正在初始化部署目录与镜像配置..."
    ensure_logs_dir
    load_deploy_env
    apply_cn_mirrors
    if [ ! -f "$DEPLOY_ENV_FILE" ] && [ -f "$FAST_DEPLOY_DIR/deploy.env.example" ]; then
        cp "$FAST_DEPLOY_DIR/deploy.env.example" "$DEPLOY_ENV_FILE"
        wizard_say_ok "已创建 deploy.env"
    fi
    wizard_say_ok "日志目录: ${LOGS_DIR}"
    wizard_say_ok "部署配置: ${DEPLOY_ENV_FILE}"
}

wizard_install_deps() {
    ensure_logs_dir
    local log="$LOGS_DIR/wizard-deps.log"
    wizard_say "正在静默安装缺失的系统软件（可能需要 sudo 权限）..."
    wizard_say "详细安装日志: ${log}"
    if cmd_install >>"$log" 2>&1; then
        wizard_say_ok "系统依赖安装完成"
        return 0
    fi
    wizard_say_fail "依赖安装失败，请查看日志末尾："
    tail -15 "$log" >&2
    return 1
}

wizard_run_configure() {
    wizard_say "接下来需要你确认数据库与应用配置（带 * 的为必填项）。"
    echo ""
    cmd_configure
}

wizard_deploy_app() {
    if [ "$DEPLOY_MODE" = "dev" ]; then
        wizard_say "开发模式：启动后端、Worker 与 Vite 前端..."
        cmd_start_dev
        return 0
    fi
    wizard_say "生产模式：执行数据库迁移..."
    cmd_migrate
    if [ ! -f "$FRONTEND_DIR/dist/index.html" ]; then
        wizard_say "正在构建前端（首次可能较慢）..."
        cmd_build
    else
        wizard_say_ok "前端 dist 已存在，跳过构建"
    fi
    wizard_say "正在启动生产服务..."
    cmd_start_prod
}

wizard_show_summary() {
    load_deploy_env
    local server_ip web_url api_hint db_host db_port db_name
    server_ip="$(read_deploy_env_value SERVER_IP || detect_server_ip)"
    db_host="$(read_env_value DB_HOST || echo localhost)"
    db_port="$(read_env_value DB_PORT || echo "$(detect_postgres_port)")"
    db_name="$(read_env_value DB_NAME || echo riveredge)"

    if [ "$DEPLOY_MODE" = "prod" ]; then
        web_url="http://${server_ip}:${PROXY_PORT}"
        api_hint="${web_url}/api"
    else
        web_url="http://${server_ip}:${FRONTEND_PORT}"
        api_hint="http://${server_ip}:${BACKEND_PORT}"
    fi

    echo ""
    echo -e "${WIZARD_BOLD}╔════════════════════════════════════════╗${WIZARD_RESET}"
    echo -e "${WIZARD_BOLD}║           部署完成 · 系统信息           ║${WIZARD_RESET}"
    echo -e "${WIZARD_BOLD}╚════════════════════════════════════════╝${WIZARD_RESET}"
    echo ""
    wizard_say_ok "部署模式: $([ "$DEPLOY_MODE" = "dev" ] && echo "开发" || echo "生产")"
    wizard_say_ok "Web 访问: ${web_url}"
    wizard_say_ok "API 地址: ${api_hint}"
    wizard_say_ok "数据库: $(read_env_value DB_USER || echo postgres)@${db_host}:${db_port}/${db_name}"
    wizard_say_ok "平台超管: infra_admin（密码见 .env 中 PLATFORM_SUPERADMIN_PASSWORD）"
    echo ""
    wizard_say "常用命令："
    echo "    ./fast-deploy/deploy.sh status   # 查看运行状态"
    echo "    ./fast-deploy/deploy.sh stop     # 停止服务"
    echo "    ./fast-deploy/deploy.sh update   # 拉代码并更新"
    echo "    ./fast-deploy/deploy.sh check    # 仅环境检测"
    echo ""
    wizard_say "感谢使用 RiverEdge，祝运行顺利。"
    echo ""
}

cmd_wizard() {
    wizard_banner

    wizard_stage 1 "系统识别"
    wizard_detect_system
    wizard_ask_mode

    wizard_stage 2 "环境监测"
    local need_install=0
    if ! wizard_env_scan; then
        need_install=1
    fi

    wizard_stage 3 "环境准备"
    wizard_prepare_env

    if [ "$need_install" -eq 1 ] || ! cmd_check >/dev/null 2>&1; then
        wizard_stage 4 "环境软件安装"
        wizard_install_deps || exit 1
    else
        wizard_stage 4 "环境软件安装"
        wizard_say_ok "依赖已齐全，跳过安装"
    fi

    wizard_stage 5 "系统配置"
    if env_needs_configure; then
        wizard_run_configure
    else
        wizard_say_ok "应用配置已存在，跳过配置向导"
        wizard_say "如需修改可运行: ./fast-deploy/deploy.sh configure"
    fi

    wizard_stage 6 "系统安装"
    wizard_deploy_app

    wizard_stage 7 "安装完成"
    wizard_show_summary
}
