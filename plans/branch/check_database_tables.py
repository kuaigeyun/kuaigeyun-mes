#!/usr/bin/env python3
"""
检查数据库表结构，确保所有表都有必要的字段
"""

import asyncio
import asyncpg
from pathlib import Path
import os

# 添加项目根目录到Python路径
project_root = Path(__file__).parent
import sys
sys.path.insert(0, str(project_root))

async def check_table_structure():
    """检查数据库表结构"""

    # 从环境变量读取配置
    db_host = os.getenv('DB_HOST', 'localhost')
    db_port = int(os.getenv('DB_PORT', '5432'))
    db_user = os.getenv('DB_USER', 'postgres')
    db_password = os.getenv('DB_PASSWORD', 'jetema4ev')
    db_name = os.getenv('DB_NAME', 'riveredge')

    try:
        # 连接数据库
        conn = await asyncpg.connect(
            host=db_host,
            port=db_port,
            user=db_user,
            password=db_password,
            database=db_name
        )

        # 要检查的表和字段
        tables_to_check = [
            ('sys_users', ['uuid', 'tenant_id', 'deleted_at']),
            ('sys_roles', ['uuid', 'tenant_id', 'deleted_at']),
            ('sys_permissions', ['uuid', 'tenant_id', 'deleted_at']),
            ('sys_departments', ['uuid', 'tenant_id', 'deleted_at']),
            ('sys_positions', ['uuid', 'tenant_id', 'deleted_at']),
        ]

        print("🔍 检查数据库表结构...\n")

        for table_name, required_fields in tables_to_check:
            print(f"📋 检查表: {table_name}")

            # 获取表的列信息
            columns_query = """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = $1
            ORDER BY column_name;
            """

            columns = await conn.fetchval(columns_query, table_name)

            if columns is None:
                print(f"   ❌ 表 {table_name} 不存在")
                continue

            # 获取所有列名
            all_columns_query = """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = $1
            ORDER BY column_name;
            """

            rows = await conn.fetch(all_columns_query, table_name)
            existing_columns = [row['column_name'] for row in rows]

            print(f"   📊 现有字段: {', '.join(existing_columns)}")

            # 检查必需字段
            missing_fields = []
            for field in required_fields:
                if field not in existing_columns:
                    missing_fields.append(field)

            if missing_fields:
                print(f"   ❌ 缺少字段: {', '.join(missing_fields)}")

                # 为缺少的字段生成ALTER TABLE语句
                for field in missing_fields:
                    if field == 'uuid':
                        alter_sql = f"ALTER TABLE {table_name} ADD COLUMN uuid VARCHAR(36) UNIQUE NOT NULL DEFAULT gen_random_uuid();"
                    elif field == 'tenant_id':
                        alter_sql = f"ALTER TABLE {table_name} ADD COLUMN tenant_id INTEGER;"
                    elif field == 'deleted_at':
                        alter_sql = f"ALTER TABLE {table_name} ADD COLUMN deleted_at TIMESTAMP NULL;"
                    else:
                        alter_sql = f"-- 未知字段: {field}"

                    print(f"   🔧 修复SQL: {alter_sql}")

                    # 执行修复
                    try:
                        await conn.execute(alter_sql)
                        print(f"   ✅ 已添加字段: {field}")
                    except Exception as e:
                        print(f"   ❌ 添加字段失败 {field}: {e}")
            else:
                print("   ✅ 所有必需字段都存在")

            print()

        await conn.close()

    except Exception as e:
        print(f"❌ 数据库连接失败: {e}")
        print("请确保PostgreSQL服务正在运行，并且环境变量配置正确")

if __name__ == "__main__":
    asyncio.run(check_table_structure())

