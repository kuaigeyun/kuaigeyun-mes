"""
检查 cost_rule 表结构

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
            WHERE table_name = 'apps_kuaizhizao_cost_rules' 
            ORDER BY column_name
        """)
        
        print("现有字段:")
        for c in cols:
            print(f"  {c['column_name']}: {c['data_type']} ({'NULL' if c['is_nullable'] == 'YES' else 'NOT NULL'})")
        
        # 检查缺失的字段
        existing_cols = {c['column_name'] for c in cols}
        required_cols = {
            'id', 'uuid', 'tenant_id', 'created_at', 'updated_at',  # BaseModel 字段
            'code', 'name', 'rule_type', 'cost_type', 'rule_parameters',  # 规则信息
            'is_active', 'priority', 'description', 'remarks',  # 其他字段
            'created_by', 'created_by_name', 'updated_by', 'updated_by_name',  # 审计字段
            'deleted_at'  # 软删除字段
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
