"""
管理会计综合报表服务
"""

from datetime import date, datetime, timedelta
from typing import Dict, Any, List, Optional
from decimal import Decimal
from tortoise.functions import Sum

from apps.kuaicaiwu.models.receivable import Receivable
from apps.kuaicaiwu.models.cost_calculation import CostCalculation
from apps.kuaicaiwu.models.standard_cost import StandardCost
from apps.kuaizhizao.models.sales_delivery import SalesDelivery
from apps.kuaizhizao.models.sales_delivery_item import SalesDeliveryItem
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.models.scrap_record import ScrapRecord
from apps.kuaizhizao.models.reporting_record import ReportingRecord
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.master_data.models.material import Material
from apps.master_data.models.material_batch import MaterialBatch
from apps.kuaicaiwu.services.finance_service import ReceivableService
from core.utils.timezone_utils import to_api_isoformat


def _unit_price_from_defaults(defaults: Any) -> Decimal:
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


def _sum_from_aggregate(rows: List[Dict[str, Any]], key: str = "total") -> Decimal:
    """Tortoise aggregate 在无匹配行时 values() 可能为空列表。"""
    if not rows:
        return Decimal("0")
    return Decimal(str(rows[0].get(key) or 0))


class ManagementReportService:
    """
    管理会计报表服务
    
    聚合财务与生产数据，计算 DSO、毛利率、库存周转率等关键指标。
    """
    
    def __init__(self):
        self.receivable_service = ReceivableService()

    async def _total_inventory_value(self, tenant_id: int) -> Decimal:
        batches = await MaterialBatch.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            quantity__gt=0,
            status="in_stock",
        ).all()
        if not batches:
            return Decimal("0")

        qty_by_material: Dict[int, Decimal] = {}
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
        return total.quantize(Decimal("0.01"))

    async def _material_unit_cost(self, tenant_id: int, material_id: int) -> Decimal:
        sc = await StandardCost.filter(
            tenant_id=tenant_id,
            target_type="material",
            target_id=material_id,
            cost_item_type="material_cost",
            is_active=True,
            deleted_at__isnull=True,
        ).order_by("-effective_date", "-id").first()
        if sc:
            return Decimal(str(sc.standard_value or 0))

        calc = await CostCalculation.filter(
            tenant_id=tenant_id,
            product_id=material_id,
            calculation_status="已审核",
            deleted_at__isnull=True,
        ).order_by("-calculation_date", "-id").first()
        if calc and calc.unit_cost:
            return Decimal(str(calc.unit_cost))

        material = await Material.get_or_none(tenant_id=tenant_id, id=material_id, deleted_at__isnull=True)
        if material:
            return _unit_price_from_defaults(material.defaults)
        return Decimal("0")

    async def get_financial_kpis(self, tenant_id: int, days: int = 30) -> Dict[str, Any]:
        """获取关键财务指标"""
        start_date = date.today() - timedelta(days=days)
        period_start = datetime.combine(start_date, datetime.min.time())
        
        delivery_rows = await SalesDelivery.filter(
            tenant_id=tenant_id,
            status="已出库",
            delivery_time__gte=period_start,
            deleted_at__isnull=True,
        ).all()
        delivery_ids = [d.id for d in delivery_rows]
        total_sales = sum((Decimal(str(d.total_amount or 0)) for d in delivery_rows), Decimal("0"))

        cogs_total = Decimal("0")
        if delivery_ids:
            delivery_items = await SalesDeliveryItem.filter(
                tenant_id=tenant_id,
                delivery_id__in=delivery_ids,
            ).all()
            unit_cost_cache: Dict[int, Decimal] = {}
            for item in delivery_items:
                qty = Decimal(str(item.delivery_quantity or 0))
                if qty <= 0:
                    continue
                mid = int(item.material_id)
                line_unit_cost = Decimal(str(item.unit_cost or 0))
                if line_unit_cost > 0:
                    unit_cost = line_unit_cost
                elif mid not in unit_cost_cache:
                    unit_cost_cache[mid] = await self._material_unit_cost(tenant_id, mid)
                    unit_cost = unit_cost_cache[mid]
                else:
                    unit_cost = unit_cost_cache[mid]
                cogs_total += qty * unit_cost

        receivables = await Receivable.filter(
            tenant_id=tenant_id, 
            remaining_amount__gt=0,
            deleted_at__isnull=True
        ).annotate(total=Sum("remaining_amount")).values("total")
        ar_balance = _sum_from_aggregate(receivables, "total")
        
        dso = (ar_balance / total_sales * days) if total_sales > 0 else Decimal("0")

        gross_profit = total_sales - cogs_total
        gross_margin_rate = (gross_profit / total_sales) if total_sales > 0 else Decimal("0")

        inventory_total = await self._total_inventory_value(tenant_id)
        inventory_turnover = (
            (cogs_total * Decimal(str(365)) / Decimal(str(days)) / inventory_total)
            if inventory_total > 0 and days > 0
            else Decimal("0")
        )

        aging = await self.receivable_service.get_receivable_aging_analysis(tenant_id)

        return {
            "period_days": days,
            "total_sales": float(total_sales),
            "cogs_total": float(cogs_total.quantize(Decimal("0.01"))),
            "ar_balance": float(ar_balance),
            "dso": round(float(dso), 2),
            "gross_margin_rate": round(float(gross_margin_rate), 4),
            "inventory_total": float(inventory_total),
            "inventory_turnover": round(float(inventory_turnover), 2),
            "receivable_aging": aging
        }

    async def get_quality_loss_analysis(self, tenant_id: int, days: int = 30) -> Dict[str, Any]:
        """质量损失成本分析"""
        start_date = date.today() - timedelta(days=days)
        
        scraps = await ScrapRecord.filter(
            tenant_id=tenant_id,
            status="confirmed",
            created_at__gte=start_date,
            deleted_at__isnull=True
        ).annotate(total=Sum("total_cost")).values("total")
        scrap_cost = _sum_from_aggregate(scraps, "total")

        reportings = await ReportingRecord.filter(
            tenant_id=tenant_id,
            status="approved",
            reported_at__gte=start_date,
            deleted_at__isnull=True
        ).annotate(total_unqualified=Sum("unqualified_quantity")).values("total_unqualified")
        unqualified_qty = _sum_from_aggregate(reportings, "total_unqualified")

        return {
            "period_days": days,
            "scrap_cost": float(scrap_cost),
            "unqualified_quantity": float(unqualified_qty),
            "quality_loss_total": float(scrap_cost)
        }

    async def get_labor_efficiency_analysis(self, tenant_id: int, days: int = 30) -> Dict[str, Any]:
        """人工效能分析"""
        start_date = date.today() - timedelta(days=days)
        
        records = await ReportingRecord.filter(
            tenant_id=tenant_id,
            status="approved",
            reported_at__gte=start_date,
            deleted_at__isnull=True
        ).all()
        
        total_actual_hours = sum(r.work_hours for r in records)
        total_standard_hours = sum(r.qualified_quantity * Decimal("0.5") for r in records)
        
        efficiency = (total_standard_hours / total_actual_hours * 100) if total_actual_hours > 0 else Decimal(0)

        return {
            "period_days": days,
            "actual_work_hours": float(total_actual_hours),
            "standard_work_hours": float(total_standard_hours),
            "labor_efficiency_rate": round(float(efficiency), 2)
        }

    async def get_wip_valuation(self, tenant_id: int) -> Dict[str, Any]:
        """在制品 (WIP) 价值实时跟踪"""
        active_orders = await WorkOrder.filter(
            tenant_id=tenant_id,
            status__in=["released", "in_progress"],
            deleted_at__isnull=True
        ).all()

        if not active_orders:
            return {
                "active_work_orders_count": 0,
                "estimated_wip_value": 0.0,
                "generated_at": to_api_isoformat(date.today()),
                "items": [],
                "realtime_window_minutes": 10,
                "realtime_visible_ratio": 0.0,
            }

        work_order_ids = [o.id for o in active_orders]
        reporting_rows = await ReportingRecord.filter(
            tenant_id=tenant_id,
            work_order_id__in=work_order_ids,
            status="approved",
            deleted_at__isnull=True,
        ).all()

        reporting_stats: Dict[int, Dict[str, Any]] = {}
        for row in reporting_rows:
            data = reporting_stats.setdefault(
                row.work_order_id,
                {
                    "reported_qualified_qty": Decimal("0.00"),
                    "reported_unqualified_qty": Decimal("0.00"),
                    "reported_hours": Decimal("0.00"),
                    "latest_reported_at": None,
                },
            )
            data["reported_qualified_qty"] += Decimal(str(row.qualified_quantity or 0))
            data["reported_unqualified_qty"] += Decimal(str(row.unqualified_quantity or 0))
            data["reported_hours"] += Decimal(str(row.work_hours or 0))
            ts = row.reported_at
            if ts and (data["latest_reported_at"] is None or ts > data["latest_reported_at"]):
                data["latest_reported_at"] = ts

        now = date.today()
        realtime_cutoff = timedelta(minutes=10)
        total_wip_value = Decimal("0.00")
        realtime_visible_count = 0
        items: List[Dict[str, Any]] = []

        for order in active_orders:
            latest_calc = await CostCalculation.filter(
                tenant_id=tenant_id,
                work_order_id=order.id,
                calculation_type="工单成本",
                deleted_at__isnull=True,
            ).order_by("-created_at").first()

            stats = reporting_stats.get(order.id, {})
            planned_qty = Decimal(str(order.quantity or 0))
            completed_qty = Decimal(str(order.completed_quantity or 0))
            wip_qty = planned_qty - completed_qty
            if wip_qty < Decimal("0.00"):
                wip_qty = Decimal("0.00")

            unit_cost = Decimal(str(latest_calc.unit_cost)) if latest_calc else Decimal("0.00")
            wip_value = (wip_qty * unit_cost).quantize(Decimal("0.01"))
            total_wip_value += wip_value

            latest_reported_at = stats.get("latest_reported_at")
            latest_cost_at = latest_calc.created_at if latest_calc else None
            latest_update_at = max(
                [v for v in [latest_reported_at, latest_cost_at, order.updated_at] if v is not None],
                default=None,
            )
            if latest_update_at and (latest_update_at.date() == now):
                realtime_visible_count += 1

            items.append(
                {
                    "work_order_id": order.id,
                    "work_order_code": order.code,
                    "product_id": order.product_id,
                    "product_code": order.product_code,
                    "product_name": order.product_name,
                    "status": order.status,
                    "planned_quantity": float(planned_qty),
                    "completed_quantity": float(completed_qty),
                    "wip_quantity": float(wip_qty),
                    "unit_cost": float(unit_cost),
                    "estimated_wip_value": float(wip_value),
                    "reported_qualified_quantity": float(stats.get("reported_qualified_qty", Decimal("0.00"))),
                    "reported_unqualified_quantity": float(stats.get("reported_unqualified_qty", Decimal("0.00"))),
                    "reported_work_hours": float(stats.get("reported_hours", Decimal("0.00"))),
                    "latest_reported_at": to_api_isoformat(latest_reported_at) if latest_reported_at else None,
                    "latest_cost_calculated_at": to_api_isoformat(latest_cost_at) if latest_cost_at else None,
                    "latest_update_at": to_api_isoformat(latest_update_at) if latest_update_at else None,
                }
            )

        items.sort(key=lambda x: x["latest_update_at"] or "", reverse=True)
        total_count = len(items)
        realtime_ratio = (realtime_visible_count / total_count) if total_count else 0.0

        return {
            "active_work_orders_count": total_count,
            "estimated_wip_value": float(total_wip_value.quantize(Decimal("0.01"))),
            "generated_at": to_api_isoformat(now),
            "realtime_window_minutes": int(realtime_cutoff.total_seconds() / 60),
            "realtime_visible_ratio": round(realtime_ratio, 4),
            "items": items,
        }

    async def get_cost_variance_report(self, tenant_id: int, product_id: int) -> Dict[str, Any]:
        """
        获取成本差异分析报告 (标准 vs 实际)
        """
        from apps.kuaicaiwu.services.cost_service import CostCalculationService
        cs = CostCalculationService()
        try:
            comparison = await cs.compare_costs(tenant_id, product_id)
            return comparison.model_dump()
        except Exception as e:
            return {"error": str(e)}

    async def _aggregate_delivery_margin_rows(
        self,
        tenant_id: int,
        *,
        days: int = 30,
        group_by: str,
    ) -> List[Dict[str, Any]]:
        start = datetime.combine(date.today() - timedelta(days=days), datetime.min.time())
        deliveries = await SalesDelivery.filter(
            tenant_id=tenant_id,
            status="已出库",
            delivery_time__gte=start,
            deleted_at__isnull=True,
        ).all()
        if not deliveries:
            return []

        delivery_map = {d.id: d for d in deliveries}
        items = await SalesDeliveryItem.filter(
            tenant_id=tenant_id,
            delivery_id__in=list(delivery_map.keys()),
        ).all()

        buckets: Dict[Any, Dict[str, Decimal]] = {}
        for item in items:
            qty = Decimal(str(item.delivery_quantity or 0))
            if qty <= 0:
                continue
            delivery = delivery_map.get(item.delivery_id)
            if not delivery:
                continue
            revenue = qty * Decimal(str(item.unit_price or 0))
            unit_cost = Decimal(str(item.unit_cost or 0))
            if unit_cost <= 0:
                unit_cost = await self._material_unit_cost(tenant_id, int(item.material_id))
            cost = qty * unit_cost

            if group_by == "product":
                key = int(item.material_id)
                label = item.material_name or item.material_code
                extra = {"product_id": key, "product_code": item.material_code, "product_name": label}
            elif group_by == "customer":
                key = int(delivery.customer_id)
                extra = {"customer_id": key, "customer_name": delivery.customer_name}
            else:
                key = delivery.sales_order_id or delivery.id
                extra = {
                    "sales_order_id": delivery.sales_order_id,
                    "delivery_id": delivery.id,
                    "delivery_code": delivery.delivery_code,
                }

            bucket = buckets.setdefault(key, {"revenue": Decimal("0"), "cost": Decimal("0"), **extra})
            bucket["revenue"] += revenue
            bucket["cost"] += cost

        rows = []
        for bucket in buckets.values():
            rev = bucket["revenue"]
            cost = bucket["cost"]
            margin = rev - cost
            rate = (margin / rev) if rev > 0 else Decimal("0")
            rows.append({
                **{k: v for k, v in bucket.items() if k not in ("revenue", "cost")},
                "revenue": float(rev.quantize(Decimal("0.01"))),
                "cost": float(cost.quantize(Decimal("0.01"))),
                "gross_margin": float(margin.quantize(Decimal("0.01"))),
                "gross_margin_rate": round(float(rate), 4),
            })
        rows.sort(key=lambda x: x["gross_margin"], reverse=True)
        return rows

    async def get_margin_by_product(self, tenant_id: int, days: int = 30) -> Dict[str, Any]:
        items = await self._aggregate_delivery_margin_rows(tenant_id, days=days, group_by="product")
        return {"period_days": days, "items": items}

    async def get_margin_by_customer(self, tenant_id: int, days: int = 30) -> Dict[str, Any]:
        items = await self._aggregate_delivery_margin_rows(tenant_id, days=days, group_by="customer")
        return {"period_days": days, "items": items}

    async def get_margin_by_order(self, tenant_id: int, days: int = 30) -> Dict[str, Any]:
        items = await self._aggregate_delivery_margin_rows(tenant_id, days=days, group_by="order")
        order_ids = [i["sales_order_id"] for i in items if i.get("sales_order_id")]
        order_map = {}
        if order_ids:
            orders = await SalesOrder.filter(tenant_id=tenant_id, id__in=order_ids).all()
            order_map = {o.id: o.order_code for o in orders}
        for row in items:
            so_id = row.get("sales_order_id")
            row["sales_order_code"] = order_map.get(so_id) if so_id else None
        return {"period_days": days, "items": items}
