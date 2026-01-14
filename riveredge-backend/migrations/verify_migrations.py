"""
验证迁移结果脚本

验证工序表和工艺路线表的字段是否正确添加。

Author: Luigi Lu
Date: 2026-01-16
"""

import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
DB_NAME = os.getenv("DB_NAME", "riveredge")


async def verify_migrations():
    """验证迁移结果"""
    conn = await asyncpg.connect(
        host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASSWORD, database=DB_NAME
    )
    try:
        print("=" * 60)
        print("验证迁移结果")
        print("=" * 60)
        
        # 验证工序表字段
        print("\n1. 验证工序表字段 (apps_master_data_operations):")
        ops_cols = await conn.fetch("""
            SELECT column_name, data_type, column_default, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'apps_master_data_operations'
            AND column_name IN ('reporting_type', 'allow_jump')
            ORDER BY column_name
        """)
        if ops_cols:
            for col in ops_cols:
                print(f"  ✓ {col['column_name']}: {col['data_type']} (默认: {col['column_default']}, 可空: {col['is_nullable']})")
        else:
            print("  ✗ 字段未找到")
        
        # 验证工艺路线表字段
        print("\n2. 验证工艺路线表字段 (apps_master_data_process_routes):")
        routes_cols = await conn.fetch("""
            SELECT column_name, data_type, column_default, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'apps_master_data_process_routes'
            AND column_name IN ('version', 'version_description', 'base_version', 'effective_date')
            ORDER BY column_name
        """)
        if routes_cols:
            for col in routes_cols:
                print(f"  ✓ {col['column_name']}: {col['data_type']} (默认: {col['column_default']}, 可空: {col['is_nullable']})")
        else:
            print("  ✗ 字段未找到")
        
        # 验证工艺路线表唯一约束
        print("\n3. 验证工艺路线表唯一约束:")
        constraints = await conn.fetch("""
            SELECT constraint_name, constraint_type
            FROM information_schema.table_constraints
            WHERE table_name = 'apps_master_data_process_routes'
            AND constraint_type = 'UNIQUE'
            AND constraint_name LIKE '%code%version%'
        """)
        if constraints:
            for constraint in constraints:
                print(f"  ✓ {constraint['constraint_name']}")
        else:
            print("  ✗ 唯一约束未找到")
        
        # 验证工艺路线表索引
        print("\n4. 验证工艺路线表版本相关索引:")
        indexes = await conn.fetch("""
            SELECT indexname
            FROM pg_indexes
            WHERE tablename = 'apps_master_data_process_routes'
            AND indexname LIKE '%version%'
        """)
        if indexes:
            for idx in indexes:
                print(f"  ✓ {idx['indexname']}")
        else:
            print("  ✗ 索引未找到")
        
        print("\n" + "=" * 60)
        print("验证完成！")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n验证失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(verify_migrations())
