#!/bin/bash
# RiverEdge 快速启动脚本 - 最快速度重启前后端
# 强制静默模式，跳过所有不必要的输出和检查

export QUIET=true
export DEBUG=false

# 执行快速启动
exec ./start-all.sh fast
