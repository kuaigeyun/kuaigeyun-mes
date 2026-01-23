"""
检查编码规则数量脚本

Author: Auto-generated
Date: 2026-01-20
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


async def check_code_rules():
    """
    检查所有组织的编码规则数量
    """
    try:
        # 初始化 Tortoise ORM
        config = await get_dynamic_tortoise_config()
        await Tortoise.init(config=config)
        logger.info("✅ Tortoise ORM 初始化成功")
        
        # 获取所有组织
        tenants = await Tenant.all()
        logger.info(f"📋 找到 {len(tenants)} 个组织")
        
        total_rules = 0
        for tenant in tenants:
            count = await CodeRule.filter(
                tenant_id=tenant.id,
                deleted_at__isnull=True
            ).count()
            total_rules += count
            logger.info(f"   - {tenant.name} (ID: {tenant.id}): {count} 个编码规则")
        
        logger.info(f"\n✅ 总计: {total_rules} 个编码规则")
        
    except Exception as e:
        logger.error(f"❌ 检查失败: {e}")
        import traceback
        logger.error(traceback.format_exc())
        sys.exit(1)
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(check_code_rules())
