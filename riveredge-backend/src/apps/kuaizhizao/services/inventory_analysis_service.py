"""
库存分析业务服务模块

提供库存周转率、ABC 分析、呆滞料分析等（基于 MaterialBatch 与出入库单据）。
"""

from datetime import datetime, timedelta, date
from typing import List, Optional, Dict, Any
from decimal import Decimal

from tortoise.expressions import Q

from apps.kuaicaiwu.services.inventory_cost_service import InventoryCostService
from apps.kuaizhizao.models.sales_delivery import SalesDelivery
from apps.kuaizhizao.models.sales_delivery_item import SalesDeliveryItem
from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
from apps.kuaizhizao.models.purchase_receipt_item import PurchaseReceiptItem
from apps.master_data.models.material import Material
from apps.master_data.models.material_batch import MaterialBatch
from core.utils.timezone_utils import resolve_business_datetime, to_api_isoformat


class InventoryAnalysisService:
    """库存分析服务类"""

    def __init__(self):
        self._cost_svc = InventoryCostService()

    async def _material_unit_cost(self, tenant_id: int, material_id: int) -> Decimal:
        return await self._cost_svc.get_material_unit_cost(tenant_id, material_id)

    async def get_inventory_analysis(
        self,
        tenant_id: int,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        warehouse_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        turnover_rate = await self._calculate_turnover_rate(
            tenant_id=tenant_id,
            date_start=date_start,
            date_end=date_end,
            warehouse_id=warehouse_id,
        )
        abc_analysis = await self._calculate_abc_analysis(
            tenant_id=tenant_id,
            warehouse_id=warehouse_id,
        )
        slow_moving_analysis = await self._calculate_slow_moving_analysis(
            tenant_id=tenant_id,
            warehouse_id=warehouse_id,
        )
        return {
            "turnover_rate": turnover_rate,
            "abc_analysis": abc_analysis,
            "slow_moving_analysis": slow_moving_analysis,
        }

    async def _inventory_value_by_material(
        self, tenant_id: int
    ) -> Dict[int, Dict[str, Any]]:
        today = date.today()
        batches = await MaterialBatch.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            quantity__gt=0,
        ).filter(~Q(status__in=["out_stock", "scrapped", "expired"])).filter(
            Q(expiry_date__isnull=True) | Q(expiry_date__gte=today)
        ).all()

        result: Dict[int, Dict[str, Any]] = {}
        for batch in batches:
            mid = int(batch.material_id)
            qty = Decimal(str(batch.quantity or 0))
            unit_cost = await self._material_unit_cost(tenant_id, mid)
            value = qty * unit_cost
            bucket = result.setdefault(
                mid,
                {"quantity": Decimal("0"), "inventory_value": Decimal("0")},
            )
            bucket["quantity"] += qty
            bucket["inventory_value"] += value
        return result

    async def _calculate_turnover_rate(
        self,
        tenant_id: int,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        warehouse_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        if not date_end:
            date_end = resolve_business_datetime()
        if not date_start:
            date_start = date_end - timedelta(days=30)

        outbound_q = SalesDeliveryItem.filter(
            tenant_id=tenant_id,
            status="已出库",
            delivery_time__gte=date_start,
            delivery_time__lte=date_end,
        )
        if warehouse_id:
            delivery_ids = await SalesDelivery.filter(
                tenant_id=tenant_id, warehouse_id=warehouse_id, deleted_at__isnull=True
            ).values_list("id", flat=True)
            outbound_q = outbound_q.filter(delivery_id__in=list(delivery_ids))

        outbound_items = await outbound_q.all()
        outbound_qty_by_material: Dict[int, Decimal] = {}
        outbound_value = Decimal("0")
        for row in outbound_items:
            mid = int(row.material_id)
            qty = Decimal(str(row.delivery_quantity or 0))
            unit_cost = Decimal(str(row.unit_cost or 0))
            if unit_cost <= 0:
                unit_cost = await self._material_unit_cost(tenant_id, mid)
            outbound_qty_by_material[mid] = outbound_qty_by_material.get(mid, Decimal("0")) + qty
            outbound_value += qty * unit_cost

        inv_by_material = await self._inventory_value_by_material(tenant_id)
        avg_inventory = sum(v["inventory_value"] for v in inv_by_material.values()) or Decimal("1")
        total_turnover = float(outbound_value / avg_inventory) if avg_inventory > 0 else 0.0

        top_materials = []
        material_ids = sorted(
            outbound_qty_by_material.keys(),
            key=lambda m: outbound_qty_by_material[m],
            reverse=True,
        )[:10]
        if material_ids:
            materials = {
                m.id: m
                for m in await Material.filter(tenant_id=tenant_id, id__in=material_ids).all()
            }
            for mid in material_ids:
                mat = materials.get(mid)
                inv_val = inv_by_material.get(mid, {}).get("inventory_value", Decimal("0"))
                qty = outbound_qty_by_material[mid]
                rate = float(qty / inv_by_material.get(mid, {}).get("quantity", Decimal("1"))) if mid in inv_by_material else 0.0
                top_materials.append({
                    "material_id": mid,
                    "material_code": getattr(mat, "main_code", None) or getattr(mat, "code", str(mid)),
                    "material_name": getattr(mat, "name", ""),
                    "turnover_rate": round(rate, 2),
                    "inventory_value": float(inv_val),
                })

        return {
            "total_turnover_rate": round(total_turnover, 2),
            "average_turnover_rate": round(total_turnover, 2),
            "period": {"start": to_api_isoformat(date_start), "end": to_api_isoformat(date_end)},
            "top_materials": top_materials,
        }

    async def _calculate_abc_analysis(
        self,
        tenant_id: int,
        warehouse_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        inv_by_material = await self._inventory_value_by_material(tenant_id)
        if not inv_by_material:
            return {
                "category_a": {"count": 0, "percentage": 0, "value": 0, "value_percentage": 0, "materials": []},
                "category_b": {"count": 0, "percentage": 0, "value": 0, "value_percentage": 0, "materials": []},
                "category_c": {"count": 0, "percentage": 0, "value": 0, "value_percentage": 0, "materials": []},
            }

        material_ids = list(inv_by_material.keys())
        materials = {
            m.id: m for m in await Material.filter(tenant_id=tenant_id, id__in=material_ids).all()
        }
        rows = []
        total_value = Decimal("0")
        for mid, data in inv_by_material.items():
            val = data["inventory_value"]
            total_value += val
            mat = materials.get(mid)
            rows.append({
                "material_id": mid,
                "material_code": getattr(mat, "main_code", None) or getattr(mat, "code", str(mid)),
                "material_name": getattr(mat, "name", ""),
                "inventory_value": float(val),
            })
        rows.sort(key=lambda x: x["inventory_value"], reverse=True)

        def _bucket(items, value_pct_label):
            count = len(items)
            value = sum(i["inventory_value"] for i in items)
            total_count = len(rows) or 1
            return {
                "count": count,
                "percentage": round(count / total_count * 100, 1),
                "value": round(value, 2),
                "value_percentage": value_pct_label,
                "materials": items[:20],
            }

        cumulative = Decimal("0")
        a_items, b_items, c_items = [], [], []
        for row in rows:
            cumulative += Decimal(str(row["inventory_value"]))
            pct = float(cumulative / total_value * 100) if total_value > 0 else 0
            if pct <= 80:
                row["percentage"] = round(float(Decimal(str(row["inventory_value"])) / total_value * 100), 2) if total_value else 0
                a_items.append(row)
            elif pct <= 95:
                b_items.append(row)
            else:
                c_items.append(row)

        return {
            "category_a": _bucket(a_items, 80.0),
            "category_b": _bucket(b_items, 15.0),
            "category_c": _bucket(c_items, 5.0),
        }

    async def _calculate_slow_moving_analysis(
        self,
        tenant_id: int,
        warehouse_id: Optional[int] = None,
        days_threshold: int = 90,
    ) -> Dict[str, Any]:
        inv_by_material = await self._inventory_value_by_material(tenant_id)
        cutoff = resolve_business_datetime() - timedelta(days=days_threshold)

        outbound_rows = await SalesDeliveryItem.filter(
            tenant_id=tenant_id,
            status="已出库",
            delivery_time__isnull=False,
        ).all()
        last_outbound: Dict[int, datetime] = {}
        for row in outbound_rows:
            mid = int(row.material_id)
            ts = row.delivery_time
            if ts and (mid not in last_outbound or ts > last_outbound[mid]):
                last_outbound[mid] = ts

        candidate_rows: List[Dict[str, Any]] = []
        now = resolve_business_datetime()
        for mid, data in inv_by_material.items():
            qty = data["quantity"]
            if qty <= 0:
                continue
            last = last_outbound.get(mid)
            if last and last >= cutoff:
                continue
            days_since = (now - last).days if last else days_threshold + 1
            candidate_rows.append({
                "material_id": mid,
                "quantity": qty,
                "inventory_value": data["inventory_value"],
                "last": last,
                "days_since": days_since,
            })

        mat_map: Dict[int, Any] = {}
        if candidate_rows:
            mat_ids = [int(r["material_id"]) for r in candidate_rows]
            mats = await Material.filter(tenant_id=tenant_id, id__in=mat_ids).all()
            mat_map = {int(m.id): m for m in mats}

        materials = []
        total_value = Decimal("0")
        for row in candidate_rows:
            mid = int(row["material_id"])
            mat = mat_map.get(mid)
            value = row["inventory_value"]
            total_value += value
            materials.append({
                "material_id": mid,
                "material_code": getattr(mat, "main_code", None) or getattr(mat, "code", str(mid)),
                "material_name": getattr(mat, "name", "") if mat else "",
                "inventory_quantity": float(row["quantity"]),
                "inventory_value": float(value),
                "last_outbound_date": to_api_isoformat(row["last"]) if row["last"] else None,
                "days_since_last_outbound": row["days_since"],
            })

        materials.sort(key=lambda x: x["inventory_value"], reverse=True)
        return {
            "total_count": len(materials),
            "total_value": float(total_value),
            "materials": materials[:50],
        }

    async def get_inventory_cost_analysis(
        self,
        tenant_id: int,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        warehouse_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        if not date_start:
            date_start = resolve_business_datetime() - timedelta(days=30)
        if not date_end:
            date_end = resolve_business_datetime()

        inv_by_material = await self._inventory_value_by_material(tenant_id)
        total_cost = sum(v["inventory_value"] for v in inv_by_material.values())

        mat_map: Dict[int, Any] = {}
        if inv_by_material:
            mats = await Material.filter(
                tenant_id=tenant_id,
                id__in=list(inv_by_material.keys()),
            ).all()
            mat_map = {int(m.id): m for m in mats}

        by_category: Dict[str, Decimal] = {}
        for mid, data in inv_by_material.items():
            mat = mat_map.get(int(mid))
            cat = (
                (getattr(mat, "material_type", None) or getattr(mat, "category", None) or "未分类")
                if mat
                else "未分类"
            )
            by_category[str(cat)] = by_category.get(str(cat), Decimal("0")) + data["inventory_value"]

        by_category_rows = [
            {
                "category": k,
                "cost": float(v),
                "percentage": round(float(v / total_cost * 100), 1) if total_cost else 0,
            }
            for k, v in sorted(by_category.items(), key=lambda x: x[1], reverse=True)
        ]

        inbound_rows = await PurchaseReceiptItem.filter(
            tenant_id=tenant_id,
            status="已入库",
            receipt_time__gte=date_start,
            receipt_time__lte=date_end,
        ).all()
        daily_inbound: Dict[str, Decimal] = {}
        for row in inbound_rows:
            if not row.receipt_time:
                continue
            key = to_api_isoformat(row.receipt_time.date())
            qty = Decimal(str(row.receipt_quantity or 0))
            unit = Decimal(str(row.unit_price or 0))
            daily_inbound[key] = daily_inbound.get(key, Decimal("0")) + qty * unit

        trend_data = []
        day_count = max((date_end.date() - date_start.date()).days, 0)
        running = float(total_cost)
        for i in range(day_count + 1):
            d = to_api_isoformat(date_start.date() + timedelta(days=i))
            running += float(daily_inbound.get(d, Decimal("0")))
            trend_data.append({"date": d, "cost": round(running, 2)})

        return {
            "period": {"start": to_api_isoformat(date_start), "end": to_api_isoformat(date_end)},
            "summary": {
                "total_cost": float(total_cost),
                "average_cost": float(total_cost / len(inv_by_material)) if inv_by_material else 0.0,
                "cost_trend": "stable",
            },
            "by_category": by_category_rows,
            "by_warehouse": [{"warehouse_id": warehouse_id or 0, "warehouse_name": "全部", "cost": float(total_cost), "percentage": 100.0}],
            "trend_data": trend_data,
        }
