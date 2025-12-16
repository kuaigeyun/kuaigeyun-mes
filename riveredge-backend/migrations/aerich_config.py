"""
Aerich 配置文件

为 Aerich 数据库迁移工具提供 Tortoise ORM 配置。
"""

import sys
from pathlib import Path

# 添加 src 目录到 Python 路径
# 文件在 migrations/ 目录下，需要回到项目根目录
project_root = Path(__file__).parent.parent
src_path = project_root / "src"
if str(src_path) not in sys.path:
    sys.path.insert(0, str(src_path))

# 导入数据库配置
from infra.infrastructure.database.database import TORTOISE_ORM

# 导出给 Aerich 使用
__all__ = ['TORTOISE_ORM']

