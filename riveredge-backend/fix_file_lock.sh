#!/bin/bash
# 解决文件锁定问题的脚本
# 用于处理 Windows 上虚拟环境文件被占用的情况

echo "正在检查 Python 进程..."

# 检查是否有 Python 进程在运行
PYTHON_PIDS=$(tasklist | grep -i python.exe | awk '{print $2}')

if [ -z "$PYTHON_PIDS" ]; then
    echo "未发现运行中的 Python 进程"
else
    echo "发现以下 Python 进程:"
    tasklist | grep -i python.exe
    echo ""
    echo "这些进程可能正在占用虚拟环境文件"
    echo ""
    read -p "是否要关闭所有 Python 进程? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "正在关闭 Python 进程..."
        for pid in $PYTHON_PIDS; do
            echo "关闭进程 PID: $pid"
            taskkill //F //PID $pid 2>/dev/null || true
        done
        echo "等待 2 秒让系统释放文件..."
        sleep 2
    else
        echo "跳过关闭进程"
    fi
fi

# 尝试删除文件
FILE_PATH=".venv/Lib/site-packages/markupsafe/_speedups.cp311-win_amd64.pyd"

if [ -f "$FILE_PATH" ]; then
    echo ""
    echo "尝试删除文件: $FILE_PATH"
    
    # 在 Git Bash 中，可以使用 cmd 来删除
    cmd //c "del /F /Q \"$FILE_PATH\"" 2>&1
    
    if [ $? -eq 0 ]; then
        echo "✓ 文件删除成功"
    else
        echo "✗ 文件删除失败，可能需要："
        echo "  1. 关闭所有使用虚拟环境的程序（IDE、终端等）"
        echo "  2. 以管理员权限运行此脚本"
        echo "  3. 重启计算机后再试"
    fi
else
    echo "文件不存在，可能已经被删除"
fi

