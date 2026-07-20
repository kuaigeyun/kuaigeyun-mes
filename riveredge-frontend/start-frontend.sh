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

# 设置 Inngest 配置环境变量
export VITE_INNGEST_HOST="${VITE_INNGEST_HOST:-127.0.0.1}"
export VITE_INNGEST_PORT="${VITE_INNGEST_PORT:-8300}"

# 设置后端配置环境变量
export VITE_BACKEND_HOST="${VITE_BACKEND_HOST:-127.0.0.1}"
export VITE_BACKEND_PORT="${VITE_BACKEND_PORT:-8200}"

# npm run dev 固定 VITE_HOST=0.0.0.0，本机与局域网均可访问
FRONTEND_PORT="${VITE_PORT:-8100}"

echo "运行模式：SaaS 模式（SaaS Mode）"
echo "  - 作为平台宿主，运行平台级功能"
echo "  - 系统级功能由独立的 core 模块提供"
echo "  - 本机：http://127.0.0.1:${FRONTEND_PORT} 或 http://localhost:${FRONTEND_PORT}"
echo "  - 局域网：http://<本机IP>:${FRONTEND_PORT}（需后端 HOST=0.0.0.0）"
echo ""
echo "启动开发服务器..."
echo ""

# 启动开发服务器，确保环境变量传递给 Vite
# 代理目标用 127.0.0.1，避免 Windows 上 localhost→::1 与后端 IPv4 监听不一致
VITE_BACKEND_HOST="${VITE_BACKEND_HOST:-127.0.0.1}" \
VITE_BACKEND_PORT="${VITE_BACKEND_PORT:-8200}" \
VITE_INNGEST_HOST="${VITE_INNGEST_HOST:-127.0.0.1}" \
VITE_INNGEST_PORT="${VITE_INNGEST_PORT:-8300}" \
npm run dev
