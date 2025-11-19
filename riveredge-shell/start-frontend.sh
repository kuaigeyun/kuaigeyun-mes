#!/bin/bash
# 前端启动脚本

echo "=========================================="
echo "启动前端服务 (RiverEdge Shell)"
echo "=========================================="

# 进入前端目录
cd "$(dirname "$0")"

# 清除缓存
echo "清除缓存..."
rm -rf node_modules/.vite node_modules/.cache 2>/dev/null || true

# 检查依赖
if [ ! -d "node_modules" ]; then
  echo "安装依赖..."
  npm install --legacy-peer-deps
fi

# 启动服务
echo "启动前端服务 (端口 8001)..."
npm run dev

