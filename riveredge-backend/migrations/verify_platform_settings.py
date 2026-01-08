"""
验证平台设置表是否创建成功

Author: Auto (AI Assistant)
Date: 2026-01-06
"""

import asyncio
import asyncpg
import os
from pathlib import Path
from dotenv import load_dotenv

# 加载环境变量
env_file = Path(__file__).parent.parent / '.env'
load_dotenv(env_file)

async def verify_table():
    """验证表结构"""
    db_host = os.getenv('DB_HOST', 'localhost')
    db_port = int(os.getenv('DB_PORT', 5432))
    db_user = os.getenv('DB_USER', 'postgres')
    db_password = os.getenv('DB_PASSWORD', '')
    db_name = os.getenv('DB_NAME', 'riveredge')
    
    conn = await asyncpg.connect(
        host=db_host,
        port=db_port,
        user=db_user,
        password=db_password,
        database=db_name
    )
    
    try:
        # 检查表是否存在
        table_exists = await conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'infra_platform_settings'
            )
        """)
        
        if not table_exists:
            print("❌ 表 infra_platform_settings 不存在")
            return
        
        print("✅ 表 infra_platform_settings 存在")
        print("\n📋 表结构:")
        
        # 获取表结构
        columns = await conn.fetch("""
            SELECT 
                column_name, 
                data_type, 
                character_maximum_length,
                is_nullable,
                column_default
            FROM information_schema.columns 
            WHERE table_name = 'infra_platform_settings' 
            ORDER BY ordinal_position
        """)
        
        for col in columns:
            col_type = col['data_type']
            if col['character_maximum_length']:
                col_type += f"({col['character_maximum_length']})"
            nullable = "NULL" if col['is_nullable'] == 'YES' else "NOT NULL"
            default = f" DEFAULT {col['column_default']}" if col['column_default'] else ""
            print(f"  - {col['column_name']}: {col_type} {nullable}{default}")
        
        # 检查索引
        indexes = await conn.fetch("""
            SELECT indexname 
            FROM pg_indexes 
            WHERE tablename = 'infra_platform_settings'
        """)
        
        if indexes:
            print("\n📊 索引:")
            for idx in indexes:
                print(f"  - {idx['indexname']}")
        
        print("\n✅ 验证完成！")
        
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(verify_table())

