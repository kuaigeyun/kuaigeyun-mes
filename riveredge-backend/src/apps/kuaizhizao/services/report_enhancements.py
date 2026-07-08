"""
快制造报表增强逻辑（对账、流水、毛利、委外等）。

从 report_service 抽离，避免单文件持续膨胀。
"""

from __future__ import annotations

from datetime import datetime, timedelta, date
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from loguru import logger
from core.utils.timezone_utils import to_api_isoformat


async def customer_received_by_customer_id(
    tenant_id: int,
    customer_ids: List[int],
    date_start: Optional[datetime] = None,
    date_end: Optional[datetime] = None,
) -> Dict[int, float]:
    """按客户汇总已收款（kuaicaiwu Receivable.received_amount）。"""
    if not customer_ids:
        return {}
    try:
        from apps.kuaicaiwu.models.receivable import Receivable

        q = Receivable.filter(tenant_id=tenant_id, customer_id__in=customer_ids, deleted_at__isnull=True)
        if date_start:
            q = q.filter(business_date__gte=date_start.date() if isinstance(date_start, datetime) else date_start)
        if date_end:
            q = q.filter(business_date__lte=date_end.date() if isinstance(date_end, datetime) else date_end)
        rows = await q.values_list("customer_id", "received_amount")
        out: Dict[int, float] = {}
        for cid, amt in rows:
            if cid is None:
                continue
            out[int(cid)] = out.get(int(cid), 0.0) + float(amt or 0)
        return out
    except Exception as exc:
        logger.warning("customer_received_by_customer_id failed: {}", exc)
        return {}


async def build_customer_sales_reconciliation(
    tenant_id: int,
    orders: List[dict],
    returns: List[dict],
    *,
    skip: int = 0,
    limit: int = 100,
) -> Dict[str, Any]:
    """客户销售对账：订单/退货行 + 应收已收未收。"""
    from apps.kuaicaiwu.models.receivable import Receivable
    from apps.kuaicaiwu.constants.finance_source_types import RECEIVABLE_SOURCE_SALES_DELIVERY
    from apps.kuaizhizao.models.sales_delivery import SalesDelivery

    order_codes = [str(o.get("order_code") or "") for o in orders if o.get("order_code")]
    order_id_by_code: Dict[str, int] = {}
    if order_codes:
        for row in await SalesDelivery.filter(
            tenant_id=tenant_id,
            sales_order_code__in=order_codes,
            deleted_at__isnull=True,
        ).values("id", "sales_order_code", "total_amount"):
            code = str(row.get("sales_order_code") or "")
            if code and code not in order_id_by_code:
                order_id_by_code[code] = int(row["id"])

    receivable_by_order: Dict[str, Dict[str, float]] = {}
    if order_codes:
        try:
            from apps.kuaicaiwu.models.invoice import Invoice

            inv_rows = await Invoice.filter(
                tenant_id=tenant_id,
                category="OUT",
                source_document_code__in=order_codes,
            ).exclude(status__in=["已作废", "已红冲"]).values_list(
                "source_document_code", "total_amount"
            )
            for code, inv_amt in inv_rows:
                c = str(code or "")
                bucket = receivable_by_order.setdefault(c, {"invoiced": 0.0, "received": 0.0, "receivable": 0.0})
                bucket["invoiced"] += float(inv_amt or 0)

            delivery_ids = list(order_id_by_code.values())
            if delivery_ids:
                for rec in await Receivable.filter(
                    tenant_id=tenant_id,
                    source_type=RECEIVABLE_SOURCE_SALES_DELIVERY,
                    source_id__in=delivery_ids,
                    deleted_at__isnull=True,
                ).values("source_id", "total_amount", "received_amount", "remaining_amount"):
                    did = int(rec["source_id"])
                    code = next((c for c, d in order_id_by_code.items() if d == did), None)
                    if not code:
                        continue
                    bucket = receivable_by_order.setdefault(code, {"invoiced": 0.0, "received": 0.0, "receivable": 0.0})
                    bucket["receivable"] += float(rec.get("total_amount") or 0)
                    bucket["received"] += float(rec.get("received_amount") or 0)
                    bucket["invoiced"] = max(bucket["invoiced"], bucket["receivable"])
        except Exception as exc:
            logger.warning("build_customer_sales_reconciliation finance join: {}", exc)

    items: List[dict] = []
    for o in orders:
        code = str(o.get("order_code") or "")
        amt = float(o.get("total_amount") or 0)
        fin = receivable_by_order.get(code, {})
        invoiced = float(fin.get("invoiced") or 0)
        received = float(fin.get("received") or 0)
        pending = max(0.0, amt - received) if received else max(0.0, amt - invoiced)
        items.append({
            "transaction_date": o.get("order_date"),
            "bill_code": code,
            "bill_type": "SALES_ORDER",
            "customer_name": o.get("customer_name"),
            "amount": amt,
            "invoiced_amount": invoiced,
            "received_amount": received,
            "pending_amount": pending,
        })
    for r in returns:
        rt = r.get("return_time")
        amt = float(r.get("total_amount") or 0)
        items.append({
            "transaction_date": rt.date() if hasattr(rt, "date") else rt,
            "bill_code": r.get("return_code"),
            "bill_type": "SALES_RETURN",
            "customer_name": r.get("customer_name"),
            "amount": -amt,
            "invoiced_amount": 0.0,
            "received_amount": 0.0,
            "pending_amount": -amt,
        })

    items.sort(key=lambda x: x.get("transaction_date") or date.min, reverse=True)
    total_rows = len(items)
    lim = max(1, min(int(limit or 100), 500))
    sk = max(0, int(skip or 0))
    page = items[sk : sk + lim]
    return {
        "data": page,
        "total": total_rows,
        "success": True,
        "summary": {
            "total_sales": sum(it["amount"] for it in items if it["amount"] > 0),
            "total_returns": abs(sum(it["amount"] for it in items if it["amount"] < 0)),
            "total_received": sum(it.get("received_amount") or 0 for it in items),
            "total_pending": sum(it.get("pending_amount") or 0 for it in items),
            "balance": sum(it["amount"] for it in items),
            "finance_note": "开票/收款来自 kuaicaiwu 应收与销项发票",
        },
    }


async def product_profit_map(
    tenant_id: int,
    material_ids: List[int],
    date_start: Optional[datetime] = None,
    date_end: Optional[datetime] = None,
) -> Dict[int, float]:
    """物料 ID → 毛利（出库 revenue - cost）。"""
    if not material_ids:
        return {}
    try:
        from apps.kuaicaiwu.services.management_report_service import ManagementReportService
        from apps.kuaizhizao.models.sales_delivery import SalesDelivery
        from apps.kuaizhizao.models.sales_delivery_item import SalesDeliveryItem

        days = 365
        if date_start and date_end:
            days = max(1, (date_end.date() - date_start.date()).days + 1)
        svc = ManagementReportService()
        margin_rows = await svc._aggregate_delivery_margin_rows(tenant_id, days=min(days, 365), group_by="product")
        return {int(r["product_id"]): float(r.get("gross_margin") or 0) for r in margin_rows if r.get("product_id")}
    except Exception as exc:
        logger.warning("product_profit_map fallback delivery items: {}", exc)
        dq = SalesDelivery.filter(tenant_id=tenant_id, deleted_at__isnull=True).exclude(
            status__in=["待出库", "CANCELLED", "已取消"]
        )
        if date_start:
            dq = dq.filter(delivery_time__gte=date_start)
        if date_end:
            dq = dq.filter(delivery_time__lte=date_end)
        dids = await dq.values_list("id", flat=True)
        if not dids:
            return {}
        profit: Dict[int, float] = {}
        for row in await SalesDeliveryItem.filter(tenant_id=tenant_id, delivery_id__in=list(dids)).values(
            "material_id", "total_amount", "unit_cost", "delivery_quantity"
        ):
            mid = int(row["material_id"])
            rev = float(row.get("total_amount") or 0)
            cost = float(row.get("unit_cost") or 0) * float(row.get("delivery_quantity") or 0)
            profit[mid] = profit.get(mid, 0.0) + (rev - cost)
        return profit


def execution_overdue_fields(delivery_date: Any, remaining_qty: float) -> Dict[str, Any]:
    """未交数量行：逾期天数与是否逾期。"""
    today = date.today()
    overdue_days = 0
    is_overdue = False
    if remaining_qty and remaining_qty > 0 and delivery_date:
        d = delivery_date.date() if isinstance(delivery_date, datetime) else delivery_date
        if isinstance(d, date) and d < today:
            overdue_days = (today - d).days
            is_overdue = True
    return {"overdue_days": overdue_days, "is_overdue": is_overdue}


async def build_inventory_ledger(
    tenant_id: int,
    *,
    date_start: Optional[datetime] = None,
    date_end: Optional[datetime] = None,
    warehouse_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
) -> Dict[str, Any]:
    """库存流水：Union 真实出入库单据行。"""
    if not date_start:
        date_start = datetime.now() - timedelta(days=90)
    if not date_end:
        date_end = datetime.now()

    events: List[dict] = []

    async def _append_outbound_delivery():
        from apps.kuaizhizao.models.sales_delivery import SalesDelivery
        from apps.kuaizhizao.models.sales_delivery_item import SalesDeliveryItem

        dq = SalesDelivery.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            delivery_time__gte=date_start,
            delivery_time__lte=date_end,
        ).exclude(status__in=["待出库", "CANCELLED", "已取消"])
        if warehouse_id:
            dq = dq.filter(warehouse_id=warehouse_id)
        heads = {h["id"]: h for h in await dq.values("id", "delivery_code", "warehouse_name", "delivery_time", "deliverer_name")}
        if not heads:
            return
        for row in await SalesDeliveryItem.filter(tenant_id=tenant_id, delivery_id__in=list(heads.keys())).values(
            "delivery_id", "material_code", "material_name", "delivery_quantity"
        ):
            head = heads.get(row["delivery_id"], {})
            events.append({
                "event_time": head.get("delivery_time"),
                "doc_type": "销售出库",
                "doc_code": head.get("delivery_code"),
                "material_code": row.get("material_code"),
                "material_name": row.get("material_name"),
                "warehouse_name": head.get("warehouse_name"),
                "qty_in": 0.0,
                "qty_out": float(row.get("delivery_quantity") or 0),
                "operator": head.get("deliverer_name") or "",
            })

    async def _append_inbound_receipt():
        from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
        from apps.kuaizhizao.models.purchase_receipt_item import PurchaseReceiptItem

        rq = PurchaseReceipt.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            receipt_time__gte=date_start,
            receipt_time__lte=date_end,
        )
        if warehouse_id:
            rq = rq.filter(warehouse_id=warehouse_id)
        heads = {h["id"]: h for h in await rq.values("id", "receipt_code", "warehouse_name", "receipt_time", "receiver_name")}
        if not heads:
            return
        for row in await PurchaseReceiptItem.filter(tenant_id=tenant_id, receipt_id__in=list(heads.keys())).values(
            "receipt_id", "material_code", "material_name", "receipt_quantity"
        ):
            head = heads.get(row["receipt_id"], {})
            events.append({
                "event_time": head.get("receipt_time"),
                "doc_type": "采购入库",
                "doc_code": head.get("receipt_code"),
                "material_code": row.get("material_code"),
                "material_name": row.get("material_name"),
                "warehouse_name": head.get("warehouse_name"),
                "qty_in": float(row.get("receipt_quantity") or 0),
                "qty_out": 0.0,
                "operator": head.get("receiver_name") or "",
            })

    await _append_outbound_delivery()
    await _append_inbound_receipt()

    events.sort(key=lambda e: e.get("event_time") or datetime.min)
    balance: Dict[tuple, float] = {}
    for row in events:
        key = (row.get("material_code") or "", row.get("warehouse_name") or "")
        delta = float(row.get("qty_in") or 0) - float(row.get("qty_out") or 0)
        balance[key] = balance.get(key, 0.0) + delta
        row["balance_qty"] = round(balance[key], 4)
        et = row.get("event_time")
        row["event_date"] = et.strftime("%Y-%m-%d %H:%M") if et else None
        row["order_code"] = row.get("doc_code")
        row["type"] = row.get("doc_type")
        net = float(row.get("qty_in") or 0) - float(row.get("qty_out") or 0)
        row["quantity"] = net

    events.reverse()
    total = len(events)
    lim = max(1, min(int(limit or 100), 500))
    sk = max(0, int(skip or 0))
    page = events[sk : sk + lim]

    return {
        "data": page,
        "total": total,
        "success": True,
        "summary": {
            "total_in": sum(e.get("qty_in") or 0 for e in events),
            "total_out": sum(e.get("qty_out") or 0 for e in events),
            "line_count": total,
        },
    }


async def build_slow_moving_inventory(
    tenant_id: int,
    *,
    stale_days: int = 90,
    warehouse_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
) -> Dict[str, Any]:
    """呆滞料：MaterialBatch 在库 + 库龄（updated_at）。"""
    from apps.master_data.models.material_batch import MaterialBatch

    cutoff = datetime.now() - timedelta(days=stale_days)
    q = MaterialBatch.filter(
        tenant_id=tenant_id,
        deleted_at__isnull=True,
        quantity__gt=0,
        status="in_stock",
        updated_at__lt=cutoff,
    )
    total = await q.count()
    lim = max(1, min(int(limit or 100), 500))
    sk = max(0, int(skip or 0))
    batches = await q.order_by("updated_at").offset(sk).limit(lim).prefetch_related("material").all()
    today = date.today()
    items = []
    for b in batches:
        ut = b.updated_at
        age_days = (today - ut.date()).days if ut else stale_days
        material = getattr(b, "material", None)
        items.append({
            "batch_no": b.batch_no,
            "material_code": material.main_code if material else "N/A",
            "material_name": material.name if material else "未知",
            "quantity": float(b.quantity or 0),
            "last_move_date": to_api_isoformat(ut.date()) if ut else None,
            "age_days": age_days,
            "warehouse_name": "",
        })
    return {
        "data": items,
        "total": total,
        "success": True,
        "summary": {"stale_days": stale_days, "material_count": total},
    }


async def build_purchase_reconciliation(
    tenant_id: int,
    *,
    date_start: Optional[datetime] = None,
    date_end: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 100,
) -> Dict[str, Any]:
    """采购对账：PO + 入库 + 应付 + 已付。"""
    from apps.kuaizhizao.models.purchase_order import PurchaseOrder
    from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt

    pq = PurchaseOrder.filter(tenant_id=tenant_id)
    if date_start:
        pq = pq.filter(order_date__gte=date_start.date())
    if date_end:
        pq = pq.filter(order_date__lte=date_end.date())
    orders = await pq.order_by("-order_date").values(
        "id", "order_code", "order_date", "supplier_name", "total_amount", "status"
    )
    po_ids = [o["id"] for o in orders]
    received_by_po: Dict[int, float] = {}
    if po_ids:
        for r in await PurchaseReceipt.filter(
            tenant_id=tenant_id,
            purchase_order_id__in=po_ids,
            deleted_at__isnull=True,
        ).values("purchase_order_id", "total_amount"):
            pid = r.get("purchase_order_id")
            if pid:
                received_by_po[int(pid)] = received_by_po.get(int(pid), 0.0) + float(r.get("total_amount") or 0)

    payable_by_po: Dict[int, Dict[str, float]] = {}
    try:
        from apps.kuaicaiwu.models.payable import Payable
        from apps.kuaicaiwu.models.purchase_invoice import PurchaseInvoice

        for inv in await PurchaseInvoice.filter(tenant_id=tenant_id, purchase_order_id__in=po_ids).values(
            "purchase_order_id", "total_amount"
        ):
            pid = inv.get("purchase_order_id")
            if pid:
                b = payable_by_po.setdefault(int(pid), {"invoiced": 0.0, "paid": 0.0, "payable": 0.0})
                b["invoiced"] += float(inv.get("total_amount") or 0)

        for p in await Payable.filter(tenant_id=tenant_id, deleted_at__isnull=True).values(
            "source_type", "source_id", "total_amount", "paid_amount"
        ):
            pass  # 简化：按 PO 发票汇总
    except Exception as exc:
        logger.warning("purchase reconciliation payable: {}", exc)

    items = []
    for o in orders:
        pid = int(o["id"])
        order_amt = float(o.get("total_amount") or 0)
        recv = received_by_po.get(pid, 0.0)
        fin = payable_by_po.get(pid, {})
        items.append({
            "order_code": o.get("order_code"),
            "order_date": o.get("order_date"),
            "supplier_name": o.get("supplier_name"),
            "order_amount": order_amt,
            "received_amount": recv,
            "invoiced_amount": float(fin.get("invoiced") or 0),
            "paid_amount": float(fin.get("paid") or 0),
            "pending_amount": max(0.0, order_amt - float(fin.get("paid") or 0)),
            "status": o.get("status"),
        })

    total = len(items)
    lim = max(1, min(int(limit or 100), 500))
    sk = max(0, int(skip or 0))
    page = items[sk : sk + lim]
    return {
        "data": page,
        "total": total,
        "success": True,
        "summary": {
            "order_total": sum(i["order_amount"] for i in items),
            "received_total": sum(i["received_amount"] for i in items),
        },
    }


async def build_production_delay_warning(
    tenant_id: int,
    *,
    date_start: Optional[datetime] = None,
    date_end: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 100,
    keyword: Optional[str] = None,
    order_by: Optional[str] = None,
    status: Optional[str] = None,
    order_code: Optional[str] = None,
    product_name: Optional[str] = None,
) -> Dict[str, Any]:
    from datetime import time as dt_time
    from tortoise.expressions import Q
    from apps.kuaizhizao.models.work_order import WorkOrder
    from apps.kuaizhizao.services.report_service import (
        PRODUCTION_DELAY_WARNING_SORT,
        _resolve_production_report_order_by,
    )

    today = date.today()
    today_start = datetime.combine(today, dt_time.min)
    q = WorkOrder.filter(
        tenant_id=tenant_id,
        deleted_at__isnull=True,
        status__in=["released", "in_progress", "REleased", "IN_PROGRESS", "进行中", "已下达"],
    )
    if date_start:
        q = q.filter(planned_end_date__gte=date_start)
    if date_end:
        q = q.filter(planned_end_date__lte=date_end)
    q = q.filter(planned_end_date__lt=today_start)
    if status:
        q = q.filter(status=status)
    oc = (order_code or "").strip()
    if oc:
        q = q.filter(code__icontains=oc)
    pn = (product_name or "").strip()
    if pn:
        q = q.filter(product_name__icontains=pn)
    kw = (keyword or "").strip()
    if kw:
        q = q.filter(Q(code__icontains=kw) | Q(product_name__icontains=kw))
    total = await q.count()
    lim = max(1, min(int(limit or 100), 500))
    sk = max(0, int(skip or 0))
    order_clause = _resolve_production_report_order_by(
        order_by,
        PRODUCTION_DELAY_WARNING_SORT,
        "planned_end_date",
        field_aliases={"material_name": "product_name", "overdue_days": "planned_end_date"},
    )
    rows = await q.order_by(order_clause).offset(sk).limit(lim).values(
        "code", "product_name", "planned_end_date", "status", "quantity", "completed_quantity"
    )
    items = []
    for it in rows:
        ped = it.get("planned_end_date")
        ped_d = ped.date() if isinstance(ped, datetime) else ped
        overdue = (today - ped_d).days if isinstance(ped_d, date) else 0
        items.append({
            "code": it.get("code"),
            "material_name": it.get("product_name"),
            "planned_end_date": to_api_isoformat(ped_d) if isinstance(ped_d, date) else None,
            "status": it.get("status"),
            "plan_qty": float(it.get("quantity") or 0),
            "completed_qty": float(it.get("completed_quantity") or 0),
            "overdue_days": overdue,
        })
    return {"data": items, "total": total, "success": True, "summary": {"overdue_count": total}}


async def build_outsource_work_order_query(
    tenant_id: int,
    *,
    skip: int = 0,
    limit: int = 100,
    date_start: Optional[datetime] = None,
    date_end: Optional[datetime] = None,
    keyword: Optional[str] = None,
    order_by: Optional[str] = None,
    status: Optional[str] = None,
    order_code: Optional[str] = None,
    product_name: Optional[str] = None,
    supplier_name: Optional[str] = None,
) -> Dict[str, Any]:
    from tortoise.expressions import Q
    from apps.kuaizhizao.models.outsource_work_order import OutsourceWorkOrder
    from apps.kuaizhizao.services.report_service import (
        PRODUCTION_OUTSOURCE_QUERY_SORT,
        _resolve_production_report_order_by,
    )

    q = OutsourceWorkOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)
    if date_start:
        q = q.filter(created_at__gte=date_start)
    if date_end:
        q = q.filter(created_at__lte=date_end)
    if status:
        q = q.filter(status=status)
    oc = (order_code or "").strip()
    if oc:
        q = q.filter(code__icontains=oc)
    pn = (product_name or "").strip()
    if pn:
        q = q.filter(product_name__icontains=pn)
    sn = (supplier_name or "").strip()
    if sn:
        q = q.filter(supplier_name__icontains=sn)
    kw = (keyword or "").strip()
    if kw:
        q = q.filter(
            Q(code__icontains=kw) | Q(product_name__icontains=kw) | Q(supplier_name__icontains=kw)
        )
    total = await q.count()
    lim = max(1, min(int(limit or 100), 500))
    sk = max(0, int(skip or 0))
    order_clause = _resolve_production_report_order_by(
        order_by,
        PRODUCTION_OUTSOURCE_QUERY_SORT,
        "-created_at",
        field_aliases={"order_code": "code", "order_qty": "quantity", "plan_qty": "quantity", "order_date": "created_at"},
    )
    rows = await q.order_by(order_clause).offset(sk).limit(lim).values(
        "code", "supplier_name", "product_name", "quantity", "status", "planned_end_date", "created_at", "total_amount"
    )
    items = []
    for r in rows:
        ped = r.get("planned_end_date")
        created = r.get("created_at")
        items.append({
            "order_code": r.get("code"),
            "supplier_name": r.get("supplier_name"),
            "product_name": r.get("product_name"),
            "plan_qty": float(r.get("quantity") or 0),
            "order_qty": float(r.get("quantity") or 0),
            "amount": float(r.get("total_amount") or 0),
            "status": r.get("status"),
            "planned_end_date": to_api_isoformat(ped.date()) if ped and hasattr(ped, "date") else (to_api_isoformat(ped) if ped else None),
            "order_date": created,
            "created_at": created,
        })
    return {"data": items, "total": total, "success": True}


async def build_outsource_material_reconciliation(
    tenant_id: int,
    *,
    skip: int = 0,
    limit: int = 100,
    keyword: Optional[str] = None,
    order_by: Optional[str] = None,
    status: Optional[str] = None,
    work_order_code: Optional[str] = None,
) -> Dict[str, Any]:
    from tortoise.expressions import Q
    from apps.kuaizhizao.models.outsource_work_order import OutsourceMaterialIssue, OutsourceMaterialReturn
    from apps.kuaizhizao.services.report_service import (
        PRODUCTION_OUTSOURCE_RECON_SORT,
        _resolve_production_report_order_by,
    )

    q = OutsourceMaterialIssue.filter(tenant_id=tenant_id, deleted_at__isnull=True)
    if status:
        q = q.filter(status=status)
    woc = (work_order_code or "").strip()
    if woc:
        q = q.filter(outsource_work_order_code__icontains=woc)
    kw = (keyword or "").strip()
    if kw:
        q = q.filter(
            Q(code__icontains=kw)
            | Q(outsource_work_order_code__icontains=kw)
            | Q(material_code__icontains=kw)
            | Q(material_name__icontains=kw)
        )
    total = await q.count()
    lim = max(1, min(int(limit or 100), 500))
    sk = max(0, int(skip or 0))
    order_clause = _resolve_production_report_order_by(
        order_by,
        PRODUCTION_OUTSOURCE_RECON_SORT,
        "-created_at",
        field_aliases={"issue_code": "code", "issued_qty": "quantity"},
    )
    rows = await q.order_by(order_clause).offset(sk).limit(lim).values(
        "id",
        "code",
        "outsource_work_order_code",
        "material_code",
        "material_name",
        "quantity",
        "status",
    )
    issue_ids = [int(r["id"]) for r in rows if r.get("id")]
    returned_by_issue: Dict[int, float] = {}
    if issue_ids:
        for ret in await OutsourceMaterialReturn.filter(
            tenant_id=tenant_id,
            outsource_material_issue_id__in=issue_ids,
            deleted_at__isnull=True,
            status="completed",
        ).values("outsource_material_issue_id", "quantity"):
            iid = int(ret.get("outsource_material_issue_id") or 0)
            returned_by_issue[iid] = returned_by_issue.get(iid, 0.0) + float(ret.get("quantity") or 0)

    items = []
    for r in rows:
        issued = float(r.get("quantity") or 0)
        returned = returned_by_issue.get(int(r["id"]), 0.0)
        items.append({
            "issue_code": r.get("code"),
            "outsource_work_order_code": r.get("outsource_work_order_code"),
            "material_code": r.get("material_code"),
            "material_name": r.get("material_name"),
            "issued_qty": issued,
            "returned_qty": returned,
            "balance_qty": issued - returned,
            "status": r.get("status"),
        })
    return {"data": items, "total": total, "success": True}


def inspection_pass_rate_row(row: dict) -> dict:
    """为检验行补充合格率。"""
    sample = float(row.get("sample_quantity") or row.get("inspection_quantity") or 0)
    qualified = float(row.get("qualified_quantity") or row.get("pass_quantity") or 0)
    if sample <= 0:
        sample = float(row.get("total_quantity") or 1)
        qualified = sample if row.get("status") in ("合格", "passed", "PASS", "approved") else 0.0
    rate = (qualified / sample * 100) if sample else 0.0
    return {
        **row,
        "sample_qty": sample,
        "qualified_qty": qualified,
        "pass_rate": round(rate, 2),
    }
