#!/bin/bash
"""
运行完整业务流程测试脚本

用于系统性测试所有业务流程，确保全流程单据可以跑通。

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
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_DIR="$BACKEND_DIR/tests/e2e"

echo "=========================================="
echo "  全流程自动化测试"
echo "=========================================="
echo ""

# 检查是否在正确的目录
if [ ! -d "$TEST_DIR" ]; then
    echo -e "${RED}错误: 测试目录不存在: $TEST_DIR${NC}"
    exit 1
fi

# 测试列表
declare -a TEST_FILES=(
    "test_complete_sales_order_workflow.py"
    "test_sales_order_complete_workflow.py"
    "test_purchase_workflow.py"
    "test_mto_workflow.py"
    "test_mts_workflow.py"
    "test_quality_workflow.py"
    "test_finance_workflow.py"
)

# 统计变量
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 运行测试函数
run_test() {
    local test_file=$1
    local test_path="$TEST_DIR/$test_file"
    
    if [ ! -f "$test_path" ]; then
        echo -e "${YELLOW}⚠️  测试文件不存在: $test_file${NC}"
        return 1
    fi
    
    echo -e "${GREEN}运行测试: $test_file${NC}"
    echo "----------------------------------------"
    
    cd "$BACKEND_DIR"
    
    # 运行测试
    if uv run pytest "$test_path" -v --tb=short --asyncio-mode=auto; then
        echo -e "${GREEN}✅ $test_file 通过${NC}"
        ((PASSED_TESTS++))
        return 0
    else
        echo -e "${RED}❌ $test_file 失败${NC}"
        ((FAILED_TESTS++))
        return 1
    fi
}

# 运行所有测试
echo "开始运行全流程测试..."
echo ""

for test_file in "${TEST_FILES[@]}"; do
    ((TOTAL_TESTS++))
    run_test "$test_file"
    echo ""
done

# 生成测试报告
REPORT_FILE="$BACKEND_DIR/test_report_$(date +%Y%m%d_%H%M%S).html"

echo "=========================================="
echo "  测试结果汇总"
echo "=========================================="
echo "总测试数: $TOTAL_TESTS"
echo -e "${GREEN}通过: $PASSED_TESTS${NC}"
echo -e "${RED}失败: $FAILED_TESTS${NC}"
echo ""

# 生成HTML报告
if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ 所有测试通过！${NC}"
    exit 0
else
    echo -e "${RED}❌ 部分测试失败，请查看详细日志${NC}"
    exit 1
fi

