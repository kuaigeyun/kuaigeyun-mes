"""
预测冲销：销售订单数量冲抵同物料、窗口期内的销售预测未消耗量。
"""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from typing import Any, Dict, Iterable, List, Optional, Tuple


def _d(v: Any) -> Decimal:
    try:
        return Decimal(str(v or 0))
    except Exception:
        return Decimal("0")


def forecast_open_quantity(forecast_quantity: Any, consumed_quantity: Any = 0) -> Decimal:
    open_qty = _d(forecast_quantity) - _d(consumed_quantity)
    return open_qty if open_qty > 0 else Decimal("0")


def _in_consume_window(
    so_date: date,
    forecast_date: date,
    *,
    backward_days: int,
    forward_days: int,
) -> bool:
    lo = so_date - timedelta(days=max(0, int(backward_days or 0)))
    hi = so_date + timedelta(days=max(0, int(forward_days or 0)))
    return lo <= forecast_date <= hi


def allocate_forecast_consumption(
    *,
    so_material_id: int,
    so_qty: Decimal,
    so_date: date,
    forecast_lines: List[Dict[str, Any]],
    backward_days: int = 30,
    forward_days: int = 30,
) -> List[Dict[str, Any]]:
    """
    对单条 SO 行按 FIFO（预测日升序、id 升序）分配冲销。

    forecast_lines 元素需含: id, material_id, forecast_date, open_qty
    返回 [{forecast_item_id, qty}, ...]
    """
    remaining = _d(so_qty)
    if remaining <= 0:
        return []
    candidates = [
        ln
        for ln in forecast_lines
        if int(ln.get("material_id") or 0) == int(so_material_id)
        and isinstance(ln.get("forecast_date"), date)
        and _d(ln.get("open_qty")) > 0
        and _in_consume_window(
            so_date,
            ln["forecast_date"],
            backward_days=backward_days,
            forward_days=forward_days,
        )
    ]
    candidates.sort(key=lambda x: (x["forecast_date"], int(x.get("id") or 0)))
    allocs: List[Dict[str, Any]] = []
    for ln in candidates:
        if remaining <= 0:
            break
        open_qty = _d(ln.get("open_qty"))
        take = open_qty if open_qty <= remaining else remaining
        if take <= 0:
            continue
        allocs.append({"forecast_item_id": int(ln["id"]), "qty": take})
        ln["open_qty"] = open_qty - take
        remaining -= take
    return allocs


def net_forecast_gross_by_sales_orders(
    *,
    forecast_rows: List[Tuple[date, float]],
    sales_order_rows: List[Tuple[date, float]],
    backward_days: int = 30,
    forward_days: int = 30,
) -> Tuple[List[Tuple[date, float]], float]:
    """
    MRP 种子层冲销：同物料的预测分日毛需求被 SO 分日需求冲抵。

    返回 (冲销后的预测分日列表, 总冲销量)。
    """
    so_pool = sorted(
        [{"date": d, "qty": float(q)} for d, q in sales_order_rows if q and q > 0],
        key=lambda x: x["date"],
    )
    fc_sorted = sorted(
        [{"date": d, "qty": float(q)} for d, q in forecast_rows if q and q > 0],
        key=lambda x: x["date"],
    )
    consumed_total = 0.0
    out: List[Tuple[date, float]] = []
    for fc in fc_sorted:
        left = float(fc["qty"])
        for so in so_pool:
            if left <= 0:
                break
            if so["qty"] <= 0:
                continue
            if not _in_consume_window(
                so["date"],
                fc["date"],
                backward_days=backward_days,
                forward_days=forward_days,
            ):
                continue
            take = min(left, so["qty"])
            left -= take
            so["qty"] -= take
            consumed_total += take
        if left > 1e-9:
            out.append((fc["date"], left))
    return out, consumed_total


async def apply_forecast_consumption_for_sales_order(
    tenant_id: int,
    sales_order_id: int,
    *,
    backward_days: int = 30,
    forward_days: int = 30,
    only_item_ids: Optional[Iterable[int]] = None,
) -> Dict[str, Any]:
    """
    对销售订单明细自动匹配未消耗预测并累加 consumed_quantity，写回 forecast_item_id。
    已绑定 forecast_item_id 的行跳过（避免重复冲销）。
    """
    from apps.kuaizhizao.models.sales_forecast_item import SalesForecastItem
    from apps.kuaizhizao.models.sales_order_item import SalesOrderItem

    items = await SalesOrderItem.filter(
        tenant_id=tenant_id,
        sales_order_id=sales_order_id,
        deleted_at__isnull=True,
    ).order_by("id").all()
    if only_item_ids is not None:
        allow = {int(x) for x in only_item_ids}
        items = [it for it in items if int(it.id) in allow]

    material_ids = sorted({int(it.material_id) for it in items if it.material_id})
    if not material_ids:
        return {"allocations": [], "consumed_total": 0}

    # 宽窗口取候选预测行
    dates = [it.delivery_date for it in items if isinstance(it.delivery_date, date)]
    if not dates:
        return {"allocations": [], "consumed_total": 0}
    lo = min(dates) - timedelta(days=max(0, backward_days) + 7)
    hi = max(dates) + timedelta(days=max(0, forward_days) + 7)

    forecast_items = await SalesForecastItem.filter(
        tenant_id=tenant_id,
        material_id__in=material_ids,
        forecast_date__gte=lo,
        forecast_date__lte=hi,
    ).order_by("forecast_date", "id").all()

    lines: List[Dict[str, Any]] = []
    for fi in forecast_items:
        open_qty = forecast_open_quantity(fi.forecast_quantity, getattr(fi, "consumed_quantity", 0))
        if open_qty <= 0:
            continue
        lines.append(
            {
                "id": fi.id,
                "material_id": fi.material_id,
                "forecast_date": fi.forecast_date,
                "open_qty": open_qty,
                "_model": fi,
            }
        )

    allocations: List[Dict[str, Any]] = []
    consumed_total = Decimal("0")
    for it in items:
        if getattr(it, "forecast_item_id", None):
            continue
        so_date = it.delivery_date
        if not isinstance(so_date, date):
            continue
        allocs = allocate_forecast_consumption(
            so_material_id=int(it.material_id),
            so_qty=_d(it.order_quantity),
            so_date=so_date,
            forecast_lines=lines,
            backward_days=backward_days,
            forward_days=forward_days,
        )
        if not allocs:
            continue
        # 主绑定取第一条；数量按分配累加到各预测行
        primary_id = int(allocs[0]["forecast_item_id"])
        it.forecast_item_id = primary_id
        await it.save(update_fields=["forecast_item_id", "updated_at"])
        for a in allocs:
            fid = int(a["forecast_item_id"])
            qty = _d(a["qty"])
            fi_model = next((ln["_model"] for ln in lines if int(ln["id"]) == fid), None)
            if not fi_model:
                continue
            prev = _d(getattr(fi_model, "consumed_quantity", 0))
            fi_model.consumed_quantity = prev + qty
            await fi_model.save(update_fields=["consumed_quantity", "updated_at"])
            consumed_total += qty
            allocations.append(
                {
                    "sales_order_item_id": it.id,
                    "forecast_item_id": fid,
                    "qty": float(qty),
                }
            )

    return {"allocations": allocations, "consumed_total": float(consumed_total)}
