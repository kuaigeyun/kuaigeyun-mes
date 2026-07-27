"""
库存辅助工具模块

提供库存查询的辅助函数。
基于 MaterialBatch（主仓批次库存）和 LineSideInventory（线边仓库存）汇总真实库存数据。

Author: Luigi Lu
Date: 2025-01-01
"""

from datetime import date, datetime
from typing import Optional, Dict, Any, List, Iterable, Tuple
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


def _as_date(value: Any, fallback: Optional[date] = None) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return fallback or date.today()


async def batch_sum_open_supply_quantities_with_breakdown(
    tenant_id: int,
    material_ids: Iterable[int],
) -> Dict[int, Dict[str, float]]:
    """
    按物料汇总在途/在制数量明细：
    - purchase_quantity: 采购在途（已审核采购订单未入库量）
    - work_order_quantity: 工单在制
    - outsource_work_order_quantity: 委外工单在制
    """
    mids = [int(m) for m in material_ids if m is not None]
    empty_row = {
        "purchase_quantity": 0.0,
        "work_order_quantity": 0.0,
        "outsource_work_order_quantity": 0.0,
        "total": 0.0,
    }
    if not mids:
        return {}

    result: Dict[int, Dict[str, float]] = {mid: dict(empty_row) for mid in mids}
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
                    result[mid]["purchase_quantity"] += float(out)
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
                result[pid]["work_order_quantity"] += float(wip)
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
                result[pid]["outsource_work_order_quantity"] += float(wip)
    except Exception as e:
        logger.warning(f"委外工单在制汇总失败: {e}")

    for row in result.values():
        row["total"] = (
            row["purchase_quantity"]
            + row["work_order_quantity"]
            + row["outsource_work_order_quantity"]
        )
    return result


async def batch_sum_open_supply_quantities(
    tenant_id: int,
    material_ids: Iterable[int],
) -> Dict[int, Decimal]:
    """
    按物料汇总「采购在途 + 生产/委外在制」数量，供 MRP include_in_transit 使用。
    """
    breakdown = await batch_sum_open_supply_quantities_with_breakdown(tenant_id, material_ids)
    return {mid: Decimal(str(row.get("total") or 0)) for mid, row in breakdown.items()}


async def batch_list_open_supply_receipts_by_date(
    tenant_id: int,
    material_ids: Iterable[int],
) -> Dict[int, List[Dict[str, Any]]]:
    """
    按物料列出开放供应（计划收货）明细，带到期日，供时间分桶 MRP 使用。

    每项：{date, qty, source_type, document_id, document_code}
    - 采购：PurchaseOrderItem.required_date，否则订单 delivery_date
    - 工单/委外：planned_end_date，否则 planned_start_date，否则今天
    """
    mids = [int(m) for m in material_ids if m is not None]
    if not mids:
        return {}

    result: Dict[int, List[Dict[str, Any]]] = {mid: [] for mid in mids}
    mid_set = set(mids)
    today = date.today()

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
                out = max(
                    Decimal("0"),
                    _decimal_or_zero(line.ordered_quantity) - _decimal_or_zero(line.received_quantity),
                )
            if out <= 0:
                continue
            mid = int(line.material_id)
            if mid not in mid_set:
                continue
            due = getattr(line, "required_date", None) or getattr(order, "delivery_date", None)
            result[mid].append({
                "date": _as_date(due, today),
                "qty": float(out),
                "source_type": "purchase_order",
                "document_id": int(getattr(order, "id", 0) or 0),
                "document_code": str(getattr(order, "order_code", "") or ""),
            })
    except Exception as e:
        logger.warning(f"采购在途按日明细失败: {e}")

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
            wip = max(
                Decimal("0"),
                _decimal_or_zero(wo.quantity) - _decimal_or_zero(wo.completed_quantity),
            )
            if wip <= 0:
                continue
            due = getattr(wo, "planned_end_date", None) or getattr(wo, "planned_start_date", None)
            result[pid].append({
                "date": _as_date(due, today),
                "qty": float(wip),
                "source_type": "work_order",
                "document_id": int(getattr(wo, "id", 0) or 0),
                "document_code": str(getattr(wo, "code", "") or ""),
            })
    except Exception as e:
        logger.warning(f"工单在制按日明细失败: {e}")

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
            wip = max(
                Decimal("0"),
                _decimal_or_zero(owo.quantity) - _decimal_or_zero(owo.received_quantity),
            )
            if wip <= 0:
                continue
            due = getattr(owo, "planned_end_date", None) or getattr(owo, "planned_start_date", None)
            result[pid].append({
                "date": _as_date(due, today),
                "qty": float(wip),
                "source_type": "outsource_work_order",
                "document_id": int(getattr(owo, "id", 0) or 0),
                "document_code": str(getattr(owo, "code", "") or ""),
            })
    except Exception as e:
        logger.warning(f"委外工单在制按日明细失败: {e}")

    for mid in result:
        result[mid].sort(key=lambda r: (r["date"], r["source_type"], r["document_id"]))
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


def _normalize_warehouse_display_name(warehouse_name: Optional[str]) -> str:
    name = str(warehouse_name or "").strip()
    return name or "未配置仓库"


async def _list_material_default_warehouses(
    tenant_id: int,
    material: Any,
) -> List[Tuple[int, str]]:
    """物料 defaults.defaultWarehouses 中全部启用仓库，按 priority 升序。"""
    from apps.master_data.models.warehouse import Warehouse
    from apps.master_data.services.material_service import _material_defaults_as_dict

    defaults = _material_defaults_as_dict(getattr(material, "defaults", None))
    if not defaults:
        return []
    raw_list = defaults.get("defaultWarehouses") or defaults.get("default_warehouses")
    if not isinstance(raw_list, list) or not raw_list:
        return []

    def _priority(entry: dict) -> int:
        try:
            return int(entry.get("priority") or 999)
        except (TypeError, ValueError):
            return 999

    sorted_entries = sorted(
        [e for e in raw_list if isinstance(e, dict)],
        key=_priority,
    )
    seen: set[int] = set()
    out: List[Tuple[int, str]] = []
    for entry in sorted_entries:
        wh_id = entry.get("warehouseId") or entry.get("warehouse_id")
        if wh_id is None:
            continue
        try:
            wh_id_int = int(wh_id)
        except (TypeError, ValueError):
            continue
        if wh_id_int in seen:
            continue
        wh = await Warehouse.get_or_none(
            id=wh_id_int,
            tenant_id=tenant_id,
            is_active=True,
            deleted_at__isnull=True,
        )
        if wh:
            seen.add(wh_id_int)
            out.append((wh.id, wh.name))
    return out


async def get_material_detailed_locations(
    tenant_id: int,
    material_id: int
) -> list[Dict[str, Any]]:
    """
    获取物料的详细库位分布（按具体仓库聚合，不再使用「主仓/线边仓」笼统标签）。

    Returns:
        List[Dict]: warehouse_id, warehouse_name, warehouse_type, quantity
    """
    from apps.master_data.models.material import Material
    from apps.master_data.models.material_batch import MaterialBatch
    from apps.kuaizhizao.models.line_side_inventory import LineSideInventory
    from apps.master_data.models.warehouse import Warehouse
    from apps.master_data.services.material_service import (
        resolve_primary_default_warehouse_from_material,
    )

    material = await Material.get_or_none(
        tenant_id=tenant_id,
        id=material_id,
        deleted_at__isnull=True,
    )

    by_wh: Dict[int, Dict[str, Any]] = {}

    def _ensure_wh(
        wh_id: int,
        wh_name: str,
        *,
        warehouse_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        if wh_id not in by_wh:
            by_wh[wh_id] = {
                "warehouse_id": wh_id,
                "warehouse_name": _normalize_warehouse_display_name(wh_name),
                "warehouse_type": warehouse_type or "normal",
                "quantity": Decimal("0"),
                "batch_no": None,
                "storage_location_code": None,
            }
        return by_wh[wh_id]

    today = date.today()
    batch_filter = (
        Q(expiry_date__isnull=True) | Q(expiry_date__gte=today)
    )

    primary_wh = (
        await resolve_primary_default_warehouse_from_material(
            tenant_id=tenant_id,
            material=material,
        )
        if material
        else None
    )
    batch_wh_id, batch_wh_name = primary_wh if primary_wh else (0, "未配置仓库")
    if primary_wh:
        wh_row = await Warehouse.get_or_none(
            tenant_id=tenant_id,
            id=primary_wh[0],
            deleted_at__isnull=True,
        )
        batch_wh_type = wh_row.warehouse_type if wh_row else "normal"
    else:
        batch_wh_type = "normal"

    try:
        batches = await MaterialBatch.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            deleted_at__isnull=True,
            quantity__gt=0,
        ).filter(~Q(status__in=["out_stock", "scrapped", "expired"])).filter(batch_filter).all()

        for b in batches:
            row = _ensure_wh(batch_wh_id, batch_wh_name, warehouse_type=batch_wh_type)
            row["quantity"] += _decimal_or_zero(b.quantity)
    except Exception as e:
        logger.warning(f"获取主仓明细失败: {e}")

    try:
        # 与 batch_get_material_inventory 同口径：不按过期日过滤线边（过期字段常为空/类型不一致，
        # 套用 batch_filter 失败会被吞掉，导致半成品入线边后齐套「库存数量」恒为 0）
        line_items = await LineSideInventory.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            deleted_at__isnull=True,
            status="available",
        ).all()

        wh_ids = {int(item.warehouse_id) for item in line_items if item.warehouse_id}
        wh_map: Dict[int, Warehouse] = {}
        if wh_ids:
            wh_rows = await Warehouse.filter(
                tenant_id=tenant_id,
                id__in=list(wh_ids),
                deleted_at__isnull=True,
            ).all()
            wh_map = {w.id: w for w in wh_rows}

        for item in line_items:
            wh_id = int(item.warehouse_id)
            wh = wh_map.get(wh_id)
            wh_name = (
                (item.warehouse_name or "").strip()
                or (wh.name if wh else "")
                or f"仓库({wh_id})"
            )
            wh_type = (wh.warehouse_type if wh else None) or "line_side"
            avail = _decimal_or_zero(item.quantity) - _decimal_or_zero(item.reserved_quantity)
            if avail <= 0:
                continue
            row = _ensure_wh(wh_id, wh_name, warehouse_type=wh_type)
            row["quantity"] += avail
    except Exception as e:
        logger.warning(f"获取线边仓明细失败: {e}")

    # 仅在完全无实物库存时补默认仓占位；有线边/主仓库存时不再用 0 数量的半成品仓遮挡
    has_positive = any(_decimal_or_zero(r.get("quantity")) > 0 for r in by_wh.values())
    if material and not has_positive:
        for wh_id, wh_name in await _list_material_default_warehouses(tenant_id, material):
            wh = await Warehouse.get_or_none(
                tenant_id=tenant_id,
                id=wh_id,
                deleted_at__isnull=True,
            )
            _ensure_wh(
                wh_id,
                wh_name,
                warehouse_type=wh.warehouse_type if wh else "normal",
            )

    locations: list[Dict[str, Any]] = []
    for row in by_wh.values():
        qty = _decimal_or_zero(row["quantity"])
        # 有正库存时隐藏 0 数量占位仓，避免成品工单齐套只看到「半成品仓 0」
        if has_positive and qty <= 0:
            continue
        locations.append(
            {
                "warehouse_id": row["warehouse_id"],
                "warehouse_name": row["warehouse_name"],
                "warehouse_type": row["warehouse_type"],
                "batch_no": row["batch_no"],
                "quantity": row["quantity"],
                "storage_location_code": row["storage_location_code"],
            }
        )
    locations.sort(
        key=lambda x: (
            0 if (x.get("warehouse_type") or "") == "line_side" else 1,
            str(x.get("warehouse_name") or ""),
        )
    )
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


def _normalize_outbound_batch_no(batch_no: Optional[str]) -> str:
    bn = str(batch_no or "").strip()
    return bn if bn else "DEFAULT"


def _outbound_ownership_filter(
    ownership_type: Optional[str] = None,
    customer_id: Optional[int] = None,
) -> Dict[str, Any]:
    ot = ownership_type or "company_owned"
    cid = customer_id if customer_id is not None else 0
    return {"ownership_type": ot, "customer_id": cid}


async def get_outbound_available_quantity(
    tenant_id: int,
    material_id: int,
    warehouse_id: int,
    *,
    batch_no: Optional[str] = None,
    ownership_type: Optional[str] = None,
    customer_id: Optional[int] = None,
) -> Decimal:
    """
    按出库所选仓库统计可扣减数量（与批次库存查询 / 生产领料过账口径一致）。

    - 线边仓：仅汇总该 warehouse_id 下的 LineSideInventory
    - 主仓：MaterialBatch 按物料默认仓库归属；所选仓库与默认仓库不一致时可用量为 0
    """
    from apps.master_data.models.material import Material
    from apps.master_data.models.material_batch import MaterialBatch
    from apps.master_data.models.warehouse import Warehouse
    from apps.kuaizhizao.models.line_side_inventory import LineSideInventory
    from apps.master_data.services.material_service import (
        resolve_primary_default_warehouse_from_material,
    )

    wh = await Warehouse.get_or_none(
        id=int(warehouse_id),
        tenant_id=tenant_id,
        deleted_at__isnull=True,
    )
    if not wh:
        return Decimal("0")

    own = _outbound_ownership_filter(ownership_type, customer_id)
    raw_batch = str(batch_no or "").strip()
    ledger_bn = _normalize_outbound_batch_no(raw_batch) if raw_batch else ""
    use_specific_batch = bool(raw_batch) and ledger_bn != "DEFAULT"

    if wh.warehouse_type == "line_side":
        line_query = LineSideInventory.filter(
            tenant_id=tenant_id,
            warehouse_id=int(warehouse_id),
            material_id=material_id,
            deleted_at__isnull=True,
            status="available",
        )
        if use_specific_batch:
            line_query = line_query.filter(batch_no=raw_batch)
        if hasattr(LineSideInventory, "ownership_type"):
            line_query = line_query.filter(ownership_type=own["ownership_type"])
        if hasattr(LineSideInventory, "customer_id"):
            line_query = line_query.filter(customer_id=own["customer_id"])
        line_items = await line_query.all()
        available = Decimal("0")
        for item in line_items:
            qty = _decimal_or_zero(item.quantity) - _decimal_or_zero(item.reserved_quantity)
            if qty > 0:
                available += qty
        return available

    material = await Material.get_or_none(
        tenant_id=tenant_id,
        id=material_id,
        deleted_at__isnull=True,
    )
    material_wh = (
        await resolve_primary_default_warehouse_from_material(tenant_id, material=material)
        if material
        else None
    )
    if material_wh and int(material_wh[0]) != int(warehouse_id):
        return Decimal("0")

    today = date.today()
    batch_query = MaterialBatch.filter(
        tenant_id=tenant_id,
        material_id=material_id,
        deleted_at__isnull=True,
        status="in_stock",
        quantity__gt=0,
        **own,
    ).filter(Q(expiry_date__isnull=True) | Q(expiry_date__gte=today))
    if use_specific_batch:
        batch_query = batch_query.filter(batch_no=raw_batch)

    batches = await batch_query.all()
    return sum((_decimal_or_zero(b.quantity) for b in batches), Decimal("0"))


async def assert_outbound_warehouse_stock_available(
    tenant_id: int,
    material_id: int,
    warehouse_id: int,
    quantity: Decimal,
    *,
    batch_no: Optional[str] = None,
    ownership_type: Optional[str] = None,
    customer_id: Optional[int] = None,
    material_label: Optional[str] = None,
) -> None:
    """出库前校验：所选仓库下可用库存须满足扣减数量。"""
    from infra.exceptions.exceptions import BusinessLogicError
    from apps.master_data.models.material import Material
    from apps.master_data.models.warehouse import Warehouse
    from apps.master_data.services.material_service import (
        resolve_primary_default_warehouse_from_material,
    )

    need = _decimal_or_zero(quantity)
    if need <= 0:
        return

    available = await get_outbound_available_quantity(
        tenant_id=tenant_id,
        material_id=material_id,
        warehouse_id=warehouse_id,
        batch_no=batch_no,
        ownership_type=ownership_type,
        customer_id=customer_id,
    )
    if available >= need:
        return

    if not material_label:
        material = await Material.get_or_none(
            tenant_id=tenant_id,
            id=material_id,
            deleted_at__isnull=True,
        )
        if material:
            code = getattr(material, "main_code", None) or getattr(material, "code", "")
            material_label = f"{material.name}（{code}）" if code else material.name
        else:
            material_label = f"物料ID:{material_id}"

    selected_wh = await Warehouse.get_or_none(
        id=int(warehouse_id),
        tenant_id=tenant_id,
        deleted_at__isnull=True,
    )
    selected_wh_name = (selected_wh.name if selected_wh else None) or f"仓库#{warehouse_id}"

    material = await Material.get_or_none(
        tenant_id=tenant_id,
        id=material_id,
        deleted_at__isnull=True,
    )
    material_wh = (
        await resolve_primary_default_warehouse_from_material(tenant_id, material=material)
        if material
        else None
    )

    batch_hint = ""
    raw_batch = str(batch_no or "").strip()
    if raw_batch and _normalize_outbound_batch_no(raw_batch) != "DEFAULT":
        batch_hint = f"，批号 {raw_batch}"

    if (
        selected_wh
        and selected_wh.warehouse_type != "line_side"
        and material_wh
        and int(material_wh[0]) != int(warehouse_id)
    ):
        raise BusinessLogicError(
            f"出库失败：{material_label} 的主仓库存归属默认仓库 {material_wh[1]}，"
            f"不能从 {selected_wh_name} 领料/出库{batch_hint}"
        )

    raise BusinessLogicError(
        f"出库失败：{material_label} 在 {selected_wh_name} 可用库存 {available:g}，"
        f"不足本次出库 {need:g}{batch_hint}"
    )
