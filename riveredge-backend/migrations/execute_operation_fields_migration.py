"""
执行工序字段迁移脚本

手动执行迁移文件，为工序表添加报工类型和跳转规则字段。

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
    migration_file = Path(__file__).parent / "models" / "26_20260116000001_add_operation_reporting_type_and_allow_jump.py"
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
            await conn.execute(sql_content)
            print("迁移执行完成！")
            
            # 验证表结构
            print("\n验证表结构...")
            columns = await conn.fetch("""
                SELECT column_name, data_type, column_default, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'apps_master_data_operations'
                AND column_name IN ('reporting_type', 'allow_jump')
                ORDER BY column_name
            """)
            if columns:
                print("  ✓ 字段已添加：")
                for col in columns:
                    print(f"    - {col['column_name']}: {col['data_type']} (默认值: {col['column_default']}, 可空: {col['is_nullable']})")
            else:
                print("  ✗ 字段未找到")

    except Exception as e:
        print(f"\n迁移执行失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await conn.close()
        print("\n数据库连接已关闭")


if __name__ == "__main__":
    asyncio.run(execute_migration())
