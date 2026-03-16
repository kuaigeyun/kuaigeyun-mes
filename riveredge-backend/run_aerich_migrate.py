#!/usr/bin/env python3
"""
Aerich 数据库表结构迁移脚本

显式从 riveredge-backend/.env 加载配置后执行 aerich upgrade，
避免因工作目录不同导致 .env 未被正确加载。

使用方法（可从任意目录运行）:
    uv run python run_aerich_migrate.py
    或
    cd riveredge-backend && uv run python run_aerich_migrate.py
"""

import os
import subprocess
import sys
from pathlib import Path

# 获取 backend 根目录（本脚本位于 riveredge-backend/ 下）
_backend_root = Path(__file__).resolve().parent
_env_file = _backend_root / ".env"

if _env_file.exists():
    from dotenv import load_dotenv
    load_dotenv(_env_file)
    print(f"[migrate] 已加载配置: {_env_file}")
# 迁移时仅用 1 个连接，避免 too many clients
os.environ["AERICH_MIGRATE"] = "1"
else:
    print(f"[migrate] 警告: 未找到 .env 文件 ({_env_file})，将使用环境变量/默认值")

# 切换到 backend 目录，确保 aerich 和 pydantic 能正确解析相对路径
os.chdir(_backend_root)

# 设置 PYTHONPATH
src_dir = _backend_root / "src"
env = os.environ.copy()
path_sep = ";" if sys.platform == "win32" else ":"
python_path = str(_backend_root) + path_sep + str(src_dir)
if env.get("PYTHONPATH"):
    env["PYTHONPATH"] = python_path + path_sep + env["PYTHONPATH"]
else:
    env["PYTHONPATH"] = python_path

# 执行 aerich upgrade
print("[migrate] 执行 aerich upgrade...")
result = subprocess.run(
    ["uv", "run", "aerich", "upgrade"],
    cwd=str(_backend_root),
    env=env,
)
sys.exit(result.returncode)
