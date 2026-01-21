"""
检查销售出库单表字段是否存在

Author: Auto (AI Assistant)
Date: 2026-01-19
"""

import asyncio
import sys
from pathlib import Path

# 添加src目录到Python路径
backend_path = Path(__file__).parent.parent
src_path = backend_path / "src"
sys.path.insert(0, str(src_path))

from tortoise import Tortoise
from infra.infrastructure.database.database import TORTOISE_ORM


async def check_fields():
    """检查字段是否存在"""
    await Tortoise.init(config=TORTOISE_ORM)
    
    conn = Tortoise.get_connection("default")
    
    # 检查字段
    result = await conn.execute_query("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'apps_kuaizhizao_sales_deliveries' 
        AND column_name IN ('demand_id', 'demand_code', 'demand_type', 'sales_forecast_id', 'sales_forecast_code')
        ORDER BY column_name
    """)
    
    # 处理查询结果（asyncpg 返回的是元组列表）
    if isinstance(result, list) and len(result) > 0:
        if isinstance(result[0], tuple):
            existing_fields = [row[0] for row in result]
        else:
            existing_fields = [str(row) for row in result]
    else:
        existing_fields = []
    print("已存在的字段:", existing_fields)
    
    required_fields = ['demand_id', 'demand_code', 'demand_type', 'sales_forecast_id', 'sales_forecast_code']
    missing_fields = [f for f in required_fields if f not in existing_fields]
    
    if missing_fields:
        print("缺失的字段:", missing_fields)
        return False
    else:
        print("✅ 所有字段都存在！")
        return True
    
    await Tortoise.close_connections()


async def main():
    """主函数"""
    try:
        success = await check_fields()
        return 0 if success else 1
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
