#!/usr/bin/env bash
# RiverEdge 统一部署入口（Git Bash / Linux / macOS）
#
# 用法:
#   ./fast-deploy/deploy.sh              # 智能向导（全新安装 / 修改配置 / 更新系统）
#   ./fast-deploy/deploy.sh dev          # 开发模式向导
#   ./fast-deploy/deploy.sh wizard       # 显式进入向导
#   ./fast-deploy/deploy.sh configure    # 仅配置向导
#   ./fast-deploy/deploy.sh stop|status|update|...
#
# 环境变量:
#   USE_MIRROR=0  禁用国内镜像（默认 1 启用）
#   DEPLOY_MODE=prod|dev  可覆盖模式

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

export USE_MIRROR="${USE_MIRROR:-1}"

detect_os() {
    case "$(uname -s)" in
        MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
        *) echo "linux" ;;
    esac
}

RUNTIME_OS="$(detect_os)"
SUBCMD="${1:-}"

# 解析 dev/prod 模式前缀
case "$SUBCMD" in
    dev)
        export DEPLOY_MODE=dev
        export WIZARD_MODE_LOCKED=1
        shift
        SUBCMD="${1:-}"
        ;;
    prod)
        export DEPLOY_MODE=prod
        export WIZARD_MODE_LOCKED=1
        shift
        SUBCMD="${1:-}"
        ;;
esac
export DEPLOY_MODE="${DEPLOY_MODE:-prod}"

KNOWN_CMDS="wizard check install configure migrate build start stop status update install-service uninstall-service deploy"
is_known_cmd() {
    case " ${KNOWN_CMDS} " in
        *" $1 "*) return 0 ;;
        *) return 1 ;;
    esac
}

if [ -n "$SUBCMD" ] && ! is_known_cmd "$SUBCMD"; then
    echo "未知命令: $SUBCMD" >&2
    echo "用法: $0 [dev|prod] [check|install|configure|migrate|build|start|stop|status|update|install-service|uninstall-service]" >&2
    exit 1
fi

log_banner() {
    if [ -z "${SUBCMD:-}" ] || [ "${SUBCMD:-}" = "wizard" ] || [ "${SUBCMD:-}" = "deploy" ]; then
        return 0
    fi
    echo ""
    echo "========================================"
    echo " RiverEdge fast-deploy"
    echo " 系统: ${RUNTIME_OS} | 模式: ${DEPLOY_MODE} | 镜像: USE_MIRROR=${USE_MIRROR}"
    echo "========================================"
    echo ""
}

# Windows 下 install 优先走 PowerShell（winget 更可靠）
if [ "$RUNTIME_OS" = "windows" ] && [ "${SUBCMD:-deploy}" = "install" ]; then
    log_banner
    # shellcheck source=lib/common.sh
    source "$SCRIPT_DIR/lib/common.sh"
    PS_COMMON_PS1="$(to_powershell_path "$SCRIPT_DIR/lib/common.ps1")"
    if powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "
        \$ErrorActionPreference = 'Stop'
        \$env:DEPLOY_MODE = '$DEPLOY_MODE'
        \$env:USE_MIRROR = '$USE_MIRROR'
        . '$PS_COMMON_PS1'
        Load-DeployEnv
        Invoke-Install
    "; then
        exit 0
    fi
    echo "PowerShell install 失败，尝试 Git Bash 路径..." >&2
    load_deploy_env
    fd_dispatch install
    exit $?
fi

log_banner
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"
load_deploy_env
fd_dispatch "${SUBCMD:-}"
