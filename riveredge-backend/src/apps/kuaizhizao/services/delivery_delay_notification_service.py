"""销售/采购交期延误日检 → 配置中心消息规则（站内信，同日去重）。"""

from __future__ import annotations

from datetime import date, datetime, time
from typing import Any, Dict, Set

from loguru import logger

from apps.kuaizhizao.models.purchase_order import PurchaseOrder, PurchaseOrderItem
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.services.kuaizhizao_business_notification import (
    ACTION_ARRIVAL_OVERDUE,
    ACTION_DELIVERY_DELAYED,
    DOC_PURCHASE_ORDER,
    DOC_SALES_ORDER,
    dispatch_kuaizhizao_notification,
)
from apps.kuaizhizao.utils.purchase_arrival_warning import (
    PO_TERMINAL_STATUSES,
    WARNING_LEVEL_OVERDUE,
    compute_warning_level,
    line_has_open_receipt,
)
from core.models.message_log import MessageLog
from core.utils.timezone_utils import resolve_business_datetime, to_site_date

_CLOSED_STATUSES = ("COMPLETED", "已完成", "CANCELLED", "已取消", "cancelled", "closed", "CLOSED")
_MAX_PER_DOC = 40


async def _notified_entity_ids_today(
    tenant_id: int,
    *,
    trigger_document: str,
    trigger_action: str,
    id_key: str,
) -> Set[str]:
    today_start = datetime.combine(date.today(), time.min)
    logs = await MessageLog.filter(
        tenant_id=tenant_id,
        type="internal",
        created_at__gte=today_start,
        deleted_at__isnull=True,
    ).order_by("-created_at").limit(800)
    out: Set[str] = set()
    for log in logs:
        variables = log.variables if isinstance(log.variables, dict) else {}
        if str(variables.get("trigger_document") or "") != trigger_document:
            continue
        if str(variables.get("trigger_action") or "") != trigger_action:
            continue
        eid = str(variables.get(id_key) or "").strip()
        if eid:
            out.add(eid)
    return out


async def check_and_notify_delivery_delays(tenant_id: int) -> Dict[str, Any]:
    today = date.today()
    sales_sent = 0
    purchase_sent = 0

    sales_done = await _notified_entity_ids_today(
        tenant_id,
        trigger_document=DOC_SALES_ORDER,
        trigger_action=ACTION_DELIVERY_DELAYED,
        id_key="sales_order_id",
    )
    sales_orders = (
        await SalesOrder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            delivery_date__lt=today,
        )
        .exclude(status__in=list(_CLOSED_STATUSES))
        .order_by("delivery_date")
        .limit(_MAX_PER_DOC)
    )
    for order in sales_orders:
        oid = str(order.id)
        if oid in sales_done:
            continue
        n = await dispatch_kuaizhizao_notification(
            tenant_id,
            trigger_document=DOC_SALES_ORDER,
            trigger_action=ACTION_DELIVERY_DELAYED,
            variables={
                "order_code": order.order_code or oid,
                "delivery_date": str(order.delivery_date or ""),
                "customer_name": order.customer_name or "—",
                "detail_path": f"/apps/kuaizhizao/sales-management/sales-orders?highlight={order.id}",
                "sales_order_id": oid,
            },
            context={
                "creator_user_id": order.created_by,
                "salesman_user_id": order.salesman_id,
            },
        )
        sales_sent += n
        if n:
            sales_done.add(oid)

    po_done = await _notified_entity_ids_today(
        tenant_id,
        trigger_document=DOC_PURCHASE_ORDER,
        trigger_action=ACTION_DELIVERY_DELAYED,
        id_key="purchase_order_id",
    )
    purchase_orders = (
        await PurchaseOrder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            delivery_date__lt=today,
        )
        .exclude(status__in=list(_CLOSED_STATUSES))
        .order_by("delivery_date")
        .limit(_MAX_PER_DOC)
    )
    for order in purchase_orders:
        oid = str(order.id)
        if oid in po_done:
            continue
        n = await dispatch_kuaizhizao_notification(
            tenant_id,
            trigger_document=DOC_PURCHASE_ORDER,
            trigger_action=ACTION_DELIVERY_DELAYED,
            variables={
                "order_code": getattr(order, "order_code", None)
                or getattr(order, "code", None)
                or oid,
                "delivery_date": str(order.delivery_date or ""),
                "supplier_name": getattr(order, "supplier_name", None) or "—",
                "detail_path": f"/apps/kuaizhizao/purchase-management/purchase-orders?highlight={order.id}",
                "purchase_order_id": oid,
            },
            context={"creator_user_id": order.created_by},
        )
        purchase_sent += n
        if n:
            po_done.add(oid)

    arrival_sent = await _notify_purchase_arrival_overdue(tenant_id)

    result = {
        "sales_checked": len(sales_orders),
        "sales_notified": sales_sent,
        "purchase_checked": len(purchase_orders),
        "purchase_notified": purchase_sent,
        "purchase_arrival_overdue_notified": arrival_sent,
    }
    logger.info("交期延误提醒完成 tenant={} {}", tenant_id, result)
    return result


async def _notify_purchase_arrival_overdue(tenant_id: int) -> int:
    """采购行级到货逾期日检（同日按采购订单去重）。"""
    from apps.kuaizhizao.services.purchase_arrival_warning_service import (
        PurchaseArrivalWarningService,
    )

    site_today = to_site_date(resolve_business_datetime())
    imminent_days = await PurchaseArrivalWarningService().get_arrival_imminent_days(tenant_id)
    po_done = await _notified_entity_ids_today(
        tenant_id,
        trigger_document=DOC_PURCHASE_ORDER,
        trigger_action=ACTION_ARRIVAL_OVERDUE,
        id_key="purchase_order_id",
    )

    heads = await PurchaseOrder.filter(
        tenant_id=tenant_id,
        deleted_at__isnull=True,
    ).exclude(status__in=list(PO_TERMINAL_STATUSES)).limit(500)
    if not heads:
        return 0

    po_ids = [int(h.id) for h in heads]
    head_by_id = {int(h.id): h for h in heads}
    items = await PurchaseOrderItem.filter(
        tenant_id=tenant_id,
        order_id__in=po_ids,
        deleted_at__isnull=True,
    ).all()

    overdue_lines_by_po: Dict[int, int] = {}
    for item in items:
        if not line_has_open_receipt(item):
            continue
        dd = item.required_date
        if hasattr(dd, "date"):
            dd = dd.date() if callable(getattr(dd, "date", None)) else dd
        level = compute_warning_level(
            dd,
            site_today,
            imminent_days=imminent_days,
            has_open_qty=True,
        )
        if level != WARNING_LEVEL_OVERDUE:
            continue
        po_id = int(item.order_id)
        overdue_lines_by_po[po_id] = overdue_lines_by_po.get(po_id, 0) + 1

    sent = 0
    for po_id, line_count in overdue_lines_by_po.items():
        oid = str(po_id)
        if oid in po_done:
            continue
        order = head_by_id.get(po_id)
        if not order:
            continue
        n = await dispatch_kuaizhizao_notification(
            tenant_id,
            trigger_document=DOC_PURCHASE_ORDER,
            trigger_action=ACTION_ARRIVAL_OVERDUE,
            variables={
                "order_code": getattr(order, "order_code", None) or oid,
                "overdue_line_count": str(line_count),
                "supplier_name": getattr(order, "supplier_name", None) or "—",
                "detail_path": f"/apps/kuaizhizao/purchase-management/purchase-orders?highlight={po_id}",
                "purchase_order_id": oid,
            },
            context={"creator_user_id": order.created_by},
        )
        sent += n
        if n:
            po_done.add(oid)
    return sent
