"""
修复所有core_表缺少的updated_at字段
"""

import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def fix_updated_at_fields():
    """修复所有core_表缺少的updated_at字段"""
    conn = await asyncpg.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=int(os.getenv('DB_PORT', 5432)),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        database=os.getenv('DB_NAME')
    )

    try:
        # 获取所有core_开头的表
        tables = await conn.fetch("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name LIKE 'core_%'
            ORDER BY table_name
        """)

        print('🔍 检查所有core_表是否缺少updated_at字段:')

        for table_row in tables:
            table_name = table_row['table_name']

            # 检查是否有updated_at字段
            has_updated_at = await conn.fetchval("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = $1
                    AND column_name = 'updated_at'
                )
            """, table_name)

            if not has_updated_at:
                print(f'❌ {table_name} 缺少 updated_at 字段')

                # 添加updated_at字段
                await conn.execute(f"""
                    ALTER TABLE {table_name}
                    ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                """)
                print(f'✅ 已为 {table_name} 添加 updated_at 字段')
            else:
                print(f'✅ {table_name} 已有 updated_at 字段')

    finally:
        await conn.close()

if __name__ == '__main__':
    asyncio.run(fix_updated_at_fields())













