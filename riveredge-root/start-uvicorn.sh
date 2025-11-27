#!/bin/bash
# 使用 uvicorn 启动后端服务

echo "=========================================="
echo "启动后端服务 (使用 uvicorn)"
echo "=========================================="

# 进入后端目录
cd "$(dirname "$0")"

# 激活虚拟环境
if [ -f "../venv311/Scripts/activate" ]; then
  source ../venv311/Scripts/activate
elif [ -f "../venv311/bin/activate" ]; then
  source ../venv311/bin/activate
elif [ -f "venv311/Scripts/activate" ]; then
  source venv311/Scripts/activate
elif [ -f "venv311/bin/activate" ]; then
  source venv311/bin/activate
fi

# 启动服务
echo "使用 uvicorn 启动后端服务..."
python scripts/start_uvicorn.py

