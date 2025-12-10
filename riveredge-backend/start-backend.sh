#!/bin/bash

# RiverEdge SaaS 多组织框架 - 后端启动脚本
#
# 运行模式：
# SaaS 模式：作为平台宿主，运行完整的平台级功能（包含系统级和平台级）

echo "🌳 RiverEdge SaaS 多组织框架 - 启动后端服务"
echo ""

# 检查是否在正确的目录
if [ ! -f "pyproject.toml" ]; then
    echo "❌ 错误：请在 riveredge-backend 根目录运行此脚本"
    exit 1
fi

# 从环境变量获取运行模式（默认SaaS模式）
MODE=${MODE:-saas}

echo "📋 运行模式：$MODE"
if [ "$MODE" = "saas" ]; then
    echo "   - 作为平台宿主，运行平台级功能（包含系统级和平台级）"
else
    echo "   ⚠️  警告：未知模式 '$MODE'，将使用 SaaS 模式"
    MODE="saas"
fi
echo ""

# 设置环境变量
export MODE=$MODE

echo "🚀 启动后端服务..."
echo "   访问地址：http://localhost:9000"
echo "   API 文档：http://localhost:9000/docs"
echo ""

# 设置Python路径
export PYTHONPATH="${PYTHONPATH}:$(pwd)/src"

# 启动服务（启用热重载，监控 src 目录）
PYTHONPATH="${PYTHONPATH}:$(pwd)/src" python -m uvicorn server.main:app --host 0.0.0.0 --port 9000 --reload --reload-dir src


