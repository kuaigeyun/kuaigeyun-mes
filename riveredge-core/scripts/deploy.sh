#!/bin/bash
# RiverEdge SaaS 部署脚本

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 配置变量
APP_NAME="riveredge-core"
APP_PORT=${APP_PORT:-8000}
HEALTH_CHECK_URL="http://localhost:${APP_PORT}/health/detailed"
MAX_WAIT_TIME=300  # 最大等待时间（秒）
CHECK_INTERVAL=10  # 检查间隔（秒）

# 帮助信息
show_help() {
    cat << EOF
RiverEdge SaaS 部署脚本

用法: $0 [选项]

选项:
    -d, --deploy     执行完整部署流程
    -s, --start      启动服务
    -t, --stop       停止服务
    -r, --restart    重启服务
    -c, --check      健康检查
    -m, --monitor    系统监控
    -l, --logs       查看日志
    -h, --help       显示帮助信息

环境变量:
    APP_PORT        应用端口（默认: 8000）
    ENV             环境（development/production）

示例:
    $0 --deploy          # 完整部署
    $0 --start           # 启动服务
    APP_PORT=9000 $0 --start  # 指定端口启动
EOF
}

# 检查系统要求
check_system_requirements() {
    log_info "检查系统要求..."

    # 检查 Python 版本
    if ! command -v python3 &> /dev/null; then
        log_error "Python3 未安装"
        exit 1
    fi

    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d. -f1-2)
    if [[ $(echo "$PYTHON_VERSION < 3.11" | bc -l) -eq 1 ]]; then
        log_error "需要 Python 3.11 或更高版本，当前版本: $PYTHON_VERSION"
        exit 1
    fi
    log_success "Python 版本检查通过: $PYTHON_VERSION"

    # 检查虚拟环境
    if [ ! -d "venv311" ]; then
        log_error "虚拟环境不存在，请先运行: python3 -m venv venv311"
        exit 1
    fi
    log_success "虚拟环境检查通过"

    # 检查依赖
    if [ ! -f "requirements.txt" ]; then
        log_error "requirements.txt 文件不存在"
        exit 1
    fi
    log_success "依赖文件检查通过"
}

# 激活虚拟环境
activate_venv() {
    log_info "激活虚拟环境..."
    source venv311/bin/activate 2>/dev/null || source venv311/Scripts/activate 2>/dev/null || {
        log_error "无法激活虚拟环境"
        exit 1
    }
    log_success "虚拟环境已激活"
}

# 安装依赖
install_dependencies() {
    log_info "安装 Python 依赖..."
    pip install --upgrade pip
    pip install -r requirements.txt
    log_success "依赖安装完成"
}

# 数据库迁移
run_migrations() {
    log_info "执行数据库迁移..."
    if [ -f "scripts/init_default_tenant.py" ]; then
        python scripts/init_default_tenant.py
        log_success "数据库初始化完成"
    else
        log_warning "数据库初始化脚本不存在，跳过"
    fi
}

# 启动服务
start_service() {
    log_info "启动 $APP_NAME 服务..."

    # 检查是否已经在运行
    if curl -s "$HEALTH_CHECK_URL" >/dev/null 2>&1; then
        log_warning "服务已经在运行"
        return 0
    fi

    # 启动服务（后台运行）
    nohup python scripts/start_backend.py > logs/backend.log 2>&1 &
    local pid=$!

    echo $pid > .service_pid

    log_info "服务启动中，PID: $pid"

    # 等待服务启动
    wait_for_service
}

# 等待服务启动
wait_for_service() {
    log_info "等待服务启动..."

    local elapsed=0
    while [ $elapsed -lt $MAX_WAIT_TIME ]; do
        if curl -s "$HEALTH_CHECK_URL" >/dev/null 2>&1; then
            log_success "服务启动成功"
            return 0
        fi

        sleep $CHECK_INTERVAL
        elapsed=$((elapsed + CHECK_INTERVAL))
        log_info "等待中... (${elapsed}/${MAX_WAIT_TIME}秒)"
    done

    log_error "服务启动超时"
    exit 1
}

# 停止服务
stop_service() {
    log_info "停止 $APP_NAME 服务..."

    if [ -f ".service_pid" ]; then
        local pid=$(cat .service_pid)
        if kill -0 $pid 2>/dev/null; then
            kill $pid
            log_info "发送停止信号到进程 $pid"

            # 等待进程停止
            local count=0
            while kill -0 $pid 2>/dev/null && [ $count -lt 30 ]; do
                sleep 1
                count=$((count + 1))
            done

            if kill -0 $pid 2>/dev/null; then
                log_warning "强制终止进程 $pid"
                kill -9 $pid
            fi
        else
            log_warning "进程 $pid 已经不存在"
        fi

        rm -f .service_pid
    else
        # 尝试通过端口查找进程
        local pids=$(lsof -ti :$APP_PORT 2>/dev/null || true)
        if [ -n "$pids" ]; then
            echo $pids | xargs kill
            log_info "通过端口 $APP_PORT 停止服务"
        else
            log_warning "未找到运行中的服务"
        fi
    fi

    log_success "服务已停止"
}

# 健康检查
health_check() {
    log_info "执行健康检查..."

    if ! curl -s "$HEALTH_CHECK_URL" >/dev/null 2>&1; then
        log_error "服务未运行或健康检查失败"
        return 1
    fi

    local response=$(curl -s "$HEALTH_CHECK_URL")
    local status=$(echo "$response" | jq -r '.status' 2>/dev/null || echo "unknown")

    if [ "$status" = "healthy" ]; then
        log_success "健康检查通过"

        # 显示详细信息
        echo "$response" | jq '.checks' 2>/dev/null || echo "$response"
        return 0
    else
        log_error "健康检查失败"
        echo "$response"
        return 1
    fi
}

# 系统监控
system_monitor() {
    log_info "执行系统监控..."

    if [ ! -f "scripts/monitor_system.py" ]; then
        log_error "监控脚本不存在"
        return 1
    fi

    python scripts/monitor_system.py "$@"
}

# 查看日志
show_logs() {
    log_info "显示服务日志..."

    if [ -f "logs/backend.log" ]; then
        tail -f logs/backend.log
    else
        log_error "日志文件不存在"
    fi
}

# 完整部署流程
deploy() {
    log_info "开始完整部署流程..."
    log_info "环境: ${ENV:-development}"
    log_info "端口: $APP_PORT"

    check_system_requirements
    activate_venv
    install_dependencies
    run_migrations
    start_service

    log_success "部署完成！"
    log_info "服务地址: http://localhost:$APP_PORT"
    log_info "API 文档: http://localhost:$APP_PORT/docs"
    log_info "健康检查: $HEALTH_CHECK_URL"
}

# 主函数
main() {
    case "${1:-}" in
        -d|--deploy)
            deploy
            ;;
        -s|--start)
            check_system_requirements
            activate_venv
            start_service
            ;;
        -t|--stop)
            stop_service
            ;;
        -r|--restart)
            stop_service
            sleep 2
            check_system_requirements
            activate_venv
            start_service
            ;;
        -c|--check)
            health_check
            ;;
        -m|--monitor)
            shift
            system_monitor "$@"
            ;;
        -l|--logs)
            show_logs
            ;;
        -h|--help|*)
            show_help
            ;;
    esac
}

# 执行主函数
main "$@"
