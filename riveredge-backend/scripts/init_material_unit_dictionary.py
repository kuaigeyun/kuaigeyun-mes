"""
初始化物料单位数据字典脚本

创建物料单位字典（MATERIAL_UNIT）及其常用单位字典项。

Author: Luigi Lu
Date: 2026-01-16
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

from core.models.data_dictionary import DataDictionary
from core.models.dictionary_item import DictionaryItem
from core.services.data.data_dictionary_service import DataDictionaryService
from core.schemas.data_dictionary import DataDictionaryCreate
from core.schemas.dictionary_item import DictionaryItemCreate
from infra.infrastructure.database.database import get_dynamic_tortoise_config
from infra.models.tenant import Tenant


async def init_material_unit_dictionary(tenant_id: int = 1):
    """
    初始化物料单位数据字典
    
    Args:
        tenant_id: 组织ID（默认为1，可根据实际情况修改）
    """
    try:
        # 检查字典是否已存在
        existing_dict = await DataDictionary.filter(
            tenant_id=tenant_id,
            code="MATERIAL_UNIT",
            deleted_at__isnull=True
        ).first()
        
        if existing_dict:
            logger.info(f"物料单位字典已存在，UUID: {existing_dict.uuid}")
            dictionary = existing_dict
        else:
            # 创建数据字典
            logger.info("创建物料单位字典...")
            dictionary_data = DataDictionaryCreate(
                name="物料单位",
                code="MATERIAL_UNIT",
                description="物料单位字典，用于物料主数据中的基础单位和辅助单位字段",
                is_system=True,  # 标记为系统字典
                is_active=True,
            )
            dictionary = await DataDictionaryService.create_dictionary(
                tenant_id=tenant_id,
                data=dictionary_data
            )
            logger.info(f"物料单位字典创建成功，UUID: {dictionary.uuid}")
        
        # 定义字典项数据（常用单位）
        items_data = [
            # 数量单位
            {"label": "个", "value": "个", "description": "数量单位，个", "sort_order": 1},
            {"label": "件", "value": "件", "description": "数量单位，件", "sort_order": 2},
            {"label": "台", "value": "台", "description": "数量单位，台", "sort_order": 3},
            {"label": "套", "value": "套", "description": "数量单位，套", "sort_order": 4},
            {"label": "箱", "value": "箱", "description": "数量单位，箱", "sort_order": 5},
            {"label": "盒", "value": "盒", "description": "数量单位，盒", "sort_order": 6},
            {"label": "包", "value": "包", "description": "数量单位，包", "sort_order": 7},
            {"label": "袋", "value": "袋", "description": "数量单位，袋", "sort_order": 8},
            {"label": "瓶", "value": "瓶", "description": "数量单位，瓶", "sort_order": 9},
            {"label": "桶", "value": "桶", "description": "数量单位，桶", "sort_order": 10},
            {"label": "片", "value": "片", "description": "数量单位，片", "sort_order": 11},
            {"label": "张", "value": "张", "description": "数量单位，张", "sort_order": 12},
            {"label": "条", "value": "条", "description": "数量单位，条", "sort_order": 13},
            {"label": "块", "value": "块", "description": "数量单位，块", "sort_order": 14},
            {"label": "只", "value": "只", "description": "数量单位，只", "sort_order": 15},
            {"label": "头", "value": "头", "description": "数量单位，头", "sort_order": 16},
            {"label": "匹", "value": "匹", "description": "数量单位，匹", "sort_order": 17},
            # 重量单位
            {"label": "kg", "value": "kg", "description": "重量单位，千克", "sort_order": 21},
            {"label": "g", "value": "g", "description": "重量单位，克", "sort_order": 22},
            {"label": "t", "value": "t", "description": "重量单位，吨", "sort_order": 23},
            {"label": "mg", "value": "mg", "description": "重量单位，毫克", "sort_order": 24},
            # 长度单位
            {"label": "m", "value": "m", "description": "长度单位，米", "sort_order": 31},
            {"label": "cm", "value": "cm", "description": "长度单位，厘米", "sort_order": 32},
            {"label": "mm", "value": "mm", "description": "长度单位，毫米", "sort_order": 33},
            {"label": "km", "value": "km", "description": "长度单位，千米", "sort_order": 34},
            # 面积单位
            {"label": "m²", "value": "m²", "description": "面积单位，平方米", "sort_order": 41},
            {"label": "cm²", "value": "cm²", "description": "面积单位，平方厘米", "sort_order": 42},
            # 体积单位
            {"label": "L", "value": "L", "description": "体积单位，升", "sort_order": 51},
            {"label": "mL", "value": "mL", "description": "体积单位，毫升", "sort_order": 52},
            {"label": "m³", "value": "m³", "description": "体积单位，立方米", "sort_order": 53},
        ]
        
        # 创建或更新字典项
        dictionary_uuid = str(dictionary.uuid)
        created_count = 0
        updated_count = 0
        
        for item_data in items_data:
            # 检查字典项是否已存在（使用 dictionary_id 而不是 dictionary_uuid）
            existing_item = await DictionaryItem.filter(
                tenant_id=tenant_id,
                dictionary_id=dictionary.id,
                value=item_data["value"],
                deleted_at__isnull=True
            ).first()
            
            if existing_item:
                # 更新现有字典项
                logger.info(f"更新字典项: {item_data['label']} ({item_data['value']})")
                existing_item.label = item_data["label"]
                existing_item.description = item_data.get("description")
                existing_item.sort_order = item_data["sort_order"]
                existing_item.is_active = True
                await existing_item.save()
                updated_count += 1
            else:
                # 创建新字典项
                logger.info(f"创建字典项: {item_data['label']} ({item_data['value']})")
                item_create_data = DictionaryItemCreate(
                    dictionary_uuid=dictionary_uuid,
                    label=item_data["label"],
                    value=item_data["value"],
                    description=item_data.get("description"),
                    sort_order=item_data["sort_order"],
                    is_active=True,
                )
                await DataDictionaryService.create_item(
                    tenant_id=tenant_id,
                    data=item_create_data
                )
                created_count += 1
        
        logger.info(f"物料单位字典初始化完成！创建 {created_count} 个字典项，更新 {updated_count} 个字典项")
        
    except Exception as e:
        logger.error(f"初始化物料单位字典失败: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise


async def main():
    """
    主函数
    """
    logger.info("开始初始化物料单位数据字典...")
    
    try:
        # 初始化 Tortoise ORM
        config = await get_dynamic_tortoise_config()
        await Tortoise.init(config=config)
        logger.info("Tortoise ORM 初始化成功")
        
        # 获取所有组织
        tenants = await Tenant.all()
        logger.info(f"找到 {len(tenants)} 个组织")
        
        # 为每个组织创建字典
        success_count = 0
        for tenant in tenants:
            try:
                logger.info(f"为组织 {tenant.name} (ID: {tenant.id}) 创建物料单位字典...")
                await init_material_unit_dictionary(tenant_id=tenant.id)
                success_count += 1
            except Exception as e:
                logger.error(f"为组织 {tenant.name} (ID: {tenant.id}) 创建字典失败: {e}")
                import traceback
                logger.error(traceback.format_exc())
        
        logger.info(f"物料单位数据字典初始化完成！成功为 {success_count}/{len(tenants)} 个组织创建字典")
        
    except Exception as e:
        logger.error(f"初始化失败: {e}")
        import traceback
        logger.error(traceback.format_exc())
        sys.exit(1)
    finally:
        # 关闭数据库连接
        await Tortoise.close_connections()
        logger.info("数据库连接已关闭")


if __name__ == "__main__":
    asyncio.run(main())
