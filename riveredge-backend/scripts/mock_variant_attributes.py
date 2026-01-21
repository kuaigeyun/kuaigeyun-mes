"""
创建变体属性定义的MOCK数据脚本

用于生成常用的变体属性定义，如颜色、尺寸、材质等。

Author: Luigi Lu
Date: 2026-01-08
"""

import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "src"))

# 加载环境变量
load_dotenv()

from tortoise import Tortoise
from infra.infrastructure.database.database import TORTOISE_ORM
from core.models.material_variant_attribute import MaterialVariantAttributeDefinition
from core.services.business.material_variant_attribute_service import MaterialVariantAttributeService


# 常用变体属性定义数据
MOCK_VARIANT_ATTRIBUTES = [
    {
        "attribute_name": "颜色",
        "attribute_type": "enum",
        "display_name": "产品颜色",
        "description": "产品的颜色属性，用于区分不同颜色的产品变体",
        "is_required": True,
        "display_order": 1,
        "enum_values": ["红色", "蓝色", "绿色", "黄色", "黑色", "白色", "灰色", "紫色", "粉色", "橙色"],
        "validation_rules": None,
        "default_value": None,
        "dependencies": None,
        "is_active": True,
    },
    {
        "attribute_name": "尺寸",
        "attribute_type": "enum",
        "display_name": "产品尺寸",
        "description": "产品的尺寸属性，用于区分不同尺寸的产品变体",
        "is_required": True,
        "display_order": 2,
        "enum_values": ["XS", "S", "M", "L", "XL", "XXL", "XXXL"],
        "validation_rules": None,
        "default_value": None,
        "dependencies": None,
        "is_active": True,
    },
    {
        "attribute_name": "材质",
        "attribute_type": "text",
        "display_name": "产品材质",
        "description": "产品的材质属性，用于描述产品的材质类型",
        "is_required": False,
        "display_order": 3,
        "enum_values": None,
        "validation_rules": {
            "max_length": 50,
            "min_length": 1,
        },
        "default_value": None,
        "dependencies": None,
        "is_active": True,
    },
    {
        "attribute_name": "重量",
        "attribute_type": "number",
        "display_name": "产品重量",
        "description": "产品的重量属性，单位为千克（kg）",
        "is_required": False,
        "display_order": 4,
        "enum_values": None,
        "validation_rules": {
            "min": 0,
            "max": 1000,
        },
        "default_value": None,
        "dependencies": None,
        "is_active": True,
    },
    {
        "attribute_name": "长度",
        "attribute_type": "number",
        "display_name": "产品长度",
        "description": "产品的长度属性，单位为厘米（cm）",
        "is_required": False,
        "display_order": 5,
        "enum_values": None,
        "validation_rules": {
            "min": 0,
            "max": 10000,
        },
        "default_value": None,
        "dependencies": None,
        "is_active": True,
    },
    {
        "attribute_name": "宽度",
        "attribute_type": "number",
        "display_name": "产品宽度",
        "description": "产品的宽度属性，单位为厘米（cm）",
        "is_required": False,
        "display_order": 6,
        "enum_values": None,
        "validation_rules": {
            "min": 0,
            "max": 10000,
        },
        "default_value": None,
        "dependencies": None,
        "is_active": True,
    },
    {
        "attribute_name": "高度",
        "attribute_type": "number",
        "display_name": "产品高度",
        "description": "产品的高度属性，单位为厘米（cm）",
        "is_required": False,
        "display_order": 7,
        "enum_values": None,
        "validation_rules": {
            "min": 0,
            "max": 10000,
        },
        "default_value": None,
        "dependencies": None,
        "is_active": True,
    },
    {
        "attribute_name": "等级",
        "attribute_type": "enum",
        "display_name": "产品等级",
        "description": "产品的质量等级，用于区分不同质量等级的产品",
        "is_required": False,
        "display_order": 8,
        "enum_values": ["A级", "B级", "C级", "优等品", "合格品", "次品"],
        "validation_rules": None,
        "default_value": "合格品",
        "dependencies": None,
        "is_active": True,
    },
    {
        "attribute_name": "规格",
        "attribute_type": "text",
        "display_name": "产品规格",
        "description": "产品的规格描述，用于详细说明产品的技术规格",
        "is_required": False,
        "display_order": 9,
        "enum_values": None,
        "validation_rules": {
            "max_length": 200,
        },
        "default_value": None,
        "dependencies": None,
        "is_active": True,
    },
    {
        "attribute_name": "生产日期",
        "attribute_type": "date",
        "display_name": "生产日期",
        "description": "产品的生产日期，用于记录产品的生产时间",
        "is_required": False,
        "display_order": 10,
        "enum_values": None,
        "validation_rules": None,
        "default_value": None,
        "dependencies": None,
        "is_active": True,
    },
    {
        "attribute_name": "有效期",
        "attribute_type": "date",
        "display_name": "有效期至",
        "description": "产品的有效期，用于记录产品的过期时间",
        "is_required": False,
        "display_order": 11,
        "enum_values": None,
        "validation_rules": None,
        "default_value": None,
        "dependencies": None,
        "is_active": True,
    },
    {
        "attribute_name": "是否合格",
        "attribute_type": "boolean",
        "display_name": "是否合格",
        "description": "产品的合格状态，用于标识产品是否通过质量检验",
        "is_required": False,
        "display_order": 12,
        "enum_values": None,
        "validation_rules": None,
        "default_value": "true",
        "dependencies": None,
        "is_active": True,
    },
    {
        "attribute_name": "是否启用",
        "attribute_type": "boolean",
        "display_name": "是否启用",
        "description": "产品的启用状态，用于控制产品是否可用",
        "is_required": False,
        "display_order": 13,
        "enum_values": None,
        "validation_rules": None,
        "default_value": "true",
        "dependencies": None,
        "is_active": True,
    },
]


async def create_mock_variant_attributes(tenant_id: int = 1):
    """
    创建MOCK变体属性定义数据
    
    Args:
        tenant_id: 组织ID，默认为1
    """
    # 初始化 Tortoise ORM
    # 确保配置中包含 core.models
    config = TORTOISE_ORM.copy()
    if "apps" not in config:
        config["apps"] = {}
    if "models" not in config["apps"]:
        config["apps"]["models"] = {}
    if "models" not in config["apps"]["models"]:
        config["apps"]["models"]["models"] = []
    
    # 确保包含 core.models
    models_list = config["apps"]["models"].get("models", [])
    if "core.models" not in models_list:
        models_list.append("core.models")
    config["apps"]["models"]["models"] = models_list
    config["apps"]["models"]["default_connection"] = "default"
    
    await Tortoise.init(config=config)
    
    try:
        print(f"📦 开始创建变体属性定义MOCK数据（组织ID: {tenant_id}）...")
        
        created_count = 0
        skipped_count = 0
        error_count = 0
        
        for attr_data in MOCK_VARIANT_ATTRIBUTES:
            try:
                # 检查是否已存在
                existing = await MaterialVariantAttributeDefinition.filter(
                    tenant_id=tenant_id,
                    attribute_name=attr_data["attribute_name"],
                    deleted_at__isnull=True
                ).first()
                
                if existing:
                    print(f"⏭️  跳过：属性 '{attr_data['attribute_name']}' 已存在")
                    skipped_count += 1
                    continue
                
                # 创建属性定义
                attribute_def = await MaterialVariantAttributeService.create_attribute_definition(
                    tenant_id=tenant_id,
                    attribute_name=attr_data["attribute_name"],
                    attribute_type=attr_data["attribute_type"],
                    display_name=attr_data["display_name"],
                    description=attr_data.get("description"),
                    is_required=attr_data.get("is_required", False),
                    display_order=attr_data.get("display_order", 0),
                    enum_values=attr_data.get("enum_values"),
                    validation_rules=attr_data.get("validation_rules"),
                    default_value=attr_data.get("default_value"),
                    dependencies=attr_data.get("dependencies"),
                    is_active=attr_data.get("is_active", True),
                    created_by=None,
                )
                
                print(f"✅ 创建成功：{attr_data['display_name']} ({attr_data['attribute_name']})")
                created_count += 1
                
            except Exception as e:
                print(f"❌ 创建失败：{attr_data['attribute_name']} - {str(e)}")
                error_count += 1
        
        print(f"\n📊 创建完成统计：")
        print(f"   ✅ 成功创建：{created_count} 个")
        print(f"   ⏭️  跳过（已存在）：{skipped_count} 个")
        print(f"   ❌ 失败：{error_count} 个")
        print(f"   📦 总计：{len(MOCK_VARIANT_ATTRIBUTES)} 个")
        
    finally:
        await Tortoise.close_connections()


async def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description="创建变体属性定义的MOCK数据")
    parser.add_argument(
        "--tenant-id",
        type=int,
        default=1,
        help="组织ID（默认：1）"
    )
    
    args = parser.parse_args()
    
    await create_mock_variant_attributes(tenant_id=args.tenant_id)


if __name__ == "__main__":
    asyncio.run(main())
