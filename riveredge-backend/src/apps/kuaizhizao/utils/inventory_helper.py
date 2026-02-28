"""
库存辅助工具模块

提供库存查询的辅助函数。
基于 MaterialBatch（主仓批次库存）和 LineSideInventory（线边仓库存）汇总真实库存数据。

Author: Luigi Lu
Date: 2025-01-01
"""

from datetime import date
from typing import Optional, Dict, Any
from decimal import Decimal
from tortoise.functions import Sum
from tortoise.expressions import Q

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
        warehouse_id: 仓库ID（可选，None 时查询所有仓库）

    Returns:
        可用库存数量（Decimal）
    """
    info = await get_material_inventory_info(
        tenant_id=tenant_id,
        material_id=material_id,
        warehouse_id=warehouse_id
    )
    return Decimal(str(info["available_quantity"]))


async def get_material_inventory_info(
    tenant_id: int,
    material_id: int,
    warehouse_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    获取物料的库存信息（用于需求计算可供应量）

    数据来源：
    - MaterialBatch：主仓批次库存（无 warehouse_id，按物料汇总）
    - LineSideInventory：线边仓库存（按 warehouse_id、material_id 汇总，available = quantity - reserved）

    Args:
        tenant_id: 租户ID
        material_id: 物料ID
        warehouse_id: 仓库ID（可选，None 时查询所有仓库）

    Returns:
        库存信息字典，包含：
        - on_hand: 在库实际数量
        - reserved_quantity: 预留数量（线边仓预留）
        - available_quantity: 可用数量（在库 - 预留）
        - in_transit_quantity: 在途数量（占位 0，后续可对接采购在途、生产在制）
        - total_quantity: 总数量（兼容旧用法，等于 on_hand）
    """
    on_hand = Decimal("0")
    reserved = Decimal("0")

    # 1. MaterialBatch：主仓批次库存（status=in_stock 且 quantity>0）
    try:
        from apps.master_data.models.material_batch import MaterialBatch

        batch_query = MaterialBatch.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            deleted_at__isnull=True,
            status="in_stock",
            quantity__gt=0,
        )
        today = date.today()
        batch_query = batch_query.filter(
            Q(expiry_date__isnull=True) | Q(expiry_date__gte=today)
        )
        agg = await batch_query.aggregate(total=Sum("quantity"))
        batch_qty = agg.get("total") or Decimal("0")
        on_hand += batch_qty
    except Exception as e:
        logger.warning(f"MaterialBatch 查询失败: {e}")
        batch_qty = Decimal("0")

    # 2. LineSideInventory：线边仓库存（status=available）
    try:
        from apps.kuaizhizao.models.line_side_inventory import LineSideInventory

        line_query = LineSideInventory.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            deleted_at__isnull=True,
            status="available",
        )
        if warehouse_id is not None:
            line_query = line_query.filter(warehouse_id=warehouse_id)

        line_items = await line_query.all()
        line_qty = sum(
            (item.quantity or Decimal("0")) - (item.reserved_quantity or Decimal("0"))
            for item in line_items
        )
        line_reserved = sum(item.reserved_quantity or Decimal("0") for item in line_items)
        on_hand += line_qty + line_reserved  # on_hand 包含全部
        reserved += line_reserved
    except Exception as e:
        logger.warning(f"LineSideInventory 查询失败: {e}")

    available = on_hand - reserved
    if available < 0:
        available = Decimal("0")

    return {
        "on_hand": float(on_hand),
        "reserved_quantity": float(reserved),
        "available_quantity": float(available),
        "in_transit_quantity": 0.0,
        "total_quantity": float(on_hand),
    }

