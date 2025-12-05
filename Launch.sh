#!/bin/bash
# RiverEdge SaaS 多组织框架 - 一键启动脚本
# 自动处理端口冲突，进程清理，环境检查等
# 严禁使用CMD和PowerShell，只使用bash和Linux命令
#
# 快速启动选项:
#   ./Launch.sh fast    - 最快启动，强制静默
#   QUIET=true ./Launch.sh  - 静默启动
#   ./fast-start.sh        - 快速启动脚本别名

set -e  # 遇到错误立即退出

# ========================================
# 配置参数 (可通过环境变量覆盖)
# ========================================

# 服务端口配置
BACKEND_PORT="${BACKEND_PORT:-9000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
INNGEST_PORT="${INNGEST_PORT:-8288}"

# 启动超时配置（秒）- 已缩短
BACKEND_START_TIMEOUT="${BACKEND_START_TIMEOUT:-30}"
FRONTEND_START_TIMEOUT="${FRONTEND_START_TIMEOUT:-30}"

# 健康检查配置 - 已缩短
HEALTH_CHECK_INTERVAL="${HEALTH_CHECK_INTERVAL:-1}"
HEALTH_CHECK_MAX_RETRIES="${HEALTH_CHECK_MAX_RETRIES:-30}"

# 进程清理配置 - 已缩短
FORCE_KILL_TIMEOUT="${FORCE_KILL_TIMEOUT:-5}"
PORT_CLEANUP_RETRIES="${PORT_CLEANUP_RETRIES:-10}"

# 虚拟环境配置
VENV_NAME="${VENV_NAME:-venv311}"
PYTHON_MIN_VERSION="${PYTHON_MIN_VERSION:-3.11}"
NODE_MIN_VERSION="${NODE_MIN_VERSION:-16}"

# 日志配置
LOG_MAX_AGE="${LOG_MAX_AGE:-7}"  # 日志保留天数
LOG_MAX_SIZE="${LOG_MAX_SIZE:-10}"  # 日志轮转大小（MB）

# 调试模式
DEBUG="${DEBUG:-false}"

# 静默模式 - 减少输出，只显示关键信息
QUIET="${QUIET:-false}"

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

# 检查虚拟环境状态
check_venv() {
    if [ ! -d "venv311" ]; then
        log_error "虚拟环境 venv311 不存在"
        return 1
    fi

    # 检查虚拟环境是否完整
    if [ ! -f "venv311/pyvenv.cfg" ] && [ ! -f "venv311/Scripts/activate" ]; then
        log_error "虚拟环境 venv311 不完整，请重新创建"
        return 1
    fi

    log_success "虚拟环境: venv311 ✓"
    return 0
}

# 检查项目文件完整性
check_project_integrity() {
    local missing_files=()

    # 检查必需的目录
    local required_dirs=(
        "riveredge-backend/src"
        "riveredge-backend/src/infra"
        "riveredge-backend/src/app"
        "riveredge-frontend/src"
    )

    for dir in "${required_dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            missing_files+=("$dir (目录)")
        fi
    done

    # 检查必需的文件
    local required_files=(
        "riveredge-backend/pyproject.toml"
        "riveredge-backend/requirements.txt"
        "riveredge-frontend/package.json"
        "riveredge-backend/src/app/main.py"
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

# 无脑清理所有相关进程（全局清理，不考虑端口）
# 目标：杀死一切可能阻碍启动的进程，直到能够启动为止
brutal_cleanup_all() {
    log_warn "执行无脑清理：杀死一切可能阻碍启动的进程..."
    
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local log_dir="$script_dir/startlogs"
    mkdir -p "$log_dir" 2>/dev/null || true
    
    # Windows 专用：无脑杀死所有相关进程
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]] && command -v taskkill &> /dev/null; then
        log_warn "Windows: 无脑杀死所有 node.exe 进程..."
        taskkill /IM node.exe /T /F >> "$log_dir/taskkill.log" 2>&1 || true
        sleep 0.2
        taskkill /IM node.exe /F >> "$log_dir/taskkill.log" 2>&1 || true
        
        log_warn "Windows: 无脑杀死所有 npm.exe 进程..."
        taskkill /IM npm.exe /T /F >> "$log_dir/taskkill.log" 2>&1 || true
        sleep 0.2
        taskkill /IM npm.exe /F >> "$log_dir/taskkill.log" 2>&1 || true
        
        log_warn "Windows: 无脑杀死所有 python.exe 进程..."
        taskkill /IM python.exe /T /F >> "$log_dir/taskkill.log" 2>&1 || true
        sleep 0.3
        taskkill /IM python.exe /F >> "$log_dir/taskkill.log" 2>&1 || true
        
        log_warn "Windows: 无脑杀死所有 pythonw.exe 进程..."
        taskkill /IM pythonw.exe /T /F >> "$log_dir/taskkill.log" 2>&1 || true
        sleep 0.3
        taskkill /IM pythonw.exe /F >> "$log_dir/taskkill.log" 2>&1 || true
        
        # 使用 wmic 彻底清理所有相关进程
        if command -v wmic &> /dev/null; then
            log_warn "Windows: 使用 wmic 彻底清理所有 vite 相关进程..."
            wmic process where "CommandLine like '%vite%'" delete >> "$log_dir/taskkill.log" 2>&1 || true
            
            log_warn "Windows: 使用 wmic 彻底清理所有 uvicorn 相关进程..."
            wmic process where "CommandLine like '%uvicorn%'" delete >> "$log_dir/taskkill.log" 2>&1 || true
            
            log_warn "Windows: 使用 wmic 彻底清理所有 main:app 相关进程..."
            wmic process where "CommandLine like '%main:app%'" delete >> "$log_dir/taskkill.log" 2>&1 || true
            
            log_warn "Windows: 使用 wmic 彻底清理所有 fastapi 相关进程..."
            wmic process where "CommandLine like '%fastapi%'" delete >> "$log_dir/taskkill.log" 2>&1 || true
        fi
    fi
    
    # Linux/Mac: 使用 pkill 无脑杀死所有相关进程
    if command -v pkill &> /dev/null; then
        log_warn "Linux/Mac: 无脑杀死所有 vite 相关进程..."
        pkill -9 -f "vite" 2>/dev/null || true
        pkill -9 -f "node.*vite" 2>/dev/null || true
        pkill -9 -f "npm.*vite" 2>/dev/null || true
        
        log_warn "Linux/Mac: 无脑杀死所有 uvicorn 相关进程..."
        pkill -9 -f "uvicorn" 2>/dev/null || true
        pkill -9 -f "python.*uvicorn" 2>/dev/null || true
        pkill -9 -f "python.*main:app" 2>/dev/null || true
    fi
    
    # 等待进程完全终止
    sleep 1
    
    log_success "无脑清理完成"
}

# 强制清理指定端口，直到成功
# 持续清理直到端口真正释放（增强版：更激进，重试更多次）
force_clear_port() {
    local port=$1
    local max_attempts=10  # 增加重试次数
    local attempt=1
    
    log_info "强制清理端口 $port (最多尝试 $max_attempts 次，直到成功为止)..."
    
    while [ $attempt -le $max_attempts ]; do
        # 如果端口未被占用，直接返回成功
        if ! check_port $port; then
            log_success "端口 $port 未被占用，清理成功"
            return 0
        fi
        
        log_info "尝试 $attempt/$max_attempts: 清理端口 $port..."
        
        # 先执行全局无脑清理（每次尝试都清理）
        if [ $attempt -eq 1 ] || [ $((attempt % 3)) -eq 0 ]; then
            brutal_cleanup_all
        fi
        
        # 执行端口特定清理
        kill_process_on_port $port || true
        
        # 等待进程完全终止
        sleep 1
        
        # 验证端口是否已释放
        if ! check_port $port; then
            log_success "端口 $port 已成功释放 (尝试 $attempt/$max_attempts)"
            return 0
        fi
        
        log_warn "端口 $port 仍被占用，继续尝试清理..."
        attempt=$((attempt + 1))
        
        # 每次尝试之间等待
        if [ $attempt -le $max_attempts ]; then
            sleep 1
        fi
    done
    
    # 所有尝试都失败，最后一次绝望尝试
    log_error "端口 $port 清理失败，已尝试 $max_attempts 次，执行最后一次绝望清理..."
    brutal_cleanup_all
    kill_process_on_port $port || true
    sleep 2
    
    # 最后一次检查
    if ! check_port $port; then
        log_success "端口 $port 在最后一次清理后已释放"
        return 0
    fi
    
    # 显示占用端口的进程信息
    log_warn "显示占用端口 $port 的进程信息:"
    if command -v netstat &> /dev/null; then
        netstat -ano 2>/dev/null | grep ":$port " | head -10 || true
    fi
    
    log_error "端口 $port 清理失败，已尝试 $max_attempts 次，请手动检查"
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

# 杀死占用端口的进程 - Windows 完全强制版（彻底清理一切）
# 
# Windows 专用强制清理策略：
# 1. 通过 netstat 查找所有占用端口的进程（包括所有状态）
# 2. 使用 taskkill /F /T 强制杀死进程树（包括所有子进程）
# 3. 使用 wmic 命令（如果可用）彻底杀死进程
# 4. 通过进程名批量杀死所有相关进程（node.exe, npm.exe, python.exe, uvicorn, vite 等）
# 5. 多次尝试，确保彻底清理
kill_process_on_port() {
    local port=$1
    log_warn "端口 $port 被占用，开始 Windows 完全强制清理一切相关进程..."

    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local log_dir="$script_dir/startlogs"
    mkdir -p "$log_dir" 2>/dev/null || true

    # Windows 专用：使用 netstat 查找所有占用端口的进程（包括 LISTENING、ESTABLISHED 等所有状态）
    if command -v netstat &> /dev/null && command -v taskkill &> /dev/null; then
        log_info "Windows: 查找所有占用端口 $port 的进程..."
        
        # 查找所有占用端口的进程 PID（包括所有 TCP 状态）
        local all_pids=$(netstat -ano 2>/dev/null | grep ":$port " | awk '{print $NF}' | sort -u | grep -v "^0$" | grep -v "^$")
        
        if [ ! -z "$all_pids" ]; then
            log_info "发现占用端口 $port 的进程: $all_pids"
            
            # 逐个强制杀死进程树（多次尝试，确保彻底）
            for pid in $all_pids; do
                if [ ! -z "$pid" ] && [ "$pid" != "0" ] && [ "$pid" != "-" ]; then
                    log_warn "强制杀死进程 PID: $pid (包括所有子进程)..."
                    
                    # 方法1: taskkill /F /T - 强制杀死进程树（最彻底）
                    taskkill /PID $pid /T /F >> "$log_dir/taskkill.log" 2>&1 || true
                    
                    # 方法2: wmic 命令（如果可用，更彻底）
                    if command -v wmic &> /dev/null; then
                        wmic process where "ProcessId=$pid" delete >> "$log_dir/taskkill.log" 2>&1 || true
                        # 杀死所有子进程
                        wmic process where "ParentProcessId=$pid" delete >> "$log_dir/taskkill.log" 2>&1 || true
                    fi
                    
                    # 方法3: 再次尝试 taskkill（确保彻底）
                    sleep 0.2
                    taskkill /PID $pid /F >> "$log_dir/taskkill.log" 2>&1 || true
                    
                    # 方法4: 第三次尝试（确保彻底）
                    sleep 0.2
                    taskkill /PID $pid /T /F >> "$log_dir/taskkill.log" 2>&1 || true
                fi
            done
        fi
    fi

    # Windows 专用：通过进程名批量杀死所有相关进程（不考虑其他应用，统统杀死）
    if command -v taskkill &> /dev/null; then
        # 清理前端相关进程（杀死所有 node.exe、npm.exe、vite 等，不考虑其他应用）
        if [ "$port" == "$FRONTEND_PORT" ]; then
            log_warn "Windows: 强制清理所有前端相关进程（清理 node、npm、vite 进程）..."
            
            # 查找所有占用前端端口的进程
            local frontend_pids=$(netstat -ano 2>/dev/null | grep ":$FRONTEND_PORT " | awk '{print $NF}' | sort -u | grep -v "^0$" | grep -v "^$")
            
            # 强制杀死所有相关进程（多次尝试）
            for pid in $frontend_pids; do
                if [ ! -z "$pid" ] && [ "$pid" != "0" ]; then
                    taskkill /PID $pid /T /F >> "$log_dir/taskkill.log" 2>&1 || true
                    sleep 0.1
                    taskkill /PID $pid /F >> "$log_dir/taskkill.log" 2>&1 || true
                fi
            done
            
            # 强制杀死所有 node.exe 进程（不考虑其他应用）
            log_warn "Windows: 强制杀死所有 node.exe 进程（清理）..."
            taskkill /IM node.exe /T /F >> "$log_dir/taskkill.log" 2>&1 || true
            sleep 0.2
            taskkill /IM node.exe /F >> "$log_dir/taskkill.log" 2>&1 || true
            
            # 强制杀死所有 npm.exe 进程（不考虑其他应用）
            log_warn "Windows: 强制杀死所有 npm.exe 进程（清理）..."
            taskkill /IM npm.exe /T /F >> "$log_dir/taskkill.log" 2>&1 || true
            sleep 0.2
            taskkill /IM npm.exe /F >> "$log_dir/taskkill.log" 2>&1 || true
            
            # 强制杀死所有 vite 相关进程（通过命令行匹配）
            log_warn "Windows: 强制杀死所有 vite 相关进程（清理）..."
            for pid in $(wmic process where "CommandLine like '%vite%'" get ProcessId /format:value 2>/dev/null | grep "ProcessId=" | cut -d= -f2); do
                if [ ! -z "$pid" ] && [ "$pid" != "0" ]; then
                    taskkill /PID $pid /T /F >> "$log_dir/taskkill.log" 2>&1 || true
                fi
            done
        fi

        # 清理后端相关进程（杀死所有 python.exe、uvicorn 等，不考虑其他应用）
        if [ "$port" == "$BACKEND_PORT" ]; then
            log_warn "Windows: 强制清理所有后端相关进程（清理 python、uvicorn 进程）..."
            
            # 查找所有占用后端端口的进程（包括所有 TCP 状态）
            local backend_pids=$(netstat -ano 2>/dev/null | grep ":$BACKEND_PORT " | awk '{print $NF}' | sort -u | grep -v "^0$" | grep -v "^$")
            
            # 强制杀死所有相关进程（多次尝试，更彻底）
            for pid in $backend_pids; do
                if [ ! -z "$pid" ] && [ "$pid" != "0" ]; then
                    log_info "Windows: 强制杀死占用后端端口的进程 PID: $pid..."
                    # 方法1: taskkill /F /T - 强制杀死进程树
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
            
            # 强制杀死所有 uvicorn 相关进程（通过命令行匹配，优先处理）
            log_warn "Windows: 强制杀死所有 uvicorn 相关进程（清理）..."
            if command -v wmic &> /dev/null; then
                for pid in $(wmic process where "CommandLine like '%uvicorn%'" get ProcessId /format:value 2>/dev/null | grep "ProcessId=" | cut -d= -f2); do
                    if [ ! -z "$pid" ] && [ "$pid" != "0" ]; then
                        log_info "Windows: 强制杀死 uvicorn 进程 PID: $pid..."
                        taskkill /PID $pid /T /F >> "$log_dir/taskkill.log" 2>&1 || true
                        sleep 0.1
                        taskkill /PID $pid /F >> "$log_dir/taskkill.log" 2>&1 || true
                        wmic process where "ProcessId=$pid" delete >> "$log_dir/taskkill.log" 2>&1 || true
                    fi
                done
            fi
            
            # 强制杀死所有 python.exe 进程（不考虑其他应用）
            log_warn "Windows: 强制杀死所有 python.exe 进程（清理）..."
            taskkill /IM python.exe /T /F >> "$log_dir/taskkill.log" 2>&1 || true
            sleep 0.3
            taskkill /IM python.exe /F >> "$log_dir/taskkill.log" 2>&1 || true
            
            # 强制杀死所有 pythonw.exe 进程（不考虑其他应用）
            log_warn "Windows: 强制杀死所有 pythonw.exe 进程（清理）..."
            taskkill /IM pythonw.exe /T /F >> "$log_dir/taskkill.log" 2>&1 || true
            sleep 0.3
            taskkill /IM pythonw.exe /F >> "$log_dir/taskkill.log" 2>&1 || true
            
            # 额外清理：通过命令行匹配杀死所有包含 main:app 的进程
            log_warn "Windows: 强制杀死所有 main:app 相关进程（清理）..."
            if command -v wmic &> /dev/null; then
                for pid in $(wmic process where "CommandLine like '%main:app%'" get ProcessId /format:value 2>/dev/null | grep "ProcessId=" | cut -d= -f2); do
                    if [ ! -z "$pid" ] && [ "$pid" != "0" ]; then
                        taskkill /PID $pid /T /F >> "$log_dir/taskkill.log" 2>&1 || true
                    fi
                done
            fi
        fi
    fi

    # Linux/Mac: 使用 pkill 杀死进程（更激进）
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

# 启动后端服务（使用 uvicorn）
start_backend() {
    local port=$1
    log_info "启动后端服务 (uvicorn, 端口: $port)..."

    # 进入后端目录并启动
    cd riveredge-backend

    # 激活虚拟环境
    if [ -f "../venv311/bin/activate" ]; then
        source ../venv311/bin/activate
    elif [ -f "../venv311/Scripts/activate" ]; then
        # Windows Git Bash兼容
        source ../venv311/Scripts/activate
    else
        log_error "虚拟环境未找到，请检查 venv311 目录"
        exit 1
    fi

    # 设置环境变量（传递给 start_backend.py）
    export PORT=$port
    export HOST=${HOST:-0.0.0.0}
    
    # 确保启用热重载（开发环境默认启用）
    # 可以通过设置 RELOAD=false 来禁用
    if [ -z "$RELOAD" ]; then
        export RELOAD=true  # 默认启用热重载
    fi

    # 清理旧的PID文件
    rm -f ../startlogs/backend.pid

    # ⚠️ 无脑清理策略：只有在端口被占用时才执行彻底清理
    if check_port $port; then
        log_warn "端口 $port 被占用，执行无脑清理所有可能阻碍启动的进程..."
        brutal_cleanup_all
        
        # 强制清理端口，直到成功为止
        log_warn "强制清理端口 $port 直到成功..."
        if ! force_clear_port $port; then
            log_error "端口 $port 清理失败，无法启动后端服务"
            return 1
        fi
        
        # 启动前最后一次验证端口
        if check_port $port; then
            log_error "端口 $port 在启动前仍被占用，执行最后一次绝望清理..."
            brutal_cleanup_all
            sleep 2
            if check_port $port; then
                log_error "端口 $port 仍被占用，请手动检查并清理占用进程"
                return 1
            fi
        fi
    else
        log_info "端口 $port 未被占用，直接启动"
    fi

    # 启动后端服务（使用 uvicorn）
    log_info "使用 uvicorn 启动后端服务..."
    # 使用更稳定的启动方式：指定正确的模块路径和工作目录
    PYTHONPATH="$(pwd)/src" nohup python -m uvicorn app.main:app --host 0.0.0.0 --port $port --reload --reload-include "*.py" > ../startlogs/backend.log 2>&1 &
    local backend_pid=$!
    echo $backend_pid > ../startlogs/backend.pid

    cd ..
    log_success "后端服务启动中 (PID: $backend_pid, 端口: $port, uvicorn + 热重载)"

    # 快速等待后端启动（缩短等待时间）
    if [ "$QUIET" != "true" ]; then
        log_info "等待后端服务启动..."
    fi
    if ! wait_for_service "http://localhost:$port/health" "后端服务" 15; then
        log_error "后端服务启动失败，请检查 startlogs/backend.log"
        if [ -f "startlogs/backend.pid" ]; then
            kill $backend_pid 2>/dev/null || true
            rm -f startlogs/backend.pid
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
    local log_dir="$script_dir/startlogs"
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

# Windows 专用：硬重启 VITE 相关进程（强制杀死）
hard_restart_vite_windows() {
    log_warn "Windows: 执行硬重启 VITE 相关进程（强制杀死）..."
    
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local log_dir="$script_dir/startlogs"
    mkdir -p "$log_dir" 2>/dev/null || true
    
    # 只在 Windows 下执行
    if command -v taskkill &> /dev/null; then
        # 1. 查找所有占用前端端口的进程并强制杀死
        local vite_pids=$(netstat -ano 2>/dev/null | grep ":$FRONTEND_PORT " | awk '{print $NF}' | sort -u | grep -v "^0$" | grep -v "^$")
        if [ ! -z "$vite_pids" ]; then
            log_info "Windows: 发现占用 $FRONTEND_PORT 端口的进程: $vite_pids"
            for pid in $vite_pids; do
                if [ ! -z "$pid" ] && [ "$pid" != "0" ]; then
                    log_info "Windows: 强制杀死进程 PID: $pid (包括所有子进程)..."
                    taskkill /PID $pid /T /F >> "$log_dir/taskkill.log" 2>&1 || true
                fi
            done
        fi
        
        # 2. 使用 wmic 查找所有包含 vite 的进程并杀死
        if command -v wmic &> /dev/null; then
            log_info "Windows: 使用 wmic 查找所有 vite 相关进程..."
            wmic process where "CommandLine like '%vite%'" delete >> "$log_dir/taskkill.log" 2>&1 || true
        fi
        
        # 3. 强制杀死所有 node.exe 和 npm.exe 进程（不考虑其他应用）
        log_warn "Windows: 强制杀死所有 node.exe 进程（硬重启 VITE）..."
        taskkill /IM node.exe /T /F >> "$log_dir/taskkill.log" 2>&1 || true
        log_warn "Windows: 强制杀死所有 npm.exe 进程（硬重启 VITE）..."
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
        if [ -f "startlogs/backend.pid" ]; then
            local backend_pid=$(cat startlogs/backend.pid 2>/dev/null)
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
        if [ -f "startlogs/frontend.pid" ]; then
            local frontend_pid=$(cat startlogs/frontend.pid 2>/dev/null)
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

# 启动 Inngest 服务
start_inngest() {
    local port=$1
    log_info "启动 Inngest 服务 (端口: $port)..."
    
    # 检查 Inngest 可执行文件
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local inngest_exe=""
    
    # 查找 Inngest 可执行文件
    if [ -f "$script_dir/bin/inngest.exe" ]; then
        inngest_exe="$script_dir/bin/inngest.exe"
    elif [ -f "$script_dir/bin/inngest" ]; then
        inngest_exe="$script_dir/bin/inngest"
    elif [ -f "$script_dir/bin/inngest-windows-amd64.exe" ]; then
        inngest_exe="$script_dir/bin/inngest-windows-amd64.exe"
    else
        log_warn "未找到 Inngest 可执行文件，跳过 Inngest 服务启动"
        log_warn "请确保 Inngest 可执行文件位于以下位置之一："
        log_warn "  - $script_dir/bin/inngest.exe"
        log_warn "  - $script_dir/bin/inngest"
        log_warn "  - $script_dir/bin/inngest-windows-amd64.exe"
        return 0  # 不阻止其他服务启动
    fi
    
    # 检查配置文件
    local config_file="$script_dir/bin/inngest.config.json"
    if [ ! -f "$config_file" ]; then
        log_warn "未找到 Inngest 配置文件: $config_file，跳过 Inngest 服务启动"
        return 0  # 不阻止其他服务启动
    fi
    
    # 检查端口是否被占用
    if check_port $port; then
        log_warn "端口 $port 被占用，清理 Inngest 相关进程..."
        kill_process_on_port $port || true
        sleep 1
        if check_port $port; then
            log_warn "端口 $port 仍被占用，跳过 Inngest 服务启动"
            return 0  # 不阻止其他服务启动
        fi
    fi
    
    # 清理旧的PID文件
    rm -f "$script_dir/startlogs/inngest.pid"
    
    # 启动 Inngest 服务
    cd "$script_dir"
    # 确保日志目录存在
    mkdir -p "$script_dir/startlogs" 2>/dev/null || true
    
    # 创建日志文件（确保存在）
    touch "$script_dir/startlogs/inngest.log" 2>/dev/null || true
    
    # Windows Git Bash 兼容：使用不同的启动方式
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]]; then
        # Windows: 直接后台启动，重定向输出
        ("$inngest_exe" dev --config "$config_file" >> "$script_dir/startlogs/inngest.log" 2>&1) &
        local inngest_pid=$!
    else
        # Linux/Mac: 使用 nohup
        nohup "$inngest_exe" dev --config "$config_file" >> "$script_dir/startlogs/inngest.log" 2>&1 &
        local inngest_pid=$!
    fi
    
    # 等待一下确保进程启动
    sleep 2
    
    # 验证进程是否真的在运行（通过检查端口或进程）
    local process_running=false
    
    # 方法1: 检查进程是否存在
    if kill -0 $inngest_pid 2>/dev/null; then
        process_running=true
    fi
    
    # 方法2: 检查端口是否监听（更可靠）
    if check_port $port; then
        process_running=true
        # 如果进程ID不匹配，尝试从端口获取正确的PID
        local port_pid=$(get_pid_by_port $port)
        if [ ! -z "$port_pid" ] && [ "$port_pid" != "0" ] && [ "$port_pid" != "-" ]; then
            inngest_pid=$port_pid
        fi
    fi
    
    if [ "$process_running" = false ]; then
        log_warn "Inngest 进程启动失败，检查日志: $script_dir/startlogs/inngest.log"
        if [ -f "$script_dir/startlogs/inngest.log" ] && [ -s "$script_dir/startlogs/inngest.log" ]; then
            log_warn "Inngest 启动错误:"
            tail -10 "$script_dir/startlogs/inngest.log" | while read line; do
                log_warn "  $line"
            done
        else
            log_warn "日志文件为空或不存在，可能进程立即退出了"
        fi
        return 0  # 不阻止其他服务启动
    fi
    
    echo $inngest_pid > "$script_dir/startlogs/inngest.pid"
    
    log_success "Inngest 服务启动中 (PID: $inngest_pid, 端口: $port)"
    
    # 等待 Inngest 服务启动
    if ! wait_for_service "http://localhost:$port" "Inngest 服务" 15; then
        log_warn "Inngest 服务启动失败，请检查 $script_dir/startlogs/inngest.log"
        if [ -f "$script_dir/startlogs/inngest.pid" ]; then
            kill $inngest_pid 2>/dev/null || true
            rm -f "$script_dir/startlogs/inngest.pid"
        fi
        return 0  # 不阻止其他服务启动
    fi
    
    log_success "Inngest Dashboard: http://localhost:$port/_dashboard"
}

# 启动前端服务
start_frontend() {
    local port=$1
    local backend_port=$2
    log_info "启动前端服务 (端口: $port, 后端: $backend_port)..."
    
    # ⚠️ 无脑清理策略：只有在端口被占用时才执行彻底清理
    if check_port $port; then
        log_warn "端口 $port 被占用，执行无脑清理所有可能阻碍启动的进程..."
        brutal_cleanup_all
        
        # 强制清理端口，直到成功为止
        log_warn "强制清理端口 $port 直到成功..."
        if ! force_clear_port $port; then
            log_error "端口 $port 清理失败，无法启动前端服务"
            return 1
        fi
        
        # 启动前最后一次验证端口
        if check_port $port; then
            log_error "端口 $port 在启动前仍被占用，执行最后一次绝望清理..."
            brutal_cleanup_all
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
    mkdir -p "$project_root/startlogs" 2>/dev/null || true

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
        kill_process_on_port $port || true
        sleep 1
        if check_port $port; then
            log_error "端口 $port 仍被占用，无法启动前端服务"
            return 1
        fi
    fi

    # 清理旧的PID文件
    rm -f "$project_root/startlogs/frontend.pid"

    # 启动前最后一次端口检查（Windows 上需要更长的等待时间）
    if check_port $port; then
        log_warn "启动前检查：端口 $port 仍被占用，最后一次清理..."
        kill_process_on_port $port || true
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
    # Windows 兼容性：在 Windows 上使用 127.0.0.1 而不是 0.0.0.0 或 localhost，避免 IPv6 权限问题
    # localhost 在 Windows 上可能解析为 IPv6 的 ::1，导致 EACCES 权限错误
    local host_bind="0.0.0.0"
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]]; then
        host_bind="127.0.0.1"  # 强制使用 IPv4，避免 localhost 解析为 IPv6
    fi
    # 使用 npx vite 直接启动，指定 src 作为根目录（vite.config.ts 在 src 目录下）
    # vite [root] 指定根目录，--port 和 --host 指定端口和主机
    nohup npx vite src --port $port --host $host_bind > "$project_root/startlogs/frontend.log" 2>&1 &
    local frontend_pid=$!
    echo $frontend_pid > "$project_root/startlogs/frontend.pid"

    cd "$project_root"
    log_success "前端服务启动中 (PID: $frontend_pid, 端口: $port)"

    # 快速等待前端启动（缩短等待时间）
    if ! wait_for_frontend $port "前端服务" 15; then
        log_error "前端服务启动失败，请检查 $project_root/startlogs/frontend.log"
        if [ -f "$project_root/startlogs/frontend.pid" ]; then
            kill $frontend_pid 2>/dev/null || true
            rm -f "$project_root/startlogs/frontend.pid"
        fi
        exit 1
    fi
}

# 停止所有服务 - Windows兼容（增强版）
stop_all() {
    log_info "停止所有服务..."

    # 确保日志目录存在
    mkdir -p startlogs 2>/dev/null || true
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local log_dir="$script_dir/startlogs"

    # 停止后端（通过PID文件）
    if [ -f "startlogs/backend.pid" ]; then
        local backend_pid=$(cat startlogs/backend.pid 2>/dev/null)
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
                # 如果还在运行，强制杀死
                if kill -0 $backend_pid 2>/dev/null; then
                    log_warn "强制停止后端服务 (PID: $backend_pid)"
                    kill -KILL $backend_pid 2>/dev/null || true
                    if command -v taskkill &> /dev/null; then
                        taskkill /PID $backend_pid /F >> "$log_dir/taskkill.log" 2>&1 || true
                    fi
                fi
            fi
        fi
        rm -f startlogs/backend.pid
    fi

    # 停止前端（通过PID文件）
    if [ -f "startlogs/frontend.pid" ]; then
        local frontend_pid=$(cat startlogs/frontend.pid 2>/dev/null)
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
                # 如果还在运行，强制杀死
                if kill -0 $frontend_pid 2>/dev/null; then
                    log_warn "强制停止前端服务 (PID: $frontend_pid)"
                    kill -KILL $frontend_pid 2>/dev/null || true
                    if command -v taskkill &> /dev/null; then
                        taskkill /PID $frontend_pid /F >> "$log_dir/taskkill.log" 2>&1 || true
                    fi
                fi
            fi
        fi
        rm -f startlogs/frontend.pid
    fi

    # 停止 Inngest（通过PID文件）
    if [ -f "startlogs/inngest.pid" ]; then
        local inngest_pid=$(cat startlogs/inngest.pid 2>/dev/null)
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
                # 如果还在运行，强制杀死
                if kill -0 $inngest_pid 2>/dev/null; then
                    log_warn "强制停止 Inngest 服务 (PID: $inngest_pid)"
                    kill -KILL $inngest_pid 2>/dev/null || true
                    if command -v taskkill &> /dev/null; then
                        taskkill /PID $inngest_pid /F >> "$log_dir/taskkill.log" 2>&1 || true
                    fi
                fi
            fi
        fi
        rm -f startlogs/inngest.pid
    fi

    # 清理可能残留的进程（简化版，避免卡住）
    log_info "清理残留进程..."
    
    # 只清理关键端口，避免遍历所有端口导致卡住
    for port in $FRONTEND_PORT $BACKEND_PORT $INNGEST_PORT; do
        if check_port $port; then
            local pid=$(get_pid_by_port $port)
            if [ ! -z "$pid" ] && [ "$pid" != "0" ] && [ "$pid" != "-" ]; then
                log_info "清理占用端口 $port 的进程 (PID: $pid)"
                # 直接强制杀死，不等待
                kill -KILL $pid 2>/dev/null || true
                if command -v taskkill &> /dev/null; then
                    taskkill /PID $pid /F >> "$log_dir/taskkill.log" 2>&1 &
                fi
            fi
        fi
    done

    # 使用 pkill 快速清理（如果可用，后台执行避免卡住）
    if command -v pkill &> /dev/null; then
        pkill -f "uvicorn.*app.main:app" 2>/dev/null &
        pkill -f "vite.*--port" 2>/dev/null &
    fi

    # 等待进程完全停止
    sleep 1

    # 最终验证：检查关键端口是否已释放
    local ports_still_occupied=0
    for port in $FRONTEND_PORT $BACKEND_PORT $INNGEST_PORT; do
        if check_port $port; then
            log_warn "警告：端口 $port 仍被占用"
            ports_still_occupied=$((ports_still_occupied + 1))
        fi
    done

    if [ $ports_still_occupied -eq 0 ]; then
        log_success "所有服务已停止，端口已释放"
    else
        log_warn "部分端口仍被占用，但继续执行启动流程"
    fi
}

# 显示状态
show_status() {
    log_info "服务状态检查:"

    if [ -f "startlogs/backend.pid" ]; then
        local backend_pid=$(cat startlogs/backend.pid)
        if kill -0 $backend_pid 2>/dev/null; then
            log_success "后端服务运行中 (PID: $backend_pid)"
        else
            log_warn "后端服务PID文件存在但进程未运行"
        fi
    else
        log_warn "后端服务未运行"
    fi

    if [ -f "startlogs/frontend.pid" ]; then
        local frontend_pid=$(cat startlogs/frontend.pid)
        if kill -0 $frontend_pid 2>/dev/null; then
            log_success "前端服务运行中 (PID: $frontend_pid)"
        else
            log_warn "前端服务PID文件存在但进程未运行"
        fi
    else
        log_warn "前端服务未运行"
    fi

    if [ -f "startlogs/inngest.pid" ]; then
        local inngest_pid=$(cat startlogs/inngest.pid)
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
    
    if check_port $INNGEST_PORT; then
        log_warn "Inngest 端口 $INNGEST_PORT 被占用"
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
    mkdir -p startlogs

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

    # 执行日志管理
    manage_logs "startlogs"

    # 显示配置摘要
    log_info "启动配置:"
    log_info "   后端端口: $BACKEND_PORT"
    log_info "   前端端口: $FRONTEND_PORT"
    log_info "   Inngest 端口: $INNGEST_PORT"
    log_info "   调试模式: $DEBUG"
    echo

    # 基础环境检查
    log_info "执行环境检查..."
    check_command curl
    check_command python
    check_python_version
    check_command npm
    check_node_version
    check_command sed
    check_command awk

    # 项目完整性检查
    log_info "检查项目完整性..."
    check_project_integrity
    check_disk_space

    # 检查项目结构（更新路径）
    if [ ! -d "riveredge-backend/src/infra" ] || [ ! -d "riveredge-backend/src/app" ] || [ ! -d "riveredge-frontend/src" ]; then
        log_error "项目结构不完整，请确保在项目根目录运行"
        log_error "需要: riveredge-backend/src/infra/, riveredge-backend/src/app/ 和 riveredge-frontend/src/ 目录"
        exit 1
    fi

    # 检查和创建虚拟环境
    if ! check_venv; then
        log_info "正在创建虚拟环境 venv311..."
        python -m venv venv311 || {
            log_error "创建虚拟环境失败"
            exit 1
        }
        log_success "虚拟环境已创建"

        # 激活虚拟环境并安装依赖
        log_info "安装后端依赖..."
        if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]]; then
            source venv311/Scripts/activate
        else
            source venv311/bin/activate
        fi

        cd riveredge-backend && pip install -r requirements.txt || {
            log_error "安装后端依赖失败"
            cd ..
            exit 1
        }
        cd ..
        log_success "后端依赖安装完成 ✓"
    fi

    # 停止现有服务
    stop_all

    # ⚠️ 无脑清理策略：只有在端口被占用时才执行彻底清理
    local need_cleanup=false
    
    # 检查端口占用情况
    if check_port "$FRONTEND_PORT" || check_port "$BACKEND_PORT"; then
        need_cleanup=true
        log_warn "检测到端口被占用，执行全局无脑清理：杀死一切可能阻碍启动的进程..."
        brutal_cleanup_all
        sleep 1  # 等待进程完全终止
    else
        log_info "端口未被占用，跳过全局清理，直接启动"
    fi

    # 强制清理指定端口，直到成功（如果被占用）
    log_info "检查并清理端口 $FRONTEND_PORT (前端)、$BACKEND_PORT (后端) 和 $INNGEST_PORT (Inngest)..."

    # 清理前端端口（如果被占用）
    if check_port "$FRONTEND_PORT"; then
        if ! force_clear_port "$FRONTEND_PORT"; then
            log_error "前端端口 $FRONTEND_PORT 清理失败，请手动检查并清理占用进程"
            log_error ""
            log_error "手动清理步骤："
            log_error "1. 检查占用端口的进程: netstat -ano | findstr :$FRONTEND_PORT"
            log_error "2. 强制杀死进程: taskkill /PID <PID> /F /T"
            log_error "3. 或者杀死所有 node 进程: taskkill /IM node.exe /F /T"
            log_error "4. 或者杀死所有 vite 进程: wmic process where \"CommandLine like '%%vite%%'\" delete"
            log_error ""
            exit 1
        fi
    else
        log_info "前端端口 $FRONTEND_PORT 未被占用，跳过清理"
    fi

    # 清理后端端口（如果被占用）
    if check_port "$BACKEND_PORT"; then
        if ! force_clear_port "$BACKEND_PORT"; then
            log_error "后端端口 $BACKEND_PORT 清理失败，请手动检查并清理占用进程"
            log_error ""
            log_error "手动清理步骤："
            log_error "1. 检查占用端口的进程: netstat -ano | findstr :$BACKEND_PORT"
            log_error "2. 强制杀死进程: taskkill /PID <PID> /F /T"
            log_error "3. 或者杀死所有 python 进程: taskkill /IM python.exe /F /T"
            log_error "4. 或者杀死所有 uvicorn 进程: wmic process where \"CommandLine like '%%uvicorn%%'\" delete"
            log_error ""
            exit 1
        fi
    else
        log_info "后端端口 $BACKEND_PORT 未被占用，跳过清理"
    fi

    # 清理 Inngest 端口（如果被占用）
    if check_port "$INNGEST_PORT"; then
        if ! force_clear_port "$INNGEST_PORT"; then
            log_warn "Inngest 端口 $INNGEST_PORT 清理失败，继续启动（Inngest 服务可选）"
        fi
    else
        log_info "Inngest 端口 $INNGEST_PORT 未被占用，跳过清理"
    fi
    
    local backend_port="$BACKEND_PORT"
    local frontend_port="$FRONTEND_PORT"
    local inngest_port="$INNGEST_PORT"
    
    log_success "端口清理完成 - 后端: $backend_port, 前端: $frontend_port, Inngest: $inngest_port"

    # 启动后端
    start_backend "$backend_port"
    if [ $? -ne 0 ]; then
        log_error "后端启动失败，退出"
        exit 1
    fi

    # 启动前端
    start_frontend "$frontend_port" "$backend_port"
    if [ $? -ne 0 ]; then
        log_error "前端启动失败，正在停止后端..."
        stop_all
        exit 1
    fi

    # 启动 Inngest（可选服务，失败不阻止其他服务）
    start_inngest "$inngest_port"

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
        echo "  前端界面:    http://localhost:$FRONTEND_PORT"
        echo "  平台登录:    http://localhost:$FRONTEND_PORT/platform"
        echo "  后端 API:    http://localhost:$BACKEND_PORT"
        echo "  API 文档:    http://localhost:$BACKEND_PORT/docs"
        echo "  Inngest:     http://localhost:$INNGEST_PORT"
        echo "  Inngest Dashboard: http://localhost:$INNGEST_PORT/_dashboard"
        echo
        echo "管理命令:"
        echo "  查看状态:    ./Launch.sh status"
        echo "  停止服务:    ./Launch.sh stop"
        echo "  重启服务:    ./Launch.sh restart"
        echo "  获取帮助:    ./Launch.sh help"
        echo
        echo "日志文件:"
        echo "  后端日志:    startlogs/backend.log"
        echo "  前端日志:    startlogs/frontend.log"
        echo "  Inngest 日志: startlogs/inngest.log"
        echo "  清理日志:    startlogs/taskkill.log"
        echo
        echo "提示:"
        echo "  服务将在后台持续运行"
        echo "  如需停止，请使用 ./Launch.sh stop"
        echo "  首次访问可能需要等待前端完全编译"
        echo
        echo "=================================================================================="
    else
        log_key "启动完成 - 前端: http://localhost:$FRONTEND_PORT 后端: http://localhost:$BACKEND_PORT Inngest: http://localhost:$INNGEST_PORT"
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
    (sleep 2 && curl -s --max-time 3 "http://localhost:$FRONTEND_PORT" >/dev/null 2>&1 && log_success "前端服务验证通过" || log_warn "前端服务验证失败，可能仍在编译中") &

    log_success "RiverEdge SaaS 框架启动完成！开始您的开发之旅吧！"
}

# 显示帮助信息
show_help() {
    cat << EOF
RiverEdge SaaS 框架一键启动脚本

用法: $0 [命令] [选项]

命令:
    start     启动所有服务 (默认)
    stop      停止所有服务
    restart   重启所有服务 (静默模式)
    fast      快速启动 (强制静默，最快速度)
    status    显示服务状态
    help      显示此帮助信息

环境变量配置:
    BACKEND_PORT=$BACKEND_PORT          后端服务端口
    FRONTEND_PORT=$FRONTEND_PORT        前端服务端口
    INNGEST_PORT=$INNGEST_PORT          Inngest 服务端口
    DEBUG=$DEBUG                       调试模式
    QUIET=$QUIET                       静默模式 (减少输出)

示例:
    $0                            # 启动服务
    $0 stop                       # 停止服务
    $0 restart                    # 重启服务 (静默模式)
    $0 fast                       # 快速启动 (最快速度，强制静默)
    QUIET=true $0                 # 静默启动 (快速模式)
    BACKEND_PORT=9002 $0          # 指定后端端口启动
    DEBUG=true $0                 # 启用调试模式

日志文件:
    startlogs/backend.log         后端日志
    startlogs/frontend.log        前端日志
    startlogs/inngest.log         Inngest 日志
    startlogs/taskkill.log        进程清理日志

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
    help|--help|-h)
        show_help
        ;;
    *)
        main
        ;;
esac