#!/bin/bash
# RiverEdge 传统部署 - 一键更新脚本
# 在服务器 /opt/riveredge 下执行

set -e
cd /opt/riveredge

echo "=== RiverEdge 更新部署 ==="

git pull

echo "--- 后端依赖 ---"
cd riveredge-backend
uv sync --no-install-project --frozen --no-dev
cd ..

echo "--- 前端构建 ---"
cd riveredge-frontend
npm ci
npm run build
cd ..

echo "--- 复制前端静态文件 ---"
mkdir -p /opt/riveredge/frontend-dist
cp -r riveredge-frontend/src/dist/* /opt/riveredge/frontend-dist/

echo "--- 重启后端 ---"
sudo systemctl restart riveredge-backend

echo "✅ 部署完成。Caddy 无需重启，静态文件变更已生效。"
