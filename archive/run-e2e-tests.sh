#!/bin/bash
# 运行端到端测试脚本

cd "$(dirname "$0")/riveredge-backend"

echo "安装测试依赖..."
uv sync --extra dev

echo ""
echo "运行端到端测试..."
python tests/e2e/run_all_tests.py

