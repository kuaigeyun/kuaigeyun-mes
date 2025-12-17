"""
Aerich 配置文件

为 Aerich 数据库迁移工具提供 Tortoise ORM 配置。

使用方法：
1. 首次初始化：运行 `uv run aerich init -t migrations.aerich_config.TORTOISE_ORM`
2. 或者使用初始化脚本：`./migrations/init_aerich.sh`
3. 执行迁移：`uv run aerich upgrade`
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

# Aerich 初始化配置说明
# 
# 1. 在 pyproject.toml 中配置：
#    [tool.aerich]
#    tortoise_orm = "migrations.aerich_config.TORTOISE_ORM"
#    location = "./migrations"
#    src_folder = "./src"
#
# 2. 初始化 Aerich：
#    uv run aerich init -t migrations.aerich_config.TORTOISE_ORM
#
# 3. 执行迁移：
#    uv run aerich upgrade
#
# 4. 生成迁移文件：
#    uv run aerich migrate --name migration_name

