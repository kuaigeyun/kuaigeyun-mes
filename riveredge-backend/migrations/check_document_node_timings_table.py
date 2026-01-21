"""
检查 document_node_timings 表结构

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
            WHERE table_name = 'apps_kuaizhizao_document_node_timings' 
            ORDER BY column_name
        """)
        
        print("现有字段:")
        for c in cols:
            print(f"  {c['column_name']}: {c['data_type']} ({'NULL' if c['is_nullable'] == 'YES' else 'NOT NULL'})")
        
        # 检查缺失的字段
        existing_cols = {c['column_name'] for c in cols}
        required_cols = {
            'id', 'uuid', 'tenant_id', 'created_at', 'updated_at',  # BaseModel 字段
            'document_type', 'document_id', 'document_code',  # 单据信息
            'node_name', 'node_code',  # 节点信息
            'start_time', 'end_time', 'duration_seconds', 'duration_hours',  # 时间信息
            'operator_id', 'operator_name',  # 操作人信息
            'remarks', 'deleted_at'  # 其他字段
        }
        
        missing_cols = required_cols - existing_cols
        if missing_cols:
            print(f"\n缺失的字段: {missing_cols}")
        else:
            print("\n✅ 所有必需字段都存在")
            
    finally:
        await conn.close()

if __name__ == '__main__':
    asyncio.run(check_table())
