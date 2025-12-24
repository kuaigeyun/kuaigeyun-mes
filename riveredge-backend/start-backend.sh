#!/bin/bash

# RiverEdge SaaS 多组织框架 - 后端启动脚本
#
# 运行模式：
# SaaS 模式：作为平台宿主，运行完整的平台级功能（包含系统级和平台级）

echo "RiverEdge SaaS 多组织框架 - 后端服务启动"
echo ""

# 检查是否在正确的目录
if [ ! -f "pyproject.toml" ]; then
    echo "错误：请在 riveredge-backend 根目录运行此脚本"
    exit 1
fi

# 从环境变量获取运行模式（默认SaaS模式）
MODE=${MODE:-saas}

echo "运行模式：$MODE"
if [ "$MODE" = "saas" ]; then
    echo "  - 作为平台宿主，运行平台级功能（包含系统级和平台级）"
else
    echo "警告：未知模式 '$MODE'，将使用 SaaS 模式"
    MODE="saas"
fi
echo ""

# 设置环境变量
export MODE=$MODE
# 设置 UV 链接模式为复制，避免硬链接警告（Windows 环境下硬链接可能不支持）
export UV_LINK_MODE="${UV_LINK_MODE:-copy}"

# 从环境变量获取端口和主机（如果未设置则使用默认值）
BACKEND_HOST="${HOST:-127.0.0.1}"
BACKEND_PORT="${PORT:-8200}"

# 设置 Inngest 配置环境变量
export INNGEST_HOST="${INNGEST_HOST:-127.0.0.1}"
export INNGEST_PORT="${INNGEST_PORT:-8300}"

echo "启动后端服务..."
echo "  访问地址：http://${BACKEND_HOST}:${BACKEND_PORT}"
echo "  API 文档：http://${BACKEND_HOST}:${BACKEND_PORT}/docs"
echo ""

# 设置环境变量：强制 egg-info 生成到 .logs 目录（如果必须生成）
export SETUPTOOLS_EGG_INFO_DIR="../.logs"

# 清理可能存在的 egg-info 目录（严禁在 src 目录下产生）
# 如果在 src 目录下发现，立即删除或移动到 .logs
if [ -d "src/riveredge_backend.egg-info" ]; then
    echo "警告：检测到 src 目录下的 egg-info，正在移动到 .logs..."
    mkdir -p "../.logs" 2>/dev/null || true
    mv "src/riveredge_backend.egg-info" "../.logs/riveredge_backend.egg-info" 2>/dev/null || rm -rf "src/riveredge_backend.egg-info"
fi

# 检查并同步 UV 虚拟环境（如果不存在或依赖有变化）
# 使用 --no-install-project 避免安装项目本身，防止生成 egg-info 目录
if [ ! -d ".venv" ] || [ "pyproject.toml" -nt ".venv" ] || [ "uv.lock" -nt ".venv" ]; then
    echo "同步 UV 依赖..."
    uv sync --no-install-project
    echo ""
fi

# 再次检查并清理（防止在同步过程中意外生成）
# 如果在 src 目录下发现，立即删除并移动到 .logs（如果必须保留）
if [ -d "src/riveredge_backend.egg-info" ]; then
    echo "警告：检测到 src 目录下的 egg-info，正在移动到 .logs..."
    mkdir -p "../.logs" 2>/dev/null || true
    mv "src/riveredge_backend.egg-info" "../.logs/riveredge_backend.egg-info" 2>/dev/null || rm -rf "src/riveredge_backend.egg-info"
fi

# 设置Python路径
export PYTHONPATH="${PYTHONPATH}:$(pwd)/src"

# 启动服务（启用热重载，监控 src 目录）
# 使用 UV 运行，自动使用 .venv 虚拟环境
# 主机和端口从环境变量读取（HOST 和 PORT），未设置时使用配置文件默认值
PYTHONPATH="${PYTHONPATH}:$(pwd)/src" uv run uvicorn server.main:app --host "${BACKEND_HOST}" --port "${BACKEND_PORT}" --reload --reload-dir src


