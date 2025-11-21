#!/bin/bash
# 前端启动脚本

echo "=========================================="
echo "启动前端服务 (RiverEdge Shell)"
echo "=========================================="

# 进入前端目录
cd "$(dirname "$0")"

# 端口号
PORT=8001

# 清理端口占用
echo "检查端口 ${PORT} 占用情况..."
if command -v netstat >/dev/null 2>&1; then
  # Windows 或 Linux 使用 netstat
  PID=$(netstat -ano 2>/dev/null | grep ":${PORT}" | grep LISTENING | awk '{print $NF}' | head -1)
  if [ -n "$PID" ] && [ "$PID" != "0" ]; then
    echo "发现端口 ${PORT} 被进程 ${PID} 占用，正在终止..."
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]]; then
      # Windows 使用 taskkill
      taskkill //F //PID "$PID" 2>/dev/null || true
    else
      # Linux/Mac 使用 kill
      kill -9 "$PID" 2>/dev/null || true
    fi
    echo "端口 ${PORT} 已释放"
    sleep 1
  else
    echo "端口 ${PORT} 未被占用"
  fi
elif command -v lsof >/dev/null 2>&1; then
  # Mac/Linux 使用 lsof
  PID=$(lsof -ti:${PORT} 2>/dev/null | head -1)
  if [ -n "$PID" ]; then
    echo "发现端口 ${PORT} 被进程 ${PID} 占用，正在终止..."
    kill -9 "$PID" 2>/dev/null || true
    echo "端口 ${PORT} 已释放"
    sleep 1
  else
    echo "端口 ${PORT} 未被占用"
  fi
else
  echo "无法检测端口占用（未找到 netstat 或 lsof 命令）"
fi

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

