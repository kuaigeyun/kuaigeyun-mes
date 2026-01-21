"""
初始化物料类型数据字典脚本

创建物料类型字典（MATERIAL_TYPE）及其字典项。

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


async def init_material_type_dictionary(tenant_id: int = 1):
    """
    初始化物料类型数据字典
    
    Args:
        tenant_id: 组织ID（默认为1，可根据实际情况修改）
    """
    try:
        # 检查字典是否已存在
        existing_dict = await DataDictionary.filter(
            tenant_id=tenant_id,
            code="MATERIAL_TYPE",
            deleted_at__isnull=True
        ).first()
        
        if existing_dict:
            logger.info(f"物料类型字典已存在，UUID: {existing_dict.uuid}")
            dictionary = existing_dict
        else:
            # 创建数据字典
            logger.info("创建物料类型字典...")
            dictionary_data = DataDictionaryCreate(
                name="物料类型",
                code="MATERIAL_TYPE",
                description="物料类型字典，用于物料主数据中的物料类型字段",
                is_system=True,  # 标记为系统字典
                is_active=True,
            )
            dictionary = await DataDictionaryService.create_dictionary(
                tenant_id=tenant_id,
                data=dictionary_data
            )
            logger.info(f"物料类型字典创建成功，UUID: {dictionary.uuid}")
        
        # 定义字典项数据
        items_data = [
            {
                "label": "成品",
                "value": "FIN",
                "description": "最终产品，可直接销售的成品",
                "sort_order": 1,
            },
            {
                "label": "半成品",
                "value": "SEMI",
                "description": "需要进一步加工的半成品",
                "sort_order": 2,
            },
            {
                "label": "原材料",
                "value": "RAW",
                "description": "生产用的原材料",
                "sort_order": 3,
            },
            {
                "label": "包装材料",
                "value": "PACK",
                "description": "用于包装的材料",
                "sort_order": 4,
            },
            {
                "label": "辅助材料",
                "value": "AUX",
                "description": "辅助生产使用的材料",
                "sort_order": 5,
            },
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
        
        logger.info(f"物料类型字典初始化完成！创建 {created_count} 个字典项，更新 {updated_count} 个字典项")
        
    except Exception as e:
        logger.error(f"初始化物料类型字典失败: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise


async def main():
    """
    主函数
    """
    logger.info("开始初始化物料类型数据字典...")
    
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
                logger.info(f"为组织 {tenant.name} (ID: {tenant.id}) 创建物料类型字典...")
                await init_material_type_dictionary(tenant_id=tenant.id)
                success_count += 1
            except Exception as e:
                logger.error(f"为组织 {tenant.name} (ID: {tenant.id}) 创建字典失败: {e}")
                import traceback
                logger.error(traceback.format_exc())
        
        logger.info(f"物料类型数据字典初始化完成！成功为 {success_count}/{len(tenants)} 个组织创建字典")
        
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
