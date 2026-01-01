"""
检查数据库表结构的脚本
"""

import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def check_table_structure():
    """检查数据库表结构"""
    conn = await asyncpg.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=int(os.getenv('DB_PORT', 5432)),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        database=os.getenv('DB_NAME')
    )

    try:
        # 检查core_operation_logs表结构
        columns = await conn.fetch("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'core_operation_logs'
            ORDER BY ordinal_position
        """)

        print('📋 core_operation_logs 表结构:')
        has_updated_at = False
        for col in columns:
            print(f'  {col["column_name"]}: {col["data_type"]} {"NULL" if col["is_nullable"] == "YES" else "NOT NULL"} {col["column_default"] or ""}')
            if col["column_name"] == "updated_at":
                has_updated_at = True

        if not has_updated_at:
            print('\n❌ 缺少 updated_at 字段！')
        else:
            print('\n✅ updated_at 字段存在')

        # 检查core_operation_logs表是否有数据
        count = await conn.fetchval("SELECT COUNT(*) FROM core_operation_logs")
        print(f'\n📊 core_operation_logs 表中有 {count} 条记录')

    finally:
        await conn.close()

if __name__ == '__main__':
    asyncio.run(check_table_structure())




