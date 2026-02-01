"""
手动应用「创建统一需求计算表及明细表」迁移（30_20260115120000）

创建 apps_kuaizhizao_demand_computations 和 apps_kuaizhizao_demand_computation_items。
运行一次即可；表已存在时会跳过（CREATE TABLE IF NOT EXISTS）。
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
    """应用迁移"""
    await Tortoise.init(config=TORTOISE_ORM)

    migration_file = project_root / "migrations" / "models" / "30_20260115120000_create_demand_computation_tables.py"
    import importlib.util
    spec = importlib.util.spec_from_file_location("migration", migration_file)
    migration_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration_module)

    db = Tortoise.get_connection("default")

    try:
        print("开始应用「创建统一需求计算表及明细表」迁移...")
        sql = await migration_module.upgrade(db)
        statements = [s.strip() for s in sql.split(";") if s.strip()]
        for i, statement in enumerate(statements, 1):
            if not statement.strip():
                continue
            if not statement.strip().endswith(";"):
                statement += ";"
            try:
                await db.execute_query(statement)
                print(f"  [{i}/{len(statements)}] 执行成功")
            except Exception as e:
                print(f"  [{i}/{len(statements)}] 执行失败: {e}")
                raise
        print("✅ 需求计算表及明细表迁移应用成功！")
    except Exception as e:
        print(f"❌ 迁移失败: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(apply_migration())
