#!/usr/bin/env python3
"""
检查数据库表结构，确认 deleted_at 字段是否存在
"""

import asyncio
import asyncpg
import sys
import os

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from riveredge_backend.src.soil.config import settings

async def check_table_columns():
    """检查指定表的列结构"""
    try:
        conn = await asyncpg.connect(
            host=settings.DB_HOST,
            port=settings.DB_PORT,
            user=settings.DB_USER,
            password=settings.DB_PASSWORD,
            database=settings.DB_NAME,
        )

        tables_to_check = ['sys_users', 'sys_roles', 'sys_permissions']

        for table in tables_to_check:
            print(f"\n=== 检查表 {table} ===")

            # 获取表的所有列
            columns = await conn.fetch("""
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_name = $1 AND table_schema = 'public'
                ORDER BY ordinal_position;
            """, table)

            if not columns:
                print(f"表 {table} 不存在")
                continue

            # 检查是否包含 deleted_at 字段
            has_deleted_at = any(col['column_name'] == 'deleted_at' for col in columns)
            print(f"包含 deleted_at 字段: {has_deleted_at}")

            if not has_deleted_at:
                print(f"⚠️  表 {table} 缺少 deleted_at 字段")
                # 添加 deleted_at 字段
                await conn.execute(f"""
                    ALTER TABLE {table}
                    ADD COLUMN deleted_at TIMESTAMP NULL;
                """)
                print(f"✅ 已为表 {table} 添加 deleted_at 字段")
            else:
                print(f"✅ 表 {table} 已包含 deleted_at 字段")

            # 显示所有列
            print("所有字段:")
            for col in columns:
                nullable = "NULL" if col['is_nullable'] == 'YES' else "NOT NULL"
                default = f" DEFAULT {col['column_default']}" if col['column_default'] else ""
                print(f"  - {col['column_name']}: {col['data_type']} {nullable}{default}")

        await conn.close()

    except Exception as e:
        print(f"检查数据库表结构失败: {e}")
        return False

    return True

if __name__ == "__main__":
    asyncio.run(check_table_columns())
