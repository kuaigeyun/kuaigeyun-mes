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
    获取物料的库存信息（用于需求计算可供应量）

    Args:
        tenant_id: 租户ID
        material_id: 物料ID
        warehouse_id: 仓库ID（可选，None 时查询所有仓库）

    Returns:
        库存信息字典，包含：
        - on_hand: 在库实际数量
        - reserved_quantity: 预留数量（已分配订单/工单）
        - available_quantity: 可用数量（在库 - 预留）
        - in_transit_quantity: 在途数量（采购在途 + 生产在制）
        - total_quantity: 总数量（兼容旧用法，等于 on_hand）
    """
    # TODO: 调用库存管理系统的API获取真实库存数据
    # 当前为占位实现，待对接 WMS、采购单、工单等
    available_quantity = await get_material_available_quantity(
        tenant_id=tenant_id,
        material_id=material_id,
        warehouse_id=warehouse_id
    )
    on_hand = available_quantity  # 占位：实际应为在库数量
    reserved = Decimal("0")
    in_transit = Decimal("0")

    return {
        "on_hand": float(on_hand),
        "reserved_quantity": float(reserved),
        "available_quantity": float(available_quantity),
        "in_transit_quantity": float(in_transit),
        "total_quantity": float(on_hand),
    }

