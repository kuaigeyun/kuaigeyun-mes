"""
快制造报表增强逻辑（对账、流水、毛利、委外等）。

从 report_service 抽离，避免单文件持续膨胀。
"""

from __future__ import annotations

from datetime import datetime, timedelta, date
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from loguru import logger
from core.utils.timezone_utils import (
    coerce_business_datetime_to_utc,
    resolve_business_datetime,
    site_day_bounds_utc,
    to_api_isoformat,
    to_site_date,
)

# 与前端 UNI_REPORT_PAGE_SIZE_ALL 一致：报表分页「全部」上限
REPORT_LIST_MAX_LIMIT = 10_000


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
            "row_key": f"SALES_ORDER:{code}",
            "transaction_date": o.get("order_date"),
            "bill_code": code,
            "bill_type": "SALES_ORDER",
            "customer_id": o.get("customer_id"),
            "customer_code": o.get("customer_code") or "",
            "customer_name": o.get("customer_name"),
            "salesman_name": o.get("salesman_name") or "",
            "amount": amt,
            "invoiced_amount": invoiced,
            "received_amount": received,
            "pending_amount": pending,
        })
    for r in returns:
        rt = r.get("return_time")
        amt = float(r.get("total_amount") or 0)
        items.append({
            "row_key": f"SALES_RETURN:{r.get('return_code') or ''}",
            "transaction_date": rt.date() if hasattr(rt, "date") else rt,
            "bill_code": r.get("return_code"),
            "bill_type": "SALES_RETURN",
            "customer_id": r.get("customer_id"),
            "customer_code": r.get("customer_code") or "",
            "customer_name": r.get("customer_name"),
            "salesman_name": r.get("salesman_name") or "",
            "amount": -amt,
            "invoiced_amount": 0.0,
            "received_amount": 0.0,
            "pending_amount": -amt,
        })

    items.sort(key=lambda x: x.get("transaction_date") or date.min, reverse=True)
    return {
        "data": items,
        "total": len(items),
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


def _ledger_balance_key(row: dict) -> tuple:
    """结存按「物料+仓库」累计；优先稳定 ID，避免名称空值导致每行各自起算。"""
    mid = row.get("material_id")
    wid = row.get("warehouse_id")
    material_key: Any = int(mid) if mid is not None else (str(row.get("material_code") or "").strip() or "")
    warehouse_key: Any = int(wid) if wid is not None else (str(row.get("warehouse_name") or "").strip() or "")
    return (material_key, warehouse_key)


def _report_calendar_day(value: Optional[datetime]) -> date:
    """API 传入的 YYYY-MM-DD 按站点日历日理解，禁止把 naive 墙钟当 UTC。"""
    if value is None:
        return to_site_date(resolve_business_datetime())
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.date()
        return to_site_date(value)
    return value


def resolve_inventory_report_period(
    date_start: Optional[datetime],
    date_end: Optional[datetime],
    *,
    default_start_days: Optional[int] = None,
) -> Tuple[datetime, datetime]:
    """收发存/台账期间：站点日历日 → UTC [start, end)。"""
    now = resolve_business_datetime()
    end_day = _report_calendar_day(date_end)
    if date_start is None:
        if default_start_days is not None:
            start_day = to_site_date(now - timedelta(days=default_start_days))
        else:
            today = to_site_date(now)
            start_day = today.replace(day=1)
    else:
        start_day = _report_calendar_day(date_start)
    start_utc, _ = site_day_bounds_utc(start_day)
    _, end_exclusive = site_day_bounds_utc(end_day)
    return start_utc, end_exclusive


def _event_time_utc(event_time: Any) -> Optional[datetime]:
    if event_time is None:
        return None
    if isinstance(event_time, datetime):
        if event_time.tzinfo is None:
            return coerce_business_datetime_to_utc(event_time)
        return event_time
    return None


async def collect_inventory_movement_events(
    tenant_id: int,
    *,
    date_start: datetime,
    date_end: Optional[datetime] = None,
    warehouse_id: Optional[int] = None,
    material_id: Optional[int] = None,
) -> List[dict]:
    """
    收发存/台账共用流水。
    date_start / date_end 为 UTC，date_end 为开区间上界；None 表示不截尾。
    采销走单据，流水排除 purchase_receipt / sales_delivery，避免双计。
    """
    events: List[dict] = []

    async def _append_outbound_delivery():
        from apps.kuaizhizao.models.sales_delivery import SalesDelivery
        from apps.kuaizhizao.models.sales_delivery_item import SalesDeliveryItem

        dq = SalesDelivery.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            delivery_time__gte=date_start,
        ).exclude(status__in=["待出库", "CANCELLED", "已取消"])
        if date_end is not None:
            dq = dq.filter(delivery_time__lt=date_end)
        if warehouse_id:
            dq = dq.filter(warehouse_id=warehouse_id)
        heads = {
            h["id"]: h
            for h in await dq.values(
                "id", "delivery_code", "warehouse_id", "warehouse_name", "delivery_time", "deliverer_name"
            )
        }
        if not heads:
            return
        item_q = SalesDeliveryItem.filter(tenant_id=tenant_id, delivery_id__in=list(heads.keys()))
        if material_id:
            item_q = item_q.filter(material_id=material_id)
        for row in await item_q.values(
            "delivery_id", "material_id", "material_code", "material_name", "delivery_quantity"
        ):
            head = heads.get(row["delivery_id"], {})
            events.append({
                "event_time": head.get("delivery_time"),
                "doc_type": "销售出库",
                "doc_code": head.get("delivery_code"),
                "material_id": row.get("material_id"),
                "material_code": row.get("material_code"),
                "material_name": row.get("material_name"),
                "warehouse_id": head.get("warehouse_id"),
                "warehouse_name": head.get("warehouse_name") or "",
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
        )
        if date_end is not None:
            rq = rq.filter(receipt_time__lt=date_end)
        if warehouse_id:
            rq = rq.filter(warehouse_id=warehouse_id)
        heads = {
            h["id"]: h
            for h in await rq.values(
                "id", "receipt_code", "warehouse_id", "warehouse_name", "receipt_time", "receiver_name"
            )
        }
        if not heads:
            return
        item_q = PurchaseReceiptItem.filter(tenant_id=tenant_id, receipt_id__in=list(heads.keys()))
        if material_id:
            item_q = item_q.filter(material_id=material_id)
        for row in await item_q.values(
            "receipt_id", "material_id", "material_code", "material_name", "receipt_quantity"
        ):
            head = heads.get(row["receipt_id"], {})
            events.append({
                "event_time": head.get("receipt_time"),
                "doc_type": "采购入库",
                "doc_code": head.get("receipt_code"),
                "material_id": row.get("material_id"),
                "material_code": row.get("material_code"),
                "material_name": row.get("material_name"),
                "warehouse_id": head.get("warehouse_id"),
                "warehouse_name": head.get("warehouse_name") or "",
                "qty_in": float(row.get("receipt_quantity") or 0),
                "qty_out": 0.0,
                "operator": head.get("receiver_name") or "",
            })

    async def _append_production_movements():
        from apps.kuaizhizao.models.material_stock_movement import MaterialStockMovement

        type_labels = {
            "staging_to_line": "线边备料",
            "production_issue": "生产领料",
            "production_return": "生产退料",
            "backflush_consume": "报工倒冲",
            "semi_fg_receipt": "半成品入库",
            "fg_receipt": "成品入库",
            "scrap": "报废",
            "transfer": "调拨",
            "outsource_issue": "委外发料",
            "outsource_receipt": "委外收货",
            "adjust": "库存调整",
            "other_inbound": "其他入库",
            "other_outbound": "其他出库",
        }
        mq = MaterialStockMovement.filter(
            tenant_id=tenant_id,
            created_at__gte=date_start,
        )
        if date_end is not None:
            mq = mq.filter(created_at__lt=date_end)
        mq = mq.exclude(movement_type__in=["purchase_receipt", "sales_delivery"])
        if material_id:
            mq = mq.filter(material_id=material_id)
        rows = await mq.order_by("created_at", "id").all()
        for r in rows:
            qty = float(r.quantity or 0)
            bal_wh = r.balance_warehouse_id
            if warehouse_id is not None:
                if bal_wh != warehouse_id and r.from_warehouse_id != warehouse_id and r.to_warehouse_id != warehouse_id:
                    continue
            wh_id = bal_wh or r.from_warehouse_id or r.to_warehouse_id
            wh_name = (
                (r.from_warehouse_name if bal_wh == r.from_warehouse_id else None)
                or (r.to_warehouse_name if bal_wh == r.to_warehouse_id else None)
                or r.from_warehouse_name
                or r.to_warehouse_name
                or ""
            )
            events.append({
                "event_time": r.created_at,
                "doc_type": type_labels.get(r.movement_type, r.movement_type or "库存移动"),
                "doc_code": r.source_doc_code or "",
                "material_id": r.material_id,
                "material_code": r.material_code or "",
                "material_name": "",
                "warehouse_id": wh_id,
                "warehouse_name": wh_name,
                "qty_in": qty if qty > 0 else 0.0,
                "qty_out": abs(qty) if qty < 0 else 0.0,
                "operator": r.operator_name or "",
            })

    await _append_outbound_delivery()
    await _append_inbound_receipt()
    await _append_production_movements()
    return events


async def build_inventory_summary(
    tenant_id: int,
    current_balances: List[Dict[str, Any]],
    *,
    date_start: Optional[datetime] = None,
    date_end: Optional[datetime] = None,
    warehouse_id: Optional[int] = None,
    keyword: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> Dict[str, Any]:
    """
    收发存汇总：期末=期间截止日结存，本期入/出=期间流水，期初=期末-入+出。
    当前批次/线边为「此刻」结存，期间之后的流水回拨到截止日。
    """
    start_utc, end_exclusive = resolve_inventory_report_period(date_start, date_end)
    events = await collect_inventory_movement_events(
        tenant_id,
        date_start=start_utc,
        date_end=None,
        warehouse_id=warehouse_id,
    )

    period: Dict[tuple, Dict[str, float]] = {}
    post: Dict[tuple, Dict[str, float]] = {}
    meta: Dict[tuple, Dict[str, Any]] = {}

    def _touch(store: Dict[tuple, Dict[str, float]], key: tuple) -> Dict[str, float]:
        if key not in store:
            store[key] = {"qty_in": 0.0, "qty_out": 0.0}
        return store[key]

    def _remember(key: tuple, row: Dict[str, Any]) -> None:
        cur = meta.get(key) or {}
        if row.get("material_code") and not cur.get("material_code"):
            cur["material_code"] = row.get("material_code")
        if row.get("material_name") and not cur.get("material_name"):
            cur["material_name"] = row.get("material_name")
        if row.get("warehouse_name") and not cur.get("warehouse_name"):
            cur["warehouse_name"] = row.get("warehouse_name")
        cur.setdefault("material_id", row.get("material_id"))
        cur.setdefault("warehouse_id", row.get("warehouse_id"))
        meta[key] = cur

    for bal in current_balances:
        key = _ledger_balance_key(bal)
        _remember(key, bal)
        meta[key]["current_qty"] = meta[key].get("current_qty", 0.0) + float(bal.get("quantity") or 0)

    for ev in events:
        key = _ledger_balance_key(ev)
        _remember(key, ev)
        et = _event_time_utc(ev.get("event_time"))
        bucket = period if et is None or et < end_exclusive else post
        rec = _touch(bucket, key)
        rec["qty_in"] += float(ev.get("qty_in") or 0)
        rec["qty_out"] += float(ev.get("qty_out") or 0)

    missing_ids = [
        int(info["material_id"])
        for info in meta.values()
        if info.get("material_id") and not str(info.get("material_name") or "").strip()
    ]
    if missing_ids:
        from apps.master_data.models.material import Material

        for row in await Material.filter(
            tenant_id=tenant_id, id__in=list(set(missing_ids)), deleted_at__isnull=True
        ).values("id", "main_code", "name"):
            mid = int(row["id"])
            for key, info in meta.items():
                if int(info.get("material_id") or 0) != mid:
                    continue
                if not info.get("material_code"):
                    info["material_code"] = row.get("main_code") or ""
                if not info.get("material_name"):
                    info["material_name"] = row.get("name") or ""

    items: List[Dict[str, Any]] = []
    for key, info in meta.items():
        current_qty = float(info.get("current_qty") or 0)
        post_in = float(post.get(key, {}).get("qty_in") or 0)
        post_out = float(post.get(key, {}).get("qty_out") or 0)
        inbound = float(period.get(key, {}).get("qty_in") or 0)
        outbound = float(period.get(key, {}).get("qty_out") or 0)
        closing = current_qty - post_in + post_out
        opening = closing - inbound + outbound
        if opening == 0 and inbound == 0 and outbound == 0 and closing == 0:
            continue
        wid = info.get("warehouse_id")
        items.append({
            "id": f"{info.get('material_id') or key[0]}:{wid if wid is not None else 'none'}",
            "material_id": info.get("material_id"),
            "material_code": info.get("material_code") or "",
            "material_name": info.get("material_name") or "",
            "warehouse_id": wid,
            "warehouse_name": str(info.get("warehouse_name") or "").strip() or "未配置仓库",
            "opening_qty": round(opening, 4),
            "inbound_qty": round(inbound, 4),
            "outbound_qty": round(outbound, 4),
            "closing_qty": round(closing, 4),
        })

    kw = (keyword or "").strip().lower()
    if kw:
        items = [
            it
            for it in items
            if kw in str(it.get("material_code") or "").lower()
            or kw in str(it.get("material_name") or "").lower()
            or kw in str(it.get("warehouse_name") or "").lower()
        ]

    items.sort(key=lambda it: (str(it.get("material_code") or ""), str(it.get("warehouse_name") or "")))
    return {
        "data": items,
        "success": True,
        "summary": {
            "opening_qty": round(sum(it["opening_qty"] for it in items), 4),
            "inbound_qty": round(sum(it["inbound_qty"] for it in items), 4),
            "outbound_qty": round(sum(it["outbound_qty"] for it in items), 4),
            "closing_qty": round(sum(it["closing_qty"] for it in items), 4),
        },
    }


async def build_inventory_ledger(
    tenant_id: int,
    *,
    date_start: Optional[datetime] = None,
    date_end: Optional[datetime] = None,
    warehouse_id: Optional[int] = None,
    material_id: Optional[int] = None,
    keyword: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> Dict[str, Any]:
    """库存收发明细：按物料+仓库滚动结存（非跨物料合计）。"""
    start_utc, end_exclusive = resolve_inventory_report_period(
        date_start, date_end, default_start_days=90,
    )
    events = await collect_inventory_movement_events(
        tenant_id,
        date_start=start_utc,
        date_end=end_exclusive,
        warehouse_id=warehouse_id,
        material_id=material_id,
    )
    kw = (keyword or "").strip().lower()

    # 时间正序滚动结存，再倒序展示（新在前）
    events.sort(
        key=lambda e: (
            e.get("event_time") or datetime.min,
            int(e.get("material_id") or 0),
            str(e.get("doc_code") or ""),
        )
    )
    balance: Dict[tuple, float] = {}
    for idx, row in enumerate(events):
        key = _ledger_balance_key(row)
        delta = float(row.get("qty_in") or 0) - float(row.get("qty_out") or 0)
        balance[key] = balance.get(key, 0.0) + delta
        row["balance_qty"] = round(balance[key], 4)
        et = row.get("event_time")
        row["event_date"] = et.strftime("%Y-%m-%d %H:%M") if et else None
        row["order_code"] = row.get("doc_code")
        row["type"] = row.get("doc_type")
        row["quantity"] = delta
        row["id"] = (
            f"{row.get('doc_code') or ''}:{row.get('material_id') or row.get('material_code') or ''}:"
            f"{row.get('warehouse_id') or ''}:{idx}"
        )

    # 关键词仅影响展示，不打断结存累计
    if kw:
        events = [
            e
            for e in events
            if kw in str(e.get("material_code") or "").lower()
            or kw in str(e.get("material_name") or "").lower()
            or kw in str(e.get("doc_code") or "").lower()
            or kw in str(e.get("warehouse_name") or "").lower()
        ]

    events.reverse()

    return {
        "data": events,
        "success": True,
        "summary": {
            "total_in": sum(e.get("qty_in") or 0 for e in events),
            "total_out": sum(e.get("qty_out") or 0 for e in events),
            "line_count": len(events),
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

    cutoff = resolve_business_datetime() - timedelta(days=stale_days)
    q = MaterialBatch.filter(
        tenant_id=tenant_id,
        deleted_at__isnull=True,
        quantity__gt=0,
        status="in_stock",
        updated_at__lt=cutoff,
    )
    total = await q.count()
    batches = await q.order_by("updated_at").prefetch_related("material").all()
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
        "success": True,
        "summary": {"stale_days": stale_days, "material_count": total},
    }


async def build_fifo_exception_audit(
    tenant_id: int,
    *,
    date_start: Optional[datetime] = None,
    date_end: Optional[datetime] = None,
    warehouse_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
) -> Dict[str, Any]:
    """
    FIFO 例外抽查：出库（流水数量为负）时，按当前 fifo_mode 仍存在更应先出的批次余额。

    以 MaterialStockMovement 滚动重建批号余额；专供审厂导出，非实时拦截列表。
    """
    from apps.kuaizhizao.models.material_stock_movement import MaterialStockMovement
    from apps.kuaizhizao.services.fifo_policy import (
        fifo_mode_label,
        is_batch_before,
        normalize_fifo_mode,
        resolve_fifo_settings,
    )
    from apps.master_data.models.material_batch import MaterialBatch
    from infra.services.business_config_service import BusinessConfigService

    cfg = await BusinessConfigService().get_business_config(tenant_id)
    _, fifo_mode = resolve_fifo_settings(cfg)
    fifo_mode = normalize_fifo_mode(fifo_mode)
    mode_label = fifo_mode_label(fifo_mode)

    now = resolve_business_datetime()
    end_at = date_end if date_end is not None else now
    start_at = date_start if date_start is not None else (end_at - timedelta(days=90))

    outbound_q = MaterialStockMovement.filter(
        tenant_id=tenant_id,
        created_at__gte=start_at,
        created_at__lte=end_at,
        quantity__lt=0,
    )
    if warehouse_id:
        wid = int(warehouse_id)
        outbound_q = outbound_q.filter(balance_warehouse_id=wid)

    outbound_material_ids = list(
        {
            int(mid)
            for mid in await outbound_q.limit(5000).values_list("material_id", flat=True)
            if mid
        }
    )
    if not outbound_material_ids:
        return {
            "data": [],
            "total": 0,
            "success": True,
            "summary": {
                "exception_count": 0,
                "fifo_mode": fifo_mode,
                "scanned_outbound": 0,
            },
        }

    # 余额重建需窗口前入库，向前多取一年流水
    history_start = start_at - timedelta(days=365)
    hist_q = MaterialStockMovement.filter(
        tenant_id=tenant_id,
        material_id__in=outbound_material_ids,
        created_at__gte=history_start,
        created_at__lte=end_at,
    )
    if warehouse_id:
        hist_q = hist_q.filter(balance_warehouse_id=int(warehouse_id))

    history = (
        await hist_q.order_by("created_at", "id")
        .limit(30000)
        .values(
            "id",
            "material_id",
            "material_code",
            "batch_no",
            "quantity",
            "created_at",
            "source_doc_type",
            "source_doc_code",
            "from_warehouse_name",
            "balance_warehouse_id",
            "operator_name",
        )
    )
    if not history:
        return {
            "data": [],
            "total": 0,
            "success": True,
            "summary": {
                "exception_count": 0,
                "fifo_mode": fifo_mode,
                "scanned_outbound": 0,
            },
        }

    material_ids = sorted({int(r["material_id"]) for r in history if r.get("material_id")})
    batches = await MaterialBatch.filter(
        tenant_id=tenant_id,
        deleted_at__isnull=True,
        material_id__in=material_ids,
    ).prefetch_related("material").all()

    batches_by_mat: Dict[int, List[Any]] = {}
    batch_by_mat_bn: Dict[Tuple[int, str], Any] = {}
    for b in batches:
        mid = int(b.material_id)
        bn = str(b.batch_no or "").strip() or "DEFAULT"
        batches_by_mat.setdefault(mid, []).append(b)
        batch_by_mat_bn[(mid, bn)] = b

    bal: Dict[Tuple[int, str], float] = {}
    exceptions: List[Dict[str, Any]] = []
    scanned_outbound = 0
    eps = 1e-6

    for row in history:
        mid = int(row["material_id"] or 0)
        if mid <= 0:
            continue
        bn = str(row.get("batch_no") or "").strip() or "DEFAULT"
        qty = float(row.get("quantity") or 0)
        key = (mid, bn)
        bal[key] = bal.get(key, 0.0) + qty

        created = row.get("created_at")
        in_window = True
        if created is not None:
            in_window = created >= start_at and created <= end_at
        if not in_window or qty >= -eps:
            continue

        scanned_outbound += 1
        issued = batch_by_mat_bn.get(key)
        if issued is None:
            continue

        older = None
        older_qty = 0.0
        for sibling in batches_by_mat.get(mid, []):
            if int(getattr(sibling, "id", 0) or 0) == int(getattr(issued, "id", 0) or 0):
                continue
            if not is_batch_before(sibling, issued, fifo_mode):
                continue
            sbn = str(sibling.batch_no or "").strip() or "DEFAULT"
            sq = bal.get((mid, sbn), 0.0)
            if sq > eps:
                older = sibling
                older_qty = sq
                break
        if older is None:
            continue

        material = getattr(issued, "material", None) or getattr(older, "material", None)
        exceptions.append(
            {
                "id": int(row["id"]),
                "event_at": to_api_isoformat(created) if created else None,
                "material_id": mid,
                "material_code": (material.main_code if material else None)
                or row.get("material_code")
                or "N/A",
                "material_name": material.name if material else "未知",
                "issued_batch_no": bn,
                "issued_qty": abs(qty),
                "preferred_batch_no": str(older.batch_no or "").strip() or "DEFAULT",
                "preferred_batch_qty_at_event": round(older_qty, 4),
                "preferred_production_date": to_api_isoformat(older.production_date)
                if older.production_date
                else None,
                "preferred_expiry_date": to_api_isoformat(older.expiry_date)
                if older.expiry_date
                else None,
                "fifo_mode": fifo_mode,
                "fifo_mode_label": mode_label,
                "source_doc_type": row.get("source_doc_type"),
                "source_doc_code": row.get("source_doc_code"),
                "warehouse_name": row.get("from_warehouse_name") or "",
                "operator_name": row.get("operator_name") or "",
            }
        )

    total = len(exceptions)
    lim = max(1, min(int(limit or 100), REPORT_LIST_MAX_LIMIT))
    sk = max(0, int(skip or 0))
    return {
        "data": exceptions,
        "total": total,
        "success": True,
        "summary": {
            "exception_count": total,
            "fifo_mode": fifo_mode,
            "scanned_outbound": scanned_outbound,
        },
    }


async def build_purchase_reconciliation(
    tenant_id: int,
    *,
    date_start: Optional[datetime] = None,
    date_end: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    supplier_name: Optional[str] = None,
    order_ids: Optional[List[int]] = None,
) -> Dict[str, Any]:
    """采购对账：PO + 入库 + 发票 + 应付已付。"""
    from apps.kuaicaiwu.models.payable import Payable
    from apps.kuaicaiwu.models.purchase_invoice import PurchaseInvoice
    from apps.kuaizhizao.models.purchase_order import PurchaseOrder
    from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
    from apps.kuaizhizao.services.report_service import ReportService

    pq = PurchaseOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)
    if order_ids is not None:
        if not order_ids:
            return {
                "data": [],
                "total": 0,
                "success": True,
                "summary": {
                    "order_amount": 0.0,
                    "received_amount": 0.0,
                    "invoiced_amount": 0.0,
                    "paid_amount": 0.0,
                    "pending_amount": 0.0,
                },
            }
        pq = pq.filter(id__in=order_ids)
    if date_start:
        pq = pq.filter(order_date__gte=date_start.date())
    if date_end:
        pq = pq.filter(order_date__lte=date_end.date())
    if status:
        pq = pq.filter(status=status)
    kw = str(supplier_name or "").strip()
    if kw:
        pq = pq.filter(supplier_name__icontains=kw)

    from tortoise.functions import Sum

    all_po_ids = list(await pq.values_list("id", flat=True))
    total = len(all_po_ids)
    lim = max(1, min(int(limit or 100), REPORT_LIST_MAX_LIMIT))
    sk = max(0, int(skip or 0))
    orders = await pq.order_by("-order_date").values(
        "id", "order_code", "order_date", "supplier_id", "supplier_name", "total_amount", "status",
    )
    order_amount_sum = 0.0
    if all_po_ids:
        agg = await PurchaseOrder.filter(id__in=all_po_ids).annotate(
            total_amt=Sum("total_amount")
        ).values("total_amt")
        order_amount_sum = float(agg[0]["total_amt"] or 0) if agg else 0.0

    received_by_po: Dict[int, float] = {}
    if all_po_ids:
        for r in await PurchaseReceipt.filter(
            tenant_id=tenant_id,
            purchase_order_id__in=all_po_ids,
            deleted_at__isnull=True,
        ).values("purchase_order_id", "total_amount"):
            pid = r.get("purchase_order_id")
            if pid:
                received_by_po[int(pid)] = received_by_po.get(int(pid), 0.0) + float(r.get("total_amount") or 0)

    invoiced_by_po: Dict[int, float] = {}
    payable_ids_by_po: Dict[int, set] = {}
    if all_po_ids:
        for inv in await PurchaseInvoice.filter(
            tenant_id=tenant_id,
            purchase_order_id__in=all_po_ids,
            deleted_at__isnull=True,
        ).values("purchase_order_id", "total_amount", "payable_id"):
            pid = inv.get("purchase_order_id")
            if not pid:
                continue
            pid = int(pid)
            invoiced_by_po[pid] = invoiced_by_po.get(pid, 0.0) + float(inv.get("total_amount") or 0)
            if inv.get("payable_id"):
                payable_ids_by_po.setdefault(pid, set()).add(int(inv["payable_id"]))

        for p in await Payable.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            source_type="purchase_order",
            source_id__in=all_po_ids,
        ).values("id", "source_id"):
            sid = p.get("source_id")
            if sid:
                payable_ids_by_po.setdefault(int(sid), set()).add(int(p["id"]))

    paid_map: Dict[int, float] = {}
    all_payable_ids = {i for ids in payable_ids_by_po.values() for i in ids}
    if all_payable_ids:
        for p in await Payable.filter(
            id__in=list(all_payable_ids),
            deleted_at__isnull=True,
        ).values("id", "paid_amount"):
            paid_map[int(p["id"])] = float(p.get("paid_amount") or 0)

    code_map = await ReportService._supplier_code_map(
        tenant_id, [o.get("supplier_id") for o in orders]
    )
    items = []
    for o in orders:
        pid = int(o["id"])
        sid = o.get("supplier_id")
        order_amt = float(o.get("total_amount") or 0)
        paid = sum(paid_map.get(i, 0.0) for i in payable_ids_by_po.get(pid, set()))
        items.append({
            "id": pid,
            "order_code": o.get("order_code") or "",
            "order_date": o.get("order_date"),
            "supplier_id": sid,
            "supplier_code": code_map.get(int(sid), "") if sid is not None else "",
            "supplier_name": o.get("supplier_name") or "",
            "order_amount": order_amt,
            "received_amount": received_by_po.get(pid, 0.0),
            "invoiced_amount": invoiced_by_po.get(pid, 0.0),
            "paid_amount": paid,
            "pending_amount": max(0.0, order_amt - paid),
            "status": o.get("status") or "",
        })

    paid_total = sum(paid_map.get(i, 0.0) for ids in payable_ids_by_po.values() for i in ids)
    return {
        "data": items,
        "total": total,
        "success": True,
        "summary": {
            "order_amount": order_amount_sum,
            "received_amount": sum(received_by_po.values()),
            "invoiced_amount": sum(invoiced_by_po.values()),
            "paid_amount": paid_total,
            "pending_amount": max(0.0, order_amount_sum - paid_total),
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

    site_today = to_site_date(resolve_business_datetime())
    today_start = coerce_business_datetime_to_utc(datetime.combine(site_today, dt_time.min))
    q = WorkOrder.filter(
        tenant_id=tenant_id,
        deleted_at__isnull=True,
        status__in=["released", "in_progress"],
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
    lim = max(1, min(int(limit or 100), REPORT_LIST_MAX_LIMIT))
    sk = max(0, int(skip or 0))
    order_clause = _resolve_production_report_order_by(
        order_by,
        PRODUCTION_DELAY_WARNING_SORT,
        "planned_end_date",
        field_aliases={"material_name": "product_name", "overdue_days": "planned_end_date"},
    )
    rows = await q.order_by(order_clause).values(
        "id",
        "code",
        "product_code",
        "product_name",
        "planned_end_date",
        "status",
        "quantity",
        "completed_quantity",
    )
    items = []
    for it in rows:
        ped = it.get("planned_end_date")
        ped_d = ped.date() if isinstance(ped, datetime) else ped
        overdue = (site_today - ped_d).days if isinstance(ped_d, date) else 0
        items.append({
            "id": it.get("id"),
            "code": it.get("code") or "",
            "order_code": it.get("code") or "",
            "product_code": it.get("product_code") or "",
            "material_name": it.get("product_name") or "",
            "planned_end_date": to_api_isoformat(ped_d) if isinstance(ped_d, date) else None,
            "status": it.get("status") or "",
            "plan_qty": float(it.get("quantity") or 0),
            "completed_qty": float(it.get("completed_quantity") or 0),
            "is_overdue": overdue > 0,
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
    lim = max(1, min(int(limit or 100), REPORT_LIST_MAX_LIMIT))
    sk = max(0, int(skip or 0))
    order_clause = _resolve_production_report_order_by(
        order_by,
        PRODUCTION_OUTSOURCE_QUERY_SORT,
        "-created_at",
        field_aliases={"order_code": "code", "order_qty": "quantity", "plan_qty": "quantity", "order_date": "created_at"},
    )
    rows = await q.order_by(order_clause).values(
        "id",
        "code",
        "supplier_name",
        "product_code",
        "product_name",
        "quantity",
        "status",
        "planned_end_date",
        "created_at",
        "total_amount",
    )
    items = []
    for r in rows:
        ped = r.get("planned_end_date")
        created = r.get("created_at")
        items.append({
            "id": r.get("id"),
            "order_code": r.get("code") or "",
            "supplier_name": r.get("supplier_name") or "",
            "product_code": r.get("product_code") or "",
            "product_name": r.get("product_name") or "",
            "plan_qty": float(r.get("quantity") or 0),
            "order_qty": float(r.get("quantity") or 0),
            "amount": float(r.get("total_amount") or 0),
            "status": r.get("status") or "",
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
    lim = max(1, min(int(limit or 100), REPORT_LIST_MAX_LIMIT))
    sk = max(0, int(skip or 0))
    order_clause = _resolve_production_report_order_by(
        order_by,
        PRODUCTION_OUTSOURCE_RECON_SORT,
        "-created_at",
        field_aliases={"issue_code": "code", "issued_qty": "quantity"},
    )
    rows = await q.order_by(order_clause).values(
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
            "id": r.get("id"),
            "issue_code": r.get("code") or "",
            "outsource_work_order_code": r.get("outsource_work_order_code") or "",
            "material_code": r.get("material_code") or "",
            "material_name": r.get("material_name") or "",
            "issued_qty": issued,
            "returned_qty": returned,
            "balance_qty": issued - returned,
            "status": r.get("status") or "",
        })
    return {"data": items, "total": total, "success": True}


def inspection_pass_rate_row(row: dict) -> dict:
    """为检验行补充合格率（0–100），数量只取单据字段。"""
    sample = float(row.get("inspection_quantity") or row.get("sample_quantity") or 0)
    qualified = float(row.get("qualified_quantity") or row.get("pass_quantity") or 0)
    unqualified = float(row.get("unqualified_quantity") or 0)
    rate = round(qualified / sample * 100, 2) if sample else 0.0
    return {
        **row,
        "sample_qty": sample,
        "qualified_qty": qualified,
        "unqualified_qty": unqualified,
        "unit": row.get("material_unit") or row.get("unit") or "",
        "pass_rate": rate,
    }


def parse_column_filters_param(raw: Optional[Any]) -> List[Dict[str, Any]]:
    """解析前端 column_filters JSON 查询参数。"""
    if not raw:
        return []
    if isinstance(raw, list):
        return [x for x in raw if isinstance(x, dict)]
    if isinstance(raw, str):
        import json

        try:
            parsed = json.loads(raw)
            return [x for x in parsed if isinstance(x, dict)] if isinstance(parsed, list) else []
        except json.JSONDecodeError:
            return []
    return []


def _row_field_value(row: Dict[str, Any], field: str) -> Any:
    if field in row:
        return row.get(field)
    parts = field.split(".")
    cur: Any = row
    for part in parts:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(part)
    return cur


def _coerce_filter_number(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


REPORT_COLUMN_FILTER_BLANK = "__blank__"
REPORT_COLUMN_FILTER_NONE = "__none__"


def _column_filter_value_key(raw: Any) -> str:
    if raw is None or raw == "":
        return REPORT_COLUMN_FILTER_BLANK
    return str(raw)


def _match_column_filter(row: Dict[str, Any], flt: Dict[str, Any]) -> bool:
    field = str(flt.get("field") or "").strip()
    if not field or field not in row and _row_field_value(row, field) is None:
        return True
    op = str(flt.get("op") or "contains").strip()
    raw = _row_field_value(row, field)
    if op == "in":
        values = flt.get("value")
        if not isinstance(values, list) or not values:
            return True
        if REPORT_COLUMN_FILTER_NONE in {str(v) for v in values}:
            return False
        allowed = {str(v) for v in values}
        key = _column_filter_value_key(raw)
        if key == REPORT_COLUMN_FILTER_BLANK:
            return REPORT_COLUMN_FILTER_BLANK in allowed or "" in allowed
        return key in allowed
    if op == "between":
        left = flt.get("value")
        right = flt.get("value_to")
        num = _coerce_filter_number(raw)
        lnum = _coerce_filter_number(left)
        rnum = _coerce_filter_number(right)
        if num is not None and lnum is not None and rnum is not None:
            return lnum <= num <= rnum
        text = str(raw or "")
        return str(left or "") <= text <= str(right or "")
    if op in {"gt", "lt", "gte", "lte", "eq"}:
        num = _coerce_filter_number(raw)
        target = _coerce_filter_number(flt.get("value"))
        if num is None or target is None:
            text = str(raw or "")
            cmp = str(flt.get("value") or "")
            if op == "eq":
                return text == cmp
            return True
        if op == "gt":
            return num > target
        if op == "lt":
            return num < target
        if op == "gte":
            return num >= target
        if op == "lte":
            return num <= target
        return num == target
    text = str(raw or "").lower()
    cmp = str(flt.get("value") or "").lower()
    if op == "eq":
        return text == cmp
    return cmp in text


def _sort_report_rows(items: List[Dict[str, Any]], order_by: Optional[str]) -> List[Dict[str, Any]]:
    if not order_by:
        return items
    desc = order_by.startswith("-")
    field = order_by[1:] if desc else order_by
    if not field:
        return items

    def sort_key(row: Dict[str, Any]) -> tuple:
        val = _row_field_value(row, field)
        if val is None:
            return (1, "")
        if isinstance(val, (int, float)):
            return (0, float(val))
        num = _coerce_filter_number(val)
        if num is not None:
            return (0, num)
        return (0, str(val).lower())

    return sorted(items, key=sort_key, reverse=desc)


def _compute_report_summary(
    rows: List[Dict[str, Any]],
    fields: Optional[List[str]],
) -> Optional[Dict[str, float]]:
    if not fields:
        return None
    summary: Dict[str, float] = {}
    for field in fields:
        key = str(field or "").strip()
        if not key:
            continue
        total = 0.0
        for row in rows:
            num = _coerce_filter_number(_row_field_value(row, key))
            if num is not None:
                total += num
        summary[key] = round(total, 4)
    return summary or None


def build_report_column_facets(
    items: List[Dict[str, Any]],
    column_filters: Optional[List[Dict[str, Any]]] = None,
    *,
    max_options_per_field: int = 200,
) -> Dict[str, List[Dict[str, Any]]]:
    """按 Excel 列头筛选：各列唯一值及计数（排除本列已生效筛选）。"""
    rows = list(items or [])
    if not rows:
        return {}
    filters = column_filters or []
    fields: set[str] = set()
    for row in rows:
        if isinstance(row, dict):
            fields.update(str(k) for k in row.keys())
    facets: Dict[str, List[Dict[str, Any]]] = {}
    for field in sorted(fields):
        other_filters = [flt for flt in filters if str(flt.get("field") or "") != field]
        scoped = [
            row
            for row in rows
            if isinstance(row, dict) and all(_match_column_filter(row, flt) for flt in other_filters)
        ]
        counts: Dict[str, int] = {}
        for row in scoped:
            key = _column_filter_value_key(_row_field_value(row, field))
            counts[key] = counts.get(key, 0) + 1
        options = sorted(
            [{"value": value, "count": count} for value, count in counts.items()],
            key=lambda item: (item["value"] == REPORT_COLUMN_FILTER_BLANK, str(item["value"]).lower()),
        )
        if len(options) > max_options_per_field:
            options = options[:max_options_per_field]
        facets[field] = options
    return facets


def finalize_report_items(
    items: List[Dict[str, Any]],
    *,
    order_by: Optional[str] = None,
    column_filters: Optional[List[Dict[str, Any]]] = None,
    skip: int = 0,
    limit: int = 100,
    summary_fields: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """列筛选 → 排序 → 分页（报表 Python 列表统一收尾）。"""
    rows = list(items or [])
    filters = column_filters or []
    column_facets = build_report_column_facets(rows, filters)
    if filters:
        rows = [row for row in rows if all(_match_column_filter(row, flt) for flt in filters)]
    rows = _sort_report_rows(rows, order_by)
    summary = _compute_report_summary(rows, summary_fields)
    total = len(rows)
    sk = max(0, int(skip or 0))
    lim = max(1, min(int(limit or 100), REPORT_LIST_MAX_LIMIT))
    page = rows[sk : sk + lim]
    result: Dict[str, Any] = {
        "data": page,
        "total": total,
        "success": True,
        "column_facets": column_facets,
    }
    if summary:
        result["summary"] = summary
    return result
