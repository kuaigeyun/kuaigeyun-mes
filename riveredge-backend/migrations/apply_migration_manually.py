"""
手动应用迁移脚本

由于 Aerich 格式检测问题，此脚本用于手动将迁移记录插入到 aerich 表中。
"""

import asyncio
import asyncpg
import os
from pathlib import Path
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

async def apply_migration_manually():
    """手动应用初始迁移"""
    # 连接数据库
    conn = await asyncpg.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=int(os.getenv('DB_PORT', 5432)),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        database=os.getenv('DB_NAME')
    )
    
    try:
        # 检查 aerich 表是否存在
        table_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'aerich'
            )
        """)
        
        if not table_exists:
            print("❌ aerich 表不存在，请先运行 aerich init-db")
            return
        
        # 检查迁移是否已存在
        migration_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM aerich 
                WHERE version = '0_20251227_init_from_current_db' 
                AND app = 'models'
            )
        """)
        
        if migration_exists:
            print("✅ 迁移 0_20251227_init_from_current_db 已存在")
        else:
            # 插入迁移记录
            await conn.execute("""
                INSERT INTO aerich (version, app, content)
                VALUES ('0_20251227_init_from_current_db', 'models', '{}')
            """)
            print("✅ 已插入迁移记录: 0_20251227_init_from_current_db")
        
        # 显示所有迁移记录
        records = await conn.fetch("""
            SELECT id, version, app, create_time 
            FROM aerich 
            ORDER BY id DESC 
            LIMIT 10
        """)
        
        print("\n📋 最近的迁移记录:")
        for record in records:
            print(f"  {record['id']}: {record['version']} ({record['app']}) - {record['create_time']}")
        
    finally:
        await conn.close()

if __name__ == '__main__':
    asyncio.run(apply_migration_manually())

