"""
库存辅助工具模块

提供库存查询的辅助函数。
基于 MaterialBatch（主仓批次库存）和 LineSideInventory（线边仓库存）汇总真实库存数据。

Author: Luigi Lu
Date: 2025-01-01
"""

from datetime import date
from typing import Optional, Dict, Any, List, Iterable
from decimal import Decimal
from tortoise.functions import Sum
from tortoise.expressions import Q

from loguru import logger


def _decimal_or_zero(v: Any) -> Decimal:
    if v is None:
        return Decimal("0")
    try:
        return Decimal(str(v))
    except Exception:
        return Decimal("0")


async def batch_sum_open_supply_quantities(
    tenant_id: int,
    material_ids: Iterable[int],
) -> Dict[int, Decimal]:
    """
    按物料汇总「采购在途 + 生产/委外在制」数量，供 MRP include_in_transit 使用。

    - 采购：已审核通过订单、状态非取消/驳回/完结，明细 outstanding_quantity>0
    - 工单：released / in_progress，计划数量减 completed_quantity
    - 委外工单：released / in_progress，计划数量减 received_quantity
    """
    mids = [int(m) for m in material_ids if m is not None]
    if not mids:
        return {}

    result: Dict[int, Decimal] = {mid: Decimal("0") for mid in mids}
    mid_set = set(mids)

    from apps.kuaizhizao.constants import DocumentStatus, ReviewStatus, REVIEW_STATUS_ALIASES, normalize_status

    def _purchase_order_supplyable(order) -> bool:
        rs = str(getattr(order, "review_status", None) or "").strip()
        if REVIEW_STATUS_ALIASES.get(rs, rs) != ReviewStatus.APPROVED.value:
            return False
        st = str(getattr(order, "status", None) or "").strip()
        ns = normalize_status(st)
        blocked = {
            DocumentStatus.CANCELLED.value,
            DocumentStatus.REJECTED.value,
            DocumentStatus.DRAFT.value,
            DocumentStatus.PENDING_REVIEW.value,
        }
        if ns in blocked or st in ("已完成", "已取消", "completed", "cancelled", "CLOSED"):
            return False
        return True


    try:
        from apps.kuaizhizao.models.purchase_order import PurchaseOrderItem

        po_items = await PurchaseOrderItem.filter(
            tenant_id=tenant_id,
            material_id__in=mids,
            deleted_at__isnull=True,
        ).select_related("order")

        for line in po_items:
            order = line.order
            if not order or getattr(order, "deleted_at", None):
                continue
            if not _purchase_order_supplyable(order):
                continue
            out = _decimal_or_zero(line.outstanding_quantity)
            if out <= 0:
                ord_q = _decimal_or_zero(line.ordered_quantity)
                rec_q = _decimal_or_zero(line.received_quantity)
                out = max(Decimal("0"), ord_q - rec_q)
            if out > 0:
                mid = int(line.material_id)
                if mid in mid_set:
                    result[mid] += out
    except Exception as e:
        logger.warning(f"采购在途汇总失败: {e}")

    try:
        from apps.kuaizhizao.models.work_order import WorkOrder

        wos = await WorkOrder.filter(
            tenant_id=tenant_id,
            product_id__in=mids,
            deleted_at__isnull=True,
            status__in=["released", "in_progress"],
        ).all()
        for wo in wos:
            pid = int(wo.product_id)
            if pid not in mid_set:
                continue
            plan = _decimal_or_zero(wo.quantity)
            done = _decimal_or_zero(wo.completed_quantity)
            wip = max(Decimal("0"), plan - done)
            if wip > 0:
                result[pid] += wip
    except Exception as e:
        logger.warning(f"工单在制汇总失败: {e}")

    try:
        from apps.kuaizhizao.models.outsource_work_order import OutsourceWorkOrder

        owos = await OutsourceWorkOrder.filter(
            tenant_id=tenant_id,
            product_id__in=mids,
            deleted_at__isnull=True,
            status__in=["released", "in_progress"],
        ).all()
        for owo in owos:
            pid = int(owo.product_id)
            if pid not in mid_set:
                continue
            plan = _decimal_or_zero(owo.quantity)
            rec = _decimal_or_zero(owo.received_quantity)
            wip = max(Decimal("0"), plan - rec)
            if wip > 0:
                result[pid] += wip
    except Exception as e:
        logger.warning(f"委外工单在制汇总失败: {e}")

    return result


async def get_material_available_quantity(
    tenant_id: int,
    material_id: int,
    warehouse_id: Optional[int] = None,
    warehouse_ids: Optional[List[int]] = None,
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
        warehouse_id=warehouse_id,
        warehouse_ids=warehouse_ids,
    )
    return Decimal(str(info["available_quantity"]))


async def get_material_inventory_info(
    tenant_id: int,
    material_id: int,
    warehouse_id: Optional[int] = None,
    warehouse_ids: Optional[List[int]] = None,
    in_transit_quantity: Optional[float] = None,
    *,
    with_breakdown: bool = False,
    ownership_type: Optional[str] = None,
    customer_id: Optional[int] = None,
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
    batch_qty = Decimal("0")
    line_items: List[Any] = []

    # 1. MaterialBatch：主仓批次库存（与报表「批次库存查询」口径对齐：quantity>0、未删除、未过期；
    #    排除明确已出库/报废/过期状态；避免仅 status=in_stock 时与即时库存页不一致）
    try:
        from apps.master_data.models.material_batch import MaterialBatch

        batch_query = MaterialBatch.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            deleted_at__isnull=True,
            quantity__gt=0,
        ).filter(~Q(status__in=["out_stock", "scrapped", "expired"]))
        if ownership_type:
            batch_query = batch_query.filter(ownership_type=ownership_type)
        if customer_id is not None:
            batch_query = batch_query.filter(customer_id=customer_id)
        today = date.today()
        batch_query = batch_query.filter(
            Q(expiry_date__isnull=True) | Q(expiry_date__gte=today)
        )

        # 使用 manual loop 替代 aggregate，绕过某些环境下 'QuerySet' object has no attribute 'aggregate' 的异常
        batch_items = await batch_query.all()
        batch_qty = sum((item.quantity or Decimal("0")) for item in batch_items)
        on_hand += batch_qty
    except Exception as e:
        logger.warning(f"MaterialBatch 查询失败: {e}")

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
        elif warehouse_ids is not None:
            if len(warehouse_ids) == 0:
                line_items = []
            else:
                line_query = line_query.filter(warehouse_id__in=warehouse_ids)
                line_items = await line_query.all()
        else:
            line_items = await line_query.all()

        line_qty = sum(
            (item.quantity or Decimal("0")) - (item.reserved_quantity or Decimal("0"))
            for item in line_items
        )
        line_reserved = sum(item.reserved_quantity or Decimal("0") for item in line_items)
        on_hand += (line_qty + line_reserved)  # on_hand 包含全部
        reserved += line_reserved
    except Exception as e:
        logger.warning(f"LineSideInventory 查询失败: {e}")

    available = on_hand - reserved
    if available < 0:
        available = Decimal("0")

    transit = 0.0
    if in_transit_quantity is not None:
        transit = float(in_transit_quantity)
    result: Dict[str, Any] = {
        "on_hand": float(on_hand),
        "reserved_quantity": float(reserved),
        "available_quantity": float(available),
        "in_transit_quantity": transit,
        "total_quantity": float(on_hand),
    }

    if with_breakdown:
        line_by_wh: Dict[int, Dict[str, Decimal]] = {}
        for item in line_items:
            wid = int(item.warehouse_id)
            if wid not in line_by_wh:
                line_by_wh[wid] = {"quantity": Decimal("0"), "reserved": Decimal("0")}
            line_by_wh[wid]["quantity"] += item.quantity or Decimal("0")
            line_by_wh[wid]["reserved"] += item.reserved_quantity or Decimal("0")

        line_rows: List[Dict[str, Any]] = []
        if line_by_wh:
            try:
                from apps.master_data.models.warehouse import Warehouse

                wh_list = await Warehouse.filter(id__in=list(line_by_wh.keys())).all()
                wh_name = {w.id: w.name for w in wh_list}
            except Exception as e:
                logger.warning(f"仓库名称加载失败: {e}")
                wh_name = {}
            for wid, agg in sorted(line_by_wh.items(), key=lambda x: x[0]):
                q = agg["quantity"]
                r = agg["reserved"]
                av = q - r
                if av < 0:
                    av = Decimal("0")
                line_rows.append(
                    {
                        "warehouse_id": wid,
                        "warehouse_name": wh_name.get(wid) or f"仓库 #{wid}",
                        "quantity": float(q),
                        "reserved": float(r),
                        "available": float(av),
                    }
                )

        wh_scope = "全部线边仓"
        if warehouse_id is not None:
            wh_scope = f"单仓 ID={warehouse_id}"
        elif warehouse_ids is not None:
            if len(warehouse_ids) == 0:
                wh_scope = "计算参数未选择仓库（线边仓不计入）"
            else:
                wh_scope = f"本次计算纳入的常态仓线边库存（共 {len(warehouse_ids)} 个仓库）"

        result["breakdown"] = {
            "main_batch": {
                "label": "主仓批次库存",
                "quantity": float(batch_qty),
                "note_zh": "MaterialBatch：quantity>0、未删除、未过期，且状态非已出库/报废/过期（与批次库存查询一致；未按仓库维度拆分）",
            },
            "line_side_scope_zh": wh_scope,
            "line_side_rows": line_rows,
            "formula_zh": [
                "在库合计 = 主仓批次数量 + 各线边仓现存量之和",
                "线边「可用」= 线边现存量 − 线边预留",
                "本列「可用库存」= 在库合计 − 线边预留合计（与列表数值一致）",
            ],
        }

    return result


async def get_material_detailed_locations(
    tenant_id: int,
    material_id: int
) -> list[Dict[str, Any]]:
    """
    获取物料的详细库位分布

    Returns:
        List[Dict], 包含库位、仓库、批次及可用数量
    """
    locations = []
    
    # 1. 主仓 MaterialBatch
    try:
        from apps.master_data.models.material_batch import MaterialBatch
        from apps.master_data.models.warehouse import Warehouse

        batches = await MaterialBatch.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            deleted_at__isnull=True,
            quantity__gt=0,
        ).filter(~Q(status__in=["out_stock", "scrapped", "expired"])).all()
        
        # 暂时没有在 MaterialBatch 里直接存 warehouse_id，
        # 如果有仓库字段则关联；如果没有则标记为“默认主仓”
        # 补充：通常在业务实务中，MaterialBatch 会归属于某个 Warehouse
        for b in batches:
            wh_name = "主仓"
            wh_id = 0
            # 尝试通过仓库字段获取（取决于具体模型定义，此处兼容性处理）
            if hasattr(b, "warehouse_id") and b.warehouse_id:
                wh = await Warehouse.get_or_none(id=b.warehouse_id)
                if wh:
                    wh_name = wh.name
                    wh_id = wh.id
            
            locations.append({
                "warehouse_id": wh_id,
                "warehouse_name": wh_name,
                "batch_no": b.batch_no,
                "quantity": b.quantity,
                "storage_location_code": getattr(b, "storage_location_code", None)
            })
    except Exception as e:
        logger.warning(f"获取主仓明细失败: {e}")

    # 2. 线边仓 LineSideInventory
    try:
        from apps.kuaizhizao.models.line_side_inventory import LineSideInventory
        from apps.master_data.models.warehouse import Warehouse

        line_items = await LineSideInventory.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            deleted_at__isnull=True,
            status="available",
            quantity__gt=0
        ).all()
        
        for item in line_items:
            wh = await Warehouse.get_or_none(id=item.warehouse_id)
            locations.append({
                "warehouse_id": item.warehouse_id,
                "warehouse_name": wh.name if wh else f"线边仓({item.warehouse_id})",
                "batch_no": item.batch_no,
                "quantity": (item.quantity or Decimal("0")) - (item.reserved_quantity or Decimal("0")),
                "storage_location_code": "线边位"
            })
    except Exception as e:
        logger.warning(f"获取线边仓明细失败: {e}")

    return locations


async def batch_get_material_inventory(
    tenant_id: int,
    material_ids: list[int],
    warehouse_id: Optional[int] = None,
    warehouse_ids: Optional[List[int]] = None,
    ownership_type: Optional[str] = None,
    customer_id: Optional[int] = None,
) -> Dict[int, Decimal]:
    """
    批量获取物料的可用库存数量（性能优化版，减少数据库往返）

    Args:
        tenant_id: 租户ID
        material_ids: 物料ID列表
        warehouse_id: 仓库ID（可选）

    Returns:
        Dict[int, Decimal]: material_id -> available_quantity
    """
    if not material_ids:
        return {}

    inventory_map: Dict[int, Decimal] = {mid: Decimal("0") for mid in material_ids}
    
    # 1. 批量查询 MaterialBatch
    try:
        from apps.master_data.models.material_batch import MaterialBatch

        today = date.today()
        batch_q = MaterialBatch.filter(
            tenant_id=tenant_id,
            material_id__in=material_ids,
            deleted_at__isnull=True,
            quantity__gt=0,
        ).filter(~Q(status__in=["out_stock", "scrapped", "expired"])).filter(
            Q(expiry_date__isnull=True) | Q(expiry_date__gte=today)
        )
        if ownership_type:
            batch_q = batch_q.filter(ownership_type=ownership_type)
        if customer_id is not None:
            batch_q = batch_q.filter(customer_id=customer_id)
        batch_items = await batch_q.all()

        for item in batch_items:
            mid = item.material_id
            inventory_map[mid] += (item.quantity or Decimal("0"))
    except Exception as e:
        logger.warning(f"MaterialBatch 批量查询失败: {e}")

    # 2. 批量查询 LineSideInventory
    try:
        from apps.kuaizhizao.models.line_side_inventory import LineSideInventory

        line_query = LineSideInventory.filter(
            tenant_id=tenant_id,
            material_id__in=material_ids,
            deleted_at__isnull=True,
            status="available",
        )
        if warehouse_id is not None:
            line_query = line_query.filter(warehouse_id=warehouse_id)
            line_items = await line_query.all()
        elif warehouse_ids is not None:
            if len(warehouse_ids) == 0:
                line_items = []
            else:
                line_query = line_query.filter(warehouse_id__in=warehouse_ids)
                line_items = await line_query.all()
        else:
            line_items = await line_query.all()

        for item in line_items:
            mid = item.material_id
            available = (item.quantity or Decimal("0")) - (item.reserved_quantity or Decimal("0"))
            if available > 0:
                inventory_map[mid] += available
    except Exception as e:
        logger.warning(f"LineSideInventory 批量查询失败: {e}")

    # 确保数值不小于 0
    for mid in inventory_map:
        if inventory_map[mid] < 0:
            inventory_map[mid] = Decimal("0")

    return inventory_map
