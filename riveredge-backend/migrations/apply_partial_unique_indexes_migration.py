"""
手动应用部分唯一索引迁移

直接执行 SQL 迁移，不依赖 aerich 工具。
"""

import asyncio
import sys
from pathlib import Path

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
src_path = project_root / "src"
sys.path.insert(0, str(src_path))
sys.path.insert(0, str(project_root))

from tortoise import Tortoise
from infra.infrastructure.database.database import TORTOISE_ORM


async def apply_migration():
    """应用迁移"""
    await Tortoise.init(config=TORTOISE_ORM)
    
    # 读取迁移文件
    migration_file = project_root / "migrations" / "models" / "63_20260122182517_add_partial_unique_indexes_for_soft_delete.py"
    
    # 导入迁移模块
    import importlib.util
    spec = importlib.util.spec_from_file_location("migration", migration_file)
    migration_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration_module)
    
    # 获取数据库连接
    db = Tortoise.get_connection("default")
    
    try:
        print("开始应用部分唯一索引迁移...")
        
        # 执行 upgrade 函数
        sql = await migration_module.upgrade(db)
        
        # 分割 SQL 语句（按分号分割，但保留 DO $$ ... END $$; 块）
        import re
        # 先处理 DO $$ ... END $$; 块
        sql_blocks = []
        remaining_sql = sql
        
        # 提取所有 DO $$ ... END $$; 块
        do_block_pattern = r'DO\s+\$\$\s+.*?END\s+\$\$;'
        do_blocks = re.findall(do_block_pattern, sql, re.DOTALL | re.IGNORECASE)
        
        # 移除 DO 块后的剩余 SQL
        for block in do_blocks:
            sql_blocks.append(block)
            remaining_sql = remaining_sql.replace(block, '', 1)
        
        # 分割剩余的 SQL 语句（按分号分割）
        remaining_statements = [s.strip() for s in remaining_sql.split(';') if s.strip()]
        sql_blocks.extend(remaining_statements)
        
        # 执行每条 SQL 语句
        for i, statement in enumerate(sql_blocks, 1):
            if not statement.strip():
                continue
            # 确保语句以分号结尾（DO 块已经有分号）
            if not statement.strip().endswith(';'):
                statement += ';'
            try:
                await db.execute_query(statement)
                print(f"  [{i}/{len(sql_blocks)}] 执行成功")
            except Exception as e:
                print(f"  [{i}/{len(sql_blocks)}] 执行失败: {e}")
                # 如果是索引已存在的错误，可以忽略
                if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                    print(f"     (索引已存在，跳过)")
                    continue
                raise
        
        print("✅ 迁移应用成功！")
        
    except Exception as e:
        print(f"❌ 迁移失败: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(apply_migration())
