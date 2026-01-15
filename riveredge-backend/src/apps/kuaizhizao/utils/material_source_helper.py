"""
物料来源控制辅助工具模块

提供物料来源识别、验证、处理等辅助函数，支持物料来源控制功能。

根据《☆ 用户使用全场景推演.md》的设计，实现物料来源控制功能。

物料来源类型：
- Make（自制件）：企业自己生产制造
- Buy（采购件）：外部采购获得
- Phantom（虚拟件）：不实际存在，仅用于BOM展开
- Outsource（委外件）：委托外部加工
- Configure（配置件）：按需配置，变体管理

Author: Auto (AI Assistant)
Date: 2026-01-16
"""

from typing import Dict, Any, Optional, List, Tuple
from decimal import Decimal
from loguru import logger

from apps.master_data.models.material import Material, BOM
from infra.exceptions.exceptions import ValidationError, NotFoundError


# 物料来源类型常量
SOURCE_TYPE_MAKE = "Make"  # 自制件
SOURCE_TYPE_BUY = "Buy"  # 采购件
SOURCE_TYPE_PHANTOM = "Phantom"  # 虚拟件
SOURCE_TYPE_OUTSOURCE = "Outsource"  # 委外件
SOURCE_TYPE_CONFIGURE = "Configure"  # 配置件

VALID_SOURCE_TYPES = [
    SOURCE_TYPE_MAKE,
    SOURCE_TYPE_BUY,
    SOURCE_TYPE_PHANTOM,
    SOURCE_TYPE_OUTSOURCE,
    SOURCE_TYPE_CONFIGURE,
]


async def get_material_source_type(
    tenant_id: int,
    material_id: int
) -> Optional[str]:
    """
    获取物料的来源类型
    
    Args:
        tenant_id: 租户ID
        material_id: 物料ID
        
    Returns:
        str: 物料来源类型（Make/Buy/Phantom/Outsource/Configure）或None
    """
    material = await Material.get_or_none(tenant_id=tenant_id, id=material_id)
    if not material:
        return None
    
    return material.source_type


async def validate_material_source_config(
    tenant_id: int,
    material_id: int,
    source_type: str
) -> Tuple[bool, List[str]]:
    """
    验证物料来源配置的完整性
    
    Args:
        tenant_id: 租户ID
        material_id: 物料ID
        source_type: 物料来源类型
        
    Returns:
        Tuple[bool, List[str]]: (是否通过验证, 错误信息列表)
    """
    errors = []
    material = await Material.get_or_none(tenant_id=tenant_id, id=material_id)
    if not material:
        errors.append(f"物料不存在: {material_id}")
        return False, errors
    
    source_config = material.source_config or {}
    
    if source_type == SOURCE_TYPE_MAKE:
        # 自制件必须有BOM和工艺路线
        from apps.master_data.models.material import BOM
        bom_count = await BOM.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            approval_status="approved",
            deleted_at__isnull=True
        ).count()
        
        if bom_count == 0:
            errors.append(f"自制件必须有BOM配置，物料: {material.main_code} ({material.name})")
        
        if not material.process_route_id:
            errors.append(f"自制件必须有工艺路线配置，物料: {material.main_code} ({material.name})")
            
    elif source_type == SOURCE_TYPE_BUY:
        # 采购件建议配置默认供应商和采购价格（警告，不阻止）
        default_supplier_id = source_config.get("default_supplier_id")
        if not default_supplier_id:
            errors.append(f"采购件建议配置默认供应商，物料: {material.main_code} ({material.name})")
            
    elif source_type == SOURCE_TYPE_PHANTOM:
        # 虚拟件必须有完整的BOM结构（下层物料必须可展开）
        from apps.master_data.models.material import BOM
        bom_count = await BOM.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            approval_status="approved",
            deleted_at__isnull=True
        ).count()
        
        if bom_count == 0:
            errors.append(f"虚拟件必须有完整的BOM结构，物料: {material.main_code} ({material.name})")
            
        # 检查下层物料是否可展开
        bom_items = await BOM.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            approval_status="approved",
            deleted_at__isnull=True
        ).prefetch_related("component").all()
        
        if bom_items:
            for bom_item in bom_items:
                component = await bom_item.component
                if component:
                    # 递归检查下层物料
                    child_bom_count = await BOM.filter(
                        tenant_id=tenant_id,
                        material_id=component.id,
                        approval_status="approved",
                        deleted_at__isnull=True
                    ).count()
                    
                    if child_bom_count == 0 and component.source_type == SOURCE_TYPE_PHANTOM:
                        errors.append(f"虚拟件的下层物料必须是虚拟件或可展开的物料，子物料: {component.main_code} ({component.name})")
                        
    elif source_type == SOURCE_TYPE_OUTSOURCE:
        # 委外件必须有委外供应商和委外工序
        outsource_supplier_id = source_config.get("outsource_supplier_id")
        outsource_operation = source_config.get("outsource_operation")
        
        if not outsource_supplier_id:
            errors.append(f"委外件必须有委外供应商配置，物料: {material.main_code} ({material.name})")
            
        if not outsource_operation:
            errors.append(f"委外件必须有委外工序配置，物料: {material.main_code} ({material.name})")
            
    elif source_type == SOURCE_TYPE_CONFIGURE:
        # 配置件必须有变体属性和BOM变体
        variant_attributes = material.variant_attributes
        bom_variants = source_config.get("bom_variants")
        
        if not variant_attributes:
            errors.append(f"配置件必须有变体属性配置，物料: {material.main_code} ({material.name})")
            
        if not bom_variants:
            errors.append(f"配置件必须有BOM变体配置，物料: {material.main_code} ({material.name})")
    
    return len(errors) == 0, errors


async def expand_bom_with_source_control(
    tenant_id: int,
    material_id: int,
    required_quantity: float,
    only_approved: bool = True,
    level: int = 0,
    max_level: int = 10
) -> List[Dict[str, Any]]:
    """
    展开BOM，自动跳过虚拟件（物料来源控制）
    
    Args:
        tenant_id: 租户ID
        material_id: 物料ID
        required_quantity: 需求数量
        only_approved: 是否只使用已审核的BOM
        level: 当前层级
        max_level: 最大层级（防止无限递归）
        
    Returns:
        List[Dict]: 展开后的物料需求列表，虚拟件已跳过
    """
    if level >= max_level:
        logger.warning(f"BOM展开达到最大层级 {max_level}，物料ID: {material_id}")
        return []
    
    # 获取物料的来源类型
    material = await Material.get_or_none(tenant_id=tenant_id, id=material_id)
    if not material:
        return []
    
    source_type = material.source_type
    
    # 如果是虚拟件，自动跳过，直接展开下层物料
    if source_type == SOURCE_TYPE_PHANTOM:
        logger.debug(f"跳过虚拟件，直接展开下层物料，物料ID: {material_id}, 物料编码: {material.main_code}")
        
        # 获取虚拟件的BOM
        bom_items = await BOM.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            approval_status="approved" if only_approved else None,
            deleted_at__isnull=True
        ).prefetch_related("component").all()
        
        if not bom_items:
            logger.warning(f"虚拟件没有BOM，物料ID: {material_id}")
            return []
        
        # 获取最新版本的bom_code
        latest_bom = await BOM.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            approval_status="approved" if only_approved else None,
            deleted_at__isnull=True
        ).order_by("-version", "-created_at").first()
        
        if not latest_bom or not latest_bom.bom_code:
            return []
        
        # 获取该bom_code下的所有BOM明细
        bom_items = await BOM.filter(
            tenant_id=tenant_id,
            bom_code=latest_bom.bom_code,
            deleted_at__isnull=True
        ).prefetch_related("component").order_by("priority", "id").all()
        
        # 递归展开下层物料
        requirements = []
        for bom_item in bom_items:
            # 跳过替代料
            if bom_item.is_alternative:
                continue
            
            component = await bom_item.component
            if not component:
                continue
            
            # 计算子物料的需求数量（考虑损耗率）
            component_qty = float(bom_item.quantity) * required_quantity
            if bom_item.waste_rate:
                component_qty = component_qty * (1 + float(bom_item.waste_rate) / 100)
            
            # 递归展开子物料
            child_requirements = await expand_bom_with_source_control(
                tenant_id=tenant_id,
                material_id=component.id,
                required_quantity=component_qty,
                only_approved=only_approved,
                level=level + 1,
                max_level=max_level
            )
            
            # 合并需求（如果有子物料展开的结果，使用子物料的结果；否则添加当前物料）
            if child_requirements:
                requirements.extend(child_requirements)
            else:
                # 子物料没有BOM，直接添加
                requirements.append({
                    "material_id": component.id,
                    "material_code": component.main_code or component.code,
                    "material_name": component.name,
                    "material_type": component.material_type,
                    "source_type": component.source_type,
                    "required_quantity": component_qty,
                    "unit": bom_item.unit or component.base_unit,
                    "level": level + 1,
                    "from_phantom": True,  # 标记来自虚拟件
                    "phantom_material_id": material_id,  # 记录原始虚拟件ID
                })
        
        return requirements
    
    # 非虚拟件，正常展开BOM
    bom_items = await BOM.filter(
        tenant_id=tenant_id,
        material_id=material_id,
        approval_status="approved" if only_approved else None,
        deleted_at__isnull=True
    ).prefetch_related("component").all()
    
    if not bom_items:
        # 没有BOM，返回空列表
        return []
    
    # 获取最新版本的bom_code
    latest_bom = await BOM.filter(
        tenant_id=tenant_id,
        material_id=material_id,
        approval_status="approved" if only_approved else None,
        deleted_at__isnull=True
    ).order_by("-version", "-created_at").first()
    
    if not latest_bom or not latest_bom.bom_code:
        return []
    
    # 获取该bom_code下的所有BOM明细
    bom_items = await BOM.filter(
        tenant_id=tenant_id,
        bom_code=latest_bom.bom_code,
        deleted_at__isnull=True
    ).prefetch_related("component").order_by("priority", "id").all()
    
    requirements = []
    for bom_item in bom_items:
        # 跳过替代料
        if bom_item.is_alternative:
            continue
        
        component = await bom_item.component
        if not component:
            continue
        
        # 计算子物料的需求数量（考虑损耗率）
        component_qty = float(bom_item.quantity) * required_quantity
        if bom_item.waste_rate:
            component_qty = component_qty * (1 + float(bom_item.waste_rate) / 100)
        
        # 获取子物料的来源类型
        component_source_type = component.source_type
        
        # 如果子物料是虚拟件，递归展开
        if component_source_type == SOURCE_TYPE_PHANTOM:
            child_requirements = await expand_bom_with_source_control(
                tenant_id=tenant_id,
                material_id=component.id,
                required_quantity=component_qty,
                only_approved=only_approved,
                level=level + 1,
                max_level=max_level
            )
            requirements.extend(child_requirements)
        else:
            # 非虚拟件，直接添加
            requirements.append({
                "material_id": component.id,
                "material_code": component.main_code or component.code,
                "material_name": component.name,
                "material_type": component.material_type,
                "source_type": component_source_type,
                "required_quantity": component_qty,
                "unit": bom_item.unit or component.base_unit,
                "level": level + 1,
                "from_phantom": False,
            })
            
            # 如果子物料还有BOM，递归展开
            child_bom_count = await BOM.filter(
                tenant_id=tenant_id,
                material_id=component.id,
                approval_status="approved" if only_approved else None,
                deleted_at__isnull=True
            ).count()
            
            if child_bom_count > 0:
                child_requirements = await expand_bom_with_source_control(
                    tenant_id=tenant_id,
                    material_id=component.id,
                    required_quantity=component_qty,
                    only_approved=only_approved,
                    level=level + 1,
                    max_level=max_level
                )
                requirements.extend(child_requirements)
    
    return requirements


async def get_material_source_config(
    tenant_id: int,
    material_id: int
) -> Optional[Dict[str, Any]]:
    """
    获取物料的来源配置
    
    Args:
        tenant_id: 租户ID
        material_id: 物料ID
        
    Returns:
        Dict: 物料来源配置信息
    """
    material = await Material.get_or_none(tenant_id=tenant_id, id=material_id)
    if not material:
        return None
    
    source_type = material.source_type
    source_config = material.source_config or {}
    
    config = {
        "source_type": source_type,
        "source_config": source_config,
    }
    
    if source_type == SOURCE_TYPE_MAKE:
        # 自制件配置
        config.update({
            "process_route_id": material.process_route_id,
            "production_lead_time": source_config.get("production_lead_time"),
            "min_production_batch": source_config.get("min_production_batch"),
            "production_waste_rate": source_config.get("production_waste_rate"),
        })
    elif source_type == SOURCE_TYPE_BUY:
        # 采购件配置
        config.update({
            "default_supplier_id": source_config.get("default_supplier_id"),
            "default_supplier_name": source_config.get("default_supplier_name"),
            "purchase_lead_time": source_config.get("purchase_lead_time"),
            "min_purchase_batch": source_config.get("min_purchase_batch"),
            "purchase_price": source_config.get("purchase_price"),
        })
    elif source_type == SOURCE_TYPE_OUTSOURCE:
        # 委外件配置
        config.update({
            "outsource_supplier_id": source_config.get("outsource_supplier_id"),
            "outsource_supplier_name": source_config.get("outsource_supplier_name"),
            "outsource_operation": source_config.get("outsource_operation"),
            "outsource_lead_time": source_config.get("outsource_lead_time"),
            "outsource_price": source_config.get("outsource_price"),
            "material_provided_by": source_config.get("material_provided_by", "enterprise"),  # enterprise/supplier
        })
    elif source_type == SOURCE_TYPE_CONFIGURE:
        # 配置件配置
        config.update({
            "variant_attributes": material.variant_attributes,
            "bom_variants": source_config.get("bom_variants"),
            "default_variant": source_config.get("default_variant"),
        })
    
    return config
