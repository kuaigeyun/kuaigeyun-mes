"""
仓储看板汇总：库存统计、库存金额、待办、最近入出库。

聚合逻辑与报表 inventory/statistics 对齐；金额按物料 defaults 单价估算。
"""

from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from loguru import logger

from apps.kuaizhizao.models.inventory_alert import InventoryAlert
from apps.kuaizhizao.models.other_inbound import OtherInbound
from apps.kuaizhizao.models.other_inbound_item import OtherInboundItem
from apps.kuaizhizao.models.other_outbound import OtherOutbound
from apps.kuaizhizao.models.other_outbound_item import OtherOutboundItem
from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
from apps.kuaizhizao.models.purchase_receipt_item import PurchaseReceiptItem
from apps.kuaizhizao.models.sales_delivery import SalesDelivery
from apps.kuaizhizao.models.sales_delivery_item import SalesDeliveryItem
from apps.master_data.models.material import Material
from apps.master_data.models.material_batch import MaterialBatch
from tortoise.functions import Count, Sum


def _unit_price_from_defaults(defaults: Any) -> Decimal:
    """从物料 defaults 取单价：standard_cost → moving_average_cost → purchase_price；无法解析为 0。"""
    if not defaults or not isinstance(defaults, dict):
        return Decimal("0")
    for key in ("standard_cost", "moving_average_cost", "purchase_price"):
        v = defaults.get(key)
        if v is None or v == "":
            continue
        try:
            return Decimal(str(v))
        except Exception:
            continue
    return Decimal("0")


async def _inventory_statistics_core(
    tenant_id: int, warehouse_id: Optional[int] = None
) -> Tuple[int, float, int, int, int, int]:
    """
    与 reports.get_inventory_statistics 一致的核心计数。
    Returns:
        total_sku, total_quantity, low_stock, out_of_stock, high_stock, normal_stock
    """
    total_materials = 0
    total_quantity = 0.0
    low_stock_count = 0
    out_of_stock_count = 0
    high_stock_count = 0

    try:
        batch_query = MaterialBatch.filter(
            tenant_id=tenant_id, deleted_at__isnull=True, quantity__gt=0, status="in_stock"
        )
        material_ids = await batch_query.values_list("material_id", flat=True)
        total_materials = len(set(material_ids)) if material_ids else 0

        quantities = await batch_query.values_list("quantity", flat=True)
        total_quantity = sum(float(q or 0) for q in quantities)
    except Exception as e:
        logger.warning(f"warehouse-dashboard batch stats: {e}")

    try:
        alert_base = InventoryAlert.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="pending")
        if warehouse_id:
            alert_base = alert_base.filter(warehouse_id=warehouse_id)

        low_stock_alerts = alert_base.filter(alert_type="low_stock")
        out_of_stock_count = await low_stock_alerts.filter(current_quantity=0).count()
        low_stock_count = await low_stock_alerts.filter(current_quantity__gt=0).count()
        high_stock_count = await alert_base.filter(alert_type="high_stock").count()
    except Exception as e:
        logger.warning(f"warehouse-dashboard alert stats: {e}")

    normal_stock = max(
        0,
        total_materials - low_stock_count - out_of_stock_count - high_stock_count,
    )
    return (
        total_materials,
        round(total_quantity, 2),
        low_stock_count,
        out_of_stock_count,
        high_stock_count,
        normal_stock,
    )


async def _total_inventory_value(tenant_id: int) -> float:
    """在库批次按物料汇总数量 × defaults 单价。"""
    try:
        batches = await MaterialBatch.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            quantity__gt=0,
            status="in_stock",
        ).all()
    except Exception as e:
        logger.warning(f"warehouse-dashboard value batches: {e}")
        return 0.0

    if not batches:
        return 0.0

    qty_by_material: dict[int, Decimal] = {}
    for batch in batches:
        mid = int(batch.material_id)
        qty_by_material[mid] = qty_by_material.get(mid, Decimal("0")) + Decimal(str(batch.quantity or 0))

    material_ids = list(qty_by_material.keys())
    materials = await Material.filter(
        tenant_id=tenant_id, id__in=material_ids, deleted_at__isnull=True
    ).all()
    mid_defaults = {m.id: m.defaults for m in materials}

    total = Decimal("0")
    for mid, qty in qty_by_material.items():
        unit = _unit_price_from_defaults(mid_defaults.get(mid))
        total += qty * unit

    return float(round(total, 2))


def _iso(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.isoformat()
    return dt.replace(microsecond=0).isoformat()


async def _first_purchase_item_labels(
    tenant_id: int, receipt_ids: List[int]
) -> Dict[int, Tuple[str, int]]:
    """receipt_id -> (首行物料名, 明细行数)"""
    if not receipt_ids:
        return {}
    counts = await PurchaseReceiptItem.filter(
        tenant_id=tenant_id, receipt_id__in=receipt_ids
    ).group_by("receipt_id").annotate(c=Count("id")).values("receipt_id", "c")
    count_map = {r["receipt_id"]: int(r["c"] or 0) for r in counts}

    items = (
        await PurchaseReceiptItem.filter(tenant_id=tenant_id, receipt_id__in=receipt_ids)
        .order_by("receipt_id", "id")
        .all()
    )
    first_name: Dict[int, str] = {}
    for it in items:
        if it.receipt_id not in first_name:
            first_name[it.receipt_id] = it.material_name or ""
    return {rid: (first_name.get(rid, ""), count_map.get(rid, 0)) for rid in receipt_ids}


async def _first_sales_item_name(tenant_id: int, delivery_ids: List[int]) -> Dict[int, str]:
    if not delivery_ids:
        return {}
    items = (
        await SalesDeliveryItem.filter(tenant_id=tenant_id, delivery_id__in=delivery_ids)
        .order_by("delivery_id", "id")
        .all()
    )
    out: Dict[int, str] = {}
    for it in items:
        if it.delivery_id not in out:
            out[it.delivery_id] = it.material_name or ""
    return out


async def _first_other_out_item_name(tenant_id: int, outbound_ids: List[int]) -> Dict[int, str]:
    if not outbound_ids:
        return {}
    items = (
        await OtherOutboundItem.filter(tenant_id=tenant_id, outbound_id__in=outbound_ids)
        .order_by("outbound_id", "id")
        .all()
    )
    out: Dict[int, str] = {}
    for it in items:
        if it.outbound_id not in out:
            out[it.outbound_id] = it.material_name or ""
    return out


class WarehouseDashboardService:
    """仓储看板汇总服务。"""

    @staticmethod
    async def get_summary(tenant_id: int, recent_limit: int = 8) -> Dict[str, Any]:
        safe_empty: Dict[str, Any] = {
            "total_sku": 0,
            "total_quantity": 0.0,
            "low_stock": 0,
            "out_of_stock": 0,
            "high_stock": 0,
            "normal_stock": 0,
            "total_inventory_value": 0.0,
            "pending_inbound": 0,
            "overdue_inbound": 0,
            "pending_outbound": 0,
            "recent_inbounds": [],
            "recent_outbounds": [],
        }

        import asyncio

        # 1. 定义并行动作：库存核心统计、总价值、待办数
        tasks = [
            _inventory_statistics_core(tenant_id),
            _total_inventory_value(tenant_id),
            PurchaseReceipt.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="待入库").count(),
            PurchaseReceipt.filter(
                tenant_id=tenant_id, 
                deleted_at__isnull=True, 
                status="待入库", 
                created_at__lt=datetime.now() - timedelta(days=3)
            ).count(),
            SalesDelivery.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="待出库").count(),
            OtherOutbound.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="待出库").count()
        ]

        try:
            (
                (total_sku, total_qty, low_stock, out_of_stock, high_stock, normal_stock),
                total_inventory_value,
                pending_inbound,
                overdue_inbound,
                p_sd,
                p_oo
            ) = await asyncio.gather(*tasks)
            pending_outbound = p_sd + p_oo
        except Exception as e:
            logger.warning(f"warehouse-dashboard summary parallel tasks failed: {e}")
            return safe_empty

        # 2. 并行获取最近入库和出库记录（稍微复杂，保持逻辑一致）
        async def fetch_recent_in(limit):
            rb = []
            fetch_n = max(limit * 4, 32)
            pr_task = PurchaseReceipt.filter(
                tenant_id=tenant_id, deleted_at__isnull=True, status="已入库"
            ).order_by("-updated_at").limit(fetch_n).all()
            
            oi_task = OtherInbound.filter(
                tenant_id=tenant_id, deleted_at__isnull=True, status="已入库"
            ).order_by("-updated_at").limit(fetch_n).all()

            pr_list, oi_list = await asyncio.gather(pr_task, oi_task)
            
            merged = []
            for r in pr_list:
                merged.append((r.receipt_time or r.updated_at or datetime.min, "purchase", {
                    "receipt_id": r.id, "receipt_code": r.receipt_code, "total_quantity": float(r.total_quantity or 0)
                }))
            for r in oi_list:
                merged.append((r.receipt_time or r.updated_at or datetime.min, "other", {
                    "inbound_id": r.id, "inbound_code": r.inbound_code, "total_quantity": float(r.total_quantity or 0)
                }))

            merged.sort(key=lambda x: x[0], reverse=True)
            merged = merged[:limit]
            
            pr_ids = [m[2]["receipt_id"] for m in merged if m[1] == "purchase"]
            labels = await _first_purchase_item_labels(tenant_id, pr_ids)
            
            for ts, kind, payload in merged:
                if kind == "purchase":
                    rid = payload["receipt_id"]
                    name, nlines = labels.get(rid, ("", 0))
                    mat_label = f"{name} 等{nlines}项" if nlines > 1 and name else (f"共{nlines}项" if nlines > 1 else name)
                    rb.append({
                        "doc_code": payload["receipt_code"],
                        "material_name": mat_label,
                        "quantity": payload["total_quantity"],
                        "time": _iso(ts if ts != datetime.min else None),
                        "doc_type": "purchase_receipt",
                    })
                else:
                    rb.append({
                        "doc_code": payload["inbound_code"],
                        "material_name": "其他入库", # OtherInbound doesn't have a helper yet, let's keep it simple
                        "quantity": payload["total_quantity"],
                        "time": _iso(ts if ts != datetime.min else None),
                        "doc_type": "other_inbound",
                    })
            return rb

        async def fetch_recent_out(limit):
            ro = []
            fetch_n = max(limit * 4, 32)
            sd_task = SalesDelivery.filter(
                tenant_id=tenant_id, deleted_at__isnull=True, status="已出库"
            ).order_by("-updated_at").limit(fetch_n).all()
            oo_task = OtherOutbound.filter(
                tenant_id=tenant_id, deleted_at__isnull=True, status="已出库"
            ).order_by("-updated_at").limit(fetch_n).all()
            
            sd_list, oo_list = await asyncio.gather(sd_task, oo_task)
            
            merged = []
            for d in sd_list:
                merged.append((d.delivery_time or d.updated_at or datetime.min, "sales", {
                    "doc_code": d.delivery_code, "quantity": float(d.total_quantity or 0), "delivery_id": d.id,
                }))
            for o in oo_list:
                merged.append((o.delivery_time or o.updated_at or datetime.min, "other", {
                    "doc_code": o.outbound_code, "quantity": float(o.total_quantity or 0), "outbound_id": o.id,
                }))
            merged.sort(key=lambda x: x[0], reverse=True)
            merged = merged[:limit]

            sd_ids = [m[2]["delivery_id"] for m in merged if m[1] == "sales"]
            oo_ids = [m[2]["outbound_id"] for m in merged if m[1] == "other"]
            sd_names_task = _first_sales_item_name(tenant_id, sd_ids)
            oo_names_task = _first_other_out_item_name(tenant_id, oo_ids)
            sd_names, oo_names = await asyncio.gather(sd_names_task, oo_names_task)

            for ts, kind, payload in merged:
                if kind == "sales":
                    ro.append({
                        "doc_code": payload["doc_code"],
                        "material_name": sd_names.get(payload["delivery_id"], ""),
                        "quantity": payload["quantity"],
                        "time": _iso(ts if ts != datetime.min else None),
                        "doc_type": "sales_delivery",
                    })
                else:
                    ro.append({
                        "doc_code": payload["doc_code"],
                        "material_name": oo_names.get(payload["outbound_id"], ""),
                        "quantity": payload["quantity"],
                        "time": _iso(ts if ts != datetime.min else None),
                        "doc_type": "other_outbound",
                    })
            return ro

        # 3. 并行获取最近流水
        recent_inbounds, recent_outbounds = await asyncio.gather(
            fetch_recent_in(recent_limit),
            fetch_recent_out(recent_limit)
        )

        return {
            "total_sku": total_sku,
            "total_quantity": total_qty,
            "low_stock": low_stock,
            "out_of_stock": out_of_stock,
            "high_stock": high_stock,
            "normal_stock": normal_stock,
            "total_inventory_value": total_inventory_value,
            "pending_inbound": pending_inbound,
            "overdue_inbound": overdue_inbound,
            "pending_outbound": pending_outbound,
            "recent_inbounds": recent_inbounds,
            "recent_outbounds": recent_outbounds,
        }
