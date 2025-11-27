#!/bin/bash
# RiverEdge SaaS 多组织框架 - 一键启动脚本
# 自动处理端口冲突，进程清理，环境检查等
# 严禁使用CMD和PowerShell，只使用bash和Linux命令

set -e  # 遇到错误立即退出

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

# 日志函数
log_info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARN: $1${NC}"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS: $1${NC}"
}

# 检查命令是否存在
check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "命令 '$1' 未找到，请确保已安装"
        exit 1
    fi
}

# 检查端口是否被占用 (增强版，Windows兼容)
check_port() {
    local port=$1
    
    # 方法1: 使用 netstat (Windows/Linux通用，更可靠)
    if command -v netstat &> /dev/null; then
        if netstat -ano 2>/dev/null | grep ":$port " | grep -q LISTENING; then
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

# 强制清理指定端口，直到成功
# 只使用固定端口 8001 和 9001，持续清理直到成功
force_clear_port() {
    local port=$1
    local max_attempts=20  # 最多尝试20次
    local attempt=0

    log_info "强制清理端口 $port，直到成功..."

    while [ $attempt -lt $max_attempts ]; do
        if ! check_port $port; then
            # 端口已释放
            log_success "端口 $port 已释放"
            return 0
        fi

        # 端口被占用，尝试清理
        attempt=$((attempt + 1))
        log_info "尝试清理端口 $port (第 $attempt/$max_attempts 次)..."
        
        # 清理进程
        kill_process_on_port $port || true
        
        # 等待端口释放
        wait_port_free $port || true
        
        # 再次检查
        if ! check_port $port; then
            log_success "端口 $port 已成功释放"
            return 0
        fi
        
        # 如果还在占用，等待一下再重试
        log_warn "端口 $port 仍被占用，等待 2 秒后重试..."
        sleep 2
    done

    log_error "端口 $port 清理失败，已尝试 $max_attempts 次"
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

# 杀死占用端口的进程 - Windows 完全强制版（彻底清理）
# 
# Windows 专用强制清理策略：
# 1. 通过 netstat 查找所有占用端口的进程（包括所有状态）
# 2. 使用 taskkill /F /T 强制杀死进程树（包括所有子进程）
# 3. 使用 wmic 命令（如果可用）彻底杀死进程
# 4. 通过进程名批量杀死相关进程
# 5. 多次尝试，确保彻底清理
kill_process_on_port() {
    local port=$1
    log_warn "端口 $port 被占用，开始 Windows 完全强制清理..."

    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local log_dir="$script_dir/logs"
    mkdir -p "$log_dir" 2>/dev/null || true

    # Windows 专用：使用 netstat 查找所有占用端口的进程（包括 LISTENING、ESTABLISHED 等所有状态）
    if command -v netstat &> /dev/null && command -v taskkill &> /dev/null; then
        log_info "Windows: 查找所有占用端口 $port 的进程..."
        
        # 查找所有占用端口的进程 PID（包括所有 TCP 状态）
        local all_pids=$(netstat -ano 2>/dev/null | grep ":$port " | awk '{print $NF}' | sort -u | grep -v "^0$" | grep -v "^$")
        
        if [ ! -z "$all_pids" ]; then
            log_info "发现占用端口 $port 的进程: $all_pids"
            
            # 逐个强制杀死进程树
            for pid in $all_pids; do
                if [ ! -z "$pid" ] && [ "$pid" != "0" ] && [ "$pid" != "-" ]; then
                    log_info "强制杀死进程 PID: $pid (包括所有子进程)..."
                    
                    # 方法1: taskkill /F /T - 强制杀死进程树（最彻底）
                    taskkill /PID $pid /T /F >> "$log_dir/taskkill.log" 2>&1 || true
                    
                    # 方法2: wmic 命令（如果可用，更彻底）
                    if command -v wmic &> /dev/null; then
                        wmic process where "ProcessId=$pid" delete >> "$log_dir/taskkill.log" 2>&1 || true
                        # 杀死子进程
                        wmic process where "ParentProcessId=$pid" delete >> "$log_dir/taskkill.log" 2>&1 || true
                    fi
                    
                    # 方法3: 再次尝试 taskkill（确保彻底）
                    sleep 0.5
                    taskkill /PID $pid /F >> "$log_dir/taskkill.log" 2>&1 || true
                fi
            done
        fi
    fi

    # Windows 专用：通过进程名批量杀死所有相关进程（不考虑其他应用，统统杀死）
    if command -v taskkill &> /dev/null; then
        # 清理前端相关进程（杀死所有 node.exe 和 npm.exe，不考虑其他应用）
        if [ "$port" == "8001" ]; then
            log_info "Windows: 强制清理所有前端相关进程（不考虑其他应用）..."
            
            # 查找所有占用 8001 端口的进程
            local frontend_pids=$(netstat -ano 2>/dev/null | grep ":8001 " | awk '{print $NF}' | sort -u | grep -v "^0$" | grep -v "^$")
            
            # 强制杀死所有相关进程
            for pid in $frontend_pids; do
                if [ ! -z "$pid" ] && [ "$pid" != "0" ]; then
                    taskkill /PID $pid /T /F >> "$log_dir/taskkill.log" 2>&1 || true
                fi
            done
            
            # 强制杀死所有 node.exe 和 npm.exe 进程（不考虑其他应用）
            log_warn "Windows: 强制杀死所有 node.exe 进程（不考虑其他应用）..."
            taskkill /IM node.exe /T /F >> "$log_dir/taskkill.log" 2>&1 || true
            log_warn "Windows: 强制杀死所有 npm.exe 进程（不考虑其他应用）..."
            taskkill /IM npm.exe /T /F >> "$log_dir/taskkill.log" 2>&1 || true
        fi

        # 清理后端相关进程（杀死所有 python.exe，不考虑其他应用）
        if [ "$port" == "9001" ]; then
            log_info "Windows: 强制清理所有后端相关进程（不考虑其他应用）..."
            
            # 查找所有占用 9001 端口的进程
            local backend_pids=$(netstat -ano 2>/dev/null | grep ":9001 " | awk '{print $NF}' | sort -u | grep -v "^0$" | grep -v "^$")
            
            # 强制杀死所有相关进程
            for pid in $backend_pids; do
                if [ ! -z "$pid" ] && [ "$pid" != "0" ]; then
                    taskkill /PID $pid /T /F >> "$log_dir/taskkill.log" 2>&1 || true
                fi
            done
            
            # 强制杀死所有 python.exe 和 pythonw.exe 进程（不考虑其他应用）
            log_warn "Windows: 强制杀死所有 python.exe 进程（不考虑其他应用）..."
            taskkill /IM python.exe /T /F >> "$log_dir/taskkill.log" 2>&1 || true
            log_warn "Windows: 强制杀死所有 pythonw.exe 进程（不考虑其他应用）..."
            taskkill /IM pythonw.exe /T /F >> "$log_dir/taskkill.log" 2>&1 || true
        fi
    fi

    # Linux/Mac: 使用 pkill 杀死进程
    if command -v pkill &> /dev/null; then
        if [ "$port" == "8001" ]; then
            pkill -9 -f "vite.*--port.*8001" 2>/dev/null || true
            pkill -9 -f "node.*vite" 2>/dev/null || true
        fi
        if [ "$port" == "9001" ]; then
            pkill -9 -f "python.*start_backend.py" 2>/dev/null || true
        fi
    fi

    # 等待进程完全结束
    sleep 3
    
    # 再次检查端口
    if ! check_port $port; then
        log_success "端口 $port 已成功释放"
        return 0
    fi

    log_warn "端口 $port 可能处于 TIME_WAIT 状态或仍有进程占用"
    return 1
}

# 等待端口释放（简化版，避免长时间等待）
wait_port_free() {
    local port=$1
    local max_wait=5  # 减少等待时间，避免卡住
    local count=0

    while [ $count -lt $max_wait ]; do
        if ! check_port $port; then
            # 再次验证，确保端口真的释放了
            sleep 0.5
            if ! check_port $port; then
                return 0
            fi
        fi
        sleep 1
        count=$((count + 1))
    done

    log_warn "端口 $port 释放等待超时（可能处于 TIME_WAIT 状态），继续执行..."
    # 即使超时也返回成功，让系统继续尝试启动（可能会使用其他端口）
    return 0
}

# 启动后端服务
start_backend() {
    local port=$1
    log_info "启动后端服务 (端口: $port)..."

    # force_clear_port已经清理过端口，这里再次确认
    if check_port $port; then
        log_error "端口 $port 仍然被占用，后端启动失败"
        exit 1
    fi

    # 进入后端目录并启动
    cd riveredge-root

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

    # 设置端口环境变量
    export PORT=$port

    # 清理旧的PID文件
    rm -f ../logs/backend.pid

    # 启动后端服务
    nohup python scripts/start_backend.py > ../logs/backend.log 2>&1 &
    local backend_pid=$!
    echo $backend_pid > ../logs/backend.pid

    cd ..
    log_success "后端服务启动中 (PID: $backend_pid, 端口: $port)"

    # 等待后端启动
    local retries=30
    while [ $retries -gt 0 ]; do
        if curl -s --max-time 5 http://localhost:$port/docs >/dev/null 2>&1; then
            log_success "后端服务启动成功 (http://localhost:$port)"
            log_info "📖 Swagger API文档: http://localhost:$port/docs"
            return 0
        fi
        sleep 2
        retries=$((retries - 1))
    done

    log_error "后端服务启动超时，请检查 logs/backend.log"
    if [ -f "logs/backend.pid" ]; then
        kill $backend_pid 2>/dev/null || true
        rm -f logs/backend.pid
    fi
    exit 1
}

# Windows 专用：软重启 VITE 相关进程（优雅停止）
soft_restart_vite_windows() {
    log_info "Windows: 尝试软重启 VITE 相关进程（优雅停止）..."
    
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local log_dir="$script_dir/logs"
    mkdir -p "$log_dir" 2>/dev/null || true
    
    local restart_success=false
    
    # 只在 Windows 下执行
    if command -v taskkill &> /dev/null; then
        # 1. 查找所有占用 8001 端口的进程
        local vite_pids=$(netstat -ano 2>/dev/null | grep ":8001 " | awk '{print $NF}' | sort -u | grep -v "^0$" | grep -v "^$")
        
        if [ ! -z "$vite_pids" ]; then
            log_info "Windows: 发现占用 8001 端口的进程: $vite_pids"
            
            # 尝试优雅停止（不使用 /F 参数）
            for pid in $vite_pids; do
                if [ ! -z "$pid" ] && [ "$pid" != "0" ]; then
                    log_info "Windows: 尝试优雅停止进程 PID: $pid..."
                    # 不使用 /F 参数，让进程优雅退出
                    taskkill /PID $pid /T >> "$log_dir/taskkill.log" 2>&1 || true
                fi
            done
            
            # 等待进程优雅退出（最多等待 5 秒）
            local wait_count=0
            while [ $wait_count -lt 5 ]; do
                sleep 1
                local still_running=$(netstat -ano 2>/dev/null | grep ":8001 " | awk '{print $NF}' | sort -u | grep -v "^0$" | grep -v "^$")
                if [ -z "$still_running" ]; then
                    log_success "Windows: VITE 进程已优雅停止"
                    restart_success=true
                    break
                fi
                wait_count=$((wait_count + 1))
            done
        else
            log_success "Windows: 没有发现占用 8001 端口的进程"
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
    local log_dir="$script_dir/logs"
    mkdir -p "$log_dir" 2>/dev/null || true
    
    # 只在 Windows 下执行
    if command -v taskkill &> /dev/null; then
        # 1. 查找所有占用 8001 端口的进程并强制杀死
        local vite_pids=$(netstat -ano 2>/dev/null | grep ":8001 " | awk '{print $NF}' | sort -u | grep -v "^0$" | grep -v "^$")
        if [ ! -z "$vite_pids" ]; then
            log_info "Windows: 发现占用 8001 端口的进程: $vite_pids"
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
        sleep 3
        
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
        if [ -f "logs/backend.pid" ]; then
            local backend_pid=$(cat logs/backend.pid 2>/dev/null)
            if [ ! -z "$backend_pid" ] && kill -0 $backend_pid 2>/dev/null; then
                backend_running=true
            fi
        fi
        
        if [ "$backend_running" = false ] && ! check_port 9001; then
            log_info "Windows: 后端服务未运行，启动后端服务..."
            start_backend 9001 || log_warn "Windows: 后端服务启动失败"
        else
            log_info "Windows: 后端服务已在运行"
        fi
        
        # 检查前端服务是否运行（通过检查端口和PID文件）
        local frontend_running=false
        if [ -f "logs/frontend.pid" ]; then
            local frontend_pid=$(cat logs/frontend.pid 2>/dev/null)
            if [ ! -z "$frontend_pid" ] && kill -0 $frontend_pid 2>/dev/null; then
                frontend_running=true
            fi
        fi
        
        if [ "$frontend_running" = false ] && ! check_port 8001; then
            log_info "Windows: 前端服务未运行，启动前端服务..."
            # 获取后端端口（从环境变量或默认值）
            local backend_port=${PORT:-9001}
            start_frontend 8001 $backend_port || log_warn "Windows: 前端服务启动失败"
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
    
    # Windows 专用：在启动前端之前清理 VITE 相关进程（不自动启动服务，因为主函数会启动）
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]]; then
        cleanup_vite_windows false
    fi

    # force_clear_port已经清理过端口，这里再次确认
    if check_port $port; then
        log_error "端口 $port 仍然被占用，前端启动失败"
        exit 1
    fi

    # 检查前端依赖
    cd riveredge-stem
    if [ ! -d "node_modules" ]; then
        log_info "安装前端依赖..."
        npm install --legacy-peer-deps || {
            log_error "前端依赖安装失败"
            cd ..
            exit 1
        }
        log_success "前端依赖安装完成"
    fi

    # 更新前端代理配置
    # 配置前端代理到后端端口（更精确的匹配，避免误替换）
    if [ -f "vite.config.ts" ]; then
        # 使用更精确的 sed 模式，只替换 proxy target 中的端口
        # 方法1: 尝试使用 sed -i.bak (Linux/Mac 或支持 -i 的 sed)
        if sed -i.bak "s|target: 'http://localhost:[0-9]\+'|target: 'http://localhost:$backend_port'|g" vite.config.ts 2>/dev/null; then
            # 成功，清理备份文件
            rm -f vite.config.ts.bak 2>/dev/null || true
        elif sed -i.bak "s|target: \"http://localhost:[0-9]\\+\"|target: \"http://localhost:$backend_port\"|g" vite.config.ts 2>/dev/null; then
            # 成功，清理备份文件
            rm -f vite.config.ts.bak 2>/dev/null || true
        else
            # 方法2: 使用临时文件方式（Windows Git Bash 兼容）
            if sed "s|target: 'http://localhost:[0-9]\+'|target: 'http://localhost:$backend_port'|g" vite.config.ts > vite.config.ts.tmp 2>/dev/null; then
                # 临时文件创建成功，检查文件是否存在且非空
                if [ -f "vite.config.ts.tmp" ] && [ -s "vite.config.ts.tmp" ]; then
                    mv vite.config.ts.tmp vite.config.ts 2>/dev/null || {
                        log_warn "无法移动临时文件，尝试使用备用方法..."
                        rm -f vite.config.ts.tmp 2>/dev/null || true
                    }
                else
                    log_warn "临时文件创建失败或为空，跳过配置更新"
                    rm -f vite.config.ts.tmp 2>/dev/null || true
                fi
            else
                log_warn "无法更新 vite.config.ts，可能格式不匹配"
            fi
        fi
    fi

    cd ..

    # 进入前端目录并启动
    cd riveredge-stem

    # 清理旧的PID文件
    rm -f ../logs/frontend.pid

    # 启动前端服务
    nohup npm run dev -- --port $port > ../logs/frontend.log 2>&1 &
    local frontend_pid=$!
    echo $frontend_pid > ../logs/frontend.pid

    cd ..
    log_success "前端服务启动中 (PID: $frontend_pid, 端口: $port)"

    # 等待前端启动
    local retries=30
    while [ $retries -gt 0 ]; do
        if curl -s --max-time 5 http://localhost:$port >/dev/null 2>&1; then
            log_success "前端服务启动成功 (http://localhost:$port)"
            return 0
        fi
        sleep 2
        retries=$((retries - 1))
    done

    log_error "前端服务启动超时，请检查 logs/frontend.log"
    if [ -f "logs/frontend.pid" ]; then
        kill $frontend_pid 2>/dev/null || true
        rm -f logs/frontend.pid
    fi
    exit 1
}

# 停止所有服务 - Windows兼容（增强版）
stop_all() {
    log_info "停止所有服务..."

    # 确保日志目录存在
    mkdir -p logs 2>/dev/null || true
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local log_dir="$script_dir/logs"

    # 停止后端（通过PID文件）
    if [ -f "logs/backend.pid" ]; then
        local backend_pid=$(cat logs/backend.pid 2>/dev/null)
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
                    sleep 1
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
        rm -f logs/backend.pid
    fi

    # 停止前端（通过PID文件）
    if [ -f "logs/frontend.pid" ]; then
        local frontend_pid=$(cat logs/frontend.pid 2>/dev/null)
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
                    sleep 1
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
        rm -f logs/frontend.pid
    fi

    # 清理可能残留的进程（简化版，避免卡住）
    log_info "清理残留进程..."
    
    # 只清理关键端口（8001 和 9001），避免遍历所有端口导致卡住
    for port in 8001 9001; do
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
        pkill -f "python.*scripts/start_backend.py" 2>/dev/null &
        pkill -f "vite.*--port" 2>/dev/null &
    fi

    # 等待进程完全停止（增加等待时间）
    sleep 3

    # 最终验证：检查关键端口是否已释放
    local ports_still_occupied=0
    for port in 8001 9001; do
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
    log_info "📊 服务状态检查:"

    if [ -f "logs/backend.pid" ]; then
        local backend_pid=$(cat logs/backend.pid)
        if kill -0 $backend_pid 2>/dev/null; then
            log_success "后端服务运行中 (PID: $backend_pid)"
        else
            log_warn "后端服务PID文件存在但进程未运行"
        fi
    else
        log_warn "后端服务未运行"
    fi

    if [ -f "logs/frontend.pid" ]; then
        local frontend_pid=$(cat logs/frontend.pid)
        if kill -0 $frontend_pid 2>/dev/null; then
            log_success "前端服务运行中 (PID: $frontend_pid)"
        else
            log_warn "前端服务PID文件存在但进程未运行"
        fi
    else
        log_warn "前端服务未运行"
    fi

    # 检查端口占用情况（只检查使用的端口）
    echo
    log_info "🔍 端口占用情况:"

    if check_port 8001; then
        log_warn "前端端口 8001 被占用"
    else
        log_success "前端端口 8001 可用"
    fi

    if check_port 9001; then
        log_warn "后端端口 9001 被占用"
    else
        log_success "后端端口 9001 可用"
    fi
}

# 主函数
main() {
    log_info "🚀 RiverEdge SaaS 框架一键启动脚本"
    log_info "====================================="

    # 创建日志目录
    mkdir -p logs

    # 检查必要命令
    check_command curl
    check_command python
    check_command npm
    check_command sed
    check_command awk

    # 检查项目结构
    if [ ! -d "riveredge-root" ] || [ ! -d "riveredge-stem" ]; then
        log_error "项目结构不完整，请确保在项目根目录运行"
        log_error "需要: riveredge-root/ 和 riveredge-stem/ 目录"
        exit 1
    fi

    # 检查虚拟环境
    if [ ! -d "venv311" ]; then
        log_error "虚拟环境未找到，正在创建 venv311..."
        python -m venv venv311 || {
            log_error "创建虚拟环境失败"
            exit 1
        }
        log_success "虚拟环境已创建"

        # 激活虚拟环境并安装依赖
        log_info "安装后端依赖..."
        source venv311/Scripts/activate && cd riveredge-root && pip install -r requirements.txt || {
            log_error "安装后端依赖失败"
        exit 1
        }
        cd ..
        log_success "后端依赖安装完成"
    fi

    # 停止现有服务
    stop_all

    # 强制清理指定端口（8001 和 9001），直到成功
    log_info "强制清理端口 8001 和 9001..."
    
    # 清理前端端口 8001
    if ! force_clear_port 8001; then
        log_error "前端端口 8001 清理失败，请手动检查并清理占用进程"
        exit 1
    fi
    
    # 清理后端端口 9001
    if ! force_clear_port 9001; then
        log_error "后端端口 9001 清理失败，请手动检查并清理占用进程"
        exit 1
    fi
    
    local backend_port=9001
    local frontend_port=8001
    
    log_success "端口清理完成 - 后端: $backend_port, 前端: $frontend_port"

    # 启动后端
    start_backend $backend_port
    if [ $? -ne 0 ]; then
        log_error "后端启动失败，退出"
        exit 1
    fi

    # 启动前端
    start_frontend $frontend_port $backend_port
    if [ $? -ne 0 ]; then
        log_error "前端启动失败，正在停止后端..."
        stop_all
        exit 1
    fi

    log_success "🎉 所有服务启动成功！"
    echo
    log_info "📊 服务状态:"
    log_info "   后端 API:    http://localhost:$backend_port"
    log_info "   后端文档:    http://localhost:$backend_port/docs"
    log_info "   前端界面:    http://localhost:$frontend_port"
    echo
    log_info "📝 日志文件:"
    log_info "   后端日志:    logs/backend.log"
    log_info "   前端日志:    logs/frontend.log"
    log_info "   进程清理日志: logs/taskkill.log"
    echo
    log_info "🔧 管理命令:"
    log_info "   查看状态:    ./start-all.sh status"
    log_info "   停止服务:    ./start-all.sh stop"
    log_info "   重启服务:    ./start-all.sh restart"
    echo
    log_info "📁 进程文件:"
    log_info "   后端PID:     logs/backend.pid"
    log_info "   前端PID:     logs/frontend.pid"
    echo
    log_info "⚠️  提示: 按 Ctrl+C 可以停止脚本，但服务会继续运行"
}

# 处理命令行参数
case "$1" in
    stop)
        stop_all
        ;;
    restart)
        stop_all
        sleep 3
        main
        ;;
    status)
        show_status
        ;;
    *)
        main
        ;;
esac