"""
检查 cost_calculation 表结构

Author: Auto (AI Assistant)
Date: 2026-01-20
"""

import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def check_table():
    """检查表结构"""
    conn = await asyncpg.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=int(os.getenv('DB_PORT', '5432')),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        database=os.getenv('DB_NAME')
    )
    
    try:
        cols = await conn.fetch("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'apps_kuaizhizao_cost_calculations' 
            ORDER BY column_name
        """)
        
        print("现有字段:")
        for c in cols:
            print(f"  {c['column_name']}: {c['data_type']} ({'NULL' if c['is_nullable'] == 'YES' else 'NOT NULL'})")
        
    finally:
        await conn.close()

if __name__ == '__main__':
    asyncio.run(check_table())
