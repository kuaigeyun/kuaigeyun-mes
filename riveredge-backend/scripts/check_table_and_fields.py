"""
检查表是否存在以及字段是否存在

Author: Auto (AI Assistant)
Date: 2026-01-19
"""

import asyncio
import sys
from pathlib import Path
from tortoise import Tortoise
from loguru import logger

# 添加src目录到Python路径
script_dir = Path(__file__).parent
backend_root = script_dir.parent
src_path = backend_root / "src"
if str(src_path) not in sys.path:
    sys.path.insert(0, str(src_path))

# 导入TORTOISE_ORM配置
from infra.infrastructure.database.database import TORTOISE_ORM


async def check_table_and_fields():
    """检查表是否存在以及字段是否存在"""
    await Tortoise.init(config=TORTOISE_ORM)
    conn = Tortoise.get_connection("default")
    
    # 检查表是否存在
    table_result = await conn.execute_query("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'apps_kuaizhizao_sales_deliveries'
    """)
    
    if not table_result or len(table_result) == 0:
        logger.error("表 apps_kuaizhizao_sales_deliveries 不存在！")
        return False
    
    logger.info(f"✅ 表 apps_kuaizhizao_sales_deliveries 存在")
    
    # 检查特定字段
    required_fields = ['demand_id', 'demand_code', 'demand_type', 'sales_forecast_id', 'sales_forecast_code']
    
    # 逐个检查字段是否存在
    found_fields = []
    for field_name in required_fields:
        result = await conn.execute_query("""
            SELECT COUNT(*) as count
            FROM information_schema.columns 
            WHERE table_name = 'apps_kuaizhizao_sales_deliveries' 
            AND column_name = $1
        """, [field_name])
        
        # 处理查询结果
        count = 0
        if result and len(result) > 0:
            row = result[0]
            if hasattr(row, 'count'):
                count = row.count
            elif isinstance(row, (tuple, list)) and len(row) > 0:
                count = row[0]
            else:
                count = int(row) if isinstance(row, (int, str)) else 0
        
        if count > 0:
            found_fields.append(field_name)
            logger.info(f"✅ 字段 {field_name} 存在")
        else:
            logger.warning(f"❌ 字段 {field_name} 不存在")
    
    missing_fields = [f for f in required_fields if f not in found_fields]
    
    if missing_fields:
        logger.warning(f"缺失的字段: {missing_fields}")
        return False
    else:
        logger.success("✅ 所有字段都存在！")
    
    # 检查明细表的字段
    logger.info("检查明细表 apps_kuaizhizao_sales_delivery_items...")
    item_required_fields = ['serial_numbers', 'demand_id', 'demand_item_id']
    item_found_fields = []
    
    for field_name in item_required_fields:
        result = await conn.execute_query("""
            SELECT COUNT(*) as count
            FROM information_schema.columns 
            WHERE table_name = 'apps_kuaizhizao_sales_delivery_items' 
            AND column_name = $1
        """, [field_name])
        
        count = 0
        if result and len(result) > 0:
            row = result[0]
            if hasattr(row, 'count'):
                count = row.count
            elif isinstance(row, (tuple, list)) and len(row) > 0:
                count = row[0]
            else:
                count = int(row) if isinstance(row, (int, str)) else 0
        
        if count > 0:
            item_found_fields.append(field_name)
            logger.info(f"✅ 明细表字段 {field_name} 存在")
        else:
            logger.warning(f"❌ 明细表字段 {field_name} 不存在")
    
    item_missing_fields = [f for f in item_required_fields if f not in item_found_fields]
    
    if item_missing_fields:
        logger.warning(f"明细表缺失的字段: {item_missing_fields}")
        return False
    else:
        logger.success("✅ 明细表所有字段都存在！")
        return True
    
    await Tortoise.close_connections()


async def main():
    try:
        result = await check_table_and_fields()
        sys.exit(0 if result else 1)
    except Exception as e:
        logger.error(f"检查失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(main())
