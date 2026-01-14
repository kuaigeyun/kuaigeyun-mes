"""
执行工艺路线子工艺路线字段迁移脚本

手动执行迁移文件，为工艺路线表添加子工艺路线支持字段。

Author: Luigi Lu
Date: 2026-01-16
"""

import asyncio
import asyncpg
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
DB_NAME = os.getenv("DB_NAME", "riveredge")


async def execute_migration():
    """执行迁移"""
    migration_file = Path(__file__).parent / "models" / "28_20260116000003_add_process_route_sub_route_fields.py"
    if not migration_file.exists():
        print(f"错误：迁移文件不存在: {migration_file}")
        return

    with open(migration_file, 'r', encoding='utf-8') as f:
        content = f.read()

    import re
    match = re.search(r'async def upgrade.*?return """(.*?)"""', content, re.DOTALL)
    if not match:
        print("错误：无法提取upgrade SQL")
        return
    sql_content = match.group(1).strip()

    conn = await asyncpg.connect(
        host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASSWORD, database=DB_NAME
    )
    try:
        async with conn.transaction():
            print("开始执行迁移...")
            # 执行SQL语句（按分号分割）
            statements = [s.strip() for s in sql_content.split(';') if s.strip()]
            for i, statement in enumerate(statements, 1):
                if statement:
                    print(f"执行语句 {i}/{len(statements)}...")
                    await conn.execute(statement)
            print("迁移执行完成！")
            
            # 验证表结构
            print("\n验证表结构...")
            columns = await conn.fetch("""
                SELECT column_name, data_type, column_default, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'apps_master_data_process_routes'
                AND column_name IN ('parent_route_id', 'parent_operation_uuid', 'level')
                ORDER BY column_name
            """)
            if columns:
                print("  ✓ 字段已添加：")
                for col in columns:
                    print(f"    - {col['column_name']}: {col['data_type']} (默认值: {col['column_default']}, 可空: {col['is_nullable']})")
            else:
                print("  ✗ 字段未找到")
            
            # 验证外键约束
            print("\n验证外键约束...")
            constraints = await conn.fetch("""
                SELECT constraint_name, constraint_type
                FROM information_schema.table_constraints
                WHERE table_name = 'apps_master_data_process_routes'
                AND constraint_name LIKE '%parent_route%'
            """)
            if constraints:
                print("  ✓ 外键约束：")
                for constraint in constraints:
                    print(f"    - {constraint['constraint_name']}")
            
            # 验证索引
            print("\n验证索引...")
            indexes = await conn.fetch("""
                SELECT indexname
                FROM pg_indexes
                WHERE tablename = 'apps_master_data_process_routes'
                AND indexname LIKE '%parent%' OR indexname LIKE '%level%'
            """)
            if indexes:
                print("  ✓ 相关索引：")
                for idx in indexes:
                    print(f"    - {idx['indexname']}")

    except Exception as e:
        print(f"\n迁移执行失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await conn.close()
        print("\n数据库连接已关闭")


if __name__ == "__main__":
    asyncio.run(execute_migration())
