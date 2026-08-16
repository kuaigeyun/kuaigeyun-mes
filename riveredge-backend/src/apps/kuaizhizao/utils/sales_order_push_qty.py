"""销售订单下推/取单可发量统一口径（欠发 − 通知占用 − 待出库占用，按订单行）。"""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Set, Union

from apps.kuaizhizao.models.sales_delivery import SalesDelivery
from apps.kuaizhizao.models.sales_delivery_item import SalesDeliveryItem
from apps.kuaizhizao.models.shipment_notice import ShipmentNotice
from apps.kuaizhizao.models.shipment_notice_item import ShipmentNoticeItem

ItemLike = Union[Any, Mapping[str, Any]]

OPEN_NOTICE_STATUSES: Set[str] = {
    "待发货",
    "已通知",
    "PENDING",
    "NOTIFIED",
    "pending",
    "notified",
}

CANCELLED_NOTICE_STATUSES: Set[str] = {
    "已取消",
    "cancelled",
    "CANCELLED",
}

CANCELLED_DELIVERY_STATUSES: Set[str] = {
    "已取消",
    "cancelled",
    "CANCELLED",
}

CLOSED_DELIVERY_STATUSES: Set[str] = {
    "已出库",
    "已完成",
    "completed",
    "COMPLETED",
    "done",
    "DONE",
}


def compute_backorder_qty(item: ItemLike) -> Decimal:
    """欠发 = remaining_quantity（不为 None）否则 order_quantity − delivered_quantity，下限 0。"""
    if isinstance(item, Mapping):
        remaining_raw = item.get("remaining_quantity")
        order_qty = Decimal(str(item.get("order_quantity") or 0))
        delivered = Decimal(str(item.get("delivered_quantity") or 0))
        item_id = item.get("id")
        material_id = item.get("material_id")
    else:
        remaining_raw = getattr(item, "remaining_quantity", None)
        order_qty = Decimal(str(getattr(item, "order_quantity", 0) or 0))
        delivered = Decimal(str(getattr(item, "delivered_quantity", 0) or 0))
        item_id = getattr(item, "id", None)
        material_id = getattr(item, "material_id", None)

    if remaining_raw is not None:
        backorder = Decimal(str(remaining_raw))
    else:
        backorder = order_qty - delivered
    return max(Decimal("0"), backorder)


def compute_pushable_qty(
    backorder: Decimal,
    notice_occupied: Decimal,
    delivery_occupied: Decimal,
) -> Decimal:
    return max(Decimal("0"), backorder - notice_occupied - delivery_occupied)


def _item_id(item: ItemLike) -> int:
    if isinstance(item, Mapping):
        return int(item.get("id") or 0)
    return int(getattr(item, "id", 0) or 0)


def _material_id(item: ItemLike) -> int:
    if isinstance(item, Mapping):
        return int(item.get("material_id") or 0)
    return int(getattr(item, "material_id", 0) or 0)


def _sales_order_id(item: ItemLike) -> int:
    if isinstance(item, Mapping):
        return int(item.get("sales_order_id") or 0)
    return int(getattr(item, "sales_order_id", 0) or 0)


async def batch_notice_occupied_by_order_item(
    tenant_id: int,
    sales_order_ids: Sequence[int],
    *,
    exclude_notice_id: Optional[int] = None,
) -> Dict[int, Dict[int, Decimal]]:
    """未取消发货通知（待发货 + 已通知）按 sales_order_item_id 汇总占用。"""
    if not sales_order_ids:
        return {}

    from apps.kuaizhizao.models.sales_order_item import SalesOrderItem

    so_item_rows = await SalesOrderItem.filter(
        tenant_id=tenant_id,
        sales_order_id__in=list(sales_order_ids),
    ).values("id", "sales_order_id")
    item_to_order = {
        int(r["id"]): int(r["sales_order_id"])
        for r in so_item_rows
        if r.get("id") is not None and r.get("sales_order_id") is not None
    }
    result: Dict[int, Dict[int, Decimal]] = defaultdict(lambda: defaultdict(lambda: Decimal("0")))
    if not item_to_order:
        return {}

    notice_items = await ShipmentNoticeItem.filter(
        tenant_id=tenant_id,
        sales_order_item_id__in=list(item_to_order.keys()),
    ).values("notice_id", "sales_order_item_id", "notice_quantity")
    notice_ids = {int(r["notice_id"]) for r in notice_items if r.get("notice_id") is not None}
    notice_rows = (
        await ShipmentNotice.filter(
            tenant_id=tenant_id,
            id__in=list(notice_ids),
            deleted_at__isnull=True,
        ).exclude(status__in=list(CANCELLED_NOTICE_STATUSES)).values("id", "status")
        if notice_ids
        else []
    )
    open_notice_ids: Set[int] = set()
    for row in notice_rows:
        status = str(row.get("status") or "").strip()
        if status not in OPEN_NOTICE_STATUSES:
            continue
        nid = int(row.get("id") or 0)
        if nid <= 0:
            continue
        if exclude_notice_id is not None and nid == int(exclude_notice_id):
            continue
        open_notice_ids.add(nid)
    if not open_notice_ids:
        return {}

    for ni in notice_items:
        if int(ni.get("notice_id") or 0) not in open_notice_ids:
            continue
        so_item_id = ni.get("sales_order_item_id")
        if so_item_id is None:
            continue
        qty = Decimal(str(ni.get("notice_quantity") or 0))
        if qty <= 0:
            continue
        oid = item_to_order.get(int(so_item_id), 0)
        if oid <= 0:
            continue
        result[oid][int(so_item_id)] += qty

    return {oid: dict(inner) for oid, inner in result.items()}


async def batch_delivery_occupied_by_order_item(
    tenant_id: int,
    sales_order_ids: Sequence[int],
) -> tuple[Dict[int, Dict[int, Decimal]], Dict[int, Dict[int, Decimal]]]:
    """未完结销售出库占用：按订单行汇总 + 无行关联历史明细按物料汇总（待分配）。"""
    if not sales_order_ids:
        return {}

    delivery_rows = await SalesDelivery.filter(
        tenant_id=tenant_id,
        sales_order_id__in=list(sales_order_ids),
        deleted_at__isnull=True,
    ).exclude(status__in=list(CANCELLED_DELIVERY_STATUSES)).values("id", "sales_order_id", "status")

    open_delivery_ids: List[int] = []
    delivery_order: Dict[int, int] = {}
    for row in delivery_rows:
        status = str(row.get("status") or "").strip()
        if status in CLOSED_DELIVERY_STATUSES:
            continue
        did = int(row.get("id") or 0)
        if did <= 0:
            continue
        open_delivery_ids.append(did)
        delivery_order[did] = int(row.get("sales_order_id") or 0)

    by_item: Dict[int, Dict[int, Decimal]] = defaultdict(lambda: defaultdict(lambda: Decimal("0")))
    orphan_by_order_material: Dict[int, Dict[int, Decimal]] = defaultdict(
        lambda: defaultdict(lambda: Decimal("0"))
    )

    if not open_delivery_ids:
        return (
            {oid: dict(inner) for oid, inner in by_item.items()},
            {oid: dict(inner) for oid, inner in orphan_by_order_material.items()},
        )

    item_rows = await SalesDeliveryItem.filter(
        tenant_id=tenant_id,
        delivery_id__in=open_delivery_ids,
    ).values("delivery_id", "sales_order_item_id", "material_id", "delivery_quantity")

    for row in item_rows:
        qty = Decimal(str(row.get("delivery_quantity") or 0))
        if qty <= 0:
            continue
        oid = delivery_order.get(int(row.get("delivery_id") or 0), 0)
        if oid <= 0:
            continue
        so_item_id = row.get("sales_order_item_id")
        if so_item_id is not None and int(so_item_id) > 0:
            by_item[oid][int(so_item_id)] += qty
        else:
            mid = int(row.get("material_id") or 0)
            if mid > 0:
                orphan_by_order_material[oid][mid] += qty

    return (
        {oid: dict(inner) for oid, inner in by_item.items()},
        {oid: dict(inner) for oid, inner in orphan_by_order_material.items()},
    )


async def batch_pushable_qty_by_order_item(
    tenant_id: int,
    order_items: Sequence[ItemLike],
    *,
    exclude_notice_id: Optional[int] = None,
) -> Dict[int, Dict[int, Decimal]]:
    """
    返回 sales_order_id -> {sales_order_item_id -> pushable_qty}。
    order_items 须含 id / sales_order_id / material_id / remaining / order / delivered 字段。
    """
    if not order_items:
        return {}

    order_ids = sorted({ _sales_order_id(it) for it in order_items if _sales_order_id(it) > 0 })
    notice_occ = await batch_notice_occupied_by_order_item(
        tenant_id, order_ids, exclude_notice_id=exclude_notice_id
    )
    delivery_occ, orphan_by_order_material = await batch_delivery_occupied_by_order_item(
        tenant_id, order_ids
    )

    items_by_order: Dict[int, List[ItemLike]] = defaultdict(list)
    for it in order_items:
        oid = _sales_order_id(it)
        if oid > 0:
            items_by_order[oid].append(it)

    result: Dict[int, Dict[int, Decimal]] = {}
    for oid, lines in items_by_order.items():
        notice_map = notice_occ.get(oid, {})
        delivery_map = delivery_occ.get(oid, {})
        orphan_map = orphan_by_order_material.get(oid, {})
        assigned_orphan: Dict[int, Decimal] = defaultdict(lambda: Decimal("0"))

        for mid, orphan_qty in orphan_map.items():
            if orphan_qty <= 0:
                continue
            same_material = sorted(
                [ln for ln in lines if _material_id(ln) == mid],
                key=_item_id,
            )
            if not same_material:
                continue
            assigned_orphan[_item_id(same_material[0])] += orphan_qty

        per_item: Dict[int, Decimal] = {}
        for ln in lines:
            iid = _item_id(ln)
            if iid <= 0:
                continue
            backorder = compute_backorder_qty(ln)
            pushable = compute_pushable_qty(
                backorder,
                notice_map.get(iid, Decimal("0")),
                delivery_map.get(iid, Decimal("0")) + assigned_orphan.get(iid, Decimal("0")),
            )
            per_item[iid] = pushable
        result[oid] = per_item
    return result


def order_has_pushable_qty(pushable_by_item: Mapping[int, Decimal]) -> bool:
    return any(q > 0 for q in pushable_by_item.values())


async def batch_orders_with_pushable_qty(
    tenant_id: int,
    order_items: Sequence[ItemLike],
    *,
    exclude_notice_id: Optional[int] = None,
) -> Set[int]:
    pushable = await batch_pushable_qty_by_order_item(
        tenant_id, order_items, exclude_notice_id=exclude_notice_id
    )
    return {oid for oid, by_item in pushable.items() if order_has_pushable_qty(by_item)}


async def get_pushable_qty_for_order_items(
    tenant_id: int,
    sales_order_id: int,
    order_items: Sequence[ItemLike],
    *,
    exclude_notice_id: Optional[int] = None,
) -> Dict[int, Decimal]:
    pushable = await batch_pushable_qty_by_order_item(
        tenant_id, order_items, exclude_notice_id=exclude_notice_id
    )
    return pushable.get(int(sales_order_id), {})
