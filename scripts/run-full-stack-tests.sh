#!/bin/bash
"""
运行完整的前后端全流程测试

同时运行后端E2E测试和前端集成测试，确保全流程可用。

Author: Auto (AI Assistant)
Date: 2026-01-06
"""

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/riveredge-backend"
FRONTEND_DIR="$PROJECT_ROOT/riveredge-frontend"

echo "=========================================="
echo "  全栈全流程自动化测试"
echo "=========================================="
echo ""

# 检查目录
if [ ! -d "$BACKEND_DIR" ] || [ ! -d "$FRONTEND_DIR" ]; then
    echo -e "${RED}错误: 项目目录结构不正确${NC}"
    exit 1
fi

# 统计变量
BACKEND_PASSED=0
BACKEND_FAILED=0
FRONTEND_PASSED=0
FRONTEND_FAILED=0

# ========== 步骤1: 运行后端E2E测试 ==========
echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}步骤1: 运行后端E2E测试${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""

cd "$BACKEND_DIR"

if uv run pytest tests/e2e/test_complete_sales_order_workflow.py -v --tb=short --asyncio-mode=auto; then
    echo -e "${GREEN}✅ 后端E2E测试通过${NC}"
    ((BACKEND_PASSED++))
else
    echo -e "${RED}❌ 后端E2E测试失败${NC}"
    ((BACKEND_FAILED++))
fi

echo ""

# ========== 步骤2: 检查后端服务 ==========
echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}步骤2: 检查后端服务状态${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""

BACKEND_URL="${VITE_BACKEND_URL:-http://localhost:8100}"
if curl -s -f "$BACKEND_URL/api/v1/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 后端服务运行正常: $BACKEND_URL${NC}"
else
    echo -e "${YELLOW}⚠️  后端服务未运行: $BACKEND_URL${NC}"
    echo -e "${YELLOW}   请先启动后端服务，然后重新运行测试${NC}"
    echo ""
    read -p "是否继续运行前端测试? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""

# ========== 步骤3: 运行前端集成测试 ==========
echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}步骤3: 运行前端集成测试${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""

cd "$FRONTEND_DIR"

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "安装前端依赖..."
    npm install --legacy-peer-deps --silent
fi

export VITE_BACKEND_URL="$BACKEND_URL"

if npm run test:run tests/e2e/sales-order-workflow-integration.test.ts; then
    echo -e "${GREEN}✅ 前端集成测试通过${NC}"
    ((FRONTEND_PASSED++))
else
    echo -e "${RED}❌ 前端集成测试失败${NC}"
    ((FRONTEND_FAILED++))
fi

echo ""

# ========== 步骤4: 生成测试报告 ==========
echo "=========================================="
echo "  测试结果汇总"
echo "=========================================="
echo ""

TOTAL_BACKEND=$((BACKEND_PASSED + BACKEND_FAILED))
TOTAL_FRONTEND=$((FRONTEND_PASSED + FRONTEND_FAILED))

echo "后端E2E测试:"
echo -e "  总测试数: $TOTAL_BACKEND"
echo -e "  ${GREEN}通过: $BACKEND_PASSED${NC}"
echo -e "  ${RED}失败: $BACKEND_FAILED${NC}"
echo ""

echo "前端集成测试:"
echo -e "  总测试数: $TOTAL_FRONTEND"
echo -e "  ${GREEN}通过: $FRONTEND_PASSED${NC}"
echo -e "  ${RED}失败: $FRONTEND_FAILED${NC}"
echo ""

TOTAL_PASSED=$((BACKEND_PASSED + FRONTEND_PASSED))
TOTAL_FAILED=$((BACKEND_FAILED + FRONTEND_FAILED))

if [ $TOTAL_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ 所有测试通过！${NC}"
    exit 0
else
    echo -e "${RED}❌ 部分测试失败，请查看详细日志${NC}"
    exit 1
fi

