#!/bin/bash
"""
运行前后端集成测试脚本

需要确保后端服务运行在 http://localhost:8100

Author: Auto (AI Assistant)
Date: 2026-01-06
"""

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=========================================="
echo "  前后端集成测试"
echo "=========================================="
echo ""

# 检查是否在正确的目录
if [ ! -f "$FRONTEND_DIR/package.json" ]; then
    echo -e "${RED}错误: 前端目录不存在: $FRONTEND_DIR${NC}"
    exit 1
fi

# 检查后端服务是否运行
echo "检查后端服务..."
BACKEND_URL="${VITE_BACKEND_URL:-http://localhost:8100}"
if curl -s -f "$BACKEND_URL/api/v1/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 后端服务运行正常: $BACKEND_URL${NC}"
else
    echo -e "${YELLOW}⚠️  后端服务可能未运行: $BACKEND_URL${NC}"
    echo -e "${YELLOW}   请确保后端服务已启动${NC}"
    echo ""
    read -p "是否继续测试? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""

# 进入前端目录
cd "$FRONTEND_DIR"

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "安装前端依赖..."
    npm install --legacy-peer-deps
fi

# 运行测试
echo "开始运行前后端集成测试..."
echo ""

export VITE_BACKEND_URL="$BACKEND_URL"

if npm run test:run tests/e2e/sales-order-workflow-integration.test.ts; then
    echo ""
    echo -e "${GREEN}✅ 前后端集成测试通过！${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}❌ 前后端集成测试失败${NC}"
    exit 1
fi

