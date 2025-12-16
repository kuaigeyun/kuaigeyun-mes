#!/bin/bash

# RiverEdge SaaS 多组织框架 - 前端开发服务器启动脚本
#
# 默认启动 SaaS 模式（平台宿主模式）
# 适用场景：多组织 SaaS 平台、生产环境

echo "RiverEdge SaaS 多组织框架 - 前端开发服务器启动（SaaS 模式）"
echo ""

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "错误：请在 riveredge-frontend 根目录运行此脚本"
    exit 1
fi

# 检查依赖是否已安装
if [ ! -d "node_modules" ]; then
    echo "依赖未安装，正在安装..."
    npm install --legacy-peer-deps
    if [ $? -ne 0 ]; then
        echo "依赖安装失败"
        exit 1
    fi
    echo "依赖安装完成"
    echo ""
fi

echo "清理之前的进程..."
npx kill-port 8100 8101 8102 8103 8104 8105 2>/dev/null || true

echo "清理缓存..."
rm -rf node_modules/.vite 2>/dev/null || true
rm -rf dist 2>/dev/null || true

# 进入 src 目录（前端已扁平化，所有文件直接在 src/ 下）
cd src || {
    echo "错误：src 目录不存在"
    exit 1
}

# 设置运行模式为 SaaS 模式（默认）
export MODE=saas

# 从环境变量获取端口和主机（如果未设置则使用默认值）
FRONTEND_HOST="${VITE_HOST:-}"
FRONTEND_PORT="${VITE_PORT:-8100}"

echo "运行模式：SaaS 模式（SaaS Mode）"
echo "  - 作为平台宿主，运行平台级功能"
echo "  - 系统级功能由独立的 core 模块提供"
if [ -z "$FRONTEND_HOST" ]; then
    # 如果未设置主机，使用默认值（Windows 使用 127.0.0.1，其他系统使用 localhost）
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]]; then
        FRONTEND_HOST="127.0.0.1"
    else
        FRONTEND_HOST="localhost"
    fi
fi
echo "  - 访问地址：http://${FRONTEND_HOST}:${FRONTEND_PORT}"
echo ""
echo "启动开发服务器..."
echo ""

# 启动开发服务器
npm run dev
