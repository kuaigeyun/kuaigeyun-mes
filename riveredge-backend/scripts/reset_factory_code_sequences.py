"""
重置工厂建模相关编码规则的流水号

将厂区、车间、产线、工位的编码规则序号重置为从1开始。

使用方法:
    python scripts/reset_factory_code_sequences.py [--tenant-id TENANT_ID]

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
from core.models.code_sequence import CodeSequence
from core.services.business.code_rule_service import CodeRuleService
from infra.infrastructure.database.database import get_dynamic_tortoise_config


# 需要重置的编码规则代码列表
FACTORY_RULE_CODES = [
    'MASTER_DATA_FACTORY_PLANT',
    'MASTER_DATA_FACTORY_WORKSHOP',
    'MASTER_DATA_FACTORY_PRODUCTION_LINE',
    'MASTER_DATA_FACTORY_WORKSTATION',
]


async def reset_sequences_for_tenant(tenant_id: int):
    """
    重置指定组织的工厂建模编码规则序号
    
    Args:
        tenant_id: 组织ID
    """
    reset_count = 0
    not_found_count = 0
    
    for rule_code in FACTORY_RULE_CODES:
        try:
            # 查找编码规则
            rule = await CodeRuleService.get_rule_by_code(tenant_id, rule_code)
            if not rule:
                logger.warning(f"⚠️  组织 {tenant_id} 的编码规则 {rule_code} 不存在或未启用")
                not_found_count += 1
                continue
            
            # 查找或创建序号记录
            sequence = await CodeSequence.get_or_none(
                code_rule_id=rule.id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )
            
            if sequence:
                # 重置序号为0（因为生成时会+1，所以设置为0后第一次生成会是1）
                sequence.current_seq = 0
                sequence.reset_date = None  # 清除重置日期
                await sequence.save()
                logger.info(f"✅ 重置组织 {tenant_id} 的编码规则 {rule_code} 序号为 0 (下次生成将从1开始)")
                reset_count += 1
            else:
                # 如果序号记录不存在，创建一条（初始值为0）
                await CodeSequence.create(
                    code_rule_id=rule.id,
                    tenant_id=tenant_id,
                    current_seq=0,
                    reset_date=None,
                )
                logger.info(f"✅ 创建组织 {tenant_id} 的编码规则 {rule_code} 序号记录 (初始值为0)")
                reset_count += 1
                
        except Exception as e:
            logger.error(f"❌ 重置组织 {tenant_id} 的编码规则 {rule_code} 序号失败: {e}")
            import traceback
            logger.error(traceback.format_exc())
            continue
    
    return reset_count, not_found_count


async def reset_all_tenants():
    """
    为所有组织重置工厂建模编码规则序号
    """
    logger.info("=" * 60)
    logger.info("开始为所有组织重置工厂建模编码规则序号...")
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
        
        total_reset = 0
        total_not_found = 0
        
        # 为每个组织重置序号
        for tenant in tenants:
            try:
                logger.info(f"\n{'=' * 60}")
                logger.info(f"📦 为组织 {tenant.name} (ID: {tenant.id}, Domain: {tenant.domain}) 重置序号...")
                logger.info(f"{'=' * 60}")
                
                reset, not_found = await reset_sequences_for_tenant(tenant.id)
                total_reset += reset
                total_not_found += not_found
                
                logger.info(f"✅ 组织 {tenant.name} 重置完成:")
                logger.info(f"   - 重置/创建: {reset} 个序号记录")
                logger.info(f"   - 未找到规则: {not_found} 个")
                
            except Exception as e:
                logger.error(f"❌ 为组织 {tenant.name} (ID: {tenant.id}) 重置失败: {e}")
                import traceback
                logger.error(traceback.format_exc())
                continue
        
        logger.info(f"\n{'=' * 60}")
        logger.info(f"✅ 序号重置完成！")
        logger.info(f"   - 总计重置/创建: {total_reset} 个序号记录")
        logger.info(f"   - 总计未找到规则: {total_not_found} 个")
        logger.info(f"{'=' * 60}")
        
    except Exception as e:
        logger.error(f"❌ 重置失败: {e}")
        import traceback
        logger.error(traceback.format_exc())
        sys.exit(1)
    finally:
        # 关闭数据库连接
        await Tortoise.close_connections()
        logger.info("🔌 数据库连接已关闭")


async def reset_specific_tenant(tenant_id: int):
    """
    为指定组织重置工厂建模编码规则序号
    
    Args:
        tenant_id: 组织ID
    """
    logger.info("=" * 60)
    logger.info(f"开始为组织 {tenant_id} 重置工厂建模编码规则序号...")
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
        
        logger.info(f"📦 为组织 {tenant.name} (ID: {tenant.id}, Domain: {tenant.domain}) 重置序号...")
        
        reset, not_found = await reset_sequences_for_tenant(tenant.id)
        
        logger.info(f"✅ 组织 {tenant.name} 重置完成:")
        logger.info(f"   - 重置/创建: {reset} 个序号记录")
        logger.info(f"   - 未找到规则: {not_found} 个")
        
        logger.info(f"\n{'=' * 60}")
        logger.info(f"✅ 序号重置完成！")
        logger.info(f"{'=' * 60}")
        
    except Exception as e:
        logger.error(f"❌ 重置失败: {e}")
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
    
    parser = argparse.ArgumentParser(description="重置工厂建模编码规则序号")
    parser.add_argument(
        "--tenant-id",
        type=int,
        default=None,
        help="指定组织ID（如果不指定，则为所有组织重置）"
    )
    
    args = parser.parse_args()
    
    if args.tenant_id:
        await reset_specific_tenant(args.tenant_id)
    else:
        await reset_all_tenants()


if __name__ == "__main__":
    asyncio.run(main())
