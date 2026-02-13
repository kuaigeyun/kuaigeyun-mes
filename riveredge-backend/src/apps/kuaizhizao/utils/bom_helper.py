"""
BOM辅助工具模块

提供调用master_data APP的BOM API的辅助函数。

Author: Luigi Lu
Date: 2025-01-01
"""

from typing import List, Dict, Any, Optional
from decimal import Decimal
from loguru import logger

from apps.master_data.models.material import BOM
from apps.master_data.schemas.material_schemas import BOMResponse
from infra.exceptions.exceptions import NotFoundError, ValidationError


async def get_bom_by_material_id(
    tenant_id: int,
    material_id: int,
    only_approved: bool = True
) -> Optional[BOM]:
    """
    根据物料ID获取BOM（从master_data）

    Args:
        tenant_id: 租户ID
        material_id: 物料ID
        only_approved: 是否只返回已审核的BOM（默认：True）

    Returns:
        BOM对象或None
    """
    query = BOM.filter(
        tenant_id=tenant_id,
        material_id=material_id,
        deleted_at__isnull=True
    )
    
    if only_approved:
        query = query.filter(approval_status="approved")
    
    # 获取最新版本的BOM
    bom = await query.order_by("-version", "-created_at").first()
    
    return bom


async def get_bom_items_by_material_id(
    tenant_id: int,
    material_id: int,
    only_approved: bool = True
) -> List[BOM]:
    """
    根据物料ID获取BOM明细列表（从master_data）

    Args:
        tenant_id: 租户ID
        material_id: 物料ID
        only_approved: 是否只返回已审核的BOM（默认：True）

    Returns:
        BOM明细列表
    """
    query = BOM.filter(
        tenant_id=tenant_id,
        material_id=material_id,
        deleted_at__isnull=True
    )
    
    if only_approved:
        query = query.filter(approval_status="approved")
    
    # 获取最新版本的BOM明细
    # master_data的BOM表结构：每个BOM项都是一条记录，通过material_id和bom_code关联
    # 先获取最新版本的bom_code
    latest_bom = await query.order_by("-version", "-created_at").first()
    if not latest_bom:
        return []
    
    bom_code = latest_bom.bom_code
    if not bom_code:
        return []
    
    # 获取该bom_code下的所有BOM明细（限定同一主物料，确保子物料完整）
    items_query = BOM.filter(
        tenant_id=tenant_id,
        material_id=material_id,
        bom_code=bom_code,
        deleted_at__isnull=True
    )
    if only_approved:
        items_query = items_query.filter(approval_status="approved")
    items = await items_query.prefetch_related("component").order_by("priority", "id").all()
    return items


async def calculate_material_requirements_from_bom(
    tenant_id: int,
    material_id: int,
    required_quantity: float,
    only_approved: bool = True
) -> List[Any]:
    """
    根据BOM计算物料需求（从master_data）

    Args:
        tenant_id: 租户ID
        material_id: 物料ID（成品物料ID）
        required_quantity: 需求数量
        only_approved: 是否只使用已审核的BOM（默认：True）

    Returns:
        物料需求列表，返回MaterialRequirement对象列表（兼容原BOMService的返回格式）
    """
    from apps.kuaizhizao.schemas.bom import MaterialRequirement
    
    bom_items = await get_bom_items_by_material_id(
        tenant_id=tenant_id,
        material_id=material_id,
        only_approved=only_approved
    )
    
    if not bom_items:
        raise NotFoundError(f"物料 {material_id} 的BOM不存在或未审核")
    
    requirements = []
    for item in bom_items:
        # 跳过替代料（只使用主料）
        if item.is_alternative:
            continue
        
        # 计算需求数量
        component = await item.component
        if not component:
            continue
        
        required_qty = float(item.quantity) * required_quantity
        gross_requirement = required_qty  # 暂时不考虑损耗率
        
        # 创建MaterialRequirement对象（兼容原格式）
        requirement = MaterialRequirement(
            component_id=item.component_id,
            component_code=component.code,
            component_name=component.name,
            component_type=component.material_type or "原材料",
            gross_requirement=gross_requirement,
            net_requirement=gross_requirement,  # 暂时不考虑库存和计划入库
            available_inventory=0.0,  # TODO: 从库存系统获取
            planned_receipt=0.0,  # TODO: 从计划系统获取
            unit=item.unit,
            lead_time=0  # TODO: 从物料主数据获取
        )
        
        requirements.append(requirement)
    
    return requirements

