"""
Aerich 执行脚本

用于正确设置 Python 路径并执行 Aerich 命令。
"""

import sys
import os
from pathlib import Path

# 获取项目根目录
project_root = Path(__file__).parent
src_path = project_root / "src"
migrations_path = project_root / "migrations"

# 添加路径到 sys.path
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))
if str(src_path) not in sys.path:
    sys.path.insert(0, str(src_path))
if str(migrations_path) not in sys.path:
    sys.path.insert(0, str(migrations_path))

# 切换到项目根目录
os.chdir(project_root)

# 导入并执行 aerich
if __name__ == "__main__":
    import aerich.cli
    aerich.cli.main()

