"""
手动应用多需求支持迁移

运行: python migrations/apply_demand_ids_migration.py
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
    migration_file = project_root / "migrations" / "models" / "61_20260202000000_add_demand_ids_for_multi_demand.py"
    spec = importlib.util.spec_from_file_location("migration", migration_file)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    db = Tortoise.get_connection("default")
    sql = await mod.upgrade(db)
    statements = [s.strip() for s in sql.split(";") if s.strip()]

    print("开始应用多需求支持迁移...")
    for i, stmt in enumerate(statements, 1):
        if stmt and not stmt.endswith(";"):
            stmt += ";"
        try:
            await db.execute_query(stmt)
            print(f"  [{i}/{len(statements)}] 执行成功")
        except Exception as e:
            print(f"  [{i}] 执行失败: {e}")
            # 如果是列已存在的错误，继续执行
            if "already exists" not in str(e).lower():
                raise

    print("✅ 多需求支持迁移完成")
    await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(apply_migration())
