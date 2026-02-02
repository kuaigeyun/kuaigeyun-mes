"""
手动应用采购申请表迁移

运行: python migrations/apply_purchase_requisition_migration.py
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
    migration_file = project_root / "migrations" / "models" / "60_20260201000000_create_purchase_requisition_tables.py"
    spec = importlib.util.spec_from_file_location("migration", migration_file)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    db = Tortoise.get_connection("default")
    sql = await mod.upgrade(db)
    statements = [s.strip() for s in sql.split(";") if s.strip()]

    for i, stmt in enumerate(statements, 1):
        if stmt and not stmt.endswith(";"):
            stmt += ";"
        try:
            await db.execute_query(stmt)
            print(f"  [{i}/{len(statements)}] OK")
        except Exception as e:
            print(f"  [{i}] Fail: {e}")
            raise

    print("采购申请表迁移完成")
    await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(apply_migration())
