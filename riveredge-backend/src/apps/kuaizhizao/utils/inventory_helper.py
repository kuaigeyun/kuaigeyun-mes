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

from apps.master_data.constants.batch_quality_status import QUALIFIED


def _decimal_or_zero(v: Any) -> Decimal:
    if v is None:
        return Decimal("0")
    try:
        return Decimal(str(v))
    except Exception:
        return Decimal("0")


def _normalize_inventory_warehouse_scope(
    warehouse_id: Optional[int] = None,
    warehouse_ids: Optional[List[int]] = None,
) -> Optional[List[int]]:
    """
    库存汇总仓库范围。

    Returns:
        None: 不限仓库（全部计入）
        []: 明确不计入任何仓库
        非空列表: 仅这些仓库（warehouse_id 优先于 warehouse_ids）
    """
    if warehouse_id is not None:
        return [int(warehouse_id)]
    if warehouse_ids is not None:
        return [int(x) for x in warehouse_ids]
    return None


async def _material_default_warehouse_ids(
    tenant_id: int,
    material_ids: List[int],
) -> Dict[int, int]:
    """物料主键 -> 主默认仓 ID（无默认仓则不入 dict）。"""
    if not material_ids:
        return {}
    from apps.master_data.models.material import Material
    from apps.master_data.services.material_service import (
        resolve_primary_default_warehouse_from_material,
    )

    materials = await Material.filter(
        tenant_id=tenant_id,
        id__in=material_ids,
        deleted_at__isnull=True,
    ).all()
    result: Dict[int, int] = {}
    for material in materials:
        primary = await resolve_primary_default_warehouse_from_material(
            tenant_id, material=material
        )
        if primary:
            result[int(material.id)] = int(primary[0])
    return result


def _apply_material_batch_warehouse_scope_q(
    scope: List[int],
    *,
    include_unassigned: bool,
) -> Q:
    """
    MaterialBatch 仓库范围：归属仓在范围内；
    include_unassigned 为真时一并纳入历史 warehouse_id=0（调用方须再按物料默认仓裁剪）。
    """
    scoped = Q(warehouse_id__in=scope)
    if include_unassigned:
        return scoped | Q(warehouse_id=0)
    return scoped


from core.utils.timezone_utils import resolve_business_datetime, to_site_date


def _site_today() -> date:
    return to_site_date(resolve_business_datetime())


def _as_date(value: Any, fallback: Optional[date] = None) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return fallback or _site_today()


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
    today = _site_today()

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
    - MaterialBatch：主仓批次库存（按 warehouse_id 收窄；历史 0 按物料默认仓归属）
    - LineSideInventory：线边仓库存（按 warehouse_id、material_id 汇总，available = quantity - reserved）

    Args:
        tenant_id: 租户ID
        material_id: 物料ID
        warehouse_id: 单仓（可选）
        warehouse_ids: 多仓范围（可选；与 warehouse_id 互斥时 warehouse_id 优先）
            None=全部仓；[]=不计入任何仓；非空=仅所选仓

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
    wh_scope = _normalize_inventory_warehouse_scope(warehouse_id, warehouse_ids)

    # 1. MaterialBatch：主仓批次库存（与报表「批次库存查询」口径对齐：quantity>0、未删除、未过期；
    #    排除明确已出库/报废/过期状态；避免仅 status=in_stock 时与即时库存页不一致）
    try:
        from apps.master_data.models.material_batch import MaterialBatch

        if wh_scope is not None and len(wh_scope) == 0:
            batch_qty = Decimal("0")
        else:
            batch_query = MaterialBatch.filter(
                tenant_id=tenant_id,
                material_id=material_id,
                deleted_at__isnull=True,
                quantity__gt=0,
                quality_status=QUALIFIED,
            ).filter(~Q(status__in=["out_stock", "scrapped", "expired"]))
            if ownership_type:
                batch_query = batch_query.filter(ownership_type=ownership_type)
            if customer_id is not None:
                batch_query = batch_query.filter(customer_id=customer_id)
            today = date.today()
            batch_query = batch_query.filter(
                Q(expiry_date__isnull=True) | Q(expiry_date__gte=today)
            )

            if wh_scope is not None:
                scope_set = set(wh_scope)
                default_map = await _material_default_warehouse_ids(
                    tenant_id, [material_id]
                )
                include_unassigned = default_map.get(material_id) in scope_set
                batch_query = batch_query.filter(
                    _apply_material_batch_warehouse_scope_q(
                        wh_scope, include_unassigned=include_unassigned
                    )
                )

            batch_agg = (
                await batch_query.group_by("material_id")
                .annotate(qty=Sum("quantity"))
                .values("material_id", "qty")
            )
            batch_qty = _decimal_or_zero(batch_agg[0]["qty"] if batch_agg else 0)
            on_hand += batch_qty
    except Exception as e:
        logger.warning(f"MaterialBatch 查询失败: {e}")

    # 2. LineSideInventory：线边仓库存（status=available）
    line_side_rows_for_breakdown: List[Dict[str, Any]] = []
    try:
        from apps.kuaizhizao.models.line_side_inventory import LineSideInventory

        line_query = LineSideInventory.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            deleted_at__isnull=True,
            status="available",
        )
        if wh_scope is not None:
            if len(wh_scope) == 0:
                line_query = None
            else:
                line_query = line_query.filter(warehouse_id__in=wh_scope)

        if line_query is not None:
            if with_breakdown:
                line_rows_agg = (
                    await line_query.group_by("warehouse_id")
                    .annotate(qty=Sum("quantity"), reserved_qty=Sum("reserved_quantity"))
                    .values("warehouse_id", "qty", "reserved_qty")
                )
                line_qty = Decimal("0")
                line_reserved = Decimal("0")
                for row in line_rows_agg:
                    q = _decimal_or_zero(row.get("qty"))
                    r = _decimal_or_zero(row.get("reserved_qty"))
                    line_qty += q - r
                    line_reserved += r
                    line_side_rows_for_breakdown.append(
                        {
                            "warehouse_id": int(row["warehouse_id"]),
                            "quantity": q,
                            "reserved": r,
                        }
                    )
            else:
                line_agg = (
                    await line_query.group_by("material_id")
                    .annotate(qty=Sum("quantity"), reserved_qty=Sum("reserved_quantity"))
                    .values("material_id", "qty", "reserved_qty")
                )
                line_qty_raw = _decimal_or_zero(line_agg[0]["qty"] if line_agg else 0)
                line_reserved = _decimal_or_zero(line_agg[0]["reserved_qty"] if line_agg else 0)
                line_qty = line_qty_raw - line_reserved
            on_hand += line_qty + line_reserved  # on_hand 包含全部
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
        line_rows: List[Dict[str, Any]] = []
        if line_side_rows_for_breakdown:
            try:
                from apps.master_data.models.warehouse import Warehouse

                wh_ids = [int(r["warehouse_id"]) for r in line_side_rows_for_breakdown]
                wh_list = await Warehouse.filter(id__in=wh_ids).all()
                wh_name = {w.id: w.name for w in wh_list}
            except Exception as e:
                logger.warning(f"仓库名称加载失败: {e}")
                wh_name = {}
            for row in sorted(line_side_rows_for_breakdown, key=lambda x: int(x["warehouse_id"])):
                wid = int(row["warehouse_id"])
                q = _decimal_or_zero(row["quantity"])
                r = _decimal_or_zero(row["reserved"])
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

        if wh_scope is None:
            line_scope_zh = "全部仓库"
        elif len(wh_scope) == 0:
            line_scope_zh = "计算参数未选择仓库（主仓批次与线边仓均不计入）"
        else:
            line_scope_zh = f"本次计算纳入的仓库（共 {len(wh_scope)} 个；主仓批次与线边同范围）"

        result["breakdown"] = {
            "main_batch": {
                "label": "主仓批次库存",
                "quantity": float(batch_qty),
                "note_zh": (
                    "MaterialBatch：quantity>0、未删除、未过期，且状态非已出库/报废/过期；"
                    "按参与计算的仓库过滤 warehouse_id（历史未归属按物料默认仓计入）"
                ),
            },
            "line_side_scope_zh": line_scope_zh,
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

    try:
        batches = await MaterialBatch.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            deleted_at__isnull=True,
            quantity__gt=0,
        ).filter(~Q(status__in=["out_stock", "scrapped", "expired"])).filter(batch_filter).all()

        batch_wh_ids = {
            int(getattr(b, "warehouse_id", 0) or 0)
            for b in batches
            if int(getattr(b, "warehouse_id", 0) or 0) > 0
        }
        batch_wh_map: Dict[int, Warehouse] = {}
        if batch_wh_ids:
            wh_rows = await Warehouse.filter(
                tenant_id=tenant_id,
                id__in=list(batch_wh_ids),
                deleted_at__isnull=True,
            ).all()
            batch_wh_map = {w.id: w for w in wh_rows}

        # 历史 warehouse_id=0 行：仍用物料默认仓归属
        primary_wh = None
        if any(int(getattr(b, "warehouse_id", 0) or 0) <= 0 for b in batches):
            primary_wh = (
                await resolve_primary_default_warehouse_from_material(
                    tenant_id=tenant_id,
                    material=material,
                )
                if material
                else None
            )

        for b in batches:
            wh_id = int(getattr(b, "warehouse_id", 0) or 0)
            if wh_id > 0:
                wh = batch_wh_map.get(wh_id)
                wh_name = (
                    str(getattr(b, "warehouse_name", None) or "").strip()
                    or (wh.name if wh else "")
                    or f"仓库({wh_id})"
                )
                wh_type = (wh.warehouse_type if wh else None) or "normal"
            elif primary_wh:
                wh_id, wh_name = int(primary_wh[0]), primary_wh[1]
                wh = await Warehouse.get_or_none(
                    tenant_id=tenant_id,
                    id=wh_id,
                    deleted_at__isnull=True,
                )
                wh_type = wh.warehouse_type if wh else "normal"
            else:
                wh_id, wh_name, wh_type = 0, "未配置仓库", "normal"
            row = _ensure_wh(wh_id, wh_name, warehouse_type=wh_type)
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
) -> Dict[int, Dict[str, Decimal]]:
    """
    批量获取物料库存（SQL GROUP BY，减少数据库往返）。

    口径与 get_material_inventory_info（无 breakdown）一致：
    - on_hand = 主仓批次 + 线边现存量（均按 warehouse_id / warehouse_ids 收窄）
    - reserved_quantity = 线边预留
    - available_quantity = on_hand - reserved（下限 0）
    - 仓库范围 None=全部；[]=不计入；非空=仅所选仓（主仓历史 warehouse_id=0 按物料默认仓归属）

    Returns:
        Dict[int, Dict[str, Decimal]]: material_id -> {
            available_quantity, on_hand, reserved_quantity
        }
    """
    if not material_ids:
        return {}

    unique_ids = list({int(mid) for mid in material_ids if mid is not None})
    if not unique_ids:
        return {}

    on_hand_map: Dict[int, Decimal] = {mid: Decimal("0") for mid in unique_ids}
    reserved_map: Dict[int, Decimal] = {mid: Decimal("0") for mid in unique_ids}
    wh_scope = _normalize_inventory_warehouse_scope(warehouse_id, warehouse_ids)

    # 1. 批量查询 MaterialBatch（SQL GROUP BY，不拉全表行；与 get_material_inventory_info 同仓库范围）
    try:
        from apps.master_data.models.material_batch import MaterialBatch

        if wh_scope is not None and len(wh_scope) == 0:
            pass
        else:
            today = date.today()
            batch_q = MaterialBatch.filter(
                tenant_id=tenant_id,
                material_id__in=unique_ids,
                deleted_at__isnull=True,
                quantity__gt=0,
            ).filter(~Q(status__in=["out_stock", "scrapped", "expired"])).filter(
                Q(expiry_date__isnull=True) | Q(expiry_date__gte=today)
            )
            if ownership_type:
                batch_q = batch_q.filter(ownership_type=ownership_type)
            if customer_id is not None:
                batch_q = batch_q.filter(customer_id=customer_id)

            if wh_scope is None:
                batch_rows = (
                    await batch_q.group_by("material_id")
                    .annotate(qty=Sum("quantity"))
                    .values("material_id", "qty")
                )
                for row in batch_rows:
                    mid = int(row["material_id"])
                    if mid in on_hand_map:
                        on_hand_map[mid] += _decimal_or_zero(row.get("qty"))
            else:
                scope_set = set(wh_scope)
                # 已归属所选仓的批次
                attributed_rows = (
                    await batch_q.filter(warehouse_id__in=wh_scope)
                    .group_by("material_id")
                    .annotate(qty=Sum("quantity"))
                    .values("material_id", "qty")
                )
                for row in attributed_rows:
                    mid = int(row["material_id"])
                    if mid in on_hand_map:
                        on_hand_map[mid] += _decimal_or_zero(row.get("qty"))

                # 历史未归属：仅当物料默认仓在所选范围内时计入（与出库可用量口径一致）
                zero_rows = (
                    await batch_q.filter(warehouse_id=0)
                    .group_by("material_id")
                    .annotate(qty=Sum("quantity"))
                    .values("material_id", "qty")
                )
                if zero_rows:
                    zero_mids = [int(r["material_id"]) for r in zero_rows]
                    default_map = await _material_default_warehouse_ids(
                        tenant_id, zero_mids
                    )
                    for row in zero_rows:
                        mid = int(row["material_id"])
                        if mid not in on_hand_map:
                            continue
                        if default_map.get(mid) in scope_set:
                            on_hand_map[mid] += _decimal_or_zero(row.get("qty"))
    except Exception as e:
        logger.warning(f"MaterialBatch 批量查询失败: {e}")

    # 2. 批量查询 LineSideInventory（SQL GROUP BY）
    try:
        from apps.kuaizhizao.models.line_side_inventory import LineSideInventory

        line_query = LineSideInventory.filter(
            tenant_id=tenant_id,
            material_id__in=unique_ids,
            deleted_at__isnull=True,
            status="available",
        )
        if wh_scope is not None:
            if len(wh_scope) == 0:
                line_query = None
            else:
                line_query = line_query.filter(warehouse_id__in=wh_scope)

        if line_query is not None:
            line_rows = (
                await line_query.group_by("material_id")
                .annotate(qty=Sum("quantity"), reserved_qty=Sum("reserved_quantity"))
                .values("material_id", "qty", "reserved_qty")
            )
            for row in line_rows:
                mid = int(row["material_id"])
                if mid not in on_hand_map:
                    continue
                line_qty = _decimal_or_zero(row.get("qty"))
                line_reserved = _decimal_or_zero(row.get("reserved_qty"))
                on_hand_map[mid] += line_qty
                reserved_map[mid] += line_reserved
    except Exception as e:
        logger.warning(f"LineSideInventory 批量查询失败: {e}")

    inventory_map: Dict[int, Dict[str, Decimal]] = {}
    for mid in unique_ids:
        on_hand = on_hand_map[mid]
        reserved = reserved_map[mid]
        if on_hand < 0:
            on_hand = Decimal("0")
        if reserved < 0:
            reserved = Decimal("0")
        available = on_hand - reserved
        if available < 0:
            available = Decimal("0")
        inventory_map[mid] = {
            "available_quantity": available,
            "on_hand": on_hand,
            "reserved_quantity": reserved,
        }

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
    - 主仓：汇总 MaterialBatch.warehouse_id 匹配的余额；历史 warehouse_id=0
      且物料默认仓等于所选仓时计入
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

    today = date.today()
    target_wh = int(warehouse_id)
    batch_query = MaterialBatch.filter(
        tenant_id=tenant_id,
        material_id=material_id,
        deleted_at__isnull=True,
        status="in_stock",
        quantity__gt=0,
        quality_status=QUALIFIED,
        **own,
    ).filter(Q(expiry_date__isnull=True) | Q(expiry_date__gte=today))
    if use_specific_batch:
        batch_query = batch_query.filter(batch_no=raw_batch)

    batches = await batch_query.all()
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
    material_default_id = int(material_wh[0]) if material_wh else None

    available = Decimal("0")
    for b in batches:
        b_wh = int(getattr(b, "warehouse_id", 0) or 0)
        if b_wh == target_wh:
            available += _decimal_or_zero(b.quantity)
        elif b_wh == 0 and material_default_id == target_wh:
            available += _decimal_or_zero(b.quantity)
    return available


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
        and available <= 0
    ):
        # 所选仓与物料默认仓不同且该仓无余额时，提示更明确
        has_other = await get_outbound_available_quantity(
            tenant_id=tenant_id,
            material_id=material_id,
            warehouse_id=int(material_wh[0]),
            batch_no=batch_no,
            ownership_type=ownership_type,
            customer_id=customer_id,
        )
        if has_other > 0:
            raise BusinessLogicError(
                f"出库失败：{material_label} 在 {material_wh[1]} 有库存 {has_other:g}，"
                f"不能从 {selected_wh_name} 领料/出库{batch_hint}"
            )

    raise BusinessLogicError(
        f"出库失败：{material_label} 在 {selected_wh_name} 可用库存 {available:g}，"
        f"不足本次出库 {need:g}{batch_hint}"
    )
