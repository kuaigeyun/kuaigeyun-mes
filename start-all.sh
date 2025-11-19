#!/bin/bash
# RiverEdge SaaS 多租户框架 - 一键启动脚本
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

# 检查端口是否被占用 (使用bash内置方法)
check_port() {
    local port=$1
    # 使用bash的/dev/tcp重定向来检查端口
    if (echo >/dev/tcp/localhost/$port) 2>/dev/null; then
        return 0  # 端口被占用
    else
        return 1  # 端口可用
    fi
}

# 查找可用端口 (优先清理现有进程)
find_available_port() {
    local start_port=$1
    local end_port=$2
    local port=$start_port

    while [ $port -le $end_port ]; do
        if check_port $port; then
            # 端口被占用，尝试清理进程
            log_warn "端口 $port 被占用，尝试清理进程..."
            kill_process_on_port $port
            wait_port_free $port

            # 再次检查端口是否可用
            if ! check_port $port; then
                log_success "端口 $port 已释放"
                echo $port
                return 0
            else
                log_warn "端口 $port 清理失败，使用下一个端口"
            fi
        else
            # 端口可用
            echo $port
            return 0
        fi
        port=$((port + 1))
    done

    log_error "在 $start_port-$end_port 范围内无法获取可用端口"
    exit 1
}

# 获取进程PID (通过端口) - Windows Git Bash兼容
get_pid_by_port() {
    local port=$1

    # 优先使用lsof (如果可用)
    if command -v lsof &> /dev/null; then
        lsof -ti:$port 2>/dev/null | head -1
        return
    fi

    # Windows环境下使用netstat
    if command -v netstat &> /dev/null; then
        # Windows netstat输出格式: TCP  0.0.0.0:8001  0.0.0.0:0  LISTENING  1234
        netstat -ano 2>/dev/null | grep ":$port " | grep LISTENING | awk '{print $5}' | head -1
        return
    fi

    # 如果都没有，使用ss (某些Linux系统)
    if command -v ss &> /dev/null; then
        ss -tulpn | grep ":$port " | awk '{print $7}' | cut -d',' -f1 | cut -d'=' -f2 | head -1
        return
    fi
}

# 杀死占用端口的进程 - Windows兼容
kill_process_on_port() {
    local port=$1
    log_warn "端口 $port 被占用，尝试清理..."

    local pid=$(get_pid_by_port $port)
    if [ ! -z "$pid" ] && [ "$pid" != "-" ] && [ "$pid" != "0" ]; then
        log_info "杀死进程 PID: $pid"

        # 优先使用TERM信号优雅停止
        kill -TERM $pid 2>/dev/null || true

        # Windows环境下也尝试taskkill
        if command -v taskkill &> /dev/null; then
            taskkill /PID $pid /F >> ../logs/taskkill.log 2>&1 || true
        fi

        # 等待进程结束
        local count=0
        while [ $count -lt 5 ]; do
            if ! kill -0 $pid 2>/dev/null; then
                log_success "进程 $pid 已停止"
                return 0
            fi
            sleep 1
            count=$((count + 1))
        done

        # 如果TERM不工作，强制杀死
        log_warn "TERM信号无效，强制杀死进程 $pid"
        kill -KILL $pid 2>/dev/null || true

        # 再次等待
        sleep 2
    else
        log_warn "无法获取端口 $port 的进程PID"
    fi
}

# 等待端口释放
wait_port_free() {
    local port=$1
    local max_wait=10
    local count=0

    while [ $count -lt $max_wait ]; do
        if ! check_port $port; then
            return 0
        fi
        sleep 1
        count=$((count + 1))
    done

    log_warn "端口 $port 释放等待超时，继续执行..."
}

# 启动后端服务
start_backend() {
    local port=$1
    log_info "启动后端服务 (端口: $port)..."

    # find_available_port已经清理过端口，这里再次确认
    if check_port $port; then
        log_error "端口 $port 仍然被占用，后端启动失败"
        exit 1
    fi

    # 进入后端目录并启动
    cd riveredge-core

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

# 启动前端服务
start_frontend() {
    local port=$1
    local backend_port=$2
    log_info "启动前端服务 (端口: $port, 后端: $backend_port)..."

    # find_available_port已经清理过端口，这里再次确认
    if check_port $port; then
        log_error "端口 $port 仍然被占用，前端启动失败"
        exit 1
    fi

    # 检查前端依赖
    cd riveredge-shell
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
    # 配置前端代理到后端端口
    sed "s|http://localhost:[0-9]\+|http://localhost:$backend_port|g" vite.config.ts > vite.config.ts.tmp && mv vite.config.ts.tmp vite.config.ts

    cd ..

    # 进入前端目录并启动
    cd riveredge-shell

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

# 停止所有服务 - Windows兼容
stop_all() {
    log_info "停止所有服务..."

    # 停止后端
    if [ -f "logs/backend.pid" ]; then
        local backend_pid=$(cat logs/backend.pid)
        if kill -0 $backend_pid 2>/dev/null; then
            log_info "停止后端服务 (PID: $backend_pid)"
            kill -TERM $backend_pid 2>/dev/null || true
            # Windows环境下也尝试taskkill
            if command -v taskkill &> /dev/null; then
                taskkill /PID $backend_pid /F >> logs/taskkill.log 2>&1 || true
            fi
        fi
        rm -f logs/backend.pid
    fi

    # 停止前端
    if [ -f "logs/frontend.pid" ]; then
        local frontend_pid=$(cat logs/frontend.pid)
        if kill -0 $frontend_pid 2>/dev/null; then
            log_info "停止前端服务 (PID: $frontend_pid)"
            kill -TERM $frontend_pid 2>/dev/null || true
            # Windows环境下也尝试taskkill
            if command -v taskkill &> /dev/null; then
                taskkill /PID $frontend_pid /F >> logs/taskkill.log 2>&1 || true
            fi
        fi
        rm -f logs/frontend.pid
    fi

    # 清理可能残留的进程
    pkill -f "python scripts/start_backend.py" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    pkill -f "npm.*run.*dev" 2>/dev/null || true

    # Windows环境下额外清理
    if command -v taskkill &> /dev/null; then
        taskkill /F /IM python.exe /FI "WINDOWTITLE eq " >> logs/taskkill.log 2>&1 || true
        taskkill /F /IM node.exe /FI "WINDOWTITLE eq " >> logs/taskkill.log 2>&1 || true
    fi

    # 等待进程完全停止
    sleep 3

    log_success "所有服务已停止"
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

    # 检查预留端口状态
    echo
    log_info "🔍 端口占用情况:"

    local occupied_frontend=()
    local occupied_backend=()

    for port in 8001 8002 8003 8004 8005 8006 8007 8008 8009 8010; do
        if check_port $port; then
            occupied_frontend+=($port)
        fi
    done

    for port in 9001 9002 9003 9004 9005 9006 9007 9008 9009 9010; do
        if check_port $port; then
            occupied_backend+=($port)
        fi
    done

    if [ ${#occupied_frontend[@]} -eq 0 ]; then
        log_success "前端端口范围 (8001-8010): 全部可用"
    else
        log_warn "前端端口被占用: ${occupied_frontend[*]}"
    fi

    if [ ${#occupied_backend[@]} -eq 0 ]; then
        log_success "后端端口范围 (9001-9010): 全部可用"
    else
        log_warn "后端端口被占用: ${occupied_backend[*]}"
    fi
}

# 主函数
main() {
    log_info "🚀 RiverEdge SaaS 框架一键启动脚本"
    log_info "====================================="
    log_info "严禁使用CMD和PowerShell，只使用bash和Linux命令"

    # 创建日志目录
    mkdir -p logs

    # 检查必要命令
    check_command curl
    check_command python
    check_command npm
    check_command sed
    check_command awk

    # 检查项目结构
    if [ ! -d "riveredge-core" ] || [ ! -d "riveredge-shell" ]; then
        log_error "项目结构不完整，请确保在项目根目录运行"
        log_error "需要: riveredge-core/ 和 riveredge-shell/ 目录"
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
        source venv311/Scripts/activate && cd riveredge-core && pip install -r requirements.txt || {
            log_error "安装后端依赖失败"
        exit 1
        }
        cd ..
        log_success "后端依赖安装完成"
    fi

    # 停止现有服务
    stop_all

    # 查找可用端口 (优先使用默认端口，清理占用进程)
    log_info "查找可用端口 (前端:8001-8010, 后端:9001-9010)..."
    local backend_port=$(find_available_port 9001 9010)
    local frontend_port=$(find_available_port 8001 8010)

    log_info "端口分配完成 - 后端: $backend_port, 前端: $frontend_port"

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