"""
检查数据库中所有表的脚本
"""

import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def check_tables():
    """检查数据库中的所有表"""
    conn = await asyncpg.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=int(os.getenv('DB_PORT', 5432)),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        database=os.getenv('DB_NAME')
    )

    try:
        # 查询所有表名
        tables = await conn.fetch("""
            SELECT schemaname, tablename
            FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY tablename
        """)

        print('📋 数据库中的所有表:')
        kuaizhizao_tables = []
        for table in tables:
            table_name = table['tablename']
            print(f'  - {table_name}')
            if 'kuaizhizao' in table_name.lower():
                kuaizhizao_tables.append(table_name)

        print(f'\n🔍 找到 {len(kuaizhizao_tables)} 个包含 kuaizhizao 的表:')
        for table in kuaizhizao_tables:
            print(f'  - {table}')

    finally:
        await conn.close()

if __name__ == '__main__':
    asyncio.run(check_tables())














