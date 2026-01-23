"""
检查基础数据管理的编码规则

Author: Auto-generated
Date: 2026-01-23
"""

import asyncio
import sys
from pathlib import Path

# 添加项目根目录和src目录到 Python 路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / 'src'))

from tortoise import Tortoise
from loguru import logger

from infra.models.tenant import Tenant
from core.models.code_rule import CodeRule
from infra.infrastructure.database.database import get_dynamic_tortoise_config


async def check_master_data_rules():
    """
    检查基础数据管理的编码规则
    """
    try:
        # 初始化 Tortoise ORM
        config = await get_dynamic_tortoise_config()
        await Tortoise.init(config=config)
        logger.info("✅ Tortoise ORM 初始化成功")
        
        # 获取第一个组织
        tenant = await Tenant.first()
        if not tenant:
            logger.error("❌ 没有找到组织")
            return
        
        logger.info(f"📋 检查组织 {tenant.name} (ID: {tenant.id}) 的基础数据编码规则")
        
        # 基础数据的规则代码列表
        master_data_codes = [
            "MASTER_DATA_FACTORY_PLANT",
            "MASTER_DATA_FACTORY_WORKSHOP",
            "MASTER_DATA_FACTORY_PRODUCTION_LINE",
            "MASTER_DATA_FACTORY_WORKSTATION",
            "MASTER_DATA_WAREHOUSE_WAREHOUSE",
            "MASTER_DATA_WAREHOUSE_STORAGE_AREA",
            "MASTER_DATA_WAREHOUSE_STORAGE_LOCATION",
            "MASTER_DATA_MATERIAL_GROUP",
            "MATERIAL_CODE",
            "MASTER_DATA_PROCESS_OPERATION",
            "MASTER_DATA_PROCESS_ROUTE",
            "MASTER_DATA_SUPPLY_CHAIN_CUSTOMER",
            "MASTER_DATA_SUPPLY_CHAIN_SUPPLIER",
            "MASTER_DATA_PERFORMANCE_SKILL",
        ]
        
        for rule_code in master_data_codes:
            # 查找所有规则（包括禁用的）
            rules = await CodeRule.filter(
                tenant_id=tenant.id,
                code=rule_code,
                deleted_at__isnull=True
            ).all()
            
            if rules:
                for rule in rules:
                    logger.info(f"  - {rule_code}:")
                    logger.info(f"     名称: {rule.name}")
                    logger.info(f"     启用: {rule.is_active}")
                    logger.info(f"     组件: {rule.rule_components}")
                    logger.info(f"     表达式: {rule.expression}")
            else:
                logger.warning(f"  - {rule_code}: 未找到")
        
    except Exception as e:
        logger.error(f"❌ 检查失败: {e}")
        import traceback
        logger.error(traceback.format_exc())
        sys.exit(1)
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(check_master_data_rules())
