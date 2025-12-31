"""
库存辅助工具模块

提供库存查询的辅助函数。
注意：当前为简化实现，实际应调用库存管理系统的API。

Author: Luigi Lu
Date: 2025-01-01
"""

from typing import Optional, Dict, Any
from decimal import Decimal
from loguru import logger


async def get_material_available_quantity(
    tenant_id: int,
    material_id: int,
    warehouse_id: Optional[int] = None
) -> Decimal:
    """
    获取物料的可用库存数量

    Args:
        tenant_id: 租户ID
        material_id: 物料ID
        warehouse_id: 仓库ID（可选，如果为None则查询所有仓库）

    Returns:
        可用库存数量（Decimal）

    Note:
        当前为简化实现，返回0。实际应调用库存管理系统的API。
        如果项目中有库存管理APP，应该通过API调用获取真实库存数据。
    """
    # TODO: 调用库存管理系统的API获取真实库存数据
    # 示例：
    # from apps.inventory.services.inventory_service import InventoryService
    # inventory = await InventoryService.get_material_inventory(
    #     tenant_id=tenant_id,
    #     material_id=material_id,
    #     warehouse_id=warehouse_id
    # )
    # return inventory.available_quantity if inventory else Decimal(0)
    
    logger.warning(f"库存查询为简化实现，返回0。物料ID: {material_id}, 仓库ID: {warehouse_id}")
    return Decimal(0)


async def get_material_inventory_info(
    tenant_id: int,
    material_id: int,
    warehouse_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    获取物料的库存信息

    Args:
        tenant_id: 租户ID
        material_id: 物料ID
        warehouse_id: 仓库ID（可选）

    Returns:
        库存信息字典，包含：
        - available_quantity: 可用数量
        - total_quantity: 总数量
        - reserved_quantity: 预留数量
        - in_transit_quantity: 在途数量
    """
    # TODO: 调用库存管理系统的API获取真实库存数据
    available_quantity = await get_material_available_quantity(
        tenant_id=tenant_id,
        material_id=material_id,
        warehouse_id=warehouse_id
    )
    
    return {
        "available_quantity": float(available_quantity),
        "total_quantity": float(available_quantity),
        "reserved_quantity": 0.0,
        "in_transit_quantity": 0.0
    }

