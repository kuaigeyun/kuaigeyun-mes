"""
仓储看板汇总：库存统计、库存金额、待办、最近入出库。

聚合逻辑与报表 inventory/statistics 对齐；金额按物料 defaults 单价估算。
"""

from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from loguru import logger
from tortoise.functions import Count, Sum

from apps.kuaizhizao.models.inventory_alert import InventoryAlert
from apps.kuaizhizao.models.other_inbound import OtherInbound
from apps.kuaizhizao.models.other_inbound_item import OtherInboundItem
from apps.kuaizhizao.models.finished_goods_receipt import FinishedGoodsReceipt
from apps.kuaizhizao.models.production_return import ProductionReturn
from apps.kuaizhizao.models.production_return_item import ProductionReturnItem
from apps.kuaizhizao.models.other_outbound import OtherOutbound
from apps.kuaizhizao.models.other_outbound_item import OtherOutboundItem
from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
from apps.kuaizhizao.models.purchase_receipt_item import PurchaseReceiptItem
from apps.kuaizhizao.models.sales_delivery import SalesDelivery
from apps.kuaizhizao.models.sales_delivery_item import SalesDeliveryItem
from apps.master_data.models.material import Material
from apps.master_data.models.material_batch import MaterialBatch
from core.utils.timezone_utils import resolve_business_datetime, to_api_isoformat
from apps.kuaizhizao.services.document_action_policy.warehouse_inbound_hub import (
    _INBOUND_PENDING_STATUSES,
)

_INBOUND_DOC_PENDING_STATUSES = tuple(_INBOUND_PENDING_STATUSES)
_PRODUCTION_RETURN_PENDING_STATUSES = ("待退料",)


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


async def _in_stock_qty_by_material(tenant_id: int) -> dict[int, Decimal]:
    """在库批次按物料 SQL 汇总，不把批次行拉进应用内存。"""
    rows = (
        await MaterialBatch.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            quantity__gt=0,
            status="in_stock",
        )
        .group_by("material_id")
        .annotate(qty=Sum("quantity"))
        .values("material_id", "qty")
    )
    out: dict[int, Decimal] = {}
    for row in rows:
        mid = int(row["material_id"])
        out[mid] = Decimal(str(row["qty"] or 0))
    return out


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
        qty_by_material = await _in_stock_qty_by_material(tenant_id)
        total_materials = len(qty_by_material)
        total_quantity = float(sum(qty_by_material.values(), Decimal("0")))
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
    """在库批次按物料 SQL 汇总数量 × defaults 单价。"""
    try:
        qty_by_material = await _in_stock_qty_by_material(tenant_id)
    except Exception as e:
        logger.warning(f"warehouse-dashboard value batches: {e}")
        return 0.0

    if not qty_by_material:
        return 0.0

    material_ids = list(qty_by_material.keys())
    materials = await Material.filter(
        tenant_id=tenant_id, id__in=material_ids, deleted_at__isnull=True
    ).only("id", "defaults")
    mid_defaults = {m.id: m.defaults for m in materials}

    total = Decimal("0")
    for mid, qty in qty_by_material.items():
        unit = _unit_price_from_defaults(mid_defaults.get(mid))
        total += qty * unit

    return float(round(total, 2))


def _iso(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    return to_api_isoformat(dt)


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


async def _production_return_total_qty_by_ids(
    tenant_id: int, return_ids: List[int]
) -> Dict[int, float]:
    """生产退料单头表无 total_quantity，按明细 return_quantity 汇总。"""
    if not return_ids:
        return {}
    rows = (
        await ProductionReturnItem.filter(tenant_id=tenant_id, return_id__in=return_ids)
        .group_by("return_id")
        .annotate(total=Sum("return_quantity"))
        .values("return_id", "total")
    )
    return {int(row["return_id"]): float(row["total"] or 0) for row in rows}


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
            "pending_inbounds": [],
            "recent_inbounds": [],
            "recent_outbounds": [],
        }

        import asyncio

        # 1. 定义并行动作：库存核心统计、总价值、待办数
        async def _count_pending_inbounds() -> int:
            pr, fg, oi, pret = await asyncio.gather(
                PurchaseReceipt.filter(
                    tenant_id=tenant_id,
                    deleted_at__isnull=True,
                    status__in=_INBOUND_DOC_PENDING_STATUSES,
                ).count(),
                FinishedGoodsReceipt.filter(
                    tenant_id=tenant_id,
                    deleted_at__isnull=True,
                    status__in=_INBOUND_DOC_PENDING_STATUSES,
                ).count(),
                OtherInbound.filter(
                    tenant_id=tenant_id,
                    deleted_at__isnull=True,
                    status__in=_INBOUND_DOC_PENDING_STATUSES,
                ).count(),
                ProductionReturn.filter(
                    tenant_id=tenant_id,
                    deleted_at__isnull=True,
                    status__in=_PRODUCTION_RETURN_PENDING_STATUSES,
                ).count(),
            )
            return int(pr or 0) + int(fg or 0) + int(oi or 0) + int(pret or 0)

        async def _count_overdue_purchase_receipts() -> int:
            return await PurchaseReceipt.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                status__in=_INBOUND_DOC_PENDING_STATUSES,
                created_at__lt=resolve_business_datetime() - timedelta(days=3),
            ).count()

        async def _sku_qty_and_value() -> Tuple[int, float, float]:
            qty_by_material = await _in_stock_qty_by_material(tenant_id)
            total_sku = len(qty_by_material)
            total_qty = float(sum(qty_by_material.values(), Decimal("0")))
            if not qty_by_material:
                return total_sku, round(total_qty, 2), 0.0
            materials = await Material.filter(
                tenant_id=tenant_id,
                id__in=list(qty_by_material.keys()),
                deleted_at__isnull=True,
            ).only("id", "defaults")
            mid_defaults = {m.id: m.defaults for m in materials}
            total_value = Decimal("0")
            for mid, qty in qty_by_material.items():
                total_value += qty * _unit_price_from_defaults(mid_defaults.get(mid))
            return total_sku, round(total_qty, 2), float(round(total_value, 2))

        async def _alert_stock_counts() -> Tuple[int, int, int]:
            """pending 预警：低库存 / 缺货 / 高库存。"""
            try:
                alert_base = InventoryAlert.filter(
                    tenant_id=tenant_id, deleted_at__isnull=True, status="pending"
                )
                low_stock_alerts = alert_base.filter(alert_type="low_stock")
                out_of_stock_count = await low_stock_alerts.filter(current_quantity=0).count()
                low_stock_count = await low_stock_alerts.filter(current_quantity__gt=0).count()
                high_stock_count = await alert_base.filter(alert_type="high_stock").count()
                return low_stock_count, out_of_stock_count, high_stock_count
            except Exception as e:
                logger.warning(f"warehouse-dashboard alert stats: {e}")
                return 0, 0, 0

        tasks = [
            _sku_qty_and_value(),
            _alert_stock_counts(),
            _count_pending_inbounds(),
            _count_overdue_purchase_receipts(),
            SalesDelivery.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="待出库").count(),
            OtherOutbound.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="待出库").count()
        ]

        try:
            (
                (total_sku, total_qty, total_inventory_value),
                (low_stock, out_of_stock, high_stock),
                pending_inbound,
                overdue_inbound,
                p_sd,
                p_oo
            ) = await asyncio.gather(*tasks)
            pending_outbound = p_sd + p_oo
            normal_stock = max(
                0,
                total_sku - low_stock - out_of_stock - high_stock,
            )
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

        async def fetch_pending_in(limit):
            """待入库队列：与入库 Hub 可确认态一致（含草稿下推单）。"""
            fetch_n = max(limit * 4, 32)
            pr_list, fg_list, oi_list, pr_ret_list = await asyncio.gather(
                PurchaseReceipt.filter(
                    tenant_id=tenant_id,
                    deleted_at__isnull=True,
                    status__in=_INBOUND_DOC_PENDING_STATUSES,
                ).order_by("-created_at").limit(fetch_n).all(),
                FinishedGoodsReceipt.filter(
                    tenant_id=tenant_id,
                    deleted_at__isnull=True,
                    status__in=_INBOUND_DOC_PENDING_STATUSES,
                ).order_by("-created_at").limit(fetch_n).all(),
                OtherInbound.filter(
                    tenant_id=tenant_id,
                    deleted_at__isnull=True,
                    status__in=_INBOUND_DOC_PENDING_STATUSES,
                ).order_by("-created_at").limit(fetch_n).all(),
                ProductionReturn.filter(
                    tenant_id=tenant_id,
                    deleted_at__isnull=True,
                    status__in=_PRODUCTION_RETURN_PENDING_STATUSES,
                ).order_by("-created_at").limit(fetch_n).all(),
            )

            merged = []
            for r in pr_list:
                merged.append((r.created_at or datetime.min, "purchase", {
                    "receipt_id": r.id,
                    "receipt_code": r.receipt_code,
                    "total_quantity": float(r.total_quantity or 0),
                }))
            for r in fg_list:
                merged.append((r.created_at or datetime.min, "finished_goods", {
                    "receipt_code": r.receipt_code,
                    "total_quantity": float(r.total_quantity or 0),
                }))
            for r in oi_list:
                merged.append((r.created_at or datetime.min, "other", {
                    "inbound_code": r.inbound_code,
                    "total_quantity": float(r.total_quantity or 0),
                }))
            for r in pr_ret_list:
                merged.append((r.created_at or datetime.min, "production_return", {
                    "return_id": r.id,
                    "return_code": r.return_code,
                }))

            merged.sort(key=lambda x: x[0], reverse=True)
            merged = merged[:limit]

            pr_ids = [m[2]["receipt_id"] for m in merged if m[1] == "purchase"]
            prod_return_ids = [
                m[2]["return_id"]
                for m in merged
                if m[1] == "production_return" and m[2].get("return_id") is not None
            ]
            labels, prod_return_qty_map = await asyncio.gather(
                _first_purchase_item_labels(tenant_id, pr_ids),
                _production_return_total_qty_by_ids(tenant_id, prod_return_ids),
            )

            pending = []
            for ts, kind, payload in merged:
                if kind == "purchase":
                    rid = payload["receipt_id"]
                    name, nlines = labels.get(rid, ("", 0))
                    mat_label = f"{name} 等{nlines}项" if nlines > 1 and name else (f"共{nlines}项" if nlines > 1 else name)
                    pending.append({
                        "doc_code": payload["receipt_code"],
                        "material_name": mat_label,
                        "quantity": payload["total_quantity"],
                        "time": _iso(ts if ts != datetime.min else None),
                        "doc_type": "purchase_receipt",
                    })
                elif kind == "finished_goods":
                    pending.append({
                        "doc_code": payload["receipt_code"],
                        "material_name": "成品入库",
                        "quantity": payload["total_quantity"],
                        "time": _iso(ts if ts != datetime.min else None),
                        "doc_type": "finished_goods_receipt",
                    })
                elif kind == "production_return":
                    return_id = payload.get("return_id")
                    pending.append({
                        "doc_code": payload["return_code"],
                        "material_name": "生产退料",
                        "quantity": prod_return_qty_map.get(int(return_id), 0.0) if return_id else 0.0,
                        "time": _iso(ts if ts != datetime.min else None),
                        "doc_type": "production_return",
                    })
                else:
                    pending.append({
                        "doc_code": payload["inbound_code"],
                        "material_name": "其他入库",
                        "quantity": payload["total_quantity"],
                        "time": _iso(ts if ts != datetime.min else None),
                        "doc_type": "other_inbound",
                    })
            return pending

        # 3. 并行获取待入库队列与最近出库流水
        pending_inbounds, recent_outbounds = await asyncio.gather(
            fetch_pending_in(recent_limit),
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
            "pending_inbounds": pending_inbounds,
            "recent_inbounds": [],
            "recent_outbounds": recent_outbounds,
        }
