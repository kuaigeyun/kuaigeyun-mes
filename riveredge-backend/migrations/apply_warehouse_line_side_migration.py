"""
手动应用仓库线边仓字段迁移

为 apps_master_data_warehouses 表添加 warehouse_type, workshop_id, workshop_name, work_center_id, work_center_name。

运行: python migrations/apply_warehouse_line_side_migration.py
"""

import asyncio
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
src_path = project_root / "src"
sys.path.insert(0, str(src_path))
sys.path.insert(0, str(project_root))

from tortoise import Tortoise
from infra.infrastructure.database.database import TORTOISE_ORM


async def apply_migration():
    await Tortoise.init(config=TORTOISE_ORM)

    import importlib.util
    migration_file = project_root / "migrations" / "models" / "69_20260202120000_add_warehouse_line_side_fields.py"
    spec = importlib.util.spec_from_file_location("migration", migration_file)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    db = Tortoise.get_connection("default")
    sql = (await mod.upgrade(db)).strip()
    if not sql.endswith(";"):
        sql += ";"
    try:
        await db.execute_query(sql)
        print("  [1/1] OK")
    except Exception as e:
        print(f"  Fail: {e}")
        raise

    print("仓库线边仓字段迁移完成")
    await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(apply_migration())
