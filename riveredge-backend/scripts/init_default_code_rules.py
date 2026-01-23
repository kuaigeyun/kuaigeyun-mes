"""
初始化预设编码规则脚本

为所有现有组织初始化预设的编码规则（使用新的组件格式）。

使用方法:
    python -m scripts.init_default_code_rules

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
from core.services.default.default_values_service import DefaultValuesService
from infra.infrastructure.database.database import get_dynamic_tortoise_config


async def init_default_code_rules_for_all_tenants():
    """
    为所有组织初始化预设编码规则
    """
    logger.info("=" * 60)
    logger.info("开始为所有组织初始化预设编码规则...")
    logger.info("=" * 60)
    
    try:
        # 初始化 Tortoise ORM
        config = await get_dynamic_tortoise_config()
        await Tortoise.init(config=config)
        logger.info("✅ Tortoise ORM 初始化成功")
        
        # 获取所有组织
        tenants = await Tenant.all()
        logger.info(f"📋 找到 {len(tenants)} 个组织")
        
        if len(tenants) == 0:
            logger.warning("⚠️  没有找到任何组织，请先创建组织")
            return
        
        # 为每个组织初始化预设编码规则
        success_count = 0
        failed_count = 0
        
        for tenant in tenants:
            try:
                logger.info(f"\n{'=' * 60}")
                logger.info(f"📦 为组织 {tenant.name} (ID: {tenant.id}, Domain: {tenant.domain}) 初始化预设编码规则...")
                logger.info(f"{'=' * 60}")
                
                result = await DefaultValuesService.initialize_tenant_defaults(tenant_id=tenant.id)
                
                logger.info(f"✅ 组织 {tenant.name} 初始化完成:")
                logger.info(f"   - 编码规则: {result['code_rules_count']} 个")
                logger.info(f"   - 系统参数: {result['system_parameters_count']} 个")
                
                success_count += 1
                
            except Exception as e:
                logger.error(f"❌ 为组织 {tenant.name} (ID: {tenant.id}) 初始化失败: {e}")
                import traceback
                logger.error(traceback.format_exc())
                failed_count += 1
                continue
        
        logger.info(f"\n{'=' * 60}")
        logger.info(f"✅ 预设编码规则初始化完成！")
        logger.info(f"   - 成功: {success_count}/{len(tenants)} 个组织")
        logger.info(f"   - 失败: {failed_count}/{len(tenants)} 个组织")
        logger.info(f"{'=' * 60}")
        
    except Exception as e:
        logger.error(f"❌ 初始化失败: {e}")
        import traceback
        logger.error(traceback.format_exc())
        sys.exit(1)
    finally:
        # 关闭数据库连接
        await Tortoise.close_connections()
        logger.info("🔌 数据库连接已关闭")


async def init_default_code_rules_for_specific_tenant(tenant_id: int):
    """
    为指定组织初始化预设编码规则
    
    Args:
        tenant_id: 组织ID
    """
    logger.info("=" * 60)
    logger.info(f"开始为组织 {tenant_id} 初始化预设编码规则...")
    logger.info("=" * 60)
    
    try:
        # 初始化 Tortoise ORM
        config = await get_dynamic_tortoise_config()
        await Tortoise.init(config=config)
        logger.info("✅ Tortoise ORM 初始化成功")
        
        # 获取指定组织
        tenant = await Tenant.get_or_none(id=tenant_id)
        if not tenant:
            logger.error(f"❌ 组织 {tenant_id} 不存在")
            sys.exit(1)
        
        logger.info(f"📦 为组织 {tenant.name} (ID: {tenant.id}, Domain: {tenant.domain}) 初始化预设编码规则...")
        
        result = await DefaultValuesService.initialize_tenant_defaults(tenant_id=tenant.id)
        
        logger.info(f"✅ 组织 {tenant.name} 初始化完成:")
        logger.info(f"   - 编码规则: {result['code_rules_count']} 个")
        logger.info(f"   - 系统参数: {result['system_parameters_count']} 个")
        
        logger.info(f"\n{'=' * 60}")
        logger.info(f"✅ 预设编码规则初始化完成！")
        logger.info(f"{'=' * 60}")
        
    except Exception as e:
        logger.error(f"❌ 初始化失败: {e}")
        import traceback
        logger.error(traceback.format_exc())
        sys.exit(1)
    finally:
        # 关闭数据库连接
        await Tortoise.close_connections()
        logger.info("🔌 数据库连接已关闭")


async def main():
    """
    主函数
    """
    import argparse
    
    parser = argparse.ArgumentParser(description="初始化预设编码规则")
    parser.add_argument(
        "--tenant-id",
        type=int,
        default=None,
        help="指定组织ID（如果不指定，则为所有组织初始化）"
    )
    
    args = parser.parse_args()
    
    if args.tenant_id:
        await init_default_code_rules_for_specific_tenant(args.tenant_id)
    else:
        await init_default_code_rules_for_all_tenants()


if __name__ == "__main__":
    asyncio.run(main())
