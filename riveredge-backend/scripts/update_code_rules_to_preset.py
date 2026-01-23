"""
更新现有编码规则为预设格式脚本

将现有组织的编码规则更新为新的预设格式（使用新的组件格式）：
- 基础数据：功能缩写+流水号
- 业务单据：功能缩写+年月日+流水号

使用方法:
    python scripts/update_code_rules_to_preset.py

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
from core.services.business.code_rule_service import CodeRuleService
from core.services.default.default_values_service import DefaultValuesService
from core.config.code_rule_pages import CODE_RULE_PAGES
from core.schemas.code_rule import CodeRuleUpdate
from infra.infrastructure.database.database import get_dynamic_tortoise_config


async def update_code_rules_to_preset(tenant_id: int):
    """
    将指定组织的编码规则更新为预设格式
    
    Args:
        tenant_id: 组织ID
    """
    updated_count = 0
    skipped_count = 0
    error_count = 0
    
    # 为每个页面更新编码规则
    for page_config in CODE_RULE_PAGES:
        page_code = page_config.get("page_code")
        page_name = page_config.get("page_name", page_code)
        rule_code = page_config.get("rule_code")
        
        # 如果没有指定rule_code，使用page_code作为rule_code
        if not rule_code:
            rule_code = page_code.upper().replace("-", "_")
        
        # 获取功能缩写
        abbreviation = DefaultValuesService.PAGE_CODE_ABBREVIATIONS.get(page_code)
        if not abbreviation:
            # 如果没有定义缩写，从page_code提取
            parts = page_code.split("-")
            abbreviation = "".join([p[0].upper() for p in parts[-2:]])[:4]
        
        # 构建规则组件
        rule_components = DefaultValuesService._build_rule_components(page_code, abbreviation)
        
        # 判断是否为业务单据
        is_business = DefaultValuesService._is_business_document(page_code)
        
        # 构建规则名称和描述
        rule_name = f"{page_name}编码规则"
        if is_business:
            description = f"{page_name}编码规则，格式：{abbreviation} + 日期（YYYYMMDD）+ 4位序号，每日重置"
        else:
            description = f"{page_name}编码规则，格式：{abbreviation} + 4位序号"
        
        try:
            # 查找现有规则（包括禁用的规则）
            existing_rule = await CodeRule.filter(
                tenant_id=tenant_id,
                code=rule_code,
                deleted_at__isnull=True
            ).first()
            
            if existing_rule:
                # 更新现有规则
                update_data = CodeRuleUpdate(
                    name=rule_name,
                    rule_components=rule_components,
                    description=description,
                )
                await CodeRuleService.update_rule(tenant_id, existing_rule.uuid, update_data)
                updated_count += 1
                logger.debug(f"✅ 更新组织 {tenant_id} 的编码规则: {rule_code} ({page_name})")
            else:
                # 如果规则不存在，创建新规则
                from core.schemas.code_rule import CodeRuleCreate
                rule_data = CodeRuleCreate(
                    name=rule_name,
                    code=rule_code,
                    rule_components=rule_components,
                    description=description,
                    is_system=True,
                    is_active=True,
                )
                await CodeRuleService.create_rule(tenant_id, rule_data)
                updated_count += 1
                logger.debug(f"✅ 创建组织 {tenant_id} 的编码规则: {rule_code} ({page_name})")
                
        except Exception as e:
            error_count += 1
            logger.warning(f"⚠️  更新组织 {tenant_id} 的编码规则 {rule_code} 失败: {e}")
            continue
    
    return updated_count, skipped_count, error_count


async def update_all_tenants():
    """
    为所有组织更新编码规则为预设格式
    """
    logger.info("=" * 60)
    logger.info("开始为所有组织更新编码规则为预设格式...")
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
        
        total_updated = 0
        total_skipped = 0
        total_errors = 0
        
        # 为每个组织更新编码规则
        for tenant in tenants:
            try:
                logger.info(f"\n{'=' * 60}")
                logger.info(f"📦 为组织 {tenant.name} (ID: {tenant.id}, Domain: {tenant.domain}) 更新编码规则...")
                logger.info(f"{'=' * 60}")
                
                updated, skipped, errors = await update_code_rules_to_preset(tenant.id)
                total_updated += updated
                total_skipped += skipped
                total_errors += errors
                
                logger.info(f"✅ 组织 {tenant.name} 更新完成:")
                logger.info(f"   - 更新/创建: {updated} 个编码规则")
                logger.info(f"   - 跳过: {skipped} 个编码规则")
                logger.info(f"   - 错误: {errors} 个编码规则")
                
            except Exception as e:
                logger.error(f"❌ 为组织 {tenant.name} (ID: {tenant.id}) 更新失败: {e}")
                import traceback
                logger.error(traceback.format_exc())
                continue
        
        logger.info(f"\n{'=' * 60}")
        logger.info(f"✅ 编码规则更新完成！")
        logger.info(f"   - 总计更新/创建: {total_updated} 个编码规则")
        logger.info(f"   - 总计跳过: {total_skipped} 个编码规则")
        logger.info(f"   - 总计错误: {total_errors} 个编码规则")
        logger.info(f"{'=' * 60}")
        
    except Exception as e:
        logger.error(f"❌ 更新失败: {e}")
        import traceback
        logger.error(traceback.format_exc())
        sys.exit(1)
    finally:
        # 关闭数据库连接
        await Tortoise.close_connections()
        logger.info("🔌 数据库连接已关闭")


async def update_specific_tenant(tenant_id: int):
    """
    为指定组织更新编码规则为预设格式
    
    Args:
        tenant_id: 组织ID
    """
    logger.info("=" * 60)
    logger.info(f"开始为组织 {tenant_id} 更新编码规则为预设格式...")
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
        
        logger.info(f"📦 为组织 {tenant.name} (ID: {tenant.id}, Domain: {tenant.domain}) 更新编码规则...")
        
        updated, skipped, errors = await update_code_rules_to_preset(tenant.id)
        
        logger.info(f"✅ 组织 {tenant.name} 更新完成:")
        logger.info(f"   - 更新/创建: {updated} 个编码规则")
        logger.info(f"   - 跳过: {skipped} 个编码规则")
        logger.info(f"   - 错误: {errors} 个编码规则")
        
        logger.info(f"\n{'=' * 60}")
        logger.info(f"✅ 编码规则更新完成！")
        logger.info(f"{'=' * 60}")
        
    except Exception as e:
        logger.error(f"❌ 更新失败: {e}")
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
    
    parser = argparse.ArgumentParser(description="更新现有编码规则为预设格式")
    parser.add_argument(
        "--tenant-id",
        type=int,
        default=None,
        help="指定组织ID（如果不指定，则为所有组织更新）"
    )
    
    args = parser.parse_args()
    
    if args.tenant_id:
        await update_specific_tenant(args.tenant_id)
    else:
        await update_all_tenants()


if __name__ == "__main__":
    asyncio.run(main())
