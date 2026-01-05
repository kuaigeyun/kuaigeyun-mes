"""
重新创建aerich表并插入迁移记录
"""

import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def recreate_aerich_table():
    """重新创建aerich表并插入迁移记录"""
    conn = await asyncpg.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=int(os.getenv('DB_PORT', 5432)),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        database=os.getenv('DB_NAME')
    )

    try:
        # 检查aerich表是否存在
        table_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'aerich'
            )
        """)

        if not table_exists:
            print('🔧 创建aerich表...')
            await conn.execute("""
                CREATE TABLE aerich (
                    id SERIAL PRIMARY KEY,
                    version VARCHAR(255) NOT NULL,
                    app VARCHAR(100) NOT NULL,
                    content JSONB
                )
            """)
            print('✅ 已创建aerich表')
        else:
            print('ℹ️ aerich表已存在')

        # 检查并插入迁移记录
        migrations = [
            ('0_init_schema', 'models'),
            ('1_20251230080035_create_kuaizhizao_tables', 'models')
        ]

        for version, app in migrations:
            exists = await conn.fetchval("""
                SELECT EXISTS (
                    SELECT 1 FROM aerich
                    WHERE version = $1 AND app = $2
                )
            """, version, app)

            if not exists:
                await conn.execute("""
                    INSERT INTO aerich (version, app, content)
                    VALUES ($1, $2, '{}')
                """, version, app)
                print(f'✅ 已插入迁移记录: {version}')
            else:
                print(f'ℹ️ 迁移记录已存在: {version}')

        # 显示所有迁移记录
        records = await conn.fetch('SELECT id, version, app FROM aerich ORDER BY id')
        print('\n📋 当前迁移记录:')
        for record in records:
            print(f'  {record["id"]}: {record["version"]} ({record["app"]})')

    finally:
        await conn.close()

if __name__ == '__main__':
    asyncio.run(recreate_aerich_table())














