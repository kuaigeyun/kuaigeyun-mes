"""
手动应用工序表 id 序列同步迁移

直接执行 SQL 迁移，修复主键冲突（seed_master_data_operations_pkey）。
"""

import asyncio
import re
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

    migration_file = project_root / "migrations" / "models" / "64_20260126000000_sync_operations_id_sequence.py"
    import importlib.util
    spec = importlib.util.spec_from_file_location("migration", migration_file)
    migration_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration_module)

    db = Tortoise.get_connection("default")

    try:
        print("开始应用工序表 id 序列同步迁移...")
        sql = await migration_module.upgrade(db)

        sql_blocks = []
        remaining_sql = sql
        do_block_pattern = r"DO\s+\$\$\s+.*?END\s+\$\$;"
        do_blocks = re.findall(do_block_pattern, sql, re.DOTALL | re.IGNORECASE)
        for block in do_blocks:
            sql_blocks.append(block)
            remaining_sql = remaining_sql.replace(block, "", 1)
        remaining_statements = [s.strip() for s in remaining_sql.split(";") if s.strip()]
        sql_blocks.extend(remaining_statements)

        for i, statement in enumerate(sql_blocks, 1):
            if not statement.strip():
                continue
            if not statement.strip().endswith(";"):
                statement += ";"
            try:
                await db.execute_query(statement)
                print(f"  [{i}/{len(sql_blocks)}] 执行成功")
            except Exception as e:
                print(f"  [{i}/{len(sql_blocks)}] 执行失败: {e}")
                raise

        print("✅ 工序表 id 序列同步迁移应用成功！")

    except Exception as e:
        print(f"❌ 迁移失败: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(apply_migration())
