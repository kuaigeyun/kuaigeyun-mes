"""
初始化制造业行业模板脚本

创建制造业相关的行业模板数据，包括：
- 通用制造业模板
- 电子制造业模板
- 机械制造业模板
- 化工制造业模板
- 轻工制造业模板

使用方法：
    python scripts/init_manufacturing_templates.py

Author: Luigi Lu
Date: 2025-01-15
"""

import asyncio
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from tortoise import Tortoise
from loguru import logger

from infra.infrastructure.database.database import TORTOISE_ORM
from infra.models.industry_template import IndustryTemplate
from infra.services.industry_template_service import IndustryTemplateService


# 通用制造业模板配置
GENERAL_MANUFACTURING_TEMPLATE = {
    "name": "通用制造业模板",
    "code": "general_manufacturing",
    "industry": "manufacturing",
    "description": "通用制造业模板，适用于大部分制造企业，包含基础编码规则和系统参数配置",
    "config": {
        "code_rules": [
            {
                "name": "工单编码",
                "code": "work_order",
                "expression": "WO{YYYYMMDD}{SEQ:4}",
                "description": "工单编码规则，格式：WO + 日期（YYYYMMDD）+ 4位序号",
                "seq_start": 1,
                "seq_step": 1,
                "seq_reset_rule": "daily",
                "is_system": True,
                "is_active": True,
            },
            {
                "name": "物料编码",
                "code": "material",
                "expression": "MAT{SEQ:6}",
                "description": "物料编码规则，格式：MAT + 6位序号",
                "seq_start": 1,
                "seq_step": 1,
                "seq_reset_rule": "never",
                "is_system": True,
                "is_active": True,
            },
            {
                "name": "客户编码",
                "code": "customer",
                "expression": "CUST{SEQ:5}",
                "description": "客户编码规则，格式：CUST + 5位序号",
                "seq_start": 1,
                "seq_step": 1,
                "seq_reset_rule": "never",
                "is_system": True,
                "is_active": True,
            },
            {
                "name": "供应商编码",
                "code": "supplier",
                "expression": "SUP{SEQ:5}",
                "description": "供应商编码规则，格式：SUP + 5位序号",
                "seq_start": 1,
                "seq_step": 1,
                "seq_reset_rule": "never",
                "is_system": True,
                "is_active": True,
            },
            {
                "name": "产品编码",
                "code": "product",
                "expression": "PRD{SEQ:6}",
                "description": "产品编码规则，格式：PRD + 6位序号",
                "seq_start": 1,
                "seq_step": 1,
                "seq_reset_rule": "never",
                "is_system": True,
                "is_active": True,
            },
            {
                "name": "采购单编码",
                "code": "purchase_order",
                "expression": "PO{YYYYMMDD}{SEQ:4}",
                "description": "采购单编码规则，格式：PO + 日期（YYYYMMDD）+ 4位序号",
                "seq_start": 1,
                "seq_step": 1,
                "seq_reset_rule": "daily",
                "is_system": True,
                "is_active": True,
            },
            {
                "name": "销售单编码",
                "code": "sales_order",
                "expression": "SO{YYYYMMDD}{SEQ:4}",
                "description": "销售单编码规则，格式：SO + 日期（YYYYMMDD）+ 4位序号",
                "seq_start": 1,
                "seq_step": 1,
                "seq_reset_rule": "daily",
                "is_system": True,
                "is_active": True,
            },
        ],
        "system_params": [
            {
                "key": "system.timezone",
                "value": "Asia/Shanghai",
                "type": "string",
                "description": "系统时区（默认中国时区）",
                "is_system": True,
                "is_active": True,
            },
            {
                "key": "system.currency",
                "value": "CNY",
                "type": "string",
                "description": "系统货币（默认人民币）",
                "is_system": True,
                "is_active": True,
            },
            {
                "key": "system.language",
                "value": "zh-CN",
                "type": "string",
                "description": "系统语言（默认简体中文）",
                "is_system": True,
                "is_active": True,
            },
            {
                "key": "production.enable_quality_check",
                "value": True,
                "type": "boolean",
                "description": "是否启用质量检验（默认：是）",
                "is_system": False,
                "is_active": True,
            },
            {
                "key": "inventory.enable_low_stock_alert",
                "value": True,
                "type": "boolean",
                "description": "是否启用库存不足预警（默认：是）",
                "is_system": False,
                "is_active": True,
            },
            {
                "key": "inventory.low_stock_threshold",
                "value": 10,
                "type": "number",
                "description": "库存不足预警阈值（默认：10）",
                "is_system": False,
                "is_active": True,
            },
        ],
    },
    "is_active": True,
    "is_default": True,
    "sort_order": 1,
}

# 电子制造业模板配置
ELECTRONICS_MANUFACTURING_TEMPLATE = {
    "name": "电子制造业模板",
    "code": "electronics_manufacturing",
    "industry": "manufacturing.electronics",
    "description": "电子制造业模板，适用于电子元器件、电子产品制造企业，包含电子行业特有的编码规则和系统参数",
    "config": {
        "code_rules": [
            {
                "name": "工单编码",
                "code": "work_order",
                "expression": "WO{YYYYMMDD}{SEQ:4}",
                "description": "工单编码规则，格式：WO + 日期（YYYYMMDD）+ 4位序号",
                "seq_start": 1,
                "seq_step": 1,
                "seq_reset_rule": "daily",
                "is_system": True,
                "is_active": True,
            },
            {
                "name": "物料编码",
                "code": "material",
                "expression": "ELC{SEQ:6}",
                "description": "电子物料编码规则，格式：ELC + 6位序号",
                "seq_start": 1,
                "seq_step": 1,
                "seq_reset_rule": "never",
                "is_system": True,
                "is_active": True,
            },
            {
                "name": "产品编码",
                "code": "product",
                "expression": "EPD{SEQ:6}",
                "description": "电子产品编码规则，格式：EPD + 6位序号",
                "seq_start": 1,
                "seq_step": 1,
                "seq_reset_rule": "never",
                "is_system": True,
                "is_active": True,
            },
            {
                "name": "批次编码",
                "code": "batch",
                "expression": "BATCH{YYYYMMDD}{SEQ:4}",
                "description": "批次编码规则，格式：BATCH + 日期（YYYYMMDD）+ 4位序号",
                "seq_start": 1,
                "seq_step": 1,
                "seq_reset_rule": "daily",
                "is_system": True,
                "is_active": True,
            },
            {
                "name": "序列号编码",
                "code": "serial_number",
                "expression": "SN{YYYY}{SEQ:8}",
                "description": "序列号编码规则，格式：SN + 年份（YYYY）+ 8位序号",
                "seq_start": 1,
                "seq_step": 1,
                "seq_reset_rule": "yearly",
                "is_system": True,
                "is_active": True,
            },
        ],
        "system_params": [
            {
                "key": "system.timezone",
                "value": "Asia/Shanghai",
                "type": "string",
                "description": "系统时区（默认中国时区）",
                "is_system": True,
                "is_active": True,
            },
            {
                "key": "system.currency",
                "value": "CNY",
                "type": "string",
                "description": "系统货币（默认人民币）",
                "is_system": True,
                "is_active": True,
            },
            {
                "key": "production.enable_quality_check",
                "value": True,
                "type": "boolean",
                "description": "是否启用质量检验（电子行业默认启用）",
                "is_system": False,
                "is_active": True,
            },
            {
                "key": "production.enable_traceability",
                "value": True,
                "type": "boolean",
                "description": "是否启用产品追溯（电子行业默认启用）",
                "is_system": False,
                "is_active": True,
            },
            {
                "key": "production.enable_serial_number",
                "value": True,
                "type": "boolean",
                "description": "是否启用序列号管理（电子行业默认启用）",
                "is_system": False,
                "is_active": True,
            },
        ],
    },
    "is_active": True,
    "is_default": False,
    "sort_order": 2,
}

# 机械制造业模板配置
MACHINERY_MANUFACTURING_TEMPLATE = {
    "name": "机械制造业模板",
    "code": "machinery_manufacturing",
    "industry": "manufacturing.machinery",
    "description": "机械制造业模板，适用于机械设备、零部件制造企业，包含机械行业特有的编码规则和系统参数",
    "config": {
        "code_rules": [
            {
                "name": "工单编码",
                "code": "work_order",
                "expression": "WO{YYYYMMDD}{SEQ:4}",
                "description": "工单编码规则，格式：WO + 日期（YYYYMMDD）+ 4位序号",
                "seq_start": 1,
                "seq_step": 1,
                "seq_reset_rule": "daily",
                "is_system": True,
                "is_active": True,
            },
            {
                "name": "物料编码",
                "code": "material",
                "expression": "MCH{SEQ:6}",
                "description": "机械物料编码规则，格式：MCH + 6位序号",
                "seq_start": 1,
                "seq_step": 1,
                "seq_reset_rule": "never",
                "is_system": True,
                "is_active": True,
            },
            {
                "name": "产品编码",
                "code": "product",
                "expression": "MPD{SEQ:6}",
                "description": "机械产品编码规则，格式：MPD + 6位序号",
                "seq_start": 1,
                "seq_step": 1,
                "seq_reset_rule": "never",
                "is_system": True,
                "is_active": True,
            },
            {
                "name": "设备编码",
                "code": "equipment",
                "expression": "EQP{SEQ:6}",
                "description": "设备编码规则，格式：EQP + 6位序号",
                "seq_start": 1,
                "seq_step": 1,
                "seq_reset_rule": "never",
                "is_system": True,
                "is_active": True,
            },
            {
                "name": "模具编码",
                "code": "mold",
                "expression": "MOLD{SEQ:5}",
                "description": "模具编码规则，格式：MOLD + 5位序号",
                "seq_start": 1,
                "seq_step": 1,
                "seq_reset_rule": "never",
                "is_system": True,
                "is_active": True,
            },
        ],
        "system_params": [
            {
                "key": "system.timezone",
                "value": "Asia/Shanghai",
                "type": "string",
                "description": "系统时区（默认中国时区）",
                "is_system": True,
                "is_active": True,
            },
            {
                "key": "system.currency",
                "value": "CNY",
                "type": "string",
                "description": "系统货币（默认人民币）",
                "is_system": True,
                "is_active": True,
            },
            {
                "key": "production.enable_quality_check",
                "value": True,
                "type": "boolean",
                "description": "是否启用质量检验（机械行业默认启用）",
                "is_system": False,
                "is_active": True,
            },
            {
                "key": "production.enable_equipment_management",
                "value": True,
                "type": "boolean",
                "description": "是否启用设备管理（机械行业默认启用）",
                "is_system": False,
                "is_active": True,
            },
            {
                "key": "production.enable_mold_management",
                "value": True,
                "type": "boolean",
                "description": "是否启用模具管理（机械行业默认启用）",
                "is_system": False,
                "is_active": True,
            },
        ],
    },
    "is_active": True,
    "is_default": False,
    "sort_order": 3,
}

# 化工制造业模板配置
CHEMICAL_MANUFACTURING_TEMPLATE = {
    "name": "化工制造业模板",
    "code": "chemical_manufacturing",
    "industry": "manufacturing.chemical",
    "description": "化工制造业模板，适用于化工产品、精细化工制造企业，包含化工行业特有的编码规则和系统参数",
    "config": {
        "code_rules": [
            {
                "name": "工单编码",
                "code": "work_order",
                "expression": "WO{YYYYMMDD}{SEQ:4}",
                "description": "工单编码规则，格式：WO + 日期（YYYYMMDD）+ 4位序号",
                "seq_start": 1,
                "seq_step": 1,
                "seq_reset_rule": "daily",
                "is_system": True,
                "is_active": True,
            },
            {
                "name": "物料编码",
                "code": "material",
                "expression": "CHEM{SEQ:6}",
                "description": "化工物料编码规则，格式：CHEM + 6位序号",
                "seq_start": 1,
                "seq_step": 1,
                "seq_reset_rule": "never",
                "is_system": True,
                "is_active": True,
            },
            {
                "name": "产品编码",
                "code": "product",
                "expression": "CPD{SEQ:6}",
                "description": "化工产品编码规则，格式：CPD + 6位序号",
                "seq_start": 1,
                "seq_step": 1,
                "seq_reset_rule": "never",
                "is_system": True,
                "is_active": True,
            },
            {
                "name": "批次编码",
                "code": "batch",
                "expression": "BATCH{YYYYMMDD}{SEQ:4}",
                "description": "批次编码规则，格式：BATCH + 日期（YYYYMMDD）+ 4位序号",
                "seq_start": 1,
                "seq_step": 1,
                "seq_reset_rule": "daily",
                "is_system": True,
                "is_active": True,
            },
            {
                "name": "配方编码",
                "code": "formula",
                "expression": "FORMULA{SEQ:5}",
                "description": "配方编码规则，格式：FORMULA + 5位序号",
                "seq_start": 1,
                "seq_step": 1,
                "seq_reset_rule": "never",
                "is_system": True,
                "is_active": True,
            },
        ],
        "system_params": [
            {
                "key": "system.timezone",
                "value": "Asia/Shanghai",
                "type": "string",
                "description": "系统时区（默认中国时区）",
                "is_system": True,
                "is_active": True,
            },
            {
                "key": "system.currency",
                "value": "CNY",
                "type": "string",
                "description": "系统货币（默认人民币）",
                "is_system": True,
                "is_active": True,
            },
            {
                "key": "production.enable_quality_check",
                "value": True,
                "type": "boolean",
                "description": "是否启用质量检验（化工行业默认启用）",
                "is_system": False,
                "is_active": True,
            },
            {
                "key": "production.enable_batch_tracking",
                "value": True,
                "type": "boolean",
                "description": "是否启用批次追踪（化工行业默认启用）",
                "is_system": False,
                "is_active": True,
            },
            {
                "key": "production.enable_safety_management",
                "value": True,
                "type": "boolean",
                "description": "是否启用安全管理（化工行业默认启用）",
                "is_system": False,
                "is_active": True,
            },
        ],
    },
    "is_active": True,
    "is_default": False,
    "sort_order": 4,
}

# 轻工制造业模板配置
LIGHT_INDUSTRY_MANUFACTURING_TEMPLATE = {
    "name": "轻工制造业模板",
    "code": "light_industry_manufacturing",
    "industry": "manufacturing.light_industry",
    "description": "轻工制造业模板，适用于食品、日用品、纺织等轻工制造企业，包含轻工行业特有的编码规则和系统参数",
    "config": {
        "code_rules": [
            {
                "name": "工单编码",
                "code": "work_order",
                "expression": "WO{YYYYMMDD}{SEQ:4}",
                "description": "工单编码规则，格式：WO + 日期（YYYYMMDD）+ 4位序号",
                "seq_start": 1,
                "seq_step": 1,
                "seq_reset_rule": "daily",
                "is_system": True,
                "is_active": True,
            },
            {
                "name": "物料编码",
                "code": "material",
                "expression": "LIT{SEQ:6}",
                "description": "轻工物料编码规则，格式：LIT + 6位序号",
                "seq_start": 1,
                "seq_step": 1,
                "seq_reset_rule": "never",
                "is_system": True,
                "is_active": True,
            },
            {
                "name": "产品编码",
                "code": "product",
                "expression": "LPD{SEQ:6}",
                "description": "轻工产品编码规则，格式：LPD + 6位序号",
                "seq_start": 1,
                "seq_step": 1,
                "seq_reset_rule": "never",
                "is_system": True,
                "is_active": True,
            },
            {
                "name": "批次编码",
                "code": "batch",
                "expression": "BATCH{YYYYMMDD}{SEQ:4}",
                "description": "批次编码规则，格式：BATCH + 日期（YYYYMMDD）+ 4位序号",
                "seq_start": 1,
                "seq_step": 1,
                "seq_reset_rule": "daily",
                "is_system": True,
                "is_active": True,
            },
        ],
        "system_params": [
            {
                "key": "system.timezone",
                "value": "Asia/Shanghai",
                "type": "string",
                "description": "系统时区（默认中国时区）",
                "is_system": True,
                "is_active": True,
            },
            {
                "key": "system.currency",
                "value": "CNY",
                "type": "string",
                "description": "系统货币（默认人民币）",
                "is_system": True,
                "is_active": True,
            },
            {
                "key": "production.enable_quality_check",
                "value": True,
                "type": "boolean",
                "description": "是否启用质量检验（轻工行业默认启用）",
                "is_system": False,
                "is_active": True,
            },
            {
                "key": "production.enable_batch_tracking",
                "value": True,
                "type": "boolean",
                "description": "是否启用批次追踪（轻工行业默认启用）",
                "is_system": False,
                "is_active": True,
            },
            {
                "key": "production.enable_expiry_management",
                "value": True,
                "type": "boolean",
                "description": "是否启用有效期管理（轻工行业默认启用）",
                "is_system": False,
                "is_active": True,
            },
        ],
    },
    "is_active": True,
    "is_default": False,
    "sort_order": 5,
}


async def init_templates():
    """初始化制造业行业模板"""
    logger.info("开始初始化制造业行业模板...")
    
    # 初始化数据库连接
    config = TORTOISE_ORM.copy()
    if "routers" not in config or config["routers"] is None:
        config["routers"] = []
    await Tortoise.init(config=config)
    logger.info("数据库连接初始化成功")
    
    try:
        template_service = IndustryTemplateService()
        
        templates = [
            GENERAL_MANUFACTURING_TEMPLATE,
            ELECTRONICS_MANUFACTURING_TEMPLATE,
            MACHINERY_MANUFACTURING_TEMPLATE,
            CHEMICAL_MANUFACTURING_TEMPLATE,
            LIGHT_INDUSTRY_MANUFACTURING_TEMPLATE,
        ]
        
        created_count = 0
        updated_count = 0
        skipped_count = 0
        
        for template_data in templates:
            code = template_data["code"]
            
            # 检查模板是否已存在
            existing = await IndustryTemplate.get_or_none(code=code, tenant_id__isnull=True)
            
            if existing:
                logger.info(f"模板 {code} 已存在，跳过创建")
                skipped_count += 1
                continue
            
            try:
                from infra.schemas.industry_template import IndustryTemplateCreate
                template_create = IndustryTemplateCreate(**template_data)
                await template_service.create_template(template_create)
                logger.info(f"✅ 创建模板: {template_data['name']} ({code})")
                created_count += 1
            except Exception as e:
                logger.error(f"❌ 创建模板 {code} 失败: {e}")
                import traceback
                logger.error(traceback.format_exc())
        
        logger.info(f"✅ 模板初始化完成！创建: {created_count}, 跳过: {skipped_count}")
        
    except Exception as e:
        logger.error(f"❌ 初始化模板失败: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise
    finally:
        await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(init_templates())

