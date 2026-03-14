#!/bin/bash
# RiverEdge SaaS 多组织框架 - 一键启动脚本
# 自动处理端口冲突，进程清理，环境检查等
#
# Windows: 默认仅启动 Web 端，启动完成自动打开浏览器
# Linux/Mac: 默认同时启动 Web + 手机端
#
# 快速启动选项:
#   ./Launch.dev.sh fast    - 最快启动，强制静默
#   ./Launch.dev.sh mobile  - 手机端启动（前端监听 0.0.0.0，同网段手机可访问）
#   QUIET=true ./Launch.dev.sh  - 静默启动
#   ./fast-start.sh        - 快速启动脚本别名

set -e  # 遇到错误立即退出

# ========================================
# 配置参数 (可通过环境变量覆盖)
# ========================================

# 服务端口配置（避免系统保留端口和主流项目常用端口）
BACKEND_PORT="${BACKEND_PORT:-8200}"   # 后端服务端口（避免与主流项目常用端口冲突）
FRONTEND_PORT="${FRONTEND_PORT:-8100}" # 前端服务端口（Web 端，默认 8100）
MOBILE_FRONTEND_PORT="${MOBILE_FRONTEND_PORT:-8101}" # 手机端前端端口（与 Web 端 8100 分开，默认 8101）
KKFILEVIEW_PORT="${KKFILEVIEW_PORT:-8400}" # kkFileView 服务端口
INNGEST_PORT="${INNGEST_PORT:-8288}"  # Inngest Dev Server 端口（可通过环境变量INNGEST_PORT覆盖，默认8288为Inngest官方默认端口）

# Inngest 配置
INNGEST_BACKEND_URL="${INNGEST_BACKEND_URL:-http://localhost:${BACKEND_PORT}/api/inngest}"  # Inngest连接的后端URL（使用localhost与sync请求一致，避免双App）

# 启动超时配置（秒）- 已缩短
BACKEND_START_TIMEOUT="${BACKEND_START_TIMEOUT:-30}"
FRONTEND_START_TIMEOUT="${FRONTEND_START_TIMEOUT:-30}"
INNGEST_START_TIMEOUT="${INNGEST_START_TIMEOUT:-15}"  # Inngest启动超时（通常很快）

# 健康检查配置 - 已缩短
HEALTH_CHECK_INTERVAL="${HEALTH_CHECK_INTERVAL:-1}"
HEALTH_CHECK_MAX_RETRIES="${HEALTH_CHECK_MAX_RETRIES:-30}"

# 进程清理配置 - 已缩短
FORCE_KILL_TIMEOUT="${FORCE_KILL_TIMEOUT:-5}"
PORT_CLEANUP_RETRIES="${PORT_CLEANUP_RETRIES:-10}"

# 虚拟环境配置（使用 UV 管理，虚拟环境为 .venv）
VENV_NAME="${VENV_NAME:-.venv}"
PYTHON_MIN_VERSION="${PYTHON_MIN_VERSION:-3.11}"
NODE_MIN_VERSION="${NODE_MIN_VERSION:-16}"

# 日志配置
LOG_MAX_AGE="${LOG_MAX_AGE:-7}"  # 日志保留天数
LOG_MAX_SIZE="${LOG_MAX_SIZE:-10}"  # 日志轮转大小（MB）

# 调试模式
DEBUG="${DEBUG:-false}"

# 静默模式 - 减少输出，只显示关键信息
QUIET="${QUIET:-false}"

# 手机端启动 - 前端绑定 0.0.0.0，便于同网段手机通过本机 IP 访问
# Windows 默认不启动手机端（简化流程、提高速度）；Linux/Mac 默认启动
if [[ "${OSTYPE}" == "msys" || "${OSTYPE}" == "win32" || "${OSTYPE}" == "cygwin" ]]; then
    LAUNCH_MOBILE="${LAUNCH_MOBILE:-true}"  # Windows: 默认同时启动 (用户要求)
else
    LAUNCH_MOBILE="${LAUNCH_MOBILE:-true}"   # Linux/Mac: 默认同时启动手机端
fi

# UV 链接模式配置（避免硬链接警告，Windows 环境下硬链接可能不支持）
export UV_LINK_MODE="${UV_LINK_MODE:-copy}"

# ========================================

# 颜色输出 (兼容性考虑)
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    NC='\033[0m'
else
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    NC=''
fi

# 日志函数 - 支持静默模式
log_info() {
    if [ "$QUIET" != "true" ]; then
        echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
    fi
}

log_warn() {
    if [ "$QUIET" != "true" ]; then
        echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARN: $1${NC}"
    fi
}

log_error() {
    # 错误总是显示
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

log_success() {
    if [ "$QUIET" != "true" ]; then
        echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS: $1${NC}"
    fi
}

# 关键信息 - 即使在静默模式下也显示
log_key() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

# 通用重试函数
# 参数: $1 - 命令, $2 - 最大重试次数 (默认3), $3 - 重试间隔 (默认2秒)
retry_command() {
    local command="$1"
    local max_attempts="${2:-3}"
    local retry_delay="${3:-2}"
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        log_info "执行命令 (尝试 $attempt/$max_attempts): $command"

        if eval "$command"; then
            log_success "命令执行成功"
            return 0
        else
            local exit_code=$?
            log_warn "命令执行失败 (退出码: $exit_code)"

            if [ $attempt -lt $max_attempts ]; then
                log_info "等待 ${retry_delay} 秒后重试..."
                sleep $((retry_delay / 2))  # 缩短重试等待时间
            fi
        fi

        attempt=$((attempt + 1))
    done

    log_error "命令在 $max_attempts 次尝试后仍然失败: $command"
    return 1
}

# 带超时的命令执行
# 参数: $1 - 命令, $2 - 超时时间 (默认30秒)
execute_with_timeout() {
    local command="$1"
    local timeout="${2:-30}"

    if command -v timeout &> /dev/null; then
        # Linux/Mac 系统
        timeout $timeout bash -c "$command"
        return $?
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]]; then
        # Windows Git Bash - 简化处理
        log_warn "Windows系统不支持timeout命令，直接执行"
        eval "$command"
        return $?
    else
        # 其他系统 - 直接执行
        eval "$command"
        return $?
    fi
}

# 检查命令是否存在
check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "命令 '$1' 未找到，请确保已安装"
        exit 1
    fi
}

# 检查Python版本（需要3.11+）
check_python_version() {
    if ! command -v python &> /dev/null; then
        log_error "Python 未安装，请安装 Python 3.11+"
        exit 1
    fi

    local python_version=$(python --version 2>&1 | awk '{print $2}')
    local major=$(echo $python_version | cut -d. -f1)
    local minor=$(echo $python_version | cut -d. -f2)

    if [ "$major" -lt 3 ] || ([ "$major" -eq 3 ] && [ "$minor" -lt 11 ]); then
        log_error "Python 版本过低: $python_version，需要 3.11+"
        exit 1
    fi

    log_success "Python 版本: $python_version ✓"
}

# 检查 UV 是否已安装
check_uv() {
    if ! command -v uv &> /dev/null; then
        log_error "UV 未安装，请先安装 UV"
        log_info "安装方法："
        log_info "  curl -LsSf https://astral.sh/uv/install.sh | sh"
        log_info "  或访问：https://github.com/astral-sh/uv"
        exit 1
    fi

    local uv_version=$(uv --version 2>&1 | awk '{print $2}' | head -1)
    log_success "UV 版本: $uv_version ✓"
}

# 检查Node.js版本（需要16+）
check_node_version() {
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装，请安装 Node.js 16+"
        exit 1
    fi

    local node_version=$(node --version 2>&1 | sed 's/v//')
    local major=$(echo $node_version | cut -d. -f1)

    if [ "$major" -lt 16 ]; then
        log_error "Node.js 版本过低: $node_version，需要 16+"
        exit 1
    fi

    log_success "Node.js 版本: $node_version ✓"
}

# 检查磁盘空间（至少需要2GB可用空间）
check_disk_space() {
    local required_space=2048  # MB

    if command -v df &> /dev/null; then
        # Linux/Mac系统
        local available_space=$(df . | tail -1 | awk '{print int($4/1024)}')  # MB
        if [ "$available_space" -lt "$required_space" ]; then
            log_error "磁盘空间不足: ${available_space}MB 可用，需要至少 ${required_space}MB"
            exit 1
        fi
        log_success "磁盘空间: ${available_space}MB 可用 ✓"
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]]; then
        # Windows系统（简化检查）
        log_info "Windows系统跳过磁盘空间检查"
    fi
}

# 检查虚拟环境状态（使用 UV 管理，虚拟环境为 .venv）
check_venv() {
    # 检查后端目录是否存在 pyproject.toml（UV 项目标识）
    if [ ! -f "riveredge-backend/pyproject.toml" ]; then
        log_error "后端项目配置文件 pyproject.toml 不存在"
        return 1
    fi

    # UV 会在需要时自动创建 .venv，这里只检查项目配置
    log_success "UV 项目配置检查通过 ✓"
    return 0
}

# 检查项目文件完整性
check_project_integrity() {
    local missing_files=()

    # 检查必需的目录
    local required_dirs=(
        "riveredge-backend/src"
        "riveredge-backend/src/infra"
        "riveredge-backend/src/server"
        "riveredge-frontend/src"
    )

    for dir in "${required_dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            missing_files+=("$dir (目录)")
        fi
    done

    # 检查必需的文件（使用 UV 管理依赖，不再需要 requirements.txt）
    local required_files=(
        "riveredge-backend/pyproject.toml"
        "riveredge-backend/uv.lock"
        "riveredge-frontend/package.json"
        "riveredge-backend/src/server/main.py"
    )

    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            missing_files+=("$file (文件)")
        fi
    done

    if [ ${#missing_files[@]} -ne 0 ]; then
        log_error "项目文件不完整，缺少以下文件/目录:"
        for item in "${missing_files[@]}"; do
            log_error "  - $item"
        done
        exit 1
    fi

    log_success "项目文件完整性检查通过 ✓"
}

# 检查端口是否被占用 (增强版，Windows兼容，检查所有TCP状态)
check_port() {
    local port=$1
    
    # 方法1: 使用 netstat (Windows/Linux通用，检查所有TCP状态，包括LISTENING、ESTABLISHED、TIME_WAIT等)
    if command -v netstat &> /dev/null; then
        # 检查是否有任何占用该端口的连接（包括所有状态）
        if netstat -ano 2>/dev/null | grep ":$port " | grep -qE "(LISTENING|ESTABLISHED|TIME_WAIT|SYN_SENT|CLOSE_WAIT)"; then
            return 0  # 端口被占用
        fi
    fi
    
    # 方法2: 使用 lsof (Mac/Linux)
    if command -v lsof &> /dev/null; then
        if lsof -ti:$port >/dev/null 2>&1; then
            return 0  # 端口被占用
        fi
    fi
    
    # 方法3: 使用bash的/dev/tcp重定向（备用方法）
    if (echo >/dev/tcp/localhost/$port) 2>/dev/null; then
        return 0  # 端口被占用
    fi
    
    return 1  # 端口可用
}

# 通过进程名清理相关进程（高效版）
kill_processes_by_name() {
    local port=$1
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local log_dir="$script_dir/.logs"
    mkdir -p "$log_dir" 2>/dev/null || true

    log_info "Windows: 通过进程名快速清理端口 $port 相关进程..."

    # 根据端口类型清理对应的进程
    case $port in
        "$FRONTEND_PORT")
            # 前端端口：清理 Node.js 相关进程
            log_info "清理前端进程 (node.exe, npm.exe, vite相关)..."
            taskkill /IM node.exe /T /F >> "$log_dir/taskkill.log" 2>&1 || true
            taskkill /IM npm.exe /T /F >> "$log_dir/taskkill.log" 2>&1 || true
            # 通过命令行清理vite进程
            if command -v wmic &> /dev/null; then
                wmic process where "CommandLine like '%vite%'" delete >> "$log_dir/taskkill.log" 2>&1 || true
            fi
            ;;
        "$MOBILE_FRONTEND_PORT")
            # 手机端端口：仅清理 Expo 相关进程（保护 Web 端 Node 进程）
            log_info "清理手机端进程 (expo相关)..."
            if command -v wmic &> /dev/null; then
                wmic process where "Name='node.exe' and CommandLine like '%expo%'" delete >> "$log_dir/taskkill.log" 2>&1 || true
            fi
            ;;
        "$BACKEND_PORT")
            # 后端端口：清理 Python 相关进程
            log_info "清理后端进程 (python.exe, uvicorn相关)..."
            taskkill /IM python.exe /T /F >> "$log_dir/taskkill.log" 2>&1 || true
            taskkill /IM pythonw.exe /T /F >> "$log_dir/taskkill.log" 2>&1 || true
            # 通过命令行清理uvicorn进程
            if command -v wmic &> /dev/null; then
                wmic process where "CommandLine like '%uvicorn%'" delete >> "$log_dir/taskkill.log" 2>&1 || true
                wmic process where "CommandLine like '%main:app%'" delete >> "$log_dir/taskkill.log" 2>&1 || true
            fi
            ;;
    esac

    # 额外清理：终止所有可能残留的进程
    taskkill /IM cmd.exe /T /F >> "$log_dir/taskkill.log" 2>&1 || true 2>/dev/null || true
    sleep 1
}

# Linux/Mac 通过进程名清理
kill_processes_by_name_linux() {
    local port=$1
    log_info "Linux/Mac: 通过进程名清理端口 $port 相关进程..."

    case $port in
        "$FRONTEND_PORT")
            pkill -9 -f "vite" 2>/dev/null || true
            pkill -9 -f "node.*vite" 2>/dev/null || true
            ;;
        "$BACKEND_PORT")
            pkill -9 -f "uvicorn" 2>/dev/null || true
            pkill -9 -f "python.*main:app" 2>/dev/null || true
            ;;
    esac
}

# 全局清理所有相关进程（全面清理，不考虑端口）
# 目标：终止所有可能阻碍启动的进程，确保服务能够正常启动
cleanup_all_processes() {
    log_warn "执行全局清理：终止所有可能阻碍启动的进程..."

    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local log_dir="$script_dir/.logs"
    mkdir -p "$log_dir" 2>/dev/null || true

    # Windows 专用：终止所有相关进程
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]] && command -v taskkill &> /dev/null; then
        log_warn "Windows: 终止所有相关进程..."

        # 一次性终止所有关键进程
        for proc in "node.exe" "npm.exe" "python.exe" "pythonw.exe" "cmd.exe"; do
            taskkill /IM $proc /T /F >> "$log_dir/taskkill.log" 2>&1 || true
        done

        # 使用 wmic 清理特定进程
        if command -v wmic &> /dev/null; then
            for pattern in "vite" "uvicorn" "main:app" "fastapi"; do
                wmic process where "CommandLine like '%$pattern%'" delete >> "$log_dir/taskkill.log" 2>&1 || true
            done
        fi
    fi

    # Linux/Mac: 使用 pkill 终止所有相关进程
    if command -v pkill &> /dev/null; then
        for pattern in "vite" "uvicorn" "main:app" "fastapi"; do
            pkill -9 -f "$pattern" 2>/dev/null || true
        done
    fi

    # 等待进程完全终止
    sleep 2

    log_success "全局清理完成"
}

# 清理指定端口，直到成功
# 持续清理直到端口真正释放（优化版：更高效的清理策略）
clear_port() {
    local port=$1
    local max_attempts=5  # 减少重试次数，提高效率
    local attempt=1

    log_info "清理端口 $port (最多尝试 $max_attempts 次)..."

    # 首先检查端口是否已被占用
    if ! check_port $port; then
        log_success "端口 $port 未被占用，无需清理"
        return 0
    fi

    while [ $attempt -le $max_attempts ]; do
        log_info "尝试 $attempt/$max_attempts: 清理端口 $port..."

        # 策略1: 快速进程名清理（最高效）
        if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]]; then
            # Windows: 直接通过进程名清理
            kill_processes_by_name $port
        else
            # Linux/Mac: 使用pkill
            kill_processes_by_name_linux $port
        fi

        # 策略2: 端口特定清理
        terminate_process_on_port $port

        # 等待进程完全退出（增加等待时间）
        sleep 2

        # 立即验证端口是否释放
        if ! check_port $port; then
            log_success "端口 $port 已成功释放 (尝试 $attempt/$max_attempts)"
            return 0
        fi

        log_warn "端口 $port 仍被占用，继续尝试..."
        attempt=$((attempt + 1))

        # 如果不是最后一次尝试，执行全局清理
        if [ $attempt -le $max_attempts ]; then
            log_info "执行全局清理..."
            cleanup_all_processes
            sleep 1
        fi
    done

    # 所有尝试都失败，提供手动清理指导
    log_error "端口 $port 清理失败，已尝试 $max_attempts 次"
    log_error ""
    log_error "请手动清理："
    log_error "1. 检查占用进程: netstat -ano | findstr :$port"
    log_error "2. 终止进程: taskkill /PID <PID> /F /T"
    log_error "3. 或重启计算机"

    return 1
}

# 获取进程PID (通过端口) - Windows Git Bash兼容
get_pid_by_port() {
    local port=$1
    local pid=""

    # 优先使用lsof (如果可用)
    if command -v lsof &> /dev/null; then
        pid=$(lsof -ti:$port 2>/dev/null | head -1)
        if [ ! -z "$pid" ] && [ "$pid" != "0" ]; then
            echo "$pid"
            return 0
        fi
    fi

    # Windows环境下使用netstat
    if command -v netstat &> /dev/null; then
        # Windows netstat输出格式: TCP  0.0.0.0:8001  0.0.0.0:0  LISTENING  1234
        pid=$(netstat -ano 2>/dev/null | grep ":$port " | grep LISTENING | awk '{print $NF}' | head -1)
        if [ ! -z "$pid" ] && [ "$pid" != "0" ] && [ "$pid" != "-" ]; then
            echo "$pid"
            return 0
        fi
    fi

    # 如果都没有，使用ss (某些Linux系统)
    if command -v ss &> /dev/null; then
        pid=$(ss -tulpn 2>/dev/null | grep ":$port " | awk '{print $7}' | cut -d',' -f1 | cut -d'=' -f2 | head -1)
        if [ ! -z "$pid" ] && [ "$pid" != "0" ]; then
            echo "$pid"
            return 0
        fi
    fi

    return 1
}

# 终止占用端口的进程 - Windows 完整清理版（彻底清理所有相关进程）
# 
# Windows 专用清理策略：
# 1. 通过 netstat 查找所有占用端口的进程（包括所有状态）
# 2. 使用 taskkill /F /T 强制终止进程树（包括所有子进程）
# 3. 使用 wmic 命令（如果可用）彻底终止进程
# 4. 通过进程名批量终止所有相关进程（node.exe, npm.exe, python.exe, uvicorn, vite 等）
# 5. 多次尝试，确保彻底清理
terminate_process_on_port() {
    local port=$1
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local log_dir="$script_dir/.logs"
    mkdir -p "$log_dir" 2>/dev/null || true

    log_info "查找并终止占用端口 $port 的进程..."

    # Windows: 使用简化的进程查找和终止
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]] && command -v netstat &> /dev/null; then
        # 查找所有占用端口的进程PID
        local pids=$(netstat -ano 2>/dev/null | grep ":$port " | awk '{print $NF}' | sort -u | grep -v "^0$" | grep -v "^$")

        if [ ! -z "$pids" ]; then
            log_info "发现占用端口 $port 的进程: $pids"

            # 逐个终止进程
            for pid in $pids; do
                if [ ! -z "$pid" ] && [ "$pid" != "0" ] && [ "$pid" != "-" ]; then
                    log_info "终止进程 PID: $pid"
                    taskkill /PID $pid /T /F >> "$log_dir/taskkill.log" 2>&1 || true

                    # 使用wmic再次确认
                    if command -v wmic &> /dev/null; then
                        wmic process where "ProcessId=$pid" delete >> "$log_dir/taskkill.log" 2>&1 || true
                    fi
                fi
            done

            # 等待进程终止
            sleep 1
        else
            log_info "未找到占用端口 $port 的进程"
        fi
    fi

    # Windows 专用：通过进程名批量终止所有相关进程
    if command -v taskkill &> /dev/null; then
        # 清理前端相关进程（终止所有 node.exe、npm.exe、vite 等）
        if [ "$port" == "$FRONTEND_PORT" ]; then
            log_warn "Windows: 清理所有前端相关进程（终止 node、npm、vite 进程）..."
            
            # 查找所有占用前端端口的进程
            local frontend_pids=$(netstat -ano 2>/dev/null | grep ":$FRONTEND_PORT " | awk '{print $NF}' | sort -u | grep -v "^0$" | grep -v "^$")
            
            # 终止所有相关进程（多次尝试）
            for pid in $frontend_pids; do
                if [ ! -z "$pid" ] && [ "$pid" != "0" ]; then
                    taskkill /PID $pid /T /F >> "$log_dir/taskkill.log" 2>&1 || true
                    sleep 0.1
                    taskkill /PID $pid /F >> "$log_dir/taskkill.log" 2>&1 || true
                fi
            done
            
            # 终止所有 node.exe 进程
            log_warn "Windows: 终止所有 node.exe 进程..."
            taskkill /IM node.exe /T /F >> "$log_dir/taskkill.log" 2>&1 || true
            sleep 0.2
            taskkill /IM node.exe /F >> "$log_dir/taskkill.log" 2>&1 || true
            
            # 终止所有 npm.exe 进程
            log_warn "Windows: 终止所有 npm.exe 进程..."
            taskkill /IM npm.exe /T /F >> "$log_dir/taskkill.log" 2>&1 || true
            sleep 0.2
            taskkill /IM npm.exe /F >> "$log_dir/taskkill.log" 2>&1 || true
            
            # 终止所有 vite 相关进程（通过命令行匹配）
            log_warn "Windows: 终止所有 vite 相关进程..."
            for pid in $(wmic process where "CommandLine like '%vite%'" get ProcessId /format:value 2>/dev/null | grep "ProcessId=" | cut -d= -f2); do
                if [ ! -z "$pid" ] && [ "$pid" != "0" ]; then
                    taskkill /PID $pid /T /F >> "$log_dir/taskkill.log" 2>&1 || true
                fi
            done
        fi

        # 清理后端相关进程（终止所有 python.exe、uvicorn 等）
        if [ "$port" == "$BACKEND_PORT" ]; then
            log_warn "Windows: 清理所有后端相关进程（终止 python、uvicorn 进程）..."
            
            # 查找所有占用后端端口的进程（包括所有 TCP 状态）
            local backend_pids=$(netstat -ano 2>/dev/null | grep ":$BACKEND_PORT " | awk '{print $NF}' | sort -u | grep -v "^0$" | grep -v "^$")
            
            # 终止所有相关进程（多次尝试，确保彻底）
            for pid in $backend_pids; do
                if [ ! -z "$pid" ] && [ "$pid" != "0" ]; then
                    log_info "Windows: 终止占用后端端口的进程 PID: $pid..."
                    # 方法1: taskkill /F /T - 强制终止进程树
                    taskkill /PID $pid /T /F >> "$log_dir/taskkill.log" 2>&1 || true
                    sleep 0.2
                    # 方法2: 再次尝试（确保彻底）
                    taskkill /PID $pid /F >> "$log_dir/taskkill.log" 2>&1 || true
                    sleep 0.2
                    # 方法3: 使用 wmic 彻底删除
                    if command -v wmic &> /dev/null; then
                        wmic process where "ProcessId=$pid" delete >> "$log_dir/taskkill.log" 2>&1 || true
                        wmic process where "ParentProcessId=$pid" delete >> "$log_dir/taskkill.log" 2>&1 || true
                    fi
                fi
            done
            
            # 终止所有 uvicorn 相关进程（通过命令行匹配，优先处理）
            log_warn "Windows: 终止所有 uvicorn 相关进程..."
            if command -v wmic &> /dev/null; then
                for pid in $(wmic process where "CommandLine like '%uvicorn%'" get ProcessId /format:value 2>/dev/null | grep "ProcessId=" | cut -d= -f2); do
                    if [ ! -z "$pid" ] && [ "$pid" != "0" ]; then
                        log_info "Windows: 终止 uvicorn 进程 PID: $pid..."
                        taskkill /PID $pid /T /F >> "$log_dir/taskkill.log" 2>&1 || true
                        sleep 0.1
                        taskkill /PID $pid /F >> "$log_dir/taskkill.log" 2>&1 || true
                        wmic process where "ProcessId=$pid" delete >> "$log_dir/taskkill.log" 2>&1 || true
                    fi
                done
            fi
            
            # 终止所有 python.exe 进程
            log_warn "Windows: 终止所有 python.exe 进程..."
            taskkill /IM python.exe /T /F >> "$log_dir/taskkill.log" 2>&1 || true
            sleep 0.3
            taskkill /IM python.exe /F >> "$log_dir/taskkill.log" 2>&1 || true
            
            # 终止所有 pythonw.exe 进程
            log_warn "Windows: 终止所有 pythonw.exe 进程..."
            taskkill /IM pythonw.exe /T /F >> "$log_dir/taskkill.log" 2>&1 || true
            sleep 0.3
            taskkill /IM pythonw.exe /F >> "$log_dir/taskkill.log" 2>&1 || true
            
            # 额外清理：通过命令行匹配终止所有包含 main:app 的进程
            log_warn "Windows: 终止所有 main:app 相关进程..."
            if command -v wmic &> /dev/null; then
                for pid in $(wmic process where "CommandLine like '%main:app%'" get ProcessId /format:value 2>/dev/null | grep "ProcessId=" | cut -d= -f2); do
                    if [ ! -z "$pid" ] && [ "$pid" != "0" ]; then
                        taskkill /PID $pid /T /F >> "$log_dir/taskkill.log" 2>&1 || true
                    fi
                done
            fi
        fi

        # 清理手机端相关进程（仅终止 expo 相关，避免误杀 Web 端）
        if [ "$port" == "$MOBILE_FRONTEND_PORT" ]; then
            log_warn "Windows: 清理手机端相关进程（终止 expo 进程）..."
            
            # 查找所有占用手机端端口的进程
            local mobile_pids=$(netstat -ano 2>/dev/null | grep ":$MOBILE_FRONTEND_PORT " | awk '{print $NF}' | sort -u | grep -v "^0$" | grep -v "^$")
            
            for pid in $mobile_pids; do
                if [ ! -z "$pid" ] && [ "$pid" != "0" ]; then
                    taskkill /PID $pid /T /F >> "$log_dir/taskkill.log" 2>&1 || true
                fi
            done
            
            # 通过命令行清理 expo 进程
            if command -v wmic &> /dev/null; then
                wmic process where "Name='node.exe' and CommandLine like '%expo%'" delete >> "$log_dir/taskkill.log" 2>&1 || true
            fi
        fi
    fi

    # Linux/Mac: 使用 pkill 终止进程
    if command -v pkill &> /dev/null; then
        if [ "$port" == "$FRONTEND_PORT" ]; then
            pkill -9 -f "vite" 2>/dev/null || true
            pkill -9 -f "node.*vite" 2>/dev/null || true
            pkill -9 -f "npm.*vite" 2>/dev/null || true
        fi
        if [ "$port" == "$BACKEND_PORT" ]; then
            pkill -9 -f "uvicorn" 2>/dev/null || true
            pkill -9 -f "python.*uvicorn" 2>/dev/null || true
            pkill -9 -f "python.*main:app" 2>/dev/null || true
        fi
    fi

    # 等待进程完全终止（后端需要更长时间）
    if [ "$port" == "$BACKEND_PORT" ]; then
        sleep 1.5  # 后端进程需要更长时间完全终止
    else
        sleep 0.8  # 前端进程
    fi
    
    return 0
}

# 等待端口释放（简化版：直接返回，不等待）
wait_port_free() {
    # 简化：不等待，直接返回
    return 0
}

# 等待服务启动的通用函数
# 参数: $1 - 服务URL, $2 - 服务名称, $3 - 超时时间(秒，默认60)
wait_for_service() {
    local url="$1"
    local service_name="$2"
    local timeout="${3:-30}"
    local start_time=$(date +%s)
    local check_interval=1

    log_info "等待 $service_name 启动 (超时: ${timeout}秒)..."

    while true; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))

        if [ $elapsed -ge $timeout ]; then
            log_error "$service_name 启动超时 (${timeout}秒)"
            return 1
        fi

        # 检查服务健康状态
        if curl -s --max-time 10 "$url" >/dev/null 2>&1; then
            local elapsed_formatted
            if [ $elapsed -lt 60 ]; then
                elapsed_formatted="${elapsed}秒"
            else
                elapsed_formatted="$((elapsed / 60))分$((elapsed % 60))秒"
            fi
            log_success "$service_name 启动成功 (耗时: $elapsed_formatted)"
            return 0
        fi

        # 显示进度
        if [ $((elapsed % 10)) -eq 0 ] && [ $elapsed -gt 0 ]; then
            log_info "$service_name 仍在启动中... (${elapsed}秒)"
        fi

        sleep $check_interval
    done
}

# 检查服务是否真正健康（不仅仅是响应）
check_service_health() {
    local url="$1"
    local service_name="$2"
    local expected_status="${3:-200}"

    log_info "检查 $service_name 健康状态..."

    # 发送HEAD请求检查状态码
    local status_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")

    if [ "$status_code" = "$expected_status" ]; then
        log_success "$service_name 健康检查通过"
        return 0
    else
        log_error "$service_name 健康检查失败 (状态码: $status_code，期望: $expected_status)"
        return 1
    fi
}

# 等待前端服务启动（专门针对前端，先检查端口，再检查HTTP）
# 参数: $1 - 端口号, $2 - 服务名称, $3 - 超时时间(秒，默认90)
wait_for_frontend() {
    local port=$1
    local service_name="$2"
    local timeout="${3:-30}"
    local start_time=$(date +%s)
    local check_interval=1

    log_info "等待 $service_name 启动 (超时: ${timeout}秒)..."

    # 第一阶段：等待端口监听（前端Vite启动的标志）
    log_info "等待端口 $port 监听..."
    local port_ready=false
    while true; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))

        if [ $elapsed -ge $timeout ]; then
            log_error "$service_name 启动超时 (${timeout}秒)，端口 $port 未监听"
            return 1
        fi

        # 检查端口是否监听
        if check_port $port; then
            log_success "端口 $port 已监听"
            port_ready=true
            break
        fi

        sleep $check_interval
    done

    # 第二阶段：等待HTTP响应（给前端一些时间编译）
    if [ "$port_ready" = true ]; then
        log_info "等待 $service_name HTTP响应（前端可能正在编译）..."
        local http_ready=false
        local http_timeout=$((timeout - elapsed))
        
        # 至少等待5秒让前端编译
        local min_wait=5
        if [ $http_timeout -lt $min_wait ]; then
            http_timeout=$min_wait
        fi
        
        local http_start_time=$(date +%s)
        while true; do
            local current_time=$(date +%s)
            local http_elapsed=$((current_time - http_start_time))

            if [ $http_elapsed -ge $http_timeout ]; then
                # 如果端口已监听，即使HTTP还没响应，也认为启动成功（前端可能还在编译）
                log_warn "$service_name HTTP响应超时，但端口已监听，认为启动成功（前端可能仍在编译中）"
                return 0
            fi

            # 尝试访问前端服务
            if curl -s --max-time 5 "http://localhost:$port" >/dev/null 2>&1; then
                log_success "$service_name 启动成功 (端口监听 + HTTP响应)"
                return 0
            fi

            sleep $check_interval
        done
    fi

    return 1
}

# 启动 Inngest 服务
start_inngest() {
    log_info "启动 Inngest 服务（端口: $INNGEST_PORT）..."

    # Inngest 脚本目录
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local inngest_exe=""

    # 查找 Inngest 可执行文件
    # 优先查找 bin/inngest/ 目录（新结构）
    # 如果不存在，回退到 bin/ 目录（旧结构）
    if [ -f "$script_dir/bin/inngest/inngest.exe" ]; then
        inngest_exe="$script_dir/bin/inngest/inngest.exe"
        local config_file="$script_dir/bin/inngest/inngest.config.json"
    elif [ -f "$script_dir/bin/inngest/inngest" ]; then
        inngest_exe="$script_dir/bin/inngest/inngest"
        local config_file="$script_dir/bin/inngest/inngest.config.json"
    elif [ -f "$script_dir/bin/inngest/inngest-windows-amd64.exe" ]; then
        inngest_exe="$script_dir/bin/inngest/inngest-windows-amd64.exe"
        local config_file="$script_dir/bin/inngest/inngest.config.json"
    elif [ -f "$script_dir/bin/inngest.exe" ]; then
        # 回退：直接在 bin/ 目录下（旧结构）
        inngest_exe="$script_dir/bin/inngest.exe"
        local config_file="$script_dir/bin/inngest.config.json"
    elif [ -f "$script_dir/bin/inngest" ]; then
        # 回退：直接在 bin/ 目录下（旧结构）
        inngest_exe="$script_dir/bin/inngest"
        local config_file="$script_dir/bin/inngest.config.json"
    else
        log_warn "未找到 Inngest 可执行文件，跳过 Inngest 启动"
        log_warn "请确保以下文件之一存在:"
        log_warn "  - $script_dir/bin/inngest/inngest.exe (新结构)"
        log_warn "  - $script_dir/bin/inngest.exe (旧结构)"
        return 1
    fi

    # 检查配置文件（已在上面根据可执行文件位置确定）
    if [ ! -f "$config_file" ]; then
        log_warn "未找到 Inngest 配置文件: $config_file，跳过 Inngest 启动"
        return 1
    fi

    # 确保日志目录存在
    mkdir -p .logs 2>/dev/null || true
    local log_file=".logs/inngest.log"
    local pid_file=".logs/inngest.pid"

    # 清理旧的PID文件
    rm -f "$pid_file"

    # 启动 Inngest 服务
    # 使用环境变量 INNGEST_PORT 指定的端口（默认8288，Inngest官方默认端口）
    log_info "启动 Inngest Dev Server（端口: $INNGEST_PORT，后端URL: $INNGEST_BACKEND_URL）..."
    
    # 启动Inngest服务：仅使用 -u 指定的 App，关闭自动发现避免重复/无效 App
    # 明确指定 --port 参数，使用环境变量中的端口配置
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]]; then
        # Windows: 使用 --host 127.0.0.1，--no-discovery 避免与 -u 重复注册同一 URL
        ("$inngest_exe" dev -u "$INNGEST_BACKEND_URL" --no-discovery --config "$config_file" --host 127.0.0.1 --port "$INNGEST_PORT" >> "$log_file" 2>&1) &
        local inngest_pid=$!
    else
        # Linux/Mac: 使用 nohup，--no-discovery 避免与 -u 重复注册同一 URL
        nohup "$inngest_exe" dev -u "$INNGEST_BACKEND_URL" --no-discovery --config "$config_file" --port "$INNGEST_PORT" >> "$log_file" 2>&1 &
        local inngest_pid=$!
    fi

    # 等待进程启动
    sleep 2

    # 验证进程是否在运行
    if kill -0 $inngest_pid 2>/dev/null; then
        # 保存PID
        echo $inngest_pid > "$pid_file"
        log_success "Inngest 服务启动成功 (PID: $inngest_pid)"
        
        # 等待服务完全启动（检查日志）
        local wait_count=0
        while [ $wait_count -lt $INNGEST_START_TIMEOUT ]; do
            if grep -q "service starting" "$log_file" 2>/dev/null; then
                log_success "Inngest 服务已就绪"
                return 0
            fi
            sleep 1
            wait_count=$((wait_count + 1))
        done
        
        log_success "Inngest 服务启动中（请查看日志确认状态）"
        return 0
    else
        log_error "Inngest 进程启动失败，检查日志: $log_file"
        if [ -f "$log_file" ] && [ -s "$log_file" ]; then
            log_error "启动错误:"
            tail -10 "$log_file" | while read line; do
                log_error "  $line"
            done
        fi
        return 1
    fi
}

# 启动后端服务（使用 uvicorn）
start_backend() {
    local port=$1
    log_info "启动后端服务 (uvicorn, 端口: $port)..."

    # 进入后端目录并启动
    cd riveredge-backend

    # 设置环境变量：强制 egg-info 生成到 .logs 目录（如果必须生成）
    export SETUPTOOLS_EGG_INFO_DIR="$(cd .. && pwd)/.logs"

    # 清理可能存在的 egg-info 目录（严禁在 src 目录下产生）
    # 如果在 src 目录下发现，立即删除或移动到 .logs
    if [ -d "src/riveredge_backend.egg-info" ]; then
        log_warn "检测到 src 目录下的 egg-info，正在移动到 .logs..."
        mkdir -p "../.logs" 2>/dev/null || true
        mv "src/riveredge_backend.egg-info" "../.logs/riveredge_backend.egg-info" 2>/dev/null || rm -rf "src/riveredge_backend.egg-info"
    fi

    # 检查并同步 UV 虚拟环境（如果不存在或依赖有变化）
    # 使用 --no-install-project 避免安装项目本身，防止生成 egg-info 目录
    if [ ! -d ".venv" ] || [ "pyproject.toml" -nt ".venv" ] || [ "uv.lock" -nt ".venv" ]; then
        log_info "同步 UV 依赖..."
        uv sync --no-install-project
        if [ $? -ne 0 ]; then
            log_error "UV 依赖同步失败"
            cd ..
            return 1
        fi
        log_success "UV 依赖同步完成"
    fi
    
    # 再次检查并清理（防止在同步过程中意外生成）
    # 如果在 src 目录下发现，立即删除或移动到 .logs
    if [ -d "src/riveredge_backend.egg-info" ]; then
        log_warn "检测到 src 目录下的 egg-info，正在移动到 .logs..."
        mkdir -p "../.logs" 2>/dev/null || true
        mv "src/riveredge_backend.egg-info" "../.logs/riveredge_backend.egg-info" 2>/dev/null || rm -rf "src/riveredge_backend.egg-info"
    fi

    # 设置环境变量
    export PORT=$port
    export HOST=${HOST:-0.0.0.0}
    
    # 确保启用热重载（开发环境默认启用）
    # 可以通过设置 RELOAD=false 来禁用
    if [ -z "$RELOAD" ]; then
        export RELOAD=true  # 默认启用热重载
    fi

    # 清理旧的PID文件
    rm -f ../.logs/backend.pid

    # 清理策略：只有在端口被占用时才执行彻底清理
    if check_port $port; then
        log_warn "端口 $port 被占用，执行全局清理所有可能阻碍启动的进程..."
        cleanup_all_processes
        
        # 清理端口，直到成功为止
        log_warn "清理端口 $port 直到成功..."
        if ! clear_port $port; then
            log_error "端口 $port 清理失败，无法启动后端服务"
            cd ..
            return 1
        fi
        
        # 启动前最后一次验证端口
        if check_port $port; then
            log_error "端口 $port 在启动前仍被占用，执行最后一次清理尝试..."
            cleanup_all_processes
            sleep 2
            if check_port $port; then
                log_error "端口 $port 仍被占用，请手动检查并清理占用进程"
                cd ..
                return 1
            fi
        fi
    else
        log_info "端口 $port 未被占用，直接启动"
    fi

    # 启动后端服务（使用 UV 运行 uvicorn）
    log_info "使用 UV 启动后端服务..."
    # 使用 UV 运行，自动使用 .venv 虚拟环境
    # 设置 Python 路径，使用 UV 运行 uvicorn
    PYTHONPATH="$(pwd)/src" nohup uv run uvicorn server.main:app --host "${HOST:-0.0.0.0}" --port $port --reload --reload-dir src > ../.logs/backend.log 2>&1 &
    local backend_pid=$!
    echo $backend_pid > ../.logs/backend.pid

    cd ..
    log_success "后端服务启动中 (PID: $backend_pid, 端口: $port, UV + uvicorn + 热重载)"

    # 快速等待后端启动（缩短等待时间）
    if [ "$QUIET" != "true" ]; then
        log_info "等待后端服务启动..."
    fi
    if ! wait_for_service "http://localhost:$port/health" "后端服务" "$BACKEND_START_TIMEOUT"; then
        log_error "后端服务启动失败，请检查 .logs/backend.log"
        if [ -f ".logs/backend.pid" ]; then
            kill $backend_pid 2>/dev/null || true
            rm -f .logs/backend.pid
        fi
        exit 1
    fi

    # 额外验证API文档可用性
    if curl -s --max-time 5 http://localhost:$port/docs >/dev/null 2>&1; then
        log_info "📖 Swagger API文档: http://localhost:$port/docs"
    else
        log_warn "API文档暂时不可用，但服务正在运行"
    fi
}

# Windows 专用：软重启 VITE 相关进程（优雅停止）
soft_restart_vite_windows() {
    log_info "Windows: 尝试软重启 VITE 相关进程（优雅停止）..."
    
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local log_dir="$script_dir/.logs"
    mkdir -p "$log_dir" 2>/dev/null || true
    
    local restart_success=false
    
    # 只在 Windows 下执行
    if command -v taskkill &> /dev/null; then
        # 1. 查找所有占用前端端口的进程
        local vite_pids=$(netstat -ano 2>/dev/null | grep ":$FRONTEND_PORT " | awk '{print $NF}' | sort -u | grep -v "^0$" | grep -v "^$")
        
        if [ ! -z "$vite_pids" ]; then
            log_info "Windows: 发现占用 $FRONTEND_PORT 端口的进程: $vite_pids"
            
            # 尝试优雅停止（不使用 /F 参数）
            for pid in $vite_pids; do
                if [ ! -z "$pid" ] && [ "$pid" != "0" ]; then
                    log_info "Windows: 尝试优雅停止进程 PID: $pid..."
                    # 不使用 /F 参数，让进程优雅退出
                    taskkill /PID $pid /T >> "$log_dir/taskkill.log" 2>&1 || true
                fi
            done
            
            # 等待进程优雅退出（最多等待 2 秒）
            local wait_count=0
            while [ $wait_count -lt 2 ]; do
                sleep 0.5
                local still_running=$(netstat -ano 2>/dev/null | grep ":$FRONTEND_PORT " | awk '{print $NF}' | sort -u | grep -v "^0$" | grep -v "^$")
                if [ -z "$still_running" ]; then
                    log_success "Windows: VITE 进程已优雅停止"
                    restart_success=true
                    break
                fi
                wait_count=$((wait_count + 1))
            done
        else
            log_success "Windows: 没有发现占用 $FRONTEND_PORT 端口的进程"
            restart_success=true
        fi
    fi
    
    if [ "$restart_success" = true ]; then
        return 0
    else
        log_warn "Windows: 软重启失败，将执行硬重启"
        return 1
    fi
}

# Windows 专用：硬重启 VITE 相关进程（强制清理）
hard_restart_vite_windows() {
    log_warn "Windows: 执行硬重启 VITE 相关进程（强制清理）..."
    
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local log_dir="$script_dir/.logs"
    mkdir -p "$log_dir" 2>/dev/null || true
    
    # 只在 Windows 下执行
    if command -v taskkill &> /dev/null; then
        # 1. 查找所有占用前端端口的进程并强制清理
        local vite_pids=$(netstat -ano 2>/dev/null | grep ":$FRONTEND_PORT " | awk '{print $NF}' | sort -u | grep -v "^0$" | grep -v "^$")
        if [ ! -z "$vite_pids" ]; then
            log_info "Windows: 发现占用 $FRONTEND_PORT 端口的进程: $vite_pids"
            for pid in $vite_pids; do
                if [ ! -z "$pid" ] && [ "$pid" != "0" ]; then
                    log_info "Windows: 强制清理进程 PID: $pid (包括所有子进程)..."
                    taskkill /PID $pid /T /F >> "$log_dir/taskkill.log" 2>&1 || true
                fi
            done
        fi
        
        # 2. 使用 wmic 查找所有包含 vite 的进程并清理
        if command -v wmic &> /dev/null; then
            log_info "Windows: 使用 wmic 查找所有 vite 相关进程..."
            wmic process where "CommandLine like '%vite%'" delete >> "$log_dir/taskkill.log" 2>&1 || true
        fi
        
        # 3. 强制清理所有 node.exe 和 npm.exe 进程（不考虑其他应用）
        log_warn "Windows: 强制清理所有 node.exe 进程（硬重启 VITE）..."
        taskkill /IM node.exe /T /F >> "$log_dir/taskkill.log" 2>&1 || true
        log_warn "Windows: 强制清理所有 npm.exe 进程（硬重启 VITE）..."
        taskkill /IM npm.exe /T /F >> "$log_dir/taskkill.log" 2>&1 || true
        
        # 等待进程完全结束
        sleep 1
        
        log_success "Windows: VITE 硬重启完成"
    else
        log_warn "Windows: taskkill 命令不可用，跳过 VITE 清理"
    fi
}

# Windows 专用：清理 VITE 相关进程（优化策略：先软重启，失败后硬重启）
# 参数：$1 = 是否在硬重启后启动服务（默认：false）
cleanup_vite_windows() {
    local auto_start=${1:-false}
    log_info "Windows: 开始清理 VITE 相关进程（优化策略）..."
    
    # 第一步：尝试软重启
    if soft_restart_vite_windows; then
        log_success "Windows: VITE 软重启成功"
        return 0
    fi
    
    # 第二步：软重启失败，执行硬重启
    log_warn "Windows: VITE 软重启失败，执行硬重启..."
    hard_restart_vite_windows
    
    # 第三步：硬重启后，如果需要，自动启动相关服务
    if [ "$auto_start" = true ]; then
        log_info "Windows: 硬重启完成，准备启动相关服务..."
        
        # 检查后端服务是否运行（通过检查端口和PID文件）
        local backend_running=false
        if [ -f ".logs/backend.pid" ]; then
            local backend_pid=$(cat .logs/backend.pid 2>/dev/null)
            if [ ! -z "$backend_pid" ] && kill -0 $backend_pid 2>/dev/null; then
                backend_running=true
            fi
        fi
        
        if [ "$backend_running" = false ] && ! check_port $BACKEND_PORT; then
            log_info "Windows: 后端服务未运行，启动后端服务..."
            start_backend $BACKEND_PORT || log_warn "Windows: 后端服务启动失败"
        else
            log_info "Windows: 后端服务已在运行"
        fi
        
        # 检查前端服务是否运行（通过检查端口和PID文件）
        local frontend_running=false
        if [ -f ".logs/frontend.pid" ]; then
            local frontend_pid=$(cat .logs/frontend.pid 2>/dev/null)
            if [ ! -z "$frontend_pid" ] && kill -0 $frontend_pid 2>/dev/null; then
                frontend_running=true
            fi
        fi
        
        if [ "$frontend_running" = false ] && ! check_port $FRONTEND_PORT; then
            log_info "Windows: 前端服务未运行，启动前端服务..."
            start_frontend $FRONTEND_PORT $BACKEND_PORT || log_warn "Windows: 前端服务启动失败"
        else
            log_info "Windows: 前端服务已在运行"
        fi
    else
        log_info "Windows: 硬重启完成（不自动启动服务）"
    fi
    
    return 0
}


# 启动前端服务
start_frontend() {
    local port=$1
    local backend_port=$2
    log_info "启动前端服务 (端口: $port, 后端: $backend_port)..."
    
    # 清理策略：只有在端口被占用时才执行彻底清理
    if check_port $port; then
        log_warn "端口 $port 被占用，执行全局清理所有可能阻碍启动的进程..."
        cleanup_all_processes
        
        # 清理端口，直到成功为止
        log_warn "清理端口 $port 直到成功..."
        if ! clear_port $port; then
            log_error "端口 $port 清理失败，无法启动前端服务"
            return 1
        fi
        
        # 启动前最后一次验证端口
        if check_port $port; then
            log_error "端口 $port 在启动前仍被占用，执行最后一次清理尝试..."
            cleanup_all_processes
            sleep 2
            if check_port $port; then
                log_error "端口 $port 仍被占用，请手动检查并清理占用进程"
                return 1
            fi
        fi
    else
        log_info "端口 $port 未被占用，直接启动"
    fi

    # 保存当前目录（项目根目录）
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local project_root="$script_dir"
    
    # 确保日志目录存在
    mkdir -p "$project_root/.logs" 2>/dev/null || true

    # 检查前端依赖（静默模式）
    # ⚠️ 修复：从 riveredge-frontend 目录启动（package.json 在根目录）
    cd "$project_root/riveredge-frontend"
    if [ ! -d "node_modules" ]; then
        if [ "$QUIET" != "true" ]; then
            log_info "安装前端依赖..."
        fi
        npm install --legacy-peer-deps --silent > /dev/null 2>&1 || {
            log_error "前端依赖安装失败"
            exit 1
        }
        if [ "$QUIET" != "true" ]; then
            log_success "前端依赖安装完成"
        fi
    fi

    # 更新前端代理配置
    # 配置前端代理到后端端口（更精确的匹配，避免误替换）
    # vite.config.ts 在 src 目录下
    if [ -f "src/vite.config.ts" ]; then
        # 使用更精确的 sed 模式，只替换 proxy target 中的端口
        # 方法1: 尝试使用 sed -i.bak (Linux/Mac 或支持 -i 的 sed)
        if sed -i.bak "s|target: 'http://localhost:[0-9]\+'|target: 'http://localhost:$backend_port'|g" src/vite.config.ts 2>/dev/null; then
            # 成功，清理备份文件
            rm -f src/vite.config.ts.bak 2>/dev/null || true
        elif sed -i.bak "s|target: \"http://localhost:[0-9]\\+\"|target: \"http://localhost:$backend_port\"|g" src/vite.config.ts 2>/dev/null; then
            # 成功，清理备份文件
            rm -f src/vite.config.ts.bak 2>/dev/null || true
        else
            # 方法2: 使用临时文件方式（Windows Git Bash 兼容）
            if sed "s|target: 'http://localhost:[0-9]\+'|target: 'http://localhost:$backend_port'|g" src/vite.config.ts > src/vite.config.ts.tmp 2>/dev/null; then
                # 临时文件创建成功，检查文件是否存在且非空
                if [ -f "src/vite.config.ts.tmp" ] && [ -s "src/vite.config.ts.tmp" ]; then
                    mv src/vite.config.ts.tmp src/vite.config.ts 2>/dev/null || {
                        log_warn "无法移动临时文件，尝试使用备用方法..."
                        rm -f src/vite.config.ts.tmp 2>/dev/null || true
                    }
                else
                    log_warn "临时文件创建失败或为空，跳过配置更新"
                    rm -f src/vite.config.ts.tmp 2>/dev/null || true
                fi
            else
                log_warn "无法更新 vite.config.ts，可能格式不匹配"
            fi
        fi
    fi

    # 最后一次端口检查，确保在启动前端口仍然可用
    if check_port $port; then
        log_warn "端口 $port 在启动前又被占用，最后一次清理..."
        terminate_process_on_port $port || true
        sleep 1
        if check_port $port; then
            log_error "端口 $port 仍被占用，无法启动前端服务"
            return 1
        fi
    fi

    # 清理旧的PID文件
    rm -f "$project_root/.logs/frontend.pid"

    # 启动前最后一次端口检查（Windows 上需要更长的等待时间）
    if check_port $port; then
        log_warn "启动前检查：端口 $port 仍被占用，最后一次清理..."
        terminate_process_on_port $port || true
        if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]] && command -v taskkill &> /dev/null; then
            if [ "$port" == "$FRONTEND_PORT" ]; then
                taskkill /IM node.exe /T /F 2>/dev/null || true
                taskkill /IM npm.exe /T /F 2>/dev/null || true
            fi
        fi
        # Windows 上需要更长的等待时间，确保端口完全释放
        sleep 2
        if check_port $port; then
            log_error "端口 $port 在启动前仍被占用，无法启动前端服务"
            log_error "请手动检查并清理占用进程，或稍后重试"
            return 1
        fi
    fi

    # 启动前端服务（从 riveredge-frontend 目录）
    # ⚠️ 修复：直接使用 npx vite 命令，指定 src 作为根目录
    # Windows 兼容性：默认在 Windows 上使用 127.0.0.1；手机端启动时强制 0.0.0.0 以便同网段手机访问
    local host_bind="0.0.0.0"
    if [[ "$LAUNCH_MOBILE" != "true" ]] && [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]]; then
        host_bind="127.0.0.1"  # 强制使用 IPv4，避免 localhost 解析为 IPv6
    fi
    # 使用 npx vite 直接启动（vite.config.ts 已设置 root，不需要额外指定目录）
    # --port 和 --host 指定端口和主机
    nohup npx vite --port $port --host $host_bind > "$project_root/.logs/frontend.log" 2>&1 &
    local frontend_pid=$!
    echo $frontend_pid > "$project_root/.logs/frontend.pid"

    cd "$project_root"
    log_success "前端服务启动中 (PID: $frontend_pid, 端口: $port)"

    # 快速等待前端启动（缩短等待时间）
    if ! wait_for_frontend $port "前端服务" "$FRONTEND_START_TIMEOUT"; then
        log_error "前端服务启动失败，请检查 $project_root/.logs/frontend.log"
        if [ -f "$project_root/.logs/frontend.pid" ]; then
            kill $frontend_pid 2>/dev/null || true
            rm -f "$project_root/.logs/frontend.pid"
        fi
        exit 1
    fi
}

# 启动手机端前端服务 (Expo Web)
start_mobile_frontend() {
    local port=$1
    local backend_port=$2
    log_info "启动手机端前端服务 (端口: $port, 后端: $backend_port)..."
    
    # 清理策略：只有在端口被占用时才执行清理
    if check_port $port; then
        log_warn "端口 $port 被占用，尝试清理..."
        
        # 使用 clear_port 进行清理 (已更新支持 MOBILE_FRONTEND_PORT 的安全清理)
        if ! clear_port $port; then
            log_error "端口 $port 清理失败，无法启动手机端服务"
            return 1
        fi
        
        # 启动前最后一次验证端口
        if check_port $port; then
            log_error "端口 $port 在启动前仍被占用，执行最后一次清理尝试..."
            terminate_process_on_port $port || true
            sleep 2
            if check_port $port; then
                log_error "端口 $port 仍被占用，请手动检查并清理占用进程"
                return 1
            fi
        fi
    fi

    local project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    
    # 检查手机端目录
    if [ ! -d "$project_root/riveredge-mobile" ]; then
        log_warn "未找到 riveredge-mobile 目录，跳过手机端启动"
        return 1
    fi

    cd "$project_root/riveredge-mobile"
    
    # 检查依赖
    if [ ! -d "node_modules" ]; then
        log_info "安装手机端依赖..."
        npm install --legacy-peer-deps --silent > /dev/null 2>&1 || {
            log_error "手机端依赖安装失败"
            cd "$project_root"
            return 1
        }
    fi

    # 清理旧的PID文件
    rm -f "$project_root/.logs/mobile.pid"

    # 启动 Expo Web 服务
    # 使用 npx expo start --web 启动，指定端口
    log_info "执行 Expo Web 启动命令..."
    nohup npx expo start --web --port $port --non-interactive > "$project_root/.logs/mobile.log" 2>&1 &
    local mobile_pid=$!
    echo $mobile_pid > "$project_root/.logs/mobile.pid"

    cd "$project_root"
    log_success "手机端前端服务启动中 (PID: $mobile_pid, 端口: $port)"
    
    # 等待端口监听
    if ! wait_for_frontend $port "手机端前端" 30; then
        log_warn "手机端前端启动验证未完全通过，请检查 .logs/mobile.log"
    fi
}

# 停止所有服务 - Windows兼容（增强版）
stop_all() {
    log_info "停止所有服务..."

    # 确保日志目录存在
    mkdir -p .logs 2>/dev/null || true
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local log_dir="$script_dir/.logs"

    # 停止后端（通过PID文件）
    if [ -f ".logs/backend.pid" ]; then
        local backend_pid=$(cat .logs/backend.pid 2>/dev/null)
        if [ ! -z "$backend_pid" ] && [ "$backend_pid" != "0" ]; then
            if kill -0 $backend_pid 2>/dev/null; then
                log_info "停止后端服务 (PID: $backend_pid)"
                kill -TERM $backend_pid 2>/dev/null || true
                # Windows环境下也尝试taskkill
                if command -v taskkill &> /dev/null; then
                    taskkill /PID $backend_pid /F >> "$log_dir/taskkill.log" 2>&1 || true
                fi
                # 等待进程结束
                local count=0
                while [ $count -lt 5 ] && kill -0 $backend_pid 2>/dev/null; do
                    sleep 0.5
                    count=$((count + 1))
                done
                # 如果还在运行，强制清理
                if kill -0 $backend_pid 2>/dev/null; then
                    log_warn "强制停止后端服务 (PID: $backend_pid)"
                    kill -KILL $backend_pid 2>/dev/null || true
                    if command -v taskkill &> /dev/null; then
                        taskkill /PID $backend_pid /F >> "$log_dir/taskkill.log" 2>&1 || true
                    fi
                fi
            fi
        fi
        rm -f .logs/backend.pid
    fi

    # 停止前端（通过PID文件）
    if [ -f ".logs/frontend.pid" ]; then
        local frontend_pid=$(cat .logs/frontend.pid 2>/dev/null)
        if [ ! -z "$frontend_pid" ] && [ "$frontend_pid" != "0" ]; then
            if kill -0 $frontend_pid 2>/dev/null; then
                log_info "停止前端服务 (PID: $frontend_pid)"
                kill -TERM $frontend_pid 2>/dev/null || true
                # Windows环境下也尝试taskkill
                if command -v taskkill &> /dev/null; then
                    taskkill /PID $frontend_pid /F >> "$log_dir/taskkill.log" 2>&1 || true
                fi
                # 等待进程结束
                local count=0
                while [ $count -lt 5 ] && kill -0 $frontend_pid 2>/dev/null; do
                    sleep 0.5
                    count=$((count + 1))
                done
                # 如果还在运行，强制清理
                if kill -0 $frontend_pid 2>/dev/null; then
                    log_warn "强制停止前端服务 (PID: $frontend_pid)"
                    kill -KILL $frontend_pid 2>/dev/null || true
                    if command -v taskkill &> /dev/null; then
                        taskkill /PID $frontend_pid /F >> "$log_dir/taskkill.log" 2>&1 || true
                    fi
                fi
            fi
        fi
        rm -f .logs/frontend.pid
    fi

    # 停止手机端（通过PID文件）
    if [ -f ".logs/mobile.pid" ]; then
        local mobile_pid=$(cat .logs/mobile.pid 2>/dev/null)
        if [ ! -z "$mobile_pid" ] && [ "$mobile_pid" != "0" ]; then
            if kill -0 $mobile_pid 2>/dev/null; then
                log_info "停止手机端前端服务 (PID: $mobile_pid)"
                kill -TERM $mobile_pid 2>/dev/null || true
                if command -v taskkill &> /dev/null; then
                    taskkill /PID $mobile_pid /F >> "$log_dir/taskkill.log" 2>&1 || true
                fi
            fi
        fi
        rm -f .logs/mobile.pid
    fi

    # 停止 Inngest（通过PID文件）
    if [ -f ".logs/inngest.pid" ]; then
        local inngest_pid=$(cat .logs/inngest.pid 2>/dev/null)
        if [ ! -z "$inngest_pid" ] && [ "$inngest_pid" != "0" ]; then
            if kill -0 $inngest_pid 2>/dev/null; then
                log_info "停止 Inngest 服务 (PID: $inngest_pid)"
                kill -TERM $inngest_pid 2>/dev/null || true
                # Windows环境下也尝试taskkill
                if command -v taskkill &> /dev/null; then
                    taskkill /PID $inngest_pid /F >> "$log_dir/taskkill.log" 2>&1 || true
                fi
                # 等待进程结束
                local count=0
                while [ $count -lt 5 ] && kill -0 $inngest_pid 2>/dev/null; do
                    sleep 0.5
                    count=$((count + 1))
                done
                # 如果还在运行，强制清理
                if kill -0 $inngest_pid 2>/dev/null; then
                    log_warn "强制停止 Inngest 服务 (PID: $inngest_pid)"
                    kill -KILL $inngest_pid 2>/dev/null || true
                    if command -v taskkill &> /dev/null; then
                        taskkill /PID $inngest_pid /F >> "$log_dir/taskkill.log" 2>&1 || true
                    fi
                fi
            fi
        fi
        rm -f .logs/inngest.pid
    fi


    # 清理可能残留的进程（简化版，避免卡住）
    log_info "清理残留进程..."
    
    # 清理 Inngest 进程（通过进程名）
    if command -v pkill &> /dev/null; then
        (pkill -f "inngest.*dev" 2>/dev/null || true) &
    fi
    if command -v taskkill &> /dev/null; then
        (taskkill /F /IM inngest.exe >> "$log_dir/taskkill.log" 2>&1 || true) &
    fi
    
    # 只清理关键端口，避免遍历所有端口导致卡住
    for port in $FRONTEND_PORT $MOBILE_FRONTEND_PORT $BACKEND_PORT; do
        if check_port $port; then
            local pid=$(get_pid_by_port $port)
            if [ ! -z "$pid" ] && [ "$pid" != "0" ] && [ "$pid" != "-" ]; then
                log_info "清理占用端口 $port 的进程 (PID: $pid)"
                # 直接强制清理，不等待
                kill -KILL $pid 2>/dev/null || true
                if command -v taskkill &> /dev/null; then
                    taskkill /PID $pid /F >> "$log_dir/taskkill.log" 2>&1 &
                fi
            fi
        fi
    done

    # 使用 pkill 快速清理（如果可用，后台执行避免卡住）
    if command -v pkill &> /dev/null; then
        pkill -f "uvicorn.*server.main:app" 2>/dev/null &
        pkill -f "vite.*--port" 2>/dev/null &
        pkill -f "inngest.*dev" 2>/dev/null &
    fi

    # 等待进程完全停止
    sleep 1

    # 最终验证：检查关键端口是否已释放
    local ports_still_occupied=0
    for port in $FRONTEND_PORT $BACKEND_PORT; do
        if check_port $port; then
            log_warn "警告：端口 $port 仍被占用"
            ports_still_occupied=$((ports_still_occupied + 1))
        fi
    done
    
    # 注意：Inngest端口通过环境变量INNGEST_PORT配置（默认8300，避免Windows端口保留问题）
    # 启动命令中明确使用 --port 参数，确保端口配置一致

    if [ $ports_still_occupied -eq 0 ]; then
        log_success "所有服务已停止，端口已释放"
    else
        log_warn "部分端口仍被占用，但继续执行启动流程"
    fi
}

# 显示状态
show_status() {
    log_info "服务状态检查:"

    if [ -f ".logs/backend.pid" ]; then
        local backend_pid=$(cat .logs/backend.pid)
        if kill -0 $backend_pid 2>/dev/null; then
            log_success "后端服务运行中 (PID: $backend_pid)"
        else
            log_warn "后端服务PID文件存在但进程未运行"
        fi
    else
        log_warn "后端服务未运行"
    fi

    if [ -f ".logs/frontend.pid" ]; then
        local frontend_pid=$(cat .logs/frontend.pid)
        if kill -0 $frontend_pid 2>/dev/null; then
            log_success "前端服务运行中 (PID: $frontend_pid)"
        else
            log_warn "前端服务PID文件存在但进程未运行"
        fi
    else
        log_warn "前端服务未运行"
    fi

    if [ -f ".logs/mobile.pid" ]; then
        local mobile_pid=$(cat .logs/mobile.pid)
        if kill -0 $mobile_pid 2>/dev/null; then
            log_success "手机端前端运行中 (PID: $mobile_pid)"
        else
            log_warn "手机端前端PID文件存在但进程未运行"
        fi
    else
        log_warn "手机端前端未运行"
    fi

    if [ -f ".logs/inngest.pid" ]; then
        local inngest_pid=$(cat .logs/inngest.pid)
        if kill -0 $inngest_pid 2>/dev/null; then
            log_success "Inngest 服务运行中 (PID: $inngest_pid)"
        else
            log_warn "Inngest 服务PID文件存在但进程未运行"
        fi
    else
        log_warn "Inngest 服务未运行"
    fi

    # 检查端口占用情况（只检查使用的端口）
    echo
    log_info "端口占用情况:"

    if check_port $FRONTEND_PORT; then
        log_warn "前端端口 $FRONTEND_PORT 被占用"
    else
        log_success "前端端口 $FRONTEND_PORT 可用"
    fi
    
    if check_port $BACKEND_PORT; then
        log_warn "后端端口 $BACKEND_PORT 被占用"
    else
        log_success "后端端口 $BACKEND_PORT 可用"
    fi
    
    if check_port $MOBILE_FRONTEND_PORT; then
        log_warn "手机端端口 $MOBILE_FRONTEND_PORT 被占用"
    else
        log_success "手机端端口 $MOBILE_FRONTEND_PORT 可用"
    fi

    # Inngest端口检查（Windows可能被系统保留，不强制）
    if check_port $INNGEST_PORT; then
        log_warn "Inngest 端口 $INNGEST_PORT 被占用（Windows可能被系统保留）"
    else
        log_success "Inngest 端口 $INNGEST_PORT 可用"
    fi
    
}

# 主函数
main() {
    local start_time=$(date +%s)

    log_info "RiverEdge SaaS 框架一键启动脚本"
    log_info "====================================="

    # 创建日志目录
    mkdir -p .logs

    # 日志轮转管理（保留最近7天的日志）
    manage_logs() {
        local log_dir="$1"
        local max_age="${2:-7}"  # 默认保留7天

        if [ -d "$log_dir" ]; then
            log_info "清理旧日志文件 (保留 ${max_age} 天)..."

            # 查找并删除旧日志文件
            find "$log_dir" -name "*.log.*" -type f -mtime +$max_age -delete 2>/dev/null || true

            # 压缩大日志文件（超过10MB）
            find "$log_dir" -name "*.log" -type f -size +10M -exec gzip {} \; 2>/dev/null || true

            log_success "日志清理完成"
        fi
    }

    # 执行日志管理（Windows 跳过以加快启动）
    if [[ "$OSTYPE" != "msys" && "$OSTYPE" != "win32" && "$OSTYPE" != "cygwin" ]]; then
        manage_logs ".logs"
    fi

    # 显示配置摘要（main 内 frontend_port 稍后按 LAUNCH_MOBILE 设置，这里先显示默认）
    log_info "启动配置:"
    log_info "   后端端口: $BACKEND_PORT"
    log_info "   Web 前端端口: $FRONTEND_PORT"
    if [ "$LAUNCH_MOBILE" = "true" ]; then
        log_info "   手机端前端端口: $MOBILE_FRONTEND_PORT"
    fi
    log_info "   Inngest端口: $INNGEST_PORT"
    log_info "   调试模式: $DEBUG"
    echo

    # 基础环境检查
    log_info "执行环境检查..."
    check_command curl
    check_command python
    check_python_version
    check_uv  # 检查 UV 是否已安装
    check_command npm
    check_node_version
    check_command sed
    check_command awk

    # 项目完整性检查
    log_info "检查项目完整性..."
    check_project_integrity
    check_disk_space

    # 检查项目结构（更新路径）
    if [ ! -d "riveredge-backend/src/infra" ] || [ ! -d "riveredge-backend/src/server" ] || [ ! -d "riveredge-frontend/src" ]; then
        log_error "项目结构不完整，请确保在项目根目录运行"
        log_error "需要: riveredge-backend/src/infra/, riveredge-backend/src/server/ 和 riveredge-frontend/src/ 目录"
        exit 1
    fi

    # 检查 UV 项目配置并同步依赖
    if ! check_venv; then
        log_error "UV 项目配置检查失败"
        exit 1
    fi

    # 同步 UV 依赖（如果虚拟环境不存在或依赖有变化）
    # 使用 --no-install-project 避免安装项目本身，防止生成 egg-info 目录
    log_info "检查并同步 UV 依赖..."
    cd riveredge-backend
    
    # 设置环境变量：强制 egg-info 生成到 .logs 目录（如果必须生成）
    export SETUPTOOLS_EGG_INFO_DIR="$(cd .. && pwd)/.logs"
    
    # 清理可能存在的 egg-info 目录（严禁在 src 目录下产生）
    # 如果在 src 目录下发现，立即删除或移动到 .logs
    if [ -d "src/riveredge_backend.egg-info" ]; then
        log_warn "检测到 src 目录下的 egg-info，正在移动到 .logs..."
        mkdir -p "../.logs" 2>/dev/null || true
        mv "src/riveredge_backend.egg-info" "../.logs/riveredge_backend.egg-info" 2>/dev/null || rm -rf "src/riveredge_backend.egg-info"
    fi
    
    if [ ! -d ".venv" ] || [ "pyproject.toml" -nt ".venv" ] || [ "uv.lock" -nt ".venv" ]; then
        log_info "同步 UV 依赖..."
        uv sync --no-install-project || {
            log_error "UV 依赖同步失败"
            cd ..
            exit 1
        }
        log_success "UV 依赖同步完成 ✓"
    else
        log_success "UV 依赖已是最新 ✓"
    fi
    
    # 再次检查并清理（防止在同步过程中意外生成）
    # 如果在 src 目录下发现，立即删除或移动到 .logs
    if [ -d "src/riveredge_backend.egg-info" ]; then
        log_warn "检测到 src 目录下的 egg-info，正在移动到 .logs..."
        mkdir -p "../.logs" 2>/dev/null || true
        mv "src/riveredge_backend.egg-info" "../.logs/riveredge_backend.egg-info" 2>/dev/null || rm -rf "src/riveredge_backend.egg-info"
    fi
    
    cd ..

    # 停止现有服务
    stop_all

    # 清理策略：只有在端口被占用时才执行彻底清理
    local need_cleanup=false
    
    # Web 必启；手机端按 LAUNCH_MOBILE 决定
    local web_port="$FRONTEND_PORT"
    local mobile_port="$MOBILE_FRONTEND_PORT"
    if [ "$LAUNCH_MOBILE" = "true" ]; then
        log_info "启动配置：Web 端口 $web_port, 手机端端口 $mobile_port"
    else
        log_info "启动配置：Web 端口 $web_port（仅 Web 端，跳过手机端）"
    fi

    # 检查端口占用情况（不启动手机端时跳过手机端端口）
    local ports_to_check="$web_port $BACKEND_PORT"
    [ "$LAUNCH_MOBILE" = "true" ] && ports_to_check="$ports_to_check $mobile_port"
    local port_occupied=false
    for p in $ports_to_check; do
        check_port "$p" && port_occupied=true && break
    done
    if [ "$port_occupied" = true ]; then
        need_cleanup=true
        log_warn "检测到端口被占用，执行全局清理..."
        cleanup_all_processes
        sleep 1
    else
        log_info "端口未被占用，跳过全局清理，直接启动"
    fi

    # 清理端口（如果被占用）
    for p in $ports_to_check; do
        if check_port "$p"; then
            if ! clear_port "$p"; then
                log_warn "端口 $p 清理失败，尝试继续启动..."
            fi
        fi
    done

    local backend_port="$BACKEND_PORT"
    local frontend_port="$web_port"

    log_success "端口清理完成 - 后端: $backend_port, 前端: $frontend_port"

    # 启动后端
    start_backend "$backend_port"
    if [ $? -ne 0 ]; then
        log_error "后端启动失败，退出"
        exit 1
    fi
    # 启动前端 (Web)
    start_frontend "$frontend_port" "$backend_port"
    if [ $? -ne 0 ]; then
        log_error "Web 前端启动失败，正在停止服务..."
        stop_all
        exit 1
    fi

    # 启动手机端 (App)
    if [ "$LAUNCH_MOBILE" = "true" ]; then
        start_mobile_frontend "$mobile_port" "$backend_port"
    fi

    # 启动 Inngest（在后端启动之后，因为Inngest需要连接后端）
    start_inngest
    if [ $? -ne 0 ]; then
        log_warn "Inngest 启动失败，但继续运行（Inngest是可选的）"
    fi

    log_success "所有服务启动成功！"
    echo
    # 计算启动耗时
    local end_time=$(date +%s)
    local total_time=$((end_time - start_time))
    local time_formatted
    if [ $total_time -lt 60 ]; then
        time_formatted="${total_time}秒"
    else
        time_formatted="$((total_time / 60))分$((total_time % 60))秒"
    fi

    if [ "$QUIET" != "true" ]; then
        echo
        echo "=================================================================================="
        echo "                    启动完成 (耗时: $time_formatted)"
        echo "=================================================================================="
        echo
        echo "服务访问地址:"
        echo "  Web 前端:    http://localhost:$frontend_port"
        [ "$LAUNCH_MOBILE" = "true" ] && echo "  手机端 Web:   http://localhost:$mobile_port"
        echo "  平台登录:    http://localhost:$frontend_port/infra"
        echo "  后端 API:    http://localhost:$BACKEND_PORT"
        echo "  API 文档:    http://localhost:$BACKEND_PORT/docs"
        
        # 获取局域网 IP
        local lan_ip=""
        if command -v ip &>/dev/null; then
            lan_ip=$(ip route get 1 2>/dev/null | awk '{print $7; exit}' || true)
        fi
        if [ -z "$lan_ip" ] && command -v hostname &>/dev/null; then
            lan_ip=$(hostname -I 2>/dev/null | awk '{print $1}' || true)
        fi
        if [ -z "$lan_ip" ] && command -v ipconfig &>/dev/null; then
            lan_ip=$(ipconfig 2>/dev/null | grep -E "IPv4|^\s*[0-9]" | grep -oE "([0-9]{1,3}\.){3}[0-9]{1,3}" | head -1 || true)
        fi

        if [ -n "$lan_ip" ]; then
            echo "  局域网访问 (Web): http://$lan_ip:$frontend_port"
            [ "$LAUNCH_MOBILE" = "true" ] && echo "  局域网访问 (App): http://$lan_ip:$mobile_port"
        fi
        if [ -f ".logs/inngest.pid" ]; then
            echo "  Inngest Dashboard: http://localhost:$INNGEST_PORT/_dashboard"
        fi
        echo
        
        # Windows: 如果未启动手机端，给予提示
        if [ "$LAUNCH_MOBILE" != "true" ] && [ -d "riveredge-mobile" ]; then
            echo "提示: 如需启动手机端 App，请运行: ./Launch.dev.sh mobile"
            echo
        fi

        echo "管理命令:"
        echo "  查看状态:    ./Launch.dev.sh status"
        echo "  停止服务:    ./Launch.dev.sh stop"
        echo "  重启服务:    ./Launch.dev.sh restart"
        echo "  获取帮助:    ./Launch.dev.sh help"
        echo
        echo "日志文件:"
        echo "  后端日志:    .logs/backend.log"
        echo "  前端日志:    .logs/frontend.log"
        if [ -f ".logs/inngest.pid" ]; then
            echo "  Inngest日志: .logs/inngest.log"
        fi
        echo "  清理日志:    .logs/taskkill.log"
        echo
        echo "提示:"
        echo "  服务将在后台持续运行"
        echo "  如需停止，请使用 ./Launch.dev.sh stop"
        echo "  首次访问可能需要等待前端完全编译"
        echo
        echo "=================================================================================="
    else
        local lan_ip=""
        command -v ip &>/dev/null && lan_ip=$(ip route get 1 2>/dev/null | awk '{print $7; exit}' || true)
        [ -z "$lan_ip" ] && command -v hostname &>/dev/null && lan_ip=$(hostname -I 2>/dev/null | awk '{print $1}' || true)
        [ -z "$lan_ip" ] && command -v ipconfig &>/dev/null && lan_ip=$(ipconfig 2>/dev/null | grep -oE "([0-9]{1,3}\.){3}[0-9]{1,3}" | head -1 || true)
        
        if [ -n "$lan_ip" ]; then
            [ "$LAUNCH_MOBILE" = "true" ] && log_key "启动完成 - Web: http://localhost:$frontend_port 手机端: http://$lan_ip:$mobile_port" || log_key "启动完成 - Web: http://localhost:$frontend_port"
        else
            [ "$LAUNCH_MOBILE" = "true" ] && log_key "启动完成 - Web: http://localhost:$frontend_port 手机端: http://localhost:$mobile_port" || log_key "启动完成 - Web: http://localhost:$frontend_port"
        fi
    fi
    echo

    # 最终验证
    log_info "执行最终服务验证..."
    if check_service_health "http://localhost:$BACKEND_PORT/health" "后端服务"; then
        log_success "后端服务验证通过"
    else
        log_warn "后端服务验证失败，请检查日志"
    fi

    # 检查前端是否可以访问（异步检查）
    (sleep 2 && curl -s --max-time 3 "http://localhost:$frontend_port" >/dev/null 2>&1 && log_success "前端服务验证通过" || log_warn "前端服务验证失败，可能仍在编译中") &

    # 启动完成后仅自动打开 Web 端（不打开手机端）
    (sleep 2 && (
        if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]]; then
            # Windows: 优先使用 cmd start
            cmd //c start "" "http://localhost:$frontend_port" 2>/dev/null || start "http://localhost:$frontend_port" 2>/dev/null || true
        elif command -v open &>/dev/null; then
            open "http://localhost:$frontend_port"
        elif command -v xdg-open &>/dev/null; then
            xdg-open "http://localhost:$frontend_port"
        fi
    )) &

    log_success "RiverEdge SaaS 框架启动完成！开始您的开发之旅吧！"
}

# 显示帮助信息
show_help() {
    cat << EOF
RiverEdge SaaS 框架一键启动脚本

用法: $0 [命令] [选项]

命令:
    start     启动所有服务 (默认)
    mobile    手机端启动 (前端监听 0.0.0.0，同网段手机可访问)
    stop      停止所有服务
    restart   重启所有服务 (静默模式)
    fast      快速启动 (强制静默，最快速度)
    status    显示服务状态
    help      显示此帮助信息

环境变量配置:
    BACKEND_PORT=$BACKEND_PORT          后端服务端口
    FRONTEND_PORT=$FRONTEND_PORT        Web 前端端口 (默认 8100)
    MOBILE_FRONTEND_PORT=$MOBILE_FRONTEND_PORT  手机端前端端口 (默认 8101)
    LAUNCH_MOBILE=true/false           Windows 默认 false(仅Web)，Linux/Mac 默认 true
    DEBUG=$DEBUG                       调试模式
    QUIET=$QUIET                       静默模式 (减少输出)

示例:
    $0                            # 启动服务 (Windows 仅 Web，Linux/Mac 含手机端)
    $0 mobile                     # 手机端启动（同网段手机可访问前端）
    $0 stop                       # 停止服务
    $0 restart                    # 重启服务 (静默模式)
    $0 fast                       # 快速启动 (最快速度，强制静默)
    QUIET=true $0                 # 静默启动 (快速模式)
    BACKEND_PORT=9002 $0          # 指定后端端口启动
    DEBUG=true $0                 # 启用调试模式

日志文件:
    .logs/backend.log         后端日志
    .logs/frontend.log        前端日志
    .logs/taskkill.log        进程清理日志

EOF
}

# 处理命令行参数
case "$1" in
    stop)
        QUIET=true log_info "停止所有服务..."
        stop_all
        QUIET=true log_success "服务已停止"
        ;;
    restart)
        QUIET=true log_info "重启所有服务..."
        stop_all
        sleep 0.5  # 减少重启等待时间
        QUIET="${QUIET:-true}" main  # 重启时默认静默，除非明确指定
        ;;
    status)
        show_status
        ;;
    fast|quick)
        # 快速启动模式：强制静默，跳过所有不必要的检查
        QUIET=true DEBUG=false main
        ;;
    mobile|phone)
        # 手机端启动：前端绑定 0.0.0.0，同网段手机可通过本机 IP 访问
        LAUNCH_MOBILE=true main
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        main
        ;;
esac
