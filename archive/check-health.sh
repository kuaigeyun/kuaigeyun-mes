#!/bin/bash
# 项目健康检测脚本
# 快速运行项目健康检测程序

cd "$(dirname "$0")"
python riveredge-backend/scripts/check_project_health.py

