#!/bin/bash
# 后端启动脚本

echo "=========================================="
echo "启动后端服务 (RiverEdge Core)"
echo "=========================================="

# 进入后端目录
cd "$(dirname "$0")"

# 激活虚拟环境
if [ -f "venv/Scripts/activate" ]; then
  source venv/Scripts/activate
elif [ -f "venv/bin/activate" ]; then
  source venv/bin/activate
fi

# 启动服务
echo "启动后端服务 (端口 8000)..."
python scripts/start_backend.py

