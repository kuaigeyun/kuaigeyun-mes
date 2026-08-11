"""
报表服务模块

提供各类报表分析功能，包括库存报表、生产报表、质量报表等。

Author: Luigi Lu
Date: 2025-01-15
"""

from datetime import datetime, timedelta, date
from typing import List, Optional, Dict, Any, Tuple
from decimal import Decimal

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.utils.inventory_helper import get_material_available_quantity, get_material_inventory_info
from core.services.authorization.data_scope_service import DataScopeService
from core.utils.timezone_utils import resolve_business_datetime, to_api_isoformat
from infra.exceptions.exceptions import NotFoundError, ValidationError
from loguru import logger

PRODUCTION_WO_QUERY_SORT = frozenset({"code", "product_name", "quantity", "status", "created_at"})
PRODUCTION_WO_TRACKING_SORT = frozenset({
    "code", "product_name", "quantity", "completed_quantity", "status",
    "planned_start_date", "planned_end_date",
})
PRODUCTION_MATERIAL_USAGE_SORT = frozenset({"work_order_code", "material_name", "quantity", "created_at"})
PRODUCTION_LABOR_DETAIL_SORT = frozenset({
    "work_order_code", "operation_name", "worker_name", "qualified_quantity", "work_hours", "reported_at",
})
PRODUCTION_SCRAP_ANALYSIS_SORT = frozenset({"defect_reason", "count"})
PRODUCTION_DELAY_WARNING_SORT = frozenset({
    "code", "product_name", "planned_end_date", "status", "quantity", "completed_quantity",
})
PRODUCTION_OUTSOURCE_QUERY_SORT = frozenset({
    "code", "supplier_name", "product_name", "quantity", "status", "planned_end_date", "created_at",
})
PRODUCTION_OUTSOURCE_RECON_SORT = frozenset({
    "code", "outsource_work_order_code", "material_code", "material_name", "quantity", "status", "created_at",
})


def _resolve_production_report_order_by(
    order_by: Optional[str],
    allowed: frozenset,
    default: str,
    *,
    field_aliases: Optional[Dict[str, str]] = None,
) -> str:
    if not order_by:
        return default
    descending = str(order_by).startswith("-")
    field = str(order_by).lstrip("-")
    if field_aliases and field in field_aliases:
        field = field_aliases[field]
    if field not in allowed:
        return default
    return f"-{field}" if descending else field


class ReportService:
    """
    报表服务类

    处理各类报表分析相关的业务逻辑。
    """

    @staticmethod
    def _json_safe(value: Any) -> Any:
        """将 Decimal / datetime 等转为 JSON 可序列化值，避免响应 500。"""
        if value is None:
            return None
        if isinstance(value, Decimal):
            return float(value)
        if isinstance(value, datetime):
            return to_api_isoformat(value)
        if isinstance(value, date):
            return to_api_isoformat(value)
        if isinstance(value, dict):
            return {k: ReportService._json_safe(v) for k, v in value.items()}
        if isinstance(value, (list, tuple)):
            return [ReportService._json_safe(v) for v in value]
        return value

    @staticmethod
    def _as_date(value: Any) -> Optional[date]:
        if value is None:
            return None
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        return None

    @classmethod
    def _wrap_report_payload(cls, payload: Dict[str, Any]) -> Dict[str, Any]:
        return cls._json_safe(payload)

    @staticmethod
    async def _aggregate_sums(qs, field_map: Dict[str, str]) -> Dict[str, float]:
        """Tortoise QuerySet 无 Django 式 aggregate()，用 annotate + values 汇总。"""
        from tortoise.functions import Sum

        if not field_map:
            return {}
        annotations = {alias: Sum(field) for alias, field in field_map.items()}
        rows = await qs.annotate(**annotations).values(*field_map.keys())
        if not rows:
            return {alias: 0.0 for alias in field_map}
        row = rows[0]
        return {alias: float(row.get(alias) or 0) for alias in field_map}

    @staticmethod
    def _normalize_warehouse_display_name(warehouse_name: Optional[str]) -> str:
        name = str(warehouse_name or "").strip()
        return name or "未配置仓库"

    @staticmethod
    def _normalize_batch_no_for_report(batch_no: Optional[str]) -> str:
        """空批号与库存过账口径一致，展示/拣选用 DEFAULT。"""
        bn = str(batch_no or "").strip()
        return bn if bn else "DEFAULT"

    @staticmethod
    def _material_batch_matches_warehouse_filter(
        resolved_wh_id: Optional[int],
        main_warehouse_filter_id: Optional[int],
    ) -> bool:
        """主仓按 warehouse_id 筛选；未归属行仅在未指定仓库时计入。"""
        if main_warehouse_filter_id is None:
            return True
        if resolved_wh_id is None:
            return False
        return resolved_wh_id == main_warehouse_filter_id

    async def _scoped_sales_order_query(self, tenant_id: int, current_user: Optional[Any] = None):
        from apps.kuaizhizao.models.sales_order import SalesOrder

        query = SalesOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if current_user is None:
            return query
        return await DataScopeService.apply(
            query,
            tenant_id=tenant_id,
            user=current_user,
            resource="kuaizhizao:sales-order",
        )

    async def _scoped_quotation_query(self, tenant_id: int, current_user: Optional[Any] = None):
        from apps.kuaizhizao.models.quotation import Quotation

        query = Quotation.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if current_user is None:
            return query
        return await DataScopeService.apply(
            query,
            tenant_id=tenant_id,
            user=current_user,
            resource="kuaizhizao:quotation",
        )

    async def _scoped_purchase_order_query(self, tenant_id: int, current_user: Optional[Any] = None):
        from apps.kuaizhizao.models.purchase_order import PurchaseOrder

        query = PurchaseOrder.filter(tenant_id=tenant_id)
        if current_user is None:
            return query
        return await DataScopeService.apply(
            query,
            tenant_id=tenant_id,
            user=current_user,
            resource="kuaizhizao:purchase-order",
        )

    async def _scoped_work_order_query(self, tenant_id: int, current_user: Optional[Any] = None):
        from apps.kuaizhizao.models.work_order import WorkOrder

        query = WorkOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if current_user is None:
            return query
        return await DataScopeService.apply(
            query,
            tenant_id=tenant_id,
            user=current_user,
            resource="kuaizhizao:work-order",
        )

    async def _scoped_sales_contract_query(self, tenant_id: int, current_user: Optional[Any] = None):
        from apps.kuaizhizao.models.sales_contract import SalesContract

        query = SalesContract.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if current_user is None:
            return query
        return await DataScopeService.apply(
            query,
            tenant_id=tenant_id,
            user=current_user,
            resource="kuaizhizao:sales-contract",
        )

    async def get_inventory_report(
        self,
        tenant_id: int,
        report_type: str = "summary",
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        warehouse_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        获取库存报表数据
        """
        if report_type in ["summary", "inventory-summary", "inventory_summary"]:
            return await self._get_inventory_summary_v2(
                tenant_id=tenant_id,
                warehouse_id=warehouse_id,
            )
        elif report_type in [
            "turnover", "inventory-turnover", "inventory_turnover",
            "abc", "inventory-abc",
        ]:
            raise ValidationError(f"报表已下线: {report_type}")
        elif report_type in ["slow_moving", "slow-moving-analysis", "slow_moving_analysis"]:
            from apps.kuaizhizao.services.report_enhancements import build_slow_moving_inventory
            payload = await build_slow_moving_inventory(
                tenant_id, warehouse_id=warehouse_id,
            )
            return self._wrap_report_payload(payload)
        else:
            raise ValidationError(f"不支持的报表类型: {report_type}")

    async def _get_inventory_summary_v2(
        self,
        tenant_id: int,
        warehouse_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """获取库存状况分析"""
        from apps.master_data.models.material_batch import MaterialBatch
        from apps.kuaizhizao.models.inventory_alert import InventoryAlert
        from tortoise.functions import Sum

        # 1. 基础查询
        batch_query = MaterialBatch.filter(
            tenant_id=tenant_id, 
            deleted_at__isnull=True, 
            quantity__gt=0, 
            status="in_stock"
        )
        # TODO: 如果有仓库关联，需要在这里过滤（目前 MaterialBatch 模型没看到直接关联仓库，可能通过其他方式或在主表中）
        
        # 2. 统计汇总
        material_ids = await batch_query.values_list("material_id", flat=True)
        total_materials = len(set(material_ids)) if material_ids else 0
        
        agg = await self._aggregate_sums(batch_query, {"total_qty": "quantity"})
        total_quantity = float(agg.get("total_qty") or 0)
        
        # 3. 预警统计
        alert_base = InventoryAlert.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="pending")
        if warehouse_id:
            alert_base = alert_base.filter(warehouse_id=warehouse_id)
            
        low_stock_alerts = alert_base.filter(alert_type="low_stock")
        out_of_stock_count = await low_stock_alerts.filter(current_quantity=0).count()
        low_stock_count = await low_stock_alerts.filter(current_quantity__gt=0).count()
        high_stock_count = await alert_base.filter(alert_type="high_stock").count()
        
        # 4. 获取明细数据 (聚合每个物料的库存)
        # 注意：这里需要 prefetch_related('material') 如果需要物料名称
        batches = await batch_query.prefetch_related('material').all()
        material_summary = {}
        main_wh_cache: Dict[int, Optional[Tuple[int, str]]] = {}
        for b in batches:
            resolved_wh = await self._resolve_material_default_warehouse_for_report(
                tenant_id=tenant_id,
                material=getattr(b, "material", None),
                cache=main_wh_cache,
            )
            resolved_wh_id = int(resolved_wh[0]) if resolved_wh else None
            resolved_wh_name = self._normalize_warehouse_display_name(
                resolved_wh[1] if resolved_wh else None
            )
            if warehouse_id and resolved_wh_id != int(warehouse_id):
                continue
            mid = b.material_id
            key = (mid, resolved_wh_name)
            if key not in material_summary:
                material_summary[key] = {
                    "material_code": b.material.main_code if b.material else "Unknown",
                    "material_name": b.material.name if b.material else "Unknown",
                    "closing_qty": 0.0,
                    "inbound_qty": 0.0, # 简化处理，实际需要从记录表中统计
                    "outbound_qty": 0.0,
                    "opening_qty": 0.0,
                    "warehouse_name": resolved_wh_name,
                }
            material_summary[key]["closing_qty"] += float(b.quantity or 0)

        total_value = 0.0
        try:
            from apps.kuaicaiwu.services.inventory_cost_service import InventoryCostService
            cost_svc = InventoryCostService()
            seen_mids: set[int] = set()
            for b in batches:
                mid = int(b.material_id)
                if mid in seen_mids:
                    continue
                seen_mids.add(mid)
                unit_cost = float(await cost_svc.get_material_unit_cost(tenant_id, mid))
                qty_sum = sum(
                    float(x.quantity or 0)
                    for x in batches
                    if int(x.material_id) == mid
                )
                total_value += qty_sum * unit_cost
        except Exception as exc:
            logger.warning("库存状况 valuation 失败: {}", exc)

        items = list(material_summary.values())

        return {
            "summary": {
                "total_materials": total_materials,
                "total_quantity": round(total_quantity, 2),
                "total_value": round(total_value, 2),
                "low_stock_count": low_stock_count,
                "out_of_stock_count": out_of_stock_count,
                "high_stock_count": high_stock_count,
            },
            "data": items,
            "total": len(items),
            "success": True
        }

    async def _get_inventory_turnover(
        self,
        tenant_id: int,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        warehouse_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """获取库存周转率报表"""
        logger.warning("库存周转率报表为简化实现，返回示例数据")
        if not date_start: date_start = resolve_business_datetime() - timedelta(days=30)
        if not date_end: date_end = resolve_business_datetime()
        return {
            "period": {"start": to_api_isoformat(date_start), "end": to_api_isoformat(date_end)},
            "summary": {"avg_turnover_rate": 0.0, "avg_turnover_days": 0.0},
            "items": [],
        }

    async def _get_abc_analysis(
        self,
        tenant_id: int,
        warehouse_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """获取ABC分析报表"""
        logger.warning("ABC分析报表为简化实现，返回示例数据")
        return {
            "summary": {
                "class_a_count": 0, "class_a_value": 0.0, "class_a_percentage": 0.0,
                "class_b_count": 0, "class_b_value": 0.0, "class_b_percentage": 0.0,
                "class_c_count": 0, "class_c_value": 0.0, "class_c_percentage": 0.0,
            },
            "items": [],
        }

    async def _get_slow_moving_analysis(
        self,
        tenant_id: int,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        warehouse_id: Optional[int] = None,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> Dict[str, Any]:
        """获取呆滞料分析报表"""
        from apps.kuaizhizao.services.report_enhancements import build_slow_moving_inventory
        return await build_slow_moving_inventory(
            tenant_id,
            warehouse_id=warehouse_id,
            skip=skip,
            limit=limit,
        )

    async def get_production_report(
        self,
        tenant_id: int,
        report_type: str = "work-order-summary",
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        work_center_id: Optional[int] = None,
        *,
        skip: int = 0,
        limit: int = 100,
        keyword: Optional[str] = None,
        order_by: Optional[str] = None,
        status: Optional[str] = None,
        order_code: Optional[str] = None,
        product_name: Optional[str] = None,
        supplier_name: Optional[str] = None,
        work_order_code: Optional[str] = None,
    ) -> Dict[str, Any]:
        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.kuaizhizao.models.reporting_record import ReportingRecord
        from apps.kuaizhizao.models.material_binding import MaterialBinding
        from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
        from apps.kuaizhizao.models.defect_record import DefectRecord
        from tortoise.functions import Sum, Count
        from tortoise.expressions import Q
        from datetime import date

        prod_aliases = {
            "wo_query": "work-order-query",
            "wo_tracking": "work-order-execution-report",
            "scrap_analysis": "scrap-reason-analysis",
            "first_pass_yield": "first-pass-yield-analysis",
            "first_pass_yield_work_order": "first-pass-yield-work-order",
            "first_pass_yield_rty": "first-pass-yield-rty",
            "wo_material_usage": "work-order-material-usage",
            "wo_labor_detail": "process-completion-report",
            "outsource_query": "outsource-work-order-query",
            "outsource_recon": "outsource-material-reconciliation",
        }
        report_type = prod_aliases.get(report_type, report_type)

        lim = max(1, min(int(limit or 100), 500))
        sk = max(0, int(skip or 0))
        kw = (keyword or "").strip()
        wo_aliases = {"order_code": "code", "plan_qty": "quantity", "overall_progress": "completed_quantity"}

        if report_type in ["work-order-query", "wo_query"]:
            wo_q = WorkOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)
            if date_start:
                wo_q = wo_q.filter(created_at__gte=date_start)
            if date_end:
                wo_q = wo_q.filter(created_at__lte=date_end)
            if work_center_id:
                wo_q = wo_q.filter(work_center_id=work_center_id)
            if status:
                wo_q = wo_q.filter(status=status)
            oc = (order_code or "").strip()
            if oc:
                wo_q = wo_q.filter(code__icontains=oc)
            pn = (product_name or "").strip()
            if pn:
                wo_q = wo_q.filter(product_name__icontains=pn)
            if kw:
                wo_q = wo_q.filter(Q(code__icontains=kw) | Q(product_name__icontains=kw))
            total = await wo_q.count()
            order_clause = _resolve_production_report_order_by(
                order_by, PRODUCTION_WO_QUERY_SORT, "-created_at", field_aliases=wo_aliases,
            )
            items = await wo_q.order_by(order_clause).offset(sk).limit(lim).values(
                "code", "product_name", "quantity", "status", "created_at"
            )
            for it in items:
                it["order_code"] = it.get("code")
                it["plan_qty"] = float(it.get("quantity") or 0)
            return self._wrap_report_payload({"data": items, "success": True, "total": total})

        if report_type in ["work-order-execution-report", "efficiency", "wo_tracking"]:
            wo_q = WorkOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)
            if date_start:
                wo_q = wo_q.filter(planned_start_date__gte=date_start)
            if date_end:
                wo_q = wo_q.filter(planned_end_date__lte=date_end)
            if work_center_id:
                wo_q = wo_q.filter(work_center_id=work_center_id)
            if status:
                wo_q = wo_q.filter(status=status)
            oc = (order_code or work_order_code or "").strip()
            if oc:
                wo_q = wo_q.filter(code__icontains=oc)
            pn = (product_name or "").strip()
            if pn:
                wo_q = wo_q.filter(product_name__icontains=pn)
            if kw:
                wo_q = wo_q.filter(Q(code__icontains=kw) | Q(product_name__icontains=kw))
            total = await wo_q.count()
            order_clause = _resolve_production_report_order_by(
                order_by, PRODUCTION_WO_TRACKING_SORT, "-planned_end_date", field_aliases=wo_aliases,
            )
            items = await wo_q.order_by(order_clause).offset(sk).limit(lim).values(
                "code", "product_name", "quantity", "completed_quantity", "status",
                "planned_start_date", "planned_end_date",
            )
            for it in items:
                planned = float(it.get("quantity") or 0)
                actual = float(it.get("completed_quantity") or 0)
                it["order_code"] = it.get("code")
                it["planned_qty"] = planned
                it["actual_qty"] = actual
                it["overall_progress"] = round((actual / planned * 100) if planned > 0 else 0, 2)
            return self._wrap_report_payload({"data": items, "success": True, "total": total})

        if report_type == "work-order-material-usage":
            q = MaterialBinding.filter(tenant_id=tenant_id, binding_type="feeding", deleted_at__isnull=True)
            if date_start:
                q = q.filter(created_at__gte=date_start)
            if date_end:
                q = q.filter(created_at__lte=date_end)
            woc = (work_order_code or order_code or "").strip()
            if woc:
                q = q.filter(work_order_code__icontains=woc)
            pn = (product_name or "").strip()
            if pn:
                q = q.filter(material_name__icontains=pn)
            if kw:
                q = q.filter(Q(work_order_code__icontains=kw) | Q(material_name__icontains=kw))
            total = await q.count()
            order_clause = _resolve_production_report_order_by(
                order_by, PRODUCTION_MATERIAL_USAGE_SORT, "-created_at",
                field_aliases={"order_code": "work_order_code", "actual_qty": "quantity"},
            )
            rows = await q.order_by(order_clause).offset(sk).limit(lim).values(
                "work_order_code", "material_name", "quantity", "created_at",
            )
            items = []
            for it in rows:
                qty = float(it.get("quantity") or 0)
                items.append({
                    "order_code": it.get("work_order_code"),
                    "material_name": it.get("material_name"),
                    "actual_qty": qty,
                    "consumed_quantity": qty,
                    "created_at": it.get("created_at"),
                })
            return self._wrap_report_payload({"data": items, "success": True, "total": total})

        if report_type == "process-completion-report":
            q = ReportingRecord.filter(tenant_id=tenant_id, status="approved", deleted_at__isnull=True)
            if date_start:
                q = q.filter(reported_at__gte=date_start)
            if date_end:
                q = q.filter(reported_at__lte=date_end)
            woc = (work_order_code or order_code or "").strip()
            if woc:
                q = q.filter(work_order_code__icontains=woc)
            if kw:
                q = q.filter(
                    Q(work_order_code__icontains=kw)
                    | Q(operation_name__icontains=kw)
                    | Q(worker_name__icontains=kw)
                )
            total = await q.count()
            order_clause = _resolve_production_report_order_by(
                order_by, PRODUCTION_LABOR_DETAIL_SORT, "-reported_at",
                field_aliases={"process_name": "operation_name", "report_date": "reported_at", "qualified_qty": "qualified_quantity", "hours": "work_hours"},
            )
            rows = await q.order_by(order_clause).offset(sk).limit(lim).values(
                "id", "work_order_code", "operation_name", "worker_name",
                "qualified_quantity", "work_hours", "reported_at",
            )
            items = []
            for it in rows:
                reported_at = it.get("reported_at")
                record_id = it.get("id")
                items.append({
                    "report_code": str(record_id) if record_id is not None else None,
                    "order_code": it.get("work_order_code"),
                    "work_order_code": it.get("work_order_code"),
                    "process_name": it.get("operation_name"),
                    "worker_name": it.get("worker_name"),
                    "qualified_qty": float(it.get("qualified_quantity") or 0),
                    "hours": float(it.get("work_hours") or 0),
                    "report_date": reported_at,
                    "reported_at": reported_at,
                })
            return self._wrap_report_payload({"data": items, "success": True, "total": total})

        if report_type == "scrap-reason-analysis":
            q = DefectRecord.filter(tenant_id=tenant_id, deleted_at__isnull=True)
            if date_start:
                q = q.filter(created_at__gte=date_start)
            if date_end:
                q = q.filter(created_at__lte=date_end)
            if kw:
                q = q.filter(defect_reason__icontains=kw)
            stats = await q.annotate(count=Count("id")).group_by("defect_reason").values("defect_reason", "count")
            items = [{"defect_reason": s.get("defect_reason") or "-", "count": int(s.get("count") or 0)} for s in stats]
            if kw:
                items = [it for it in items if kw.lower() in str(it.get("defect_reason") or "").lower()]
            order_clause = _resolve_production_report_order_by(order_by, PRODUCTION_SCRAP_ANALYSIS_SORT, "-count")
            descending = order_clause.startswith("-")
            sort_key = order_clause.lstrip("-")
            items.sort(key=lambda x: x.get(sort_key) or 0, reverse=descending)
            total = len(items)
            page = items[sk : sk + lim]
            return self._wrap_report_payload({"data": page, "success": True, "total": total})

        if report_type in ["first-pass-yield-analysis", "first_pass_yield"]:
            from apps.kuaizhizao.services.first_pass_yield_service import FirstPassYieldService

            service = FirstPassYieldService()
            summary = await service.get_summary(
                tenant_id,
                date_start=date_start,
                date_end=date_end,
            )
            rows = await service.get_operation_breakdown(
                tenant_id,
                date_start=date_start,
                date_end=date_end,
                limit=500,
            )
            if kw:
                rows = [row for row in rows if kw.lower() in str(row.get("operation_name") or "").lower()]
            order_clause = _resolve_production_report_order_by(
                order_by,
                {"operation_name", "count", "first_pass_yield_rate", "qualification_rate"},
                "-first_pass_yield_rate",
            )
            descending = order_clause.startswith("-")
            sort_key = order_clause.lstrip("-")
            rows.sort(key=lambda x: x.get(sort_key) or 0, reverse=descending)
            total = len(rows)
            page = rows[sk : sk + lim]
            return self._wrap_report_payload(
                {
                    "data": page,
                    "success": True,
                    "total": total,
                    "summary": summary,
                }
            )

        if report_type in ["first-pass-yield-work-order", "first_pass_yield_work_order"]:
            from apps.kuaizhizao.services.first_pass_yield_service import FirstPassYieldService

            service = FirstPassYieldService()
            rows, total = await service.get_work_order_first_pass_yield(
                tenant_id,
                date_start=date_start,
                date_end=date_end,
                skip=sk,
                limit=lim,
            )
            if kw:
                rows = [
                    row
                    for row in rows
                    if kw.lower() in str(row.get("work_order_code") or "").lower()
                    or kw.lower() in str(row.get("product_name") or "").lower()
                ]
                total = len(rows)
            return self._wrap_report_payload({"data": rows, "success": True, "total": total})

        if report_type in ["first-pass-yield-rty", "first_pass_yield_rty"]:
            from apps.kuaizhizao.services.first_pass_yield_service import FirstPassYieldService

            service = FirstPassYieldService()
            rows, total = await service.get_product_rty(
                tenant_id,
                date_start=date_start,
                date_end=date_end,
                skip=sk,
                limit=lim,
            )
            if kw:
                rows = [
                    row
                    for row in rows
                    if kw.lower() in str(row.get("product_code") or "").lower()
                    or kw.lower() in str(row.get("product_name") or "").lower()
                ]
                total = len(rows)
            return self._wrap_report_payload({"data": rows, "success": True, "total": total})

        if report_type == "production-delay-warning":
            from apps.kuaizhizao.services.report_enhancements import build_production_delay_warning
            return self._wrap_report_payload(await build_production_delay_warning(
                tenant_id,
                date_start=date_start,
                date_end=date_end,
                skip=sk,
                limit=lim,
                keyword=keyword,
                order_by=order_by,
                status=status,
                order_code=order_code or work_order_code,
                product_name=product_name,
            ))

        if report_type in ["outsource-work-order-query", "outsource_query"]:
            from apps.kuaizhizao.services.report_enhancements import build_outsource_work_order_query
            return self._wrap_report_payload(await build_outsource_work_order_query(
                tenant_id,
                skip=sk,
                limit=lim,
                date_start=date_start,
                date_end=date_end,
                keyword=keyword,
                order_by=order_by,
                status=status,
                order_code=order_code,
                product_name=product_name,
                supplier_name=supplier_name,
            ))

        if report_type in ["outsource-material-reconciliation", "outsource_recon"]:
            from apps.kuaizhizao.services.report_enhancements import build_outsource_material_reconciliation
            return self._wrap_report_payload(await build_outsource_material_reconciliation(
                tenant_id,
                skip=sk,
                limit=lim,
                keyword=keyword,
                order_by=order_by,
                status=status,
                work_order_code=work_order_code or order_code,
            ))

        # 计算概览统计 (Summary) — 仅复杂生产报表需要
        all_orders = await WorkOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True).all()
        total_orders = len(all_orders)
        completed_orders = len([o for o in all_orders if o.status == "completed"])
        on_time = len([
            o for o in all_orders
            if o.status == "completed"
            and o.planned_end_date
            and o.actual_end_date
            and o.actual_end_date <= o.planned_end_date
        ])
        today = date.today()
        delay_days = 0
        for o in all_orders:
            if o.status == "completed":
                continue
            planned = self._as_date(o.planned_end_date)
            if planned and planned < today:
                delay_days += (today - planned).days

        summary = {
            "totalWorkOrders": total_orders,
            "completedWorkOrders": completed_orders,
            "onTimeCompletion": on_time,
            "averageEfficiency": 92.5,
            "averageQualifiedRate": 98.2,
            "totalDelayDays": delay_days,
        }

        if report_type in ["work-order-summary", "completion"]:
            items = await WorkOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True).limit(100).values("code", "product_name", "quantity", "completed_quantity", "status")
            res = []
            for it in items:
                res.append({
                    "code": it["code"],
                    "material_name": it["product_name"],
                    "planned_quantity": float(it["quantity"] or 0),
                    "actual_quantity": float(it["completed_quantity"] or 0),
                    "status": it["status"]
                })
            return {"data": res, "summary": summary, "success": True}
        elif report_type == "production-progress-tracking":
            items = await WorkOrderOperation.filter(tenant_id=tenant_id).limit(100).values("work_order_code", "operation_name", "completed_quantity", "status")
            res = []
            for it in items:
                res.append({
                    "work_order_code": it["work_order_code"],
                    "process_name": it["operation_name"],
                    "actual_quantity": float(it["completed_quantity"] or 0),
                    "status": it["status"]
                })
            return {"data": res, "success": True}
        elif report_type == "production-yield-analysis":
            stats = await ReportingRecord.filter(tenant_id=tenant_id, status="approved").annotate(total_q=Sum("reported_quantity"), good_q=Sum("qualified_quantity")).group_by("work_order_code").values("work_order_code", "total_q", "good_q")
            for s in stats: 
                s["total_q"] = float(s["total_q"] or 0)
                s["good_q"] = float(s["good_q"] or 0)
                s["yield_rate"] = (s["good_q"] / s["total_q"] * 100) if s["total_q"] else 0
            return {"data": stats, "success": True}
        elif report_type == "wip-inventory-query":
            items = await WorkOrderOperation.filter(tenant_id=tenant_id, status__in=["in_progress", "pending"]).limit(100).values("work_order_code", "operation_name", "completed_quantity")
            res = []
            for it in items:
                res.append({
                    "work_order_code": it["work_order_code"],
                    "process_name": it["operation_name"],
                    "actual_quantity": float(it["completed_quantity"] or 0)
                })
            return {"data": res, "success": True}
        elif report_type == "worker-efficiency-ranking":
            stats = await ReportingRecord.filter(tenant_id=tenant_id, status="approved").annotate(total_qty=Sum("qualified_quantity")).group_by("worker_name").order_by("-total_qty").values("worker_name", "total_qty")
            for s in stats: s["total_qty"] = float(s["total_qty"] or 0)
            return {"data": stats, "success": True}
        return self._wrap_report_payload({"data": [], "success": True})

    async def get_sales_report(
        self,
        tenant_id: int,
        report_type: str = "sales-order-query",
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        customer_id: Optional[int] = None,
        *,
        skip: int = 0,
        limit: int = 100,
        customer_keyword: Optional[str] = None,
        current_user: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """获取销售报表数据"""
        from tortoise.functions import Sum, Count
        if report_type in ["sales-order-query", "summary"]:
            return await self._get_sales_order_summary(
                tenant_id,
                date_start,
                date_end,
                customer_id,
                skip=skip,
                limit=limit,
                customer_keyword=customer_keyword,
                current_user=current_user,
            )
        elif report_type in ["order-execution-tracking", "execution"]:
            return await self._get_sales_order_execution(
                tenant_id,
                date_start,
                date_end,
                customer_id,
                skip=skip,
                limit=limit,
                customer_keyword=customer_keyword,
                current_user=current_user,
            )
        elif report_type in ["customer-sales-summary", "customer_summary"]:
            return await self._get_customer_sales_performance(
                tenant_id,
                date_start,
                date_end,
                customer_keyword=customer_keyword,
                skip=skip,
                limit=limit,
                current_user=current_user,
            )
        elif report_type in ["customer-sales-reconciliation", "customer_reconciliation"]:
            return await self._get_customer_sales_reconciliation(
                tenant_id,
                date_start,
                date_end,
                customer_id,
                skip=skip,
                limit=limit,
                customer_keyword=customer_keyword,
                current_user=current_user,
            )
        elif report_type in ["product-sales-ranking", "product_ranking"]:
            return await self._get_product_sales_ranking(
                tenant_id, date_start, date_end, skip=skip, limit=limit
            )
        elif report_type in ["sales-delivery-detail", "delivery_detail"]:
            return await self._get_sales_delivery_detail(
                tenant_id,
                date_start,
                date_end,
                customer_id,
                skip=skip,
                limit=limit,
                customer_keyword=customer_keyword,
                current_user=current_user,
            )
        elif report_type in ["sales-return-detail", "return_detail"]:
            return await self._get_sales_return_detail(
                tenant_id,
                date_start,
                date_end,
                customer_id,
                skip=skip,
                limit=limit,
                customer_keyword=customer_keyword,
                current_user=current_user,
            )
        elif report_type in ["material-sales-summary", "material_summary"]:
            return await self._get_material_sales_summary(
                tenant_id,
                date_start,
                date_end,
                skip=skip,
                limit=limit,
                customer_keyword=customer_keyword,
                current_user=current_user,
            )
        elif report_type in ["forecast-vs-actual", "forecast_actual"]:
            raise ValidationError(f"报表已下线: {report_type}")
        elif report_type in ["quotation-query", "quotation"]:
            return await self._get_quotation_query(
                tenant_id,
                date_start,
                date_end,
                customer_id,
                customer_keyword=customer_keyword,
                skip=skip,
                limit=limit,
                current_user=current_user,
            )
        elif report_type in ["contract-execution", "sales-contract-execution", "contract_execution"]:
            return await self._get_sales_contract_execution(
                tenant_id,
                date_start,
                date_end,
                customer_id,
                skip=skip,
                limit=limit,
                customer_keyword=customer_keyword,
                current_user=current_user,
            )
        elif report_type in ["sales-trend-analysis", "trend", "sales_trend_analysis"]:
            from apps.kuaizhizao.models.sales_order import SalesOrder
            so_q = await self._scoped_sales_order_query(tenant_id=tenant_id, current_user=current_user)
            if date_start:
                so_q = so_q.filter(order_date__gte=date_start.date())
            if date_end:
                so_q = so_q.filter(order_date__lte=date_end.date())
            data = await so_q.values("order_date", "total_amount")
            if not data: return {"data": [], "success": True}
            # 使用原生 Python 进行按月分组汇总
            res_dict = {}
            for row in data:
                if not row["order_date"]: continue
                month = row["order_date"].strftime('%Y-%m')
                if month not in res_dict:
                    res_dict[month] = {"revenue": 0.0, "quantity": 0}
                res_dict[month]["revenue"] += float(row["total_amount"] or 0)
                res_dict[month]["quantity"] += 1
            
            stats = [
                {"month": k, "total_amount": v["revenue"], "revenue": v["revenue"], "quantity": v["quantity"]}
                for k, v in sorted(res_dict.items())
            ]
            return {"data": stats, "success": True, "total": len(stats)}
        elif report_type in ["sales-return-analysis", "return_analysis", "sales_return_analysis"]:
            from apps.kuaizhizao.models.sales_return import SalesReturn
            rq = SalesReturn.filter(tenant_id=tenant_id, deleted_at__isnull=True)
            if date_start:
                rq = rq.filter(return_time__gte=date_start)
            if date_end:
                rq = rq.filter(return_time__lte=date_end)
            stats = await rq.annotate(count=Count("id")).group_by("return_reason").values("return_reason", "count")
            type_stats = await rq.annotate(count=Count("id")).group_by("return_type").values("return_type", "count")
            return {
                "data": stats,
                "success": True,
                "total": len(stats),
                "summary": {
                    "total_returns": await rq.count(),
                    "reason_distribution": stats,
                    "type_distribution": type_stats,
                },
            }
        elif report_type in ["salesperson-performance", "salesperson", "salesman"]:
            from apps.kuaizhizao.models.sales_order import SalesOrder
            so_pf = await self._scoped_sales_order_query(tenant_id=tenant_id, current_user=current_user)
            so_pf = so_pf.filter(status="COMPLETED")
            if date_start:
                so_pf = so_pf.filter(order_date__gte=date_start.date())
            if date_end:
                so_pf = so_pf.filter(order_date__lte=date_end.date())
            stats = (
                await so_pf.annotate(total=Sum("total_amount"), order_count=Count("id"))
                .group_by("salesman_name")
                .values("salesman_name", "total", "order_count")
            )
            rows = [
                {
                    "salesman_name": s.get("salesman_name") or "",
                    "total_revenue": float(s.get("total") or 0),
                    "order_count": int(s.get("order_count") or 0),
                    "rank": i + 1,
                }
                for i, s in enumerate(
                    sorted(stats, key=lambda x: float(x.get("total") or 0), reverse=True)
                )
            ]
            return {"data": rows, "success": True, "total": len(rows)}
        else:
            raise ValidationError(f"不支持的报表类型: {report_type}")

    async def _get_sales_order_summary(
        self,
        tenant_id: int,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        customer_id: Optional[int] = None,
        *,
        skip: int = 0,
        limit: int = 100,
        customer_keyword: Optional[str] = None,
        current_user: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """销售订单综合查询统计"""
        from tortoise.functions import Count, Sum

        logger.info(
            "ReportService._get_sales_order_summary: tenant_id=%s, date_start=%s, date_end=%s, customer_id=%s, skip=%s, limit=%s",
            tenant_id,
            date_start,
            date_end,
            customer_id,
            skip,
            limit,
        )

        query = await self._scoped_sales_order_query(tenant_id=tenant_id, current_user=current_user)
        if date_start:
            query = query.filter(order_date__gte=date_start.date())
        if date_end:
            query = query.filter(order_date__lte=date_end.date())
        if customer_id:
            query = query.filter(customer_id=customer_id)
        if customer_keyword and str(customer_keyword).strip():
            query = query.filter(customer_name__icontains=str(customer_keyword).strip())

        total_orders = await query.count()

        agg = await query.annotate(total_amt=Sum("total_amount")).values("total_amt")
        total_amount = float(agg[0]["total_amt"] or 0) if agg else 0.0
        pending_review = await query.filter(review_status="PENDING").count()
        in_execution = await query.filter(status__in=["CONFIRMED", "AUDITED", "已确认", "已审核"]).count()
        completed = await query.filter(status="COMPLETED").count()
        lim = max(1, min(int(limit or 100), 500))
        sk = max(0, int(skip or 0))
        items = await query.order_by("-order_date").offset(sk).limit(lim).values(
            "id",
            "order_code",
            "order_date",
            "customer_name",
            "delivery_date",
            "total_amount",
            "status",
            "review_status",
            "salesman_name",
            "notes",
        )

        return {
            "summary": {
                "total_orders": total_orders,
                "total_amount": total_amount,
                "pending_review": pending_review,
                "in_execution": in_execution,
                "completed": completed,
            },
            "data": items,
            "total": total_orders,
            "success": True,
        }

    async def _get_sales_order_execution(
        self,
        tenant_id: int,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        customer_id: Optional[int] = None,
        *,
        skip: int = 0,
        limit: int = 100,
        customer_keyword: Optional[str] = None,
        current_user: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """销售订单执行跟踪统计"""
        from apps.kuaizhizao.models.sales_order_item import SalesOrderItem
        from apps.kuaizhizao.services.report_enhancements import execution_overdue_fields
        from tortoise.functions import Sum

        query = SalesOrderItem.filter(tenant_id=tenant_id, remaining_quantity__gt=0)
        if date_start:
            query = query.filter(delivery_date__gte=date_start.date())
        if date_end:
            query = query.filter(delivery_date__lte=date_end.date())

        order_id_filter: Optional[list] = None
        scoped_order_query = await self._scoped_sales_order_query(
            tenant_id=tenant_id,
            current_user=current_user,
        )
        if customer_keyword and str(customer_keyword).strip():
            kw = str(customer_keyword).strip()
            order_id_filter = list(
                await scoped_order_query.filter(
                    customer_name__icontains=kw,
                ).values_list("id", flat=True)
            )
        if customer_id is not None:
            by_cust = list(
                await scoped_order_query.filter(customer_id=customer_id).values_list(
                    "id", flat=True
                )
            )
            if order_id_filter is None:
                order_id_filter = by_cust
            else:
                by_cust_set = set(by_cust)
                order_id_filter = [oid for oid in order_id_filter if oid in by_cust_set]
        if order_id_filter is not None:
            if not order_id_filter:
                return {
                    "summary": {
                        "total_items": 0,
                        "total_delivered": 0.0,
                        "remaining_quantity": 0.0,
                        "on_time_rate": 100.0,
                    },
                    "data": [],
                    "total": 0,
                    "success": True,
                }
            query = query.filter(sales_order_id__in=order_id_filter)
        total_items = await query.count()
        lim = max(1, min(int(limit or 100), 500))
        sk = max(0, int(skip or 0))
        items = await query.order_by("-id").offset(sk).limit(lim).values(
            "id",
            "sales_order_id",
            "material_code",
            "material_name",
            "material_spec",
            "order_quantity",
            "delivered_quantity",
            "remaining_quantity",
            "delivery_date",
            "delivery_status",
            "material_unit",
        )
        order_ids = list(set(it["sales_order_id"] for it in items))
        orders_map = {}
        if order_ids:
            orders = await scoped_order_query.filter(id__in=order_ids).values(
                "id", "order_code", "customer_name"
            )
            orders_map = {o["id"]: o for o in orders}
        for it in items:
            order = orders_map.get(it["sales_order_id"], {})
            it["order_code"] = order.get("order_code")
            it["customer_name"] = order.get("customer_name")
            rem = float(it.get("remaining_quantity") or 0)
            overdue = execution_overdue_fields(it.get("delivery_date"), rem)
            it.update(overdue)

        all_rows = await query.values("remaining_quantity", "delivery_date")
        overdue_count = 0
        on_time_count = 0
        for row in all_rows:
            rem = float(row.get("remaining_quantity") or 0)
            if rem <= 0:
                continue
            d = row.get("delivery_date")
            dd = d.date() if isinstance(d, datetime) else d
            if isinstance(dd, date) and dd < date.today():
                overdue_count += 1
            else:
                on_time_count += 1
        denom = overdue_count + on_time_count
        on_time_rate = round(on_time_count / denom * 100, 2) if denom else 100.0

        agg = await query.annotate(total_del=Sum("delivered_quantity"), total_rem=Sum("remaining_quantity")).values("total_del", "total_rem")
        total_delivered = float(agg[0]["total_del"] or 0) if agg else 0.0
        remaining_qty = float(agg[0]["total_rem"] or 0) if agg else 0.0
        return {
            "summary": {
                "total_items": total_items,
                "total_delivered": total_delivered,
                "remaining_quantity": remaining_qty,
                "on_time_rate": on_time_rate,
                "overdue_count": overdue_count,
            },
            "data": items,
            "total": total_items,
            "success": True,
        }

    async def _get_customer_sales_performance(
        self,
        tenant_id: int,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        *,
        customer_keyword: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
        current_user: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """客户销售业绩汇总（订单维度真实汇总；回款金额不在本模块计算）。"""
        from collections import defaultdict
        from tortoise.functions import Count, Sum

        COMPLETED_STATUSES = frozenset(
            {"COMPLETED", "已完成", "完成", "CLOSED", "closed", "DONE", "done"}
        )

        query = await self._scoped_sales_order_query(tenant_id=tenant_id, current_user=current_user)
        if date_start:
            query = query.filter(order_date__gte=date_start.date())
        if date_end:
            query = query.filter(order_date__lte=date_end.date())
        if customer_keyword and str(customer_keyword).strip():
            kw = str(customer_keyword).strip()
            query = query.filter(customer_name__icontains=kw)

        stats = (
            await query.annotate(order_count=Count("id"), total_rev=Sum("total_amount"))
            .group_by("customer_id", "customer_name")
            .order_by("-total_rev")
            .values("customer_id", "customer_name", "order_count", "total_rev")
        )

        order_rows = await query.values("customer_id", "order_date", "salesman_name", "status", "total_amount")
        completed_by_customer: dict[int, float] = defaultdict(float)
        latest_order: dict[int, tuple] = {}
        salesman_pick: dict[int, Optional[str]] = {}

        for row in order_rows:
            cid = row.get("customer_id")
            if cid is None:
                continue
            amt = float(row.get("total_amount") or 0)
            st = row.get("status") or ""
            if st in COMPLETED_STATUSES:
                completed_by_customer[int(cid)] += amt

            od = row.get("order_date")
            prev = latest_order.get(int(cid))
            if prev is None or (od and prev[0] and od > prev[0]) or (od and prev[0] is None):
                latest_order[int(cid)] = (od, row.get("salesman_name"))
            nm = row.get("salesman_name")
            if nm and str(nm).strip():
                salesman_pick[int(cid)] = str(nm).strip()

        customer_ids = [int(s["customer_id"]) for s in stats if s.get("customer_id") is not None]
        code_map: dict[int, str] = {}
        if customer_ids:
            try:
                from apps.master_data.models.customer import Customer

                cust_rows = await Customer.filter(
                    tenant_id=tenant_id, id__in=customer_ids, deleted_at__isnull=True
                ).values("id", "code")
                code_map = {int(r["id"]): str(r["code"] or "") for r in cust_rows}
            except Exception as e:
                logger.warning("客户销售业绩汇总：加载客户编码失败: %s", e)

        from apps.kuaizhizao.services.report_enhancements import customer_received_by_customer_id
        received_map = await customer_received_by_customer_id(
            tenant_id, customer_ids, date_start=date_start, date_end=date_end,
        )

        items_full: list[dict[str, Any]] = []
        for s in stats:
            cid = int(s["customer_id"])
            total_rev = float(s["total_rev"] or 0)
            cnt = int(s["order_count"] or 0)
            last_pair = latest_order.get(cid)
            last_dt = last_pair[0] if last_pair else None
            last_salesman = (last_pair[1] if last_pair else None) or salesman_pick.get(cid)
            cc = code_map.get(cid) or ""
            items_full.append(
                {
                    "customer_id": cid,
                    "customer_name": s.get("customer_name") or "",
                    "customer_code": cc,
                    "order_count": cnt,
                    "total_amount": total_rev,
                    "completed_amount": float(completed_by_customer.get(cid, 0.0)),
                    "received_amount": float(received_map.get(cid, 0.0)),
                    "last_order_date": last_dt.strftime("%Y-%m-%d") if last_dt else None,
                    "avg_order_value": total_rev / cnt if cnt else 0.0,
                    "salesman_name": last_salesman or "",
                }
            )

        lim = max(1, min(int(limit or 100), 500))
        sk = max(0, int(skip or 0))
        page = items_full[sk : sk + lim]
        return {
            "summary": {
                "total_customers": len(items_full),
                "total_revenue": sum(it["total_amount"] for it in items_full),
                "total_received": sum(it.get("received_amount") or 0 for it in items_full),
            },
            "data": page,
            "total": len(items_full),
            "success": True,
        }

    async def _get_customer_sales_reconciliation(
        self,
        tenant_id: int,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        customer_id: Optional[int] = None,
        *,
        skip: int = 0,
        limit: int = 100,
        customer_keyword: Optional[str] = None,
        current_user: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """客户销售对账单数据"""
        from apps.kuaizhizao.models.sales_return import SalesReturn
        query = await self._scoped_sales_order_query(tenant_id=tenant_id, current_user=current_user)
        query = query.filter(status__in=["CONFIRMED", "COMPLETED"])
        if date_start: query = query.filter(order_date__gte=date_start.date())
        if date_end: query = query.filter(order_date__lte=date_end.date())
        if customer_id: query = query.filter(customer_id=customer_id)
        if customer_keyword and str(customer_keyword).strip():
            query = query.filter(customer_name__icontains=str(customer_keyword).strip())
        orders = await query.values("order_code", "order_date", "customer_name", "total_amount")
        ret_query = SalesReturn.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="已审核")
        if date_start: ret_query = ret_query.filter(return_time__gte=date_start)
        if date_end: ret_query = ret_query.filter(return_time__lte=date_end)
        if customer_id: ret_query = ret_query.filter(customer_id=customer_id)
        if customer_keyword and str(customer_keyword).strip():
            ret_query = ret_query.filter(customer_name__icontains=str(customer_keyword).strip())
        returns = await ret_query.values("return_code", "return_time", "customer_name", "total_amount")
        from apps.kuaizhizao.services.report_enhancements import build_customer_sales_reconciliation
        return await build_customer_sales_reconciliation(
            tenant_id,
            list(orders),
            list(returns),
            skip=skip,
            limit=limit,
        )

    async def _get_product_sales_ranking(
        self,
        tenant_id: int,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> Dict[str, Any]:
        """产品销售排行榜"""
        from apps.kuaizhizao.models.sales_order_item import SalesOrderItem
        from tortoise.functions import Sum
        query = SalesOrderItem.filter(tenant_id=tenant_id)
        if date_start:
            query = query.filter(delivery_date__gte=date_start.date())
        if date_end:
            query = query.filter(delivery_date__lte=date_end.date())
        grouped = query.annotate(total_qty=Sum("order_quantity"), total_rev=Sum("total_amount")).group_by(
            "material_id", "material_code", "material_name", "material_spec", "material_unit"
        )
        # 分组总数：仅拉分组键，避免对大结果集做全量 values
        group_keys = await grouped.values("material_id")
        total_groups = len(group_keys)
        lim = max(1, min(int(limit or 100), 500))
        sk = max(0, int(skip or 0))
        ranking = (
            await grouped.order_by("-total_rev")
            .offset(sk)
            .limit(lim)
            .values(
                "material_id",
                "material_code",
                "material_name",
                "material_spec",
                "material_unit",
                "total_qty",
                "total_rev",
            )
        )
        material_ids = [int(r["material_id"]) for r in ranking if r.get("material_id")]
        from apps.kuaizhizao.services.report_enhancements import product_profit_map
        profit_map = await product_profit_map(
            tenant_id, material_ids, date_start=date_start, date_end=date_end,
        )
        items = [
            {
                "rank": sk + idx + 1,
                "product_id": r["material_id"],
                "product_code": r["material_code"],
                "product_name": r["material_name"],
                "product_spec": r["material_spec"],
                "unit": r["material_unit"],
                "total_quantity": float(r["total_qty"] or 0),
                "total_revenue": float(r["total_rev"] or 0),
                "profit": float(profit_map.get(int(r["material_id"]), 0.0)),
                "category": "",
                "avg_price": float(r["total_rev"] or 0) / float(r["total_qty"]) if r["total_qty"] else 0,
            }
            for idx, r in enumerate(ranking)
        ]
        return {
            "summary": {
                "top_product": items[0]["product_name"] if items else None,
                "total_revenue": sum(it["total_revenue"] for it in items),
            },
            "data": items,
            "success": True,
            "total": total_groups,
        }

    async def _get_sales_delivery_detail(
        self,
        tenant_id: int,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        customer_id: Optional[int] = None,
        *,
        skip: int = 0,
        limit: int = 100,
        customer_keyword: Optional[str] = None,
        current_user: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """销售出库单明细表（行级）"""
        from apps.kuaizhizao.models.sales_delivery import SalesDelivery
        from apps.kuaizhizao.models.sales_delivery_item import SalesDeliveryItem
        from tortoise.functions import Sum

        dq = SalesDelivery.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        dq = dq.exclude(status__in=["待出库", "CANCELLED", "已取消"])
        if date_start:
            dq = dq.filter(delivery_time__gte=date_start)
        if date_end:
            dq = dq.filter(delivery_time__lte=date_end)
        if customer_id:
            dq = dq.filter(customer_id=customer_id)
        if customer_keyword and str(customer_keyword).strip():
            dq = dq.filter(customer_name__icontains=str(customer_keyword).strip())

        delivery_ids = await dq.values_list("id", flat=True)
        if not delivery_ids:
            return {"data": [], "total": 0, "success": True, "summary": {"total_quantity": 0, "total_amount": 0}}

        item_q = SalesDeliveryItem.filter(tenant_id=tenant_id, delivery_id__in=list(delivery_ids))
        total = await item_q.count()
        lim = max(1, min(int(limit or 100), 500))
        sk = max(0, int(skip or 0))
        rows = await item_q.order_by("-id").offset(sk).limit(lim).values(
            "id",
            "delivery_id",
            "material_code",
            "material_name",
            "material_spec",
            "material_unit",
            "delivery_quantity",
            "unit_price",
            "total_amount",
            "batch_number",
        )
        dids = list({r["delivery_id"] for r in rows})
        dmap = {}
        if dids:
            for d in await SalesDelivery.filter(id__in=dids).values(
                "id", "delivery_code", "customer_name", "warehouse_name", "delivery_time", "sales_order_code"
            ):
                dmap[d["id"]] = d
        items = []
        for r in rows:
            head = dmap.get(r["delivery_id"], {})
            delivery_time = head.get("delivery_time")
            items.append({
                "id": r["id"],
                "delivery_id": r["delivery_id"],
                "material_code": r.get("material_code"),
                "material_name": r.get("material_name"),
                "material_spec": r.get("material_spec"),
                "material_unit": r.get("material_unit"),
                "batch_number": r.get("batch_number"),
                "delivery_code": head.get("delivery_code"),
                "customer_name": head.get("customer_name"),
                "warehouse_name": head.get("warehouse_name"),
                "delivery_date": to_api_isoformat(delivery_time.date()) if delivery_time else None,
                "sales_order_code": head.get("sales_order_code"),
                "quantity": float(r.get("delivery_quantity") or 0),
                "unit_price": float(r.get("unit_price") or 0),
                "amount": float(r.get("total_amount") or 0),
            })
        agg = await self._aggregate_sums(
            item_q,
            {"total_qty": "delivery_quantity", "total_amt": "total_amount"},
        )
        return self._wrap_report_payload({
            "data": items,
            "total": total,
            "success": True,
            "summary": {
                "total_quantity": float(agg.get("total_qty") or 0),
                "total_amount": float(agg.get("total_amt") or 0),
                "line_count": total,
            },
        })

    async def _get_sales_return_detail(
        self,
        tenant_id: int,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        customer_id: Optional[int] = None,
        *,
        skip: int = 0,
        limit: int = 100,
        customer_keyword: Optional[str] = None,
        current_user: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """销售退货单明细表（行级）"""
        from apps.kuaizhizao.models.sales_return import SalesReturn
        from apps.kuaizhizao.models.sales_return_item import SalesReturnItem
        from tortoise.functions import Sum

        rq = SalesReturn.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        rq = rq.exclude(status__in=["CANCELLED", "已取消", "待提交"])
        if date_start:
            rq = rq.filter(return_time__gte=date_start)
        if date_end:
            rq = rq.filter(return_time__lte=date_end)
        if customer_id:
            rq = rq.filter(customer_id=customer_id)
        if customer_keyword and str(customer_keyword).strip():
            rq = rq.filter(customer_name__icontains=str(customer_keyword).strip())

        return_ids = await rq.values_list("id", flat=True)
        if not return_ids:
            return {"data": [], "total": 0, "success": True, "summary": {"total_quantity": 0, "total_amount": 0}}

        item_q = SalesReturnItem.filter(tenant_id=tenant_id, return_id__in=list(return_ids))
        total = await item_q.count()
        lim = max(1, min(int(limit or 100), 500))
        sk = max(0, int(skip or 0))
        rows = await item_q.order_by("-id").offset(sk).limit(lim).values(
            "id",
            "return_id",
            "material_code",
            "material_name",
            "material_spec",
            "material_unit",
            "return_quantity",
            "unit_price",
            "total_amount",
            "batch_number",
        )
        rids = list({r["return_id"] for r in rows})
        rmap = {}
        if rids:
            for h in await SalesReturn.filter(id__in=rids).values(
                "id", "return_code", "customer_name", "warehouse_name", "return_time", "sales_delivery_code", "return_reason"
            ):
                rmap[h["id"]] = h
        items = []
        for r in rows:
            head = rmap.get(r["return_id"], {})
            return_time = head.get("return_time")
            items.append({
                "id": r["id"],
                "return_id": r["return_id"],
                "material_code": r.get("material_code"),
                "material_name": r.get("material_name"),
                "material_spec": r.get("material_spec"),
                "material_unit": r.get("material_unit"),
                "batch_number": r.get("batch_number"),
                "return_code": head.get("return_code"),
                "customer_name": head.get("customer_name"),
                "warehouse_name": head.get("warehouse_name"),
                "return_date": to_api_isoformat(return_time.date()) if return_time else None,
                "sales_delivery_code": head.get("sales_delivery_code"),
                "return_reason": head.get("return_reason"),
                "quantity": float(r.get("return_quantity") or 0),
                "unit_price": float(r.get("unit_price") or 0),
                "amount": float(r.get("total_amount") or 0),
            })
        agg = await self._aggregate_sums(
            item_q,
            {"total_qty": "return_quantity", "total_amt": "total_amount"},
        )
        return self._wrap_report_payload({
            "data": items,
            "total": total,
            "success": True,
            "summary": {
                "total_quantity": float(agg.get("total_qty") or 0),
                "total_amount": float(agg.get("total_amt") or 0),
                "line_count": total,
            },
        })

    async def _get_material_sales_summary(
        self,
        tenant_id: int,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        *,
        skip: int = 0,
        limit: int = 100,
        customer_keyword: Optional[str] = None,
        current_user: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """存货销售汇总表（按物料汇总已出库数量与金额）"""
        from apps.kuaizhizao.models.sales_delivery import SalesDelivery
        from apps.kuaizhizao.models.sales_delivery_item import SalesDeliveryItem
        from tortoise.functions import Sum

        dq = SalesDelivery.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        dq = dq.exclude(status__in=["待出库", "CANCELLED", "已取消"])
        if date_start:
            dq = dq.filter(delivery_time__gte=date_start)
        if date_end:
            dq = dq.filter(delivery_time__lte=date_end)
        if customer_keyword and str(customer_keyword).strip():
            dq = dq.filter(customer_name__icontains=str(customer_keyword).strip())

        delivery_ids = await dq.values_list("id", flat=True)
        if not delivery_ids:
            return {"data": [], "total": 0, "success": True, "summary": {"total_quantity": 0, "total_amount": 0}}

        item_q = SalesDeliveryItem.filter(tenant_id=tenant_id, delivery_id__in=list(delivery_ids))
        grouped = item_q.annotate(
            total_qty=Sum("delivery_quantity"),
            total_amt=Sum("total_amount"),
        ).group_by("material_id", "material_code", "material_name", "material_spec", "material_unit")

        group_keys = await grouped.values("material_id")
        total_groups = len(group_keys)
        lim = max(1, min(int(limit or 100), 500))
        sk = max(0, int(skip or 0))
        rows_raw = await grouped.values(
                "material_id",
                "material_code",
                "material_name",
                "material_spec",
                "material_unit",
                "total_qty",
                "total_amt",
            )
        rows = sorted(
            rows_raw,
            key=lambda r: float(r.get("total_amt") or 0),
            reverse=True,
        )[sk : sk + lim]
        items = [
            {
                "material_code": r["material_code"],
                "material_name": r["material_name"],
                "material_spec": r["material_spec"],
                "unit": r["material_unit"],
                "total_quantity": float(r["total_qty"] or 0),
                "total_amount": float(r["total_amt"] or 0),
                "avg_price": float(r["total_amt"] or 0) / float(r["total_qty"]) if r["total_qty"] else 0,
            }
            for r in rows
        ]
        all_agg = await self._aggregate_sums(
            item_q,
            {"grand_qty": "delivery_quantity", "grand_amt": "total_amount"},
        )
        return {
            "data": items,
            "total": total_groups,
            "success": True,
            "summary": {
                "material_count": total_groups,
                "total_quantity": float(all_agg.get("grand_qty") or 0),
                "total_amount": float(all_agg.get("grand_amt") or 0),
            },
        }

    async def _get_sales_forecast_vs_actual(
        self,
        tenant_id: int,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> Dict[str, Any]:
        """销售预测与实际对比"""
        from apps.kuaizhizao.models.sales_forecast_item import SalesForecastItem
        from apps.kuaizhizao.models.sales_order_item import SalesOrderItem
        from tortoise.functions import Sum
        f_query = SalesForecastItem.filter(tenant_id=tenant_id)
        if date_start: f_query = f_query.filter(forecast_date__gte=date_start.date())
        if date_end: f_query = f_query.filter(forecast_date__lte=date_end.date())
        forecasts = await f_query.annotate(total_qty=Sum("forecast_quantity")).group_by("material_id", "material_code", "material_name").values("material_id", "material_code", "material_name", "total_qty")
        o_query = SalesOrderItem.filter(tenant_id=tenant_id)
        if date_start: o_query = o_query.filter(delivery_date__gte=date_start.date())
        if date_end: o_query = o_query.filter(delivery_date__lte=date_end.date())
        actuals = await o_query.annotate(total_qty=Sum("order_quantity")).group_by("material_id").values("material_id", "total_qty")
        actual_map = {a["material_id"]: float(a["total_qty"] or 0) for a in actuals}
        items = []
        for f in forecasts:
            f_qty = float(f["total_qty"] or 0); a_qty = actual_map.get(f["material_id"], 0.0)
            items.append({"material_code": f["material_code"], "material_name": f["material_name"], "forecast_quantity": f_qty, "actual_quantity": a_qty, "diff_quantity": a_qty - f_qty, "accuracy": (1 - abs(a_qty - f_qty) / f_qty) if f_qty > 0 else 0})
        total_rows = len(items)
        lim = max(1, min(int(limit or 100), 500))
        sk = max(0, int(skip or 0))
        page = items[sk : sk + lim]
        return {
            "data": page,
            "success": True,
            "total": total_rows,
            "summary": {"avg_accuracy": sum(it["accuracy"] for it in items) / len(items) if items else 0},
        }

    async def _get_quotation_query(
        self,
        tenant_id,
        date_start,
        date_end,
        customer_id,
        customer_keyword: Optional[str] = None,
        *,
        skip: int = 0,
        limit: int = 100,
        current_user: Optional[Any] = None,
    ):
        query = await self._scoped_quotation_query(tenant_id=tenant_id, current_user=current_user)
        if date_start:
            query = query.filter(quotation_date__gte=date_start.date())
        if date_end:
            query = query.filter(quotation_date__lte=date_end.date())
        if customer_id:
            query = query.filter(customer_id=customer_id)
        if customer_keyword and str(customer_keyword).strip():
            query = query.filter(customer_name__icontains=str(customer_keyword).strip())
        total = await query.count()
        lim = max(1, min(int(limit or 100), 500))
        sk = max(0, int(skip or 0))
        items = await query.order_by("-quotation_date").offset(sk).limit(lim).values(
            "quotation_code",
            "quotation_date",
            "customer_name",
            "total_amount",
            "status",
            "salesman_name",
        )
        return {"data": items, "success": True, "total": total}

    async def _get_sales_contract_execution(
        self,
        tenant_id: int,
        date_start: Optional[datetime],
        date_end: Optional[datetime],
        customer_id: Optional[int],
        *,
        skip: int = 0,
        limit: int = 100,
        customer_keyword: Optional[str] = None,
        current_user: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """销售合同执行率与框架释放明细报表。"""
        from apps.kuaizhizao.models.sales_contract_milestone import SalesContractMilestone

        query = await self._scoped_sales_contract_query(
            tenant_id=tenant_id,
            current_user=current_user,
        )
        if date_start:
            query = query.filter(contract_date__gte=date_start.date())
        if date_end:
            query = query.filter(contract_date__lte=date_end.date())
        if customer_id:
            query = query.filter(customer_id=customer_id)
        if customer_keyword and str(customer_keyword).strip():
            query = query.filter(customer_name__icontains=str(customer_keyword).strip())

        total = await query.count()
        lim = max(1, min(int(limit or 100), 500))
        sk = max(0, int(skip or 0))
        contracts = await query.order_by("-contract_date").offset(sk).limit(lim)

        contract_ids = [c.id for c in contracts]
        release_counts: Dict[int, int] = {}
        payment_rates: Dict[int, float] = {}
        if contract_ids:
            scoped_so_query = await self._scoped_sales_order_query(
                tenant_id=tenant_id,
                current_user=current_user,
            )
            orders = await scoped_so_query.filter(
                contract_id__in=contract_ids,
                is_release_order=True,
            ).values("contract_id")
            for row in orders:
                cid = row.get("contract_id")
                if cid:
                    release_counts[int(cid)] = release_counts.get(int(cid), 0) + 1

            milestones = await SalesContractMilestone.filter(
                tenant_id=tenant_id, contract_id__in=contract_ids
            ).values("contract_id", "planned_amount", "status")
            planned_by_contract: Dict[int, Decimal] = {}
            collected_by_contract: Dict[int, Decimal] = {}
            for m in milestones:
                cid = int(m["contract_id"])
                amt = Decimal(str(m.get("planned_amount") or 0))
                planned_by_contract[cid] = planned_by_contract.get(cid, Decimal("0")) + amt
                if (m.get("status") or "") == "collected":
                    collected_by_contract[cid] = collected_by_contract.get(cid, Decimal("0")) + amt
            for cid, planned in planned_by_contract.items():
                collected = collected_by_contract.get(cid, Decimal("0"))
                payment_rates[cid] = float(collected / planned * 100) if planned > 0 else 0.0

        items = []
        for c in contracts:
            total_amt = Decimal(str(c.total_amount or 0))
            released_amt = Decimal(str(c.released_amount or 0))
            execution_rate = float(released_amt / total_amt * 100) if total_amt > 0 else 0.0
            remaining_amt = max(Decimal("0"), total_amt - released_amt)
            items.append(
                {
                    "contract_code": c.contract_code,
                    "contract_type": c.contract_type,
                    "customer_name": c.customer_name,
                    "contract_date": to_api_isoformat(c.contract_date) if c.contract_date else None,
                    "valid_to": to_api_isoformat(c.valid_to) if c.valid_to else None,
                    "status": c.status,
                    "total_amount": float(total_amt),
                    "released_amount": float(released_amt),
                    "remaining_amount": float(remaining_amt),
                    "execution_rate": round(execution_rate, 2),
                    "payment_collection_rate": round(payment_rates.get(c.id, 0.0), 2),
                    "release_order_count": release_counts.get(c.id, 0),
                }
            )

        summary_rate = (
            round(sum(it["execution_rate"] for it in items) / len(items), 2) if items else 0.0
        )
        return {
            "data": items,
            "success": True,
            "total": total,
            "summary": {"avg_execution_rate": summary_rate},
        }

    async def _resolve_material_default_warehouse_for_report(
        self,
        tenant_id: int,
        material: Any,
        cache: Dict[int, Optional[Tuple[int, str]]],
    ) -> Optional[Tuple[int, str]]:
        """
        解析报表展示所需的主仓仓库（按物料 defaults 默认仓库优先级）。
        结果按 material_id 做内存缓存，避免重复查询。
        """
        material_id = int(getattr(material, "id", 0) or 0)
        if material_id <= 0:
            return None
        if material_id in cache:
            return cache[material_id]
        from apps.master_data.services.material_service import (
            resolve_primary_default_warehouse_from_material,
        )
        resolved = await resolve_primary_default_warehouse_from_material(
            tenant_id=tenant_id,
            material=material,
        )
        cache[material_id] = resolved
        return resolved

    async def _resolve_material_batch_warehouse_for_report(
        self,
        tenant_id: int,
        batch: Any,
        material: Any,
        cache: Dict[int, Optional[Tuple[int, str]]],
        wh_name_cache: Dict[int, str],
    ) -> Tuple[Optional[int], str]:
        """
        主仓批次仓库真源：MaterialBatch.warehouse_id。
        warehouse_id=0 时回退物料默认仓（仅历史未归属行）；仍无则「未配置仓库」。
        """
        batch_wh_id = int(getattr(batch, "warehouse_id", 0) or 0)
        if batch_wh_id > 0:
            name = str(getattr(batch, "warehouse_name", None) or "").strip()
            if not name:
                if batch_wh_id in wh_name_cache:
                    name = wh_name_cache[batch_wh_id]
                else:
                    from apps.master_data.models.warehouse import Warehouse

                    wh = await Warehouse.get_or_none(
                        tenant_id=tenant_id,
                        id=batch_wh_id,
                        deleted_at__isnull=True,
                    )
                    name = (wh.name if wh else "") or ""
                    wh_name_cache[batch_wh_id] = name
            return batch_wh_id, self._normalize_warehouse_display_name(name or None)

        resolved = await self._resolve_material_default_warehouse_for_report(
            tenant_id=tenant_id,
            material=material,
            cache=cache,
        )
        if resolved:
            return int(resolved[0]), self._normalize_warehouse_display_name(resolved[1])
        return None, self._normalize_warehouse_display_name(None)

    async def _load_inventory_rows(
        self,
        tenant_id: int,
        material_id: Optional[int] = None,
        warehouse_id: Optional[int] = None,
        batch_number: Optional[str] = None,
        include_expired: bool = False,
    ) -> List[Dict[str, Any]]:
        from apps.master_data.models.material_batch import MaterialBatch
        from apps.kuaizhizao.models.line_side_inventory import LineSideInventory
        from apps.master_data.models.warehouse import Warehouse
        from tortoise.expressions import Q

        include_main_batches = True
        main_warehouse_filter_id: Optional[int] = None
        if warehouse_id:
            wh = await Warehouse.get_or_none(
                tenant_id=tenant_id, id=warehouse_id, deleted_at__isnull=True
            )
            if wh and wh.warehouse_type == "line_side":
                include_main_batches = False
            elif wh:
                main_warehouse_filter_id = int(wh.id)

        batch_query = MaterialBatch.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if material_id:
            batch_query = batch_query.filter(material_id=material_id)
        if batch_number:
            batch_query = batch_query.filter(batch_no__icontains=batch_number)
        if not include_expired:
            batch_query = batch_query.filter(Q(expiry_date__isnull=True) | Q(expiry_date__gte=date.today()))

        line_query = LineSideInventory.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="available")
        if material_id:
            line_query = line_query.filter(material_id=material_id)
        if batch_number:
            line_query = line_query.filter(batch_no__icontains=batch_number)
        if warehouse_id:
            line_query = line_query.filter(warehouse_id=warehouse_id)
        if not include_expired:
            line_query = line_query.filter(Q(expiry_date__isnull=True) | Q(expiry_date__gte=date.today()))

        batches = await batch_query.prefetch_related("material").all()
        lines = await line_query.all()

        line_wh_map: Dict[int, Any] = {}
        line_wh_ids = {int(l.warehouse_id) for l in lines if l.warehouse_id}
        if line_wh_ids:
            wh_rows = await Warehouse.filter(
                tenant_id=tenant_id,
                id__in=list(line_wh_ids),
                deleted_at__isnull=True,
            ).all()
            line_wh_map = {w.id: w for w in wh_rows}

        rows: List[Dict[str, Any]] = []
        main_wh_cache: Dict[int, Optional[Tuple[int, str]]] = {}
        wh_name_cache: Dict[int, str] = {}
        if include_main_batches:
            for b in batches:
                resolved_wh_id, resolved_wh_name = await self._resolve_material_batch_warehouse_for_report(
                    tenant_id=tenant_id,
                    batch=b,
                    material=getattr(b, "material", None),
                    cache=main_wh_cache,
                    wh_name_cache=wh_name_cache,
                )
                if not self._material_batch_matches_warehouse_filter(resolved_wh_id, main_warehouse_filter_id):
                    continue
                expiry_iso = to_api_isoformat(b.expiry_date) if b.expiry_date else None
                qty = float(b.quantity or 0)
                status = "已过期" if b.expiry_date and b.expiry_date < date.today() else ("在库" if qty > 0 else "无库存")
                rows.append({
                    "id": 1000000 + b.id,
                    "material_id": b.material_id,
                    "material_code": b.material.main_code if b.material else "UNKNOWN",
                    "material_name": b.material.name if b.material else "UNKNOWN",
                    "material_unit": getattr(b.material, "unit", None) if b.material else None,
                    "batch_no": self._normalize_batch_no_for_report(b.batch_no),
                    "production_date": to_api_isoformat(b.production_date) if b.production_date else None,
                    "expiry_date": expiry_iso,
                    "supplier_batch_no": b.supplier_batch_no,
                    "quantity": qty,
                    "status": status,
                    "warehouse_id": resolved_wh_id,
                    "warehouse_name": resolved_wh_name,
                })
        for l in lines:
            qty = float((l.quantity or 0) - (l.reserved_quantity or 0))
            status = "已过期" if l.expiry_date and l.expiry_date < date.today() else ("在库" if qty > 0 else "无库存")
            wh_id = int(l.warehouse_id) if l.warehouse_id else None
            wh = line_wh_map.get(wh_id) if wh_id else None
            wh_name = (
                str(getattr(l, "warehouse_name", None) or "").strip()
                or (wh.name if wh else "")
                or (f"仓库({wh_id})" if wh_id else None)
            )
            rows.append({
                "id": 2000000 + l.id,
                "material_id": l.material_id,
                "material_code": l.material_code,
                "material_name": l.material_name,
                "material_unit": getattr(l, "material_unit", None),
                "batch_no": self._normalize_batch_no_for_report(l.batch_no),
                "production_date": to_api_isoformat(l.production_date) if l.production_date else None,
                "expiry_date": to_api_isoformat(l.expiry_date) if l.expiry_date else None,
                "supplier_batch_no": None,
                "quantity": qty,
                "status": status,
                "warehouse_id": wh_id,
                "warehouse_name": self._normalize_warehouse_display_name(wh_name),
            })
        return rows

    async def _enrich_inventory_balance_material_fields(
        self,
        tenant_id: int,
        balances: List[Dict[str, Any]],
    ) -> None:
        """为即时库存汇总行补齐主数据物料属性、在途/在制与库存预警展示字段。"""
        from apps.kuaizhizao.models.inventory_alert import InventoryAlert, InventoryAlertRule
        from apps.kuaizhizao.utils.inventory_helper import batch_sum_open_supply_quantities_with_breakdown
        from apps.master_data.models.material import Material

        material_ids = sorted({int(b["material_id"]) for b in balances if b.get("material_id")})
        if not material_ids:
            return
        materials = await Material.filter(
            tenant_id=tenant_id,
            id__in=material_ids,
            deleted_at__isnull=True,
        ).all()
        by_id = {m.id: m for m in materials}

        in_transit_map = await batch_sum_open_supply_quantities_with_breakdown(tenant_id, material_ids)
        pending_alerts = await InventoryAlert.filter(
            tenant_id=tenant_id,
            material_id__in=material_ids,
            deleted_at__isnull=True,
            status__in=["pending", "processing"],
        ).all()
        alerts_by_key: Dict[tuple, List[Any]] = {}
        for alert in pending_alerts:
            wid = getattr(alert, "warehouse_id", None)
            key = (int(alert.material_id), int(wid) if wid is not None else None)
            alerts_by_key.setdefault(key, []).append(alert)

        enabled_rules = await InventoryAlertRule.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            is_enabled=True,
        ).all()

        for balance in balances:
            mid = balance.get("material_id")
            if not mid:
                continue
            mid_int = int(mid)
            material = by_id.get(mid_int)
            if material:
                balance["material_spec"] = getattr(material, "specification", None)
                balance["brand"] = getattr(material, "brand", None)
                balance["texture"] = getattr(material, "texture", None)
                balance["model"] = getattr(material, "model", None)
                balance["material_unit"] = balance.get("material_unit") or getattr(material, "base_unit", None)

            transit = in_transit_map.get(mid_int) or {
                "purchase_quantity": 0.0,
                "work_order_quantity": 0.0,
                "outsource_work_order_quantity": 0.0,
                "total": 0.0,
            }
            balance["in_transit_quantity"] = float(transit.get("total") or 0)
            balance["in_transit_breakdown"] = {
                "purchase_quantity": float(transit.get("purchase_quantity") or 0),
                "work_order_quantity": float(transit.get("work_order_quantity") or 0),
                "outsource_work_order_quantity": float(transit.get("outsource_work_order_quantity") or 0),
            }

            wid_raw = balance.get("warehouse_id")
            wid_int = int(wid_raw) if wid_raw is not None else None
            pending_for_row = list(alerts_by_key.get((mid_int, wid_int), []))
            if wid_int is not None:
                pending_for_row.extend(alerts_by_key.get((mid_int, None), []))
            alert_info = self._resolve_inventory_balance_alert(
                float(balance.get("quantity") or 0),
                material,
                pending_for_row,
                warehouse_id=wid_int,
                rules=enabled_rules,
            )
            balance.update(alert_info)

    @staticmethod
    def _material_stock_thresholds(material: Any) -> tuple[Optional[float], Optional[float]]:
        from apps.kuaizhizao.services.inventory_threshold_resolver import material_stock_thresholds

        safety, max_stock = material_stock_thresholds(material)
        return (
            float(safety) if safety is not None else None,
            float(max_stock) if max_stock is not None else None,
        )

    @classmethod
    def _resolve_inventory_balance_alert(
        cls,
        quantity: float,
        material: Any,
        pending_alerts: List[Any],
        *,
        warehouse_id: Optional[int] = None,
        rules: Optional[List[Any]] = None,
    ) -> Dict[str, Any]:
        from apps.kuaizhizao.services.inventory_threshold_resolver import (
            display_alert_from_threshold,
            resolve_effective_threshold,
        )

        level_rank = {"critical": 3, "warning": 2, "info": 1}
        type_labels = {
            "low_stock": "低库存",
            "high_stock": "高库存",
            "expired": "过期",
        }

        if pending_alerts:
            best = sorted(
                pending_alerts,
                key=lambda a: (
                    level_rank.get(str(getattr(a, "alert_level", "") or ""), 0),
                    str(getattr(a, "triggered_at", "") or ""),
                ),
                reverse=True,
            )[0]
            alert_type = str(getattr(best, "alert_type", "") or "")
            return {
                "alert_status": alert_type or "warning",
                "alert_level": str(getattr(best, "alert_level", "") or "warning"),
                "alert_label": type_labels.get(alert_type, "预警"),
                "alert_message": getattr(best, "alert_message", None),
            }

        rule_list = rules or []
        if material is not None:
            for alert_type in ("low_stock", "high_stock"):
                threshold = resolve_effective_threshold(
                    alert_type=alert_type,
                    material=material,
                    warehouse_id=warehouse_id,
                    rules=rule_list,
                )
                display = display_alert_from_threshold(quantity, threshold)
                if display:
                    return display
        return {
            "alert_status": "normal",
            "alert_level": None,
            "alert_label": "正常",
            "alert_message": None,
        }

    @staticmethod
    def _apply_inventory_filters(
        rows: List[Dict[str, Any]],
        include_zero_stock: bool = True,
        status_filter: Optional[str] = None,
        aging_bucket: Optional[str] = None,
        keyword: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        out = rows
        if not include_zero_stock:
            out = [r for r in out if float(r.get("quantity") or 0) > 0]
        if status_filter in {"in_stock", "zero", "expired"}:
            if status_filter == "in_stock":
                out = [r for r in out if float(r.get("quantity") or 0) > 0 and r.get("status") != "已过期"]
            elif status_filter == "zero":
                out = [r for r in out if float(r.get("quantity") or 0) <= 0]
            else:
                out = [r for r in out if r.get("status") == "已过期"]
        if aging_bucket in {"expired", "0-30", "31-90", "90+"}:
            today = date.today()
            filtered: List[Dict[str, Any]] = []
            for r in out:
                expiry = r.get("expiry_date")
                if not expiry:
                    continue
                try:
                    diff = (datetime.fromisoformat(str(expiry)).date() - today).days
                except Exception:
                    continue
                if aging_bucket == "expired" and diff < 0:
                    filtered.append(r)
                elif aging_bucket == "0-30" and 0 <= diff <= 30:
                    filtered.append(r)
                elif aging_bucket == "31-90" and 31 <= diff <= 90:
                    filtered.append(r)
                elif aging_bucket == "90+" and diff >= 91:
                    filtered.append(r)
            out = filtered
        if keyword:
            k = str(keyword).strip().lower()
            if k:
                out = [
                    r for r in out
                    if k in str(r.get("material_code") or "").lower()
                    or k in str(r.get("material_name") or "").lower()
                    or k in str(r.get("material_spec") or "").lower()
                    or k in str(r.get("brand") or "").lower()
                    or k in str(r.get("texture") or "").lower()
                    or k in str(r.get("model") or "").lower()
                    or k in str(r.get("batch_no") or "").lower()
                    or k in str(r.get("warehouse_name") or "").lower()
                ]
        return out

    @staticmethod
    def _paginate(items: List[Dict[str, Any]], current: int, page_size: int) -> Dict[str, Any]:
        current = max(int(current or 1), 1)
        page_size = max(min(int(page_size or 20), 500), 1)
        total = len(items)
        start = (current - 1) * page_size
        end = start + page_size
        return {
            "items": items[start:end],
            "total": total,
            "current": current,
            "page_size": page_size,
        }

    async def get_inventory_batch_lines(
        self,
        tenant_id: int,
        material_id: Optional[int] = None,
        warehouse_id: Optional[int] = None,
        batch_number: Optional[str] = None,
        include_expired: bool = False,
        include_zero_stock: bool = True,
        aging_bucket: Optional[str] = None,
        status_filter: Optional[str] = None,
        keyword: Optional[str] = None,
        order_by: Optional[str] = None,
        current: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        rows = await self._load_inventory_rows(
            tenant_id=tenant_id,
            material_id=material_id,
            warehouse_id=warehouse_id,
            batch_number=batch_number,
            include_expired=include_expired,
        )
        await self._enrich_inventory_balance_material_fields(tenant_id, rows)
        rows = self._apply_inventory_filters(
            rows,
            include_zero_stock=include_zero_stock,
            status_filter=status_filter,
            aging_bucket=aging_bucket,
            keyword=keyword,
        )
        from apps.kuaizhizao.services.warehouse_list_core import (
            INVENTORY_BATCH_LINE_SORTABLE_FIELDS,
            sort_inventory_report_rows,
        )
        rows = sort_inventory_report_rows(
            rows,
            order_by,
            INVENTORY_BATCH_LINE_SORTABLE_FIELDS,
            "material_code",
        )
        return self._paginate(rows, current=current, page_size=page_size)

    async def get_inventory_batch_lines_summary(
        self,
        tenant_id: int,
        material_id: Optional[int] = None,
        warehouse_id: Optional[int] = None,
        batch_number: Optional[str] = None,
        include_expired: bool = False,
        include_zero_stock: bool = True,
        aging_bucket: Optional[str] = None,
        status_filter: Optional[str] = None,
        keyword: Optional[str] = None,
        group_by: str = "aging_bucket",
    ) -> Dict[str, Any]:
        rows = await self._load_inventory_rows(
            tenant_id=tenant_id,
            material_id=material_id,
            warehouse_id=warehouse_id,
            batch_number=batch_number,
            include_expired=include_expired,
        )
        await self._enrich_inventory_balance_material_fields(tenant_id, rows)
        rows = self._apply_inventory_filters(
            rows,
            include_zero_stock=include_zero_stock,
            status_filter=status_filter,
            aging_bucket=aging_bucket,
            keyword=keyword,
        )
        return {
            "summary": self._build_inventory_items_summary(rows),
            "groups": self._group_inventory_items(rows, group_by) or [],
        }

    async def get_inventory_material_balances(
        self,
        tenant_id: int,
        material_id: Optional[int] = None,
        warehouse_id: Optional[int] = None,
        include_zero_stock: bool = True,
        status_filter: Optional[str] = None,
        keyword: Optional[str] = None,
        order_by: Optional[str] = None,
        current: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        rows = await self._load_inventory_rows(
            tenant_id=tenant_id,
            material_id=material_id,
            warehouse_id=warehouse_id,
            include_expired=True,
        )
        grouped: Dict[tuple, Dict[str, Any]] = {}
        for it in rows:
            warehouse_name = self._normalize_warehouse_display_name(it.get("warehouse_name"))
            wh_id_raw = it.get("warehouse_id")
            try:
                warehouse_id_key = int(wh_id_raw) if wh_id_raw is not None else 0
            except (TypeError, ValueError):
                warehouse_id_key = 0
            if warehouse_id_key < 0:
                warehouse_id_key = 0
            key = (it.get("material_id"), warehouse_id_key, warehouse_name)
            if key not in grouped:
                grouped[key] = {
                    "id": int(it.get("material_id") or 0) * 100000 + (abs(hash(str(key[1:]) )) % 10000),
                    "material_id": it.get("material_id"),
                    "material_code": it.get("material_code"),
                    "material_name": it.get("material_name"),
                    "material_unit": it.get("material_unit"),
                    "quantity": 0.0,
                    "status": "无库存",
                    "warehouse_id": warehouse_id_key if warehouse_id_key > 0 else None,
                    "warehouse_name": warehouse_name,
                }
            grouped[key]["quantity"] += float(it.get("quantity") or 0)
        balances = list(grouped.values())
        for b in balances:
            b["status"] = "在库" if float(b.get("quantity") or 0) > 0 else "无库存"
        await self._enrich_inventory_balance_material_fields(tenant_id, balances)
        balances = self._apply_inventory_filters(
            balances,
            include_zero_stock=include_zero_stock,
            status_filter=status_filter,
            keyword=keyword,
        )
        from apps.kuaizhizao.services.warehouse_list_core import (
            INVENTORY_MATERIAL_BALANCE_SORTABLE_FIELDS,
            sort_inventory_report_rows,
        )
        balances = sort_inventory_report_rows(
            balances,
            order_by,
            INVENTORY_MATERIAL_BALANCE_SORTABLE_FIELDS,
            "material_code",
        )
        return self._paginate(balances, current=current, page_size=page_size)

    async def get_inventory_material_balances_summary(
        self,
        tenant_id: int,
        material_id: Optional[int] = None,
        warehouse_id: Optional[int] = None,
        include_zero_stock: bool = True,
        status_filter: Optional[str] = None,
        keyword: Optional[str] = None,
        group_by: str = "warehouse",
    ) -> Dict[str, Any]:
        rows = await self.get_inventory_material_balances(
            tenant_id=tenant_id,
            material_id=material_id,
            warehouse_id=warehouse_id,
            include_zero_stock=include_zero_stock,
            status_filter=status_filter,
            keyword=keyword,
            current=1,
            page_size=100000,
        )
        items = rows["items"]
        return {
            "summary": self._build_inventory_items_summary(items),
            "groups": self._group_inventory_items(items, group_by) or [],
        }

    async def query_batch_inventory(
        self, tenant_id: int, material_id: Optional[int] = None, material_ids: Optional[List[int]] = None,
        warehouse_id: Optional[int] = None, batch_number: Optional[str] = None, include_expired: bool = False, summary_only: bool = False,
        include_zero_stock: bool = True,
        aggregate_by_material: bool = False,
        include_sales_commitment: bool = False,
        include_summary: bool = False,
        group_by: Optional[str] = None,
        ownership_type: Optional[str] = None,
        customer_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """批次库存查询"""
        logger.info(f"query_batch_inventory: material_id={material_id}, material_ids={material_ids}, include_sales_commitment={include_sales_commitment}")
        from apps.master_data.constants.batch_quality_status import QUALIFIED
        from apps.master_data.models.material_batch import MaterialBatch
        from apps.kuaizhizao.models.line_side_inventory import LineSideInventory
        from tortoise.expressions import Q
        query = MaterialBatch.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            quality_status=QUALIFIED,
        )
        if material_ids: query = query.filter(material_id__in=material_ids)
        elif material_id: query = query.filter(material_id=material_id)
        if batch_number: query = query.filter(batch_no__icontains=batch_number)
        if ownership_type:
            query = query.filter(ownership_type=ownership_type)
        if customer_id is not None:
            query = query.filter(customer_id=customer_id)
        if not include_expired: query = query.filter(Q(expiry_date__isnull=True) | Q(expiry_date__gte=date.today()))
        include_main_batches = True
        main_warehouse_filter_id: Optional[int] = None
        if warehouse_id:
            from apps.master_data.models.warehouse import Warehouse
            wh = await Warehouse.get_or_none(
                tenant_id=tenant_id, id=warehouse_id, deleted_at__isnull=True
            )
            if wh and wh.warehouse_type == "line_side":
                include_main_batches = False
            elif wh:
                main_warehouse_filter_id = int(wh.id)
        if summary_only:
            batches = await query.all()
        else:
            batches = await query.prefetch_related('material').all()
        line_query = LineSideInventory.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="available")
        if material_ids: line_query = line_query.filter(material_id__in=material_ids)
        elif material_id: line_query = line_query.filter(material_id=material_id)
        if batch_number: line_query = line_query.filter(batch_no__icontains=batch_number)
        if ownership_type:
            # 线边仓模型若无归属字段则忽略；有则对齐过滤
            if hasattr(LineSideInventory, "ownership_type"):
                line_query = line_query.filter(ownership_type=ownership_type)
        if customer_id is not None and hasattr(LineSideInventory, "customer_id"):
            line_query = line_query.filter(customer_id=customer_id)
        if warehouse_id:
            line_query = line_query.filter(warehouse_id=warehouse_id)
        line_items = await line_query.all()
        logger.info(f"query_batch_inventory found {len(batches)} batches and {len(line_items)} line items")
        if summary_only:
            target_ids = material_ids if material_ids else ([material_id] if material_id else [])
            totals = {str(mid): 0.0 for mid in target_ids}
            for b in batches:
                # 与出库扣减默认口径一致：仅自购在库；客供不计入 summary
                if (getattr(b, "status", None) or "") != "in_stock":
                    continue
                if (getattr(b, "ownership_type", None) or "company_owned") != "company_owned":
                    continue
                if int(getattr(b, "customer_id", 0) or 0) != 0:
                    continue
                if (b.quantity or 0) <= 0:
                    continue
                key = str(b.material_id)
                totals[key] = totals.get(key, 0) + float(b.quantity or 0)
            for l in line_items:
                if (getattr(l, "ownership_type", None) or "company_owned") != "company_owned":
                    continue
                if int(getattr(l, "customer_id", 0) or 0) != 0:
                    continue
                key = str(l.material_id)
                avail = float((l.quantity or 0) - (l.reserved_quantity or 0))
                if avail <= 0:
                    continue
                totals[key] = totals.get(key, 0) + avail
            if include_sales_commitment:
                from apps.kuaizhizao.models.sales_order import SalesOrder
                from apps.kuaizhizao.models.sales_order_item import SalesOrderItem

                logger.info("query_batch_inventory: including sales commitment")
                active_order_ids = await SalesOrder.filter(
                    tenant_id=tenant_id,
                    deleted_at__isnull=True,
                ).exclude(status__in=["草稿", "DRAFT", "已驳回", "REJECTED", "已取消", "CANCELLED"]).values_list("id", flat=True)
                if active_order_ids:
                    item_query = SalesOrderItem.filter(
                        tenant_id=tenant_id,
                        sales_order_id__in=list(active_order_ids),
                        remaining_quantity__gt=0,
                    )
                    if material_ids:
                        item_query = item_query.filter(material_id__in=material_ids)
                    elif material_id:
                        item_query = item_query.filter(material_id=material_id)
                    committed_rows = await item_query.values_list("material_id", "remaining_quantity")
                    for mid, qty in committed_rows:
                        key = str(mid)
                        current = float(totals.get(key, 0) or 0)
                        next_qty = current - float(qty or 0)
                        totals[key] = next_qty if next_qty > 0 else 0.0
            return {"material_totals": totals}
        items = []
        main_wh_cache: Dict[int, Optional[Tuple[int, str]]] = {}
        wh_name_cache: Dict[int, str] = {}
        for b in batches:
            if not include_main_batches:
                continue
            resolved_wh_id, resolved_wh_name = await self._resolve_material_batch_warehouse_for_report(
                tenant_id=tenant_id,
                batch=b,
                material=getattr(b, "material", None),
                cache=main_wh_cache,
                wh_name_cache=wh_name_cache,
            )
            if not self._material_batch_matches_warehouse_filter(resolved_wh_id, main_warehouse_filter_id):
                continue
            status = b.status
            if b.expiry_date and b.expiry_date < date.today(): status = "已过期"
            elif (b.quantity or 0) <= 0: status = "无库存"
            items.append({
                "id": 1000000 + b.id, 
                "material_id": b.material_id, 
                "material_code": b.material.main_code if b.material else (b.material.code if b.material else "UNKNOWN"), 
                "material_name": b.material.name if b.material else "UNKNOWN", 
                "batch_no": self._normalize_batch_no_for_report(b.batch_no), 
                "production_date": to_api_isoformat(b.production_date) if b.production_date else None,
                "expiry_date": to_api_isoformat(b.expiry_date) if b.expiry_date else None,
                "supplier_batch_no": b.supplier_batch_no,
                "quantity": float(b.quantity or 0), 
                "status": status, 
                "warehouse_id": resolved_wh_id,
                "warehouse_name": resolved_wh_name,
                "ownership_type": getattr(b, "ownership_type", None) or "company_owned",
                "customer_id": int(getattr(b, "customer_id", 0) or 0),
            })
        for l in line_items:
            qty = float((l.quantity or 0) - (l.reserved_quantity or 0))
            items.append({
                "id": 2000000 + l.id, 
                "material_id": l.material_id, 
                "material_code": l.material_code, 
                "material_name": l.material_name, 
                "batch_no": self._normalize_batch_no_for_report(l.batch_no), 
                "production_date": to_api_isoformat(l.production_date) if l.production_date else None,
                "expiry_date": to_api_isoformat(l.expiry_date) if l.expiry_date else None,
                "supplier_batch_no": None,
                "quantity": qty, 
                "status": "在库" if qty > 0 else "无库存", 
                "warehouse_name": self._normalize_warehouse_display_name(getattr(l, "warehouse_name", None)),
                "ownership_type": getattr(l, "ownership_type", None) or "company_owned",
                "customer_id": int(getattr(l, "customer_id", 0) or 0),
            })
        if aggregate_by_material:
            # 即时库存口径：按物料（可按仓库）汇总，不按批次拆分
            grouped: Dict[tuple, Dict[str, Any]] = {}
            for it in items:
                warehouse_name = self._normalize_warehouse_display_name(it.get("warehouse_name"))
                key = (it.get("material_id"), warehouse_name)
                if key not in grouped:
                    grouped[key] = {
                        "id": int(it.get("material_id") or 0) * 100000 + (abs(hash(str(key[1]))) % 10000),
                        "material_id": it.get("material_id"),
                        "material_code": it.get("material_code"),
                        "material_name": it.get("material_name"),
                        "quantity": 0.0,
                        "status": "无库存",
                        "warehouse_name": warehouse_name,
                    }
                grouped[key]["quantity"] += float(it.get("quantity") or 0)
            agg_items = []
            for row in grouped.values():
                qty = float(row["quantity"] or 0)
                row["status"] = "在库" if qty > 0 else "无库存"
                agg_items.append(row)
            if not include_zero_stock:
                agg_items = [row for row in agg_items if float(row.get("quantity") or 0) > 0]
            agg_items.sort(key=lambda x: ((x.get("material_code") or ""), (x.get("warehouse_name") or "")))
            summary = self._build_inventory_items_summary(agg_items)
            grouped = self._group_inventory_items(agg_items, group_by)
            return {
                "total": len(agg_items),
                "items": agg_items,
                "summary": summary if include_summary else None,
                "groups": grouped if group_by else None,
                "query_meta": {
                    "material_id": material_id,
                    "material_ids": material_ids,
                    "warehouse_id": warehouse_id,
                    "batch_number": batch_number,
                    "include_expired": include_expired,
                    "include_zero_stock": include_zero_stock,
                    "aggregate_by_material": aggregate_by_material,
                },
            }
        if not include_zero_stock:
            items = [it for it in items if float(it.get("quantity") or 0) > 0]
        summary = self._build_inventory_items_summary(items)
        grouped = self._group_inventory_items(items, group_by)
        return {
            "total": len(items),
            "items": items,
            "summary": summary if include_summary else None,
            "groups": grouped if group_by else None,
            "query_meta": {
                "material_id": material_id,
                "material_ids": material_ids,
                "warehouse_id": warehouse_id,
                "batch_number": batch_number,
                "include_expired": include_expired,
                "include_zero_stock": include_zero_stock,
                "aggregate_by_material": aggregate_by_material,
            },
        }

    async def get_plan_report(
        self,
        tenant_id: int,
        report_type: str = "plan-fulfillment-rate",
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        *,
        current_user: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """计划报表汇总"""
        from apps.kuaizhizao.models.demand import Demand
        from apps.kuaizhizao.models.demand_item import DemandItem
        from apps.kuaizhizao.models.purchase_requisition import PurchaseRequisition
        from apps.kuaizhizao.models.inventory_alert import InventoryAlert
        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation

        if report_type in ["plan-fulfillment-rate", "fulfillment"]:
            # 计划达成率分析 - 使用 DemandItem 获取明细
            items = await DemandItem.filter(tenant_id=tenant_id).limit(100).values("id", "material_name", "required_quantity", "delivered_quantity", "delivery_status")
            res = []
            for it in items:
                res.append({
                    "plan_code": f"D-ITEM-{it['id']}",
                    "material_name": it["material_name"],
                    "planned_quantity": float(it["required_quantity"] or 0),
                    "completed_quantity": float(it["delivered_quantity"] or 0),
                    "fulfillment_rate": (float(it["delivered_quantity"] or 0) / float(it["required_quantity"] or 1) * 100),
                    "status": it["delivery_status"] or "未知"
                })
            return {"data": res, "success": True}
        elif report_type in ["demand-plan-detail", "demand_detail"]:
            # 需求计划详情
            items = await DemandItem.filter(tenant_id=tenant_id).limit(100).values("id", "material_code", "material_name", "required_quantity", "delivery_date")
            for it in items:
                it["quantity"] = float(it["required_quantity"] or 0)
                it["requirement_date"] = it["delivery_date"].strftime("%Y-%m-%d") if it["delivery_date"] else None
            return {"data": items, "success": True}
        elif report_type in ["purchase-plan-comparison", "pur_comparison"]:
            # 采购计划对比 - 使用 PurchaseRequisitionItem 获取明细
            from apps.kuaizhizao.models.purchase_requisition import PurchaseRequisitionItem
            items = await PurchaseRequisitionItem.filter(tenant_id=tenant_id).limit(100).values("requisition_id", "material_name", "quantity", "notes")
            res = []
            for it in items:
                res.append({
                    "requisition_code": f"REQ-ITEM-{it['requisition_id']}",
                    "material_name": it["material_name"],
                    "quantity": float(it["quantity"] or 0),
                    "status": "已申请"
                })
            return {"data": res, "success": True}
        elif report_type in ["capacity-load-analysis", "capacity"]:
            # 产能负荷分析
            items = await WorkOrderOperation.filter(tenant_id=tenant_id).limit(100).values("operation_name", "planned_start_date", "planned_end_date", "status")
            for it in items:
                it["planned_start_date"] = it["planned_start_date"].strftime("%Y-%m-%d") if it["planned_start_date"] else None
                it["planned_end_date"] = it["planned_end_date"].strftime("%Y-%m-%d") if it["planned_end_date"] else None
            return {"data": items, "success": True}
        elif report_type in ["material-shortage-alert", "shortage"]:
            # 物料短缺预警（InventoryAlert：threshold_value=最低库存阈值，triggered_at=预警时间）
            items = await InventoryAlert.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                alert_type="low_stock",
                status="pending",
            ).limit(100).values(
                "material_name",
                "warehouse_name",
                "current_quantity",
                "threshold_value",
                "triggered_at",
            )
            return {"data": items, "success": True}
        elif report_type in ["production-delay-analysis", "delay"]:
            # 生产延期分析
            delay_qs = await self._scoped_work_order_query(
                tenant_id=tenant_id,
                current_user=current_user,
            )
            items = await delay_qs.filter(planned_end_date__lt=date.today()).limit(100).values(
                "code",
                "product_name",
                "planned_end_date",
                "status",
            )
            res = [
                {
                    "code": it["code"],
                    "material_name": it["product_name"],
                    "planned_end_date": it["planned_end_date"].strftime("%Y-%m-%d") if it["planned_end_date"] else None,
                    "status": it["status"],
                }
                for it in items
            ]
            return self._wrap_report_payload({"data": res, "success": True})
        return {"data": [], "success": True}

    async def get_purchase_report(
        self,
        tenant_id: int,
        report_type: str = "purchase-order-query",
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        supplier_id: Optional[int] = None,
        *,
        skip: int = 0,
        limit: int = 100,
        current_user: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """采购报表汇总"""
        from apps.kuaizhizao.models.purchase_requisition import PurchaseRequisition
        from apps.kuaizhizao.models.purchase_order import PurchaseOrder, PurchaseOrderItem
        from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
        from apps.kuaizhizao.models.purchase_return import PurchaseReturn
        from apps.kuaizhizao.models.incoming_inspection import IncomingInspection
        from tortoise.functions import Sum, Count, Avg

        if report_type in ["purchase-requisition-tracking", "req_tracking", "requisition_tracking"]:
            from apps.kuaizhizao.models.purchase_requisition import PurchaseRequisitionItem

            rows = await PurchaseRequisitionItem.filter(tenant_id=tenant_id).order_by("-id").limit(100).values(
                "requisition_id",
                "material_name",
                "quantity",
                "required_date",
            )
            req_ids = list({r["requisition_id"] for r in rows if r.get("requisition_id")})
            req_map = {}
            if req_ids:
                for head in await PurchaseRequisition.filter(id__in=req_ids).values(
                    "id", "requisition_code", "status"
                ):
                    req_map[head["id"]] = head
            res = []
            for it in rows:
                head = req_map.get(it.get("requisition_id"), {})
                res.append({
                    "requisition_code": head.get("requisition_code") or "N/A",
                    "material_name": it.get("material_name"),
                    "quantity": float(it.get("quantity") or 0),
                    "requirement_date": it["required_date"].strftime("%Y-%m-%d") if it.get("required_date") else None,
                    "status": head.get("status") or "未知",
                })
            return {"data": res, "success": True}

        scoped_po_query = await self._scoped_purchase_order_query(
            tenant_id=tenant_id,
            current_user=current_user,
        )
        scoped_po_ids = await scoped_po_query.values_list("id", flat=True)
        scoped_po_id_list = list(scoped_po_ids)

        po_dependent_types = {
            "purchase-order-query",
            "po_query",
            "purchase-order-progress",
            "po_progress",
        }
        if report_type in po_dependent_types and not scoped_po_id_list:
            return {"data": [], "success": True, "total": 0}

        lim = max(1, min(int(limit or 100), 500))
        sk = max(0, int(skip or 0))

        if report_type in ["purchase-order-query", "po_query"]:
            po_q = scoped_po_query
            if date_start:
                po_q = po_q.filter(order_date__gte=date_start.date())
            if date_end:
                po_q = po_q.filter(order_date__lte=date_end.date())
            if supplier_id:
                po_q = po_q.filter(supplier_id=supplier_id)
            total = await po_q.count()
            items = await po_q.order_by("-order_date").offset(sk).limit(lim).values(
                "order_code",
                "order_date",
                "supplier_name",
                "total_amount",
                "status",
            )
            return {"data": items, "success": True, "total": total}
        elif report_type in ["purchase-order-progress", "po_progress"]:
            item_q = PurchaseOrderItem.filter(
                tenant_id=tenant_id,
                order_id__in=scoped_po_id_list,
            )
            if date_start:
                item_q = item_q.filter(required_date__gte=date_start.date())
            if date_end:
                item_q = item_q.filter(required_date__lte=date_end.date())
            total = await item_q.count()
            items = await item_q.order_by("-id").offset(sk).limit(lim).values(
                "material_name", "ordered_quantity", "received_quantity", "required_date",
            )
            for it in items:
                it["quantity"] = float(it["ordered_quantity"] or 0)
                it["delivery_date"] = it["required_date"].strftime("%Y-%m-%d") if it["required_date"] else None
            return {"data": items, "success": True, "total": total}
        elif report_type in ["supplier-delivery-summary", "supplier_delivery"]:
            rq = PurchaseReceipt.filter(tenant_id=tenant_id, deleted_at__isnull=True)
            if date_start:
                rq = rq.filter(receipt_time__gte=date_start)
            if date_end:
                rq = rq.filter(receipt_time__lte=date_end)
            stats = await rq.annotate(count=Count("id")).group_by("supplier_name").values("supplier_name", "count")
            return {"data": stats, "success": True}
        elif report_type in [
            "supplier-price-comparison", "price_comparison",
            "purchase-cost-trend", "cost_trend",
            "supplier-lead-time", "lead_time",
            "supplier-quality-rate", "supplier_quality",
        ]:
            raise ValidationError(f"报表已下线: {report_type}")
        elif report_type in ["purchase-reconciliation", "pur_reconciliation", "purchase_recon"]:
            from apps.kuaizhizao.services.report_enhancements import build_purchase_reconciliation
            return await build_purchase_reconciliation(
                tenant_id, date_start=date_start, date_end=date_end, skip=sk, limit=lim,
            )
        return {"data": [], "success": True}

    @staticmethod
    def _apply_inspection_date_filter(query, date_start: Optional[datetime], date_end: Optional[datetime], time_field: str = "inspection_time"):
        if date_start:
            query = query.filter(**{f"{time_field}__gte": date_start})
        if date_end:
            query = query.filter(**{f"{time_field}__lte": date_end})
        return query

    @staticmethod
    def _monthly_pass_rate_buckets(rows: List[Dict[str, Any]], time_field: str = "inspection_time") -> Dict[str, Dict[str, float]]:
        buckets: Dict[str, Dict[str, float]] = {}
        for row in rows:
            inspected_at = row.get(time_field)
            if not inspected_at:
                continue
            month = inspected_at.strftime("%Y-%m")
            total = float(row.get("inspection_quantity") or 0)
            qualified = float(row.get("qualified_quantity") or 0)
            if month not in buckets:
                buckets[month] = {"qualified": 0.0, "total": 0.0}
            buckets[month]["qualified"] += qualified
            buckets[month]["total"] += total
        return buckets

    @staticmethod
    def _pass_rate_from_bucket(bucket: Optional[Dict[str, float]]) -> Optional[float]:
        if not bucket or float(bucket.get("total") or 0) <= 0:
            return None
        return float(bucket["qualified"]) / float(bucket["total"])

    async def get_quality_report(self, tenant_id: int, report_type: str = "quality-rate-trend", date_start: Optional[datetime] = None, date_end: Optional[datetime] = None, material_id: Optional[int] = None, *, skip: int = 0, limit: int = 100, **kwargs) -> Dict[str, Any]:
        """质量报表汇总"""
        from apps.kuaizhizao.models.incoming_inspection import IncomingInspection
        from apps.kuaizhizao.models.process_inspection import ProcessInspection
        from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection
        from apps.kuaizhizao.models.defect_record import DefectRecord
        from apps.kuaizhizao.models.quality_exception import QualityException
        from tortoise.functions import Sum

        if report_type in ["incoming-inspection-report", "incoming", "incoming_pass_rate"]:
            query = IncomingInspection.filter(tenant_id=tenant_id, deleted_at__isnull=True)
            if material_id:
                query = query.filter(material_id=material_id)
            query = self._apply_inspection_date_filter(query, date_start, date_end)
            total = await query.count()
            lim = max(1, min(int(limit or 100), 500))
            sk = max(0, int(skip or 0))
            items = await query.order_by("-inspection_time").offset(sk).limit(lim).values(
                "inspection_code", "material_name", "inspection_time", "status",
                "inspection_quantity", "qualified_quantity",
            )
            from apps.kuaizhizao.services.report_enhancements import inspection_pass_rate_row
            enriched = []
            for it in items:
                it["inspection_date"] = to_api_isoformat(it["inspection_time"].date()) if it["inspection_time"] else None
                it["batch_no"] = None
                enriched.append(inspection_pass_rate_row(it))
            pass_rates = [r["pass_rate"] for r in enriched if r.get("pass_rate") is not None]
            avg_rate = round(sum(pass_rates) / len(pass_rates), 2) if pass_rates else 0.0
            return {"data": enriched, "total": total, "success": True, "summary": {"avg_pass_rate": avg_rate}}
        elif report_type in ["process-inspection-report", "process", "process_pass_rate"]:
            query = ProcessInspection.filter(tenant_id=tenant_id, deleted_at__isnull=True)
            if material_id:
                query = query.filter(material_id=material_id)
            query = self._apply_inspection_date_filter(query, date_start, date_end)
            total = await query.count()
            lim = max(1, min(int(limit or 100), 500))
            sk = max(0, int(skip or 0))
            items = await query.order_by("-inspection_time").offset(sk).limit(lim).values(
                "inspection_code", "material_name", "work_order_code", "inspection_time", "status",
                "inspection_quantity", "qualified_quantity",
            )
            from apps.kuaizhizao.services.report_enhancements import inspection_pass_rate_row
            enriched = []
            for it in items:
                it["inspection_date"] = to_api_isoformat(it["inspection_time"].date()) if it["inspection_time"] else None
                enriched.append(inspection_pass_rate_row(it))
            pass_rates = [r["pass_rate"] for r in enriched if r.get("pass_rate") is not None]
            avg_rate = round(sum(pass_rates) / len(pass_rates), 2) if pass_rates else 0.0
            return {"data": enriched, "total": total, "success": True, "summary": {"avg_pass_rate": avg_rate}}
        elif report_type in ["finished-inspection-report", "finished", "final_pass_rate"]:
            query = FinishedGoodsInspection.filter(tenant_id=tenant_id, deleted_at__isnull=True)
            if material_id:
                query = query.filter(material_id=material_id)
            query = self._apply_inspection_date_filter(query, date_start, date_end)
            total = await query.count()
            lim = max(1, min(int(limit or 100), 500))
            sk = max(0, int(skip or 0))
            items = await query.order_by("-inspection_time").offset(sk).limit(lim).values(
                "inspection_code", "material_name", "batch_number", "inspection_time", "status",
                "inspection_quantity", "qualified_quantity",
            )
            from apps.kuaizhizao.services.report_enhancements import inspection_pass_rate_row
            enriched = []
            for it in items:
                it["inspection_date"] = to_api_isoformat(it["inspection_time"].date()) if it["inspection_time"] else None
                it["batch_no"] = it.pop("batch_number", None)
                enriched.append(inspection_pass_rate_row(it))
            pass_rates = [r["pass_rate"] for r in enriched if r.get("pass_rate") is not None]
            avg_rate = round(sum(pass_rates) / len(pass_rates), 2) if pass_rates else 0.0
            return {"data": enriched, "total": total, "success": True, "summary": {"avg_pass_rate": avg_rate}}
        elif report_type in ["quality-exception-tracking", "exception_tracking", "quality_exception"]:
            query = QualityException.filter(tenant_id=tenant_id, deleted_at__isnull=True)
            if material_id:
                query = query.filter(material_id=material_id)
            if date_start:
                query = query.filter(created_at__gte=date_start)
            if date_end:
                query = query.filter(created_at__lte=date_end)
            items = await query.order_by("-created_at").limit(100).values(
                "id",
                "exception_type",
                "problem_description",
                "root_cause",
                "status",
                "created_at",
                "material_name",
            )
            for it in items:
                it["exception_code"] = f"QE-{it['id']}"
                it["discovery_date"] = to_api_isoformat(it["created_at"].date()) if it["created_at"] else None
                it["type"] = it["exception_type"]
                it["reason"] = it["root_cause"] or it["problem_description"]
            return {"data": items, "success": True}
        elif report_type in ["nonconforming-summary", "defect_summary", "nonconforming_summary"]:
            query = DefectRecord.filter(tenant_id=tenant_id, deleted_at__isnull=True)
            if material_id:
                query = query.filter(product_id=material_id)
            if date_start:
                query = query.filter(created_at__gte=date_start)
            if date_end:
                query = query.filter(created_at__lte=date_end)
            items = await query.order_by("-created_at").limit(100).values(
                "code", "product_name", "defect_quantity", "disposition", "processed_at"
            )
            for it in items:
                it["handle_code"] = it["code"]
                it["material_name"] = it["product_name"]
                it["unqualified_qty"] = float(it["defect_quantity"] or 0)
                it["disposal_method"] = it["disposition"]
                it["disposal_date"] = to_api_isoformat(it["processed_at"].date()) if it["processed_at"] else None
            total_unqualified = sum(float(it["unqualified_qty"] or 0) for it in items)
            return {
                "data": items,
                "total": len(items),
                "success": True,
                "summary": {
                    "unqualified_qty": round(total_unqualified, 2),
                    "record_count": len(items),
                },
            }
        elif report_type in ["quality-rate-trend", "quality_trend", "quality_rate_trend"]:
            iqc_query = IncomingInspection.filter(tenant_id=tenant_id, deleted_at__isnull=True)
            ipqc_query = ProcessInspection.filter(tenant_id=tenant_id, deleted_at__isnull=True)
            fqc_query = FinishedGoodsInspection.filter(tenant_id=tenant_id, deleted_at__isnull=True)
            if material_id:
                iqc_query = iqc_query.filter(material_id=material_id)
                ipqc_query = ipqc_query.filter(material_id=material_id)
                fqc_query = fqc_query.filter(material_id=material_id)
            iqc_query = self._apply_inspection_date_filter(iqc_query, date_start, date_end)
            ipqc_query = self._apply_inspection_date_filter(ipqc_query, date_start, date_end)
            fqc_query = self._apply_inspection_date_filter(fqc_query, date_start, date_end)

            iqc_rows = await iqc_query.values("inspection_time", "inspection_quantity", "qualified_quantity")
            ipqc_rows = await ipqc_query.values("inspection_time", "inspection_quantity", "qualified_quantity")
            fqc_rows = await fqc_query.values("inspection_time", "inspection_quantity", "qualified_quantity")

            iqc_buckets = self._monthly_pass_rate_buckets(iqc_rows)
            ipqc_buckets = self._monthly_pass_rate_buckets(ipqc_rows)
            fqc_buckets = self._monthly_pass_rate_buckets(fqc_rows)
            all_months = sorted(set(iqc_buckets) | set(ipqc_buckets) | set(fqc_buckets))

            stats = []
            for month in all_months:
                iqc_rate = self._pass_rate_from_bucket(iqc_buckets.get(month))
                ipqc_rate = self._pass_rate_from_bucket(ipqc_buckets.get(month))
                fqc_rate = self._pass_rate_from_bucket(fqc_buckets.get(month))
                stage_rates = [r for r in (iqc_rate, ipqc_rate, fqc_rate) if r is not None]
                stats.append({
                    "month": month,
                    "iqc_rate": iqc_rate,
                    "ipqc_rate": ipqc_rate,
                    "fqc_rate": fqc_rate,
                    "overall_rate": sum(stage_rates) / len(stage_rates) if stage_rates else None,
                })
            return {"data": stats, "success": True}
        elif report_type in ["defect-pareto-analysis", "pareto", "analysis"]:
            query = DefectRecord.filter(tenant_id=tenant_id, deleted_at__isnull=True)
            if material_id:
                query = query.filter(product_id=material_id)
            if date_start:
                query = query.filter(created_at__gte=date_start)
            if date_end:
                query = query.filter(created_at__lte=date_end)
            items = await query.order_by("-created_at").limit(100).values(
                "code", "product_name", "defect_type", "defect_quantity", "created_at", "defect_reason"
            )
            for it in items:
                it["defect_code"] = it["code"]
                it["material_name"] = it["product_name"]
                it["defect_quantity"] = float(it["defect_quantity"] or 0)
            return {"data": items, "success": True}
        return {"data": [], "success": True}

    async def get_equipment_report(self, tenant_id: int, report_type: str = "equipment-oee-analysis", date_start: Optional[datetime] = None, date_end: Optional[datetime] = None) -> Dict[str, Any]:
        """设备报表汇总"""
        from apps.kuaizhizao.models.equipment import Equipment
        from apps.kuaizhizao.models.equipment_fault import EquipmentFault
        from apps.kuaizhizao.models.maintenance_plan import MaintenanceExecution, MaintenancePlan
        from tortoise.functions import Count

        if report_type in ["equipment-maintenance-detail", "maint_detail"]:
            # 设备保养明细 - 使用 MaintenanceExecution
            items = await MaintenanceExecution.filter(tenant_id=tenant_id).limit(100).values("execution_no", "equipment_name", "status", "execution_date")
            for it in items:
                it["record_code"] = it["execution_no"]
                it["maintenance_time"] = it["execution_date"].strftime("%Y-%m-%d %H:%M") if it["execution_date"] else None
            return {"data": items, "success": True}
        elif report_type in ["equipment-oee-analysis", "oee"]:
            raise ValidationError(f"报表已下线: {report_type}")
        elif report_type in ["equipment-fault-analysis", "fault_analysis"]:
            # 设备故障分析
            stats = await EquipmentFault.filter(tenant_id=tenant_id).annotate(count=Count("id")).group_by("equipment_name").values("equipment_name", "count")
            return {"data": stats, "success": True}
        elif report_type in ["equipment-maintenance-plan", "maint_plan"]:
            # 设备保养计划
            items = await MaintenancePlan.filter(tenant_id=tenant_id).exclude(status="已完成").limit(100).values("plan_no", "equipment_name", "planned_start_date")
            for it in items:
                it["record_code"] = it["plan_no"]
                it["planned_time"] = it["planned_start_date"].strftime("%Y-%m-%d") if it["planned_start_date"] else None
            return {"data": items, "success": True}
        elif report_type in ["equipment-status-log", "status_log"]:
            from apps.kuaizhizao.models.equipment_status_monitor import EquipmentStatusMonitor
            items = await EquipmentStatusMonitor.filter(tenant_id=tenant_id).order_by("-updated_at").limit(100).values(
                "equipment_uuid", "equipment_name", "status", "updated_at",
            )
            uuid_list = [it["equipment_uuid"] for it in items if it.get("equipment_uuid")]
            name_by_uuid: Dict[str, str] = {}
            if uuid_list:
                for eq in await Equipment.filter(tenant_id=tenant_id, uuid__in=uuid_list).values("uuid", "name", "code"):
                    name_by_uuid[str(eq["uuid"])] = str(eq.get("name") or eq.get("code") or "")
            for it in items:
                it["equipment_name"] = it.get("equipment_name") or name_by_uuid.get(str(it.get("equipment_uuid") or ""), "")
                it["to_status"] = it["status"]
                it["status_changed_at"] = it["updated_at"].strftime("%Y-%m-%d %H:%M") if it["updated_at"] else None
            return {"data": items, "success": True}
        elif report_type in ["equipment-spot-check-summary", "spot_check_summary"]:
            return await self._build_equipment_spot_check_summary(tenant_id, date_start, date_end)
        elif report_type in ["equipment-route-patrol-summary", "route_patrol_summary"]:
            return await self._build_equipment_route_patrol_summary(tenant_id, date_start, date_end)
        elif report_type in ["equipment-mttr-mtbf", "mttr_mtbf_summary"]:
            return await self._build_equipment_mttr_mtbf_summary(tenant_id, date_start, date_end)
        return {"data": [], "success": True}

    async def _build_equipment_mttr_mtbf_summary(
        self,
        tenant_id: int,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        from collections import defaultdict

        from apps.kuaizhizao.models.equipment_fault import EquipmentFault, EquipmentRepair

        from apps.kuaizhizao.models.equipment import Equipment

        fault_qs = EquipmentFault.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        repair_qs = EquipmentRepair.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="已完成")
        start_d = self._as_date(date_start)
        end_d = self._as_date(date_end)
        if start_d:
            fault_qs = fault_qs.filter(fault_date__gte=start_d)
            repair_qs = repair_qs.filter(repair_date__gte=start_d)
        if end_d:
            fault_qs = fault_qs.filter(fault_date__lte=end_d)
            repair_qs = repair_qs.filter(repair_date__lte=end_d)

        faults = await fault_qs.order_by("equipment_id", "fault_date").values(
            "equipment_id",
            "equipment_name",
            "fault_date",
        )
        repairs = await repair_qs.values(
            "equipment_id",
            "equipment_name",
            "repair_duration",
        )

        repair_agg: Dict[int, Dict[str, Any]] = defaultdict(
            lambda: {
                "equipment_code": "",
                "equipment_name": "",
                "repair_count": 0,
                "total_repair_hours": 0.0,
            }
        )
        for r in repairs:
            eid = int(r["equipment_id"])
            bucket = repair_agg[eid]
            bucket["equipment_name"] = r.get("equipment_name") or bucket["equipment_name"]
            bucket["repair_count"] += 1
            duration = float(r.get("repair_duration") or 0)
            bucket["total_repair_hours"] += duration

        fault_dates: Dict[int, List[datetime]] = defaultdict(list)
        equip_meta: Dict[int, Dict[str, str]] = {}
        for f in faults:
            eid = int(f["equipment_id"])
            equip_meta[eid] = {
                "equipment_name": f.get("equipment_name") or "",
            }
            if f.get("fault_date"):
                fault_dates[eid].append(f["fault_date"])

        all_equipment_ids = set(repair_agg.keys()) | set(fault_dates.keys())
        code_by_id: Dict[int, str] = {}
        if all_equipment_ids:
            for eq in await Equipment.filter(tenant_id=tenant_id, id__in=list(all_equipment_ids)).values("id", "code"):
                code_by_id[int(eq["id"])] = str(eq.get("code") or "")

        data: List[Dict[str, Any]] = []
        for eid in sorted(all_equipment_ids):
            meta = equip_meta.get(eid) or repair_agg.get(eid) or {}
            repair_bucket = repair_agg.get(eid, {})
            repair_count = repair_bucket.get("repair_count", 0)
            total_hours = repair_bucket.get("total_repair_hours", 0.0)
            mttr_hours = round(total_hours / repair_count, 2) if repair_count else None

            dates = sorted(fault_dates.get(eid, []))
            fault_count = len(dates)
            mtbf_hours = None
            if fault_count >= 2:
                intervals = [
                    (dates[i + 1] - dates[i]).total_seconds() / 3600
                    for i in range(len(dates) - 1)
                ]
                mtbf_hours = round(sum(intervals) / len(intervals), 2)

            data.append(
                {
                    "equipment_id": eid,
                    "equipment_code": code_by_id.get(eid, ""),
                    "equipment_name": meta.get("equipment_name") or repair_bucket.get("equipment_name", ""),
                    "fault_count": fault_count,
                    "repair_count": repair_count,
                    "mttr_hours": mttr_hours,
                    "mtbf_hours": mtbf_hours,
                }
            )

        return {"data": data, "success": True}

    async def _build_equipment_spot_check_summary(
        self,
        tenant_id: int,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        from collections import defaultdict

        from apps.kuaizhizao.models.equipment_ops import EquipmentSpotCheck, EquipmentSpotCheckLine

        qs = EquipmentSpotCheck.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        start_d = self._as_date(date_start)
        end_d = self._as_date(date_end)
        if start_d:
            qs = qs.filter(check_date__gte=start_d)
        if end_d:
            qs = qs.filter(check_date__lte=end_d)

        records = await qs.values(
            "id",
            "equipment_id",
            "equipment_code",
            "equipment_name",
            "status",
            "has_abnormality",
            "check_date",
        )

        total_count = len(records)
        completed_count = sum(1 for r in records if r.get("status") == "已完成")
        abnormality_count = sum(1 for r in records if r.get("has_abnormality"))
        completion_rate = round(completed_count / total_count, 4) if total_count else 0.0

        record_ids = [r["id"] for r in records]
        fail_line_count = 0
        if record_ids:
            fail_line_count = await EquipmentSpotCheckLine.filter(
                tenant_id=tenant_id,
                spot_check_id__in=record_ids,
                deleted_at__isnull=True,
                is_pass=False,
            ).count()

        equip_agg: Dict[int, Dict[str, Any]] = defaultdict(
            lambda: {
                "equipment_code": "",
                "equipment_name": "",
                "total_count": 0,
                "completed_count": 0,
                "abnormality_count": 0,
            }
        )
        for r in records:
            eid = int(r["equipment_id"])
            bucket = equip_agg[eid]
            bucket["equipment_code"] = r.get("equipment_code") or ""
            bucket["equipment_name"] = r.get("equipment_name") or ""
            bucket["total_count"] += 1
            if r.get("status") == "已完成":
                bucket["completed_count"] += 1
            if r.get("has_abnormality"):
                bucket["abnormality_count"] += 1

        data: List[Dict[str, Any]] = []
        for eid, bucket in equip_agg.items():
            tc = bucket["total_count"]
            data.append(
                {
                    "equipment_id": eid,
                    "equipment_code": bucket["equipment_code"],
                    "equipment_name": bucket["equipment_name"],
                    "total_count": tc,
                    "completed_count": bucket["completed_count"],
                    "abnormality_count": bucket["abnormality_count"],
                    "completion_rate": round(bucket["completed_count"] / tc, 4) if tc else 0.0,
                }
            )
        data.sort(key=lambda x: (-x["total_count"], x.get("equipment_code") or ""))

        return {
            "data": data,
            "total": len(data),
            "success": True,
            "summary": {
                "total_count": total_count,
                "completed_count": completed_count,
                "abnormality_count": abnormality_count,
                "completion_rate": completion_rate,
                "fail_line_count": fail_line_count,
            },
        }

    async def _build_equipment_route_patrol_summary(
        self,
        tenant_id: int,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        from collections import defaultdict

        from apps.kuaizhizao.models.equipment_ops import EquipmentRoutePatrol, EquipmentRoutePatrolLine

        qs = EquipmentRoutePatrol.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        start_d = self._as_date(date_start)
        end_d = self._as_date(date_end)
        if start_d:
            qs = qs.filter(patrol_date__gte=start_d)
        if end_d:
            qs = qs.filter(patrol_date__lte=end_d)

        records = await qs.values(
            "id",
            "route_id",
            "route_code",
            "route_name",
            "status",
            "has_abnormality",
            "patrol_date",
        )

        total_count = len(records)
        completed_count = sum(1 for r in records if r.get("status") == "已完成")
        abnormality_count = sum(1 for r in records if r.get("has_abnormality"))
        completion_rate = round(completed_count / total_count, 4) if total_count else 0.0

        record_ids = [r["id"] for r in records]
        fail_line_count = 0
        if record_ids:
            fail_line_count = await EquipmentRoutePatrolLine.filter(
                tenant_id=tenant_id,
                route_patrol_id__in=record_ids,
                deleted_at__isnull=True,
                is_pass=False,
            ).count()

        route_agg: Dict[int, Dict[str, Any]] = defaultdict(
            lambda: {
                "route_code": "",
                "route_name": "",
                "total_count": 0,
                "completed_count": 0,
                "abnormality_count": 0,
            }
        )
        for r in records:
            rid = int(r["route_id"])
            bucket = route_agg[rid]
            bucket["route_code"] = r.get("route_code") or ""
            bucket["route_name"] = r.get("route_name") or ""
            bucket["total_count"] += 1
            if r.get("status") == "已完成":
                bucket["completed_count"] += 1
            if r.get("has_abnormality"):
                bucket["abnormality_count"] += 1

        data: List[Dict[str, Any]] = []
        for rid, bucket in route_agg.items():
            tc = bucket["total_count"]
            data.append(
                {
                    "route_id": rid,
                    "route_code": bucket["route_code"],
                    "route_name": bucket["route_name"],
                    "total_count": tc,
                    "completed_count": bucket["completed_count"],
                    "abnormality_count": bucket["abnormality_count"],
                    "completion_rate": round(bucket["completed_count"] / tc, 4) if tc else 0.0,
                }
            )
        data.sort(key=lambda x: (-x["total_count"], x.get("route_code") or ""))

        return {
            "data": data,
            "total": len(data),
            "success": True,
            "summary": {
                "total_count": total_count,
                "completed_count": completed_count,
                "abnormality_count": abnormality_count,
                "completion_rate": completion_rate,
                "fail_line_count": fail_line_count,
            },
        }

    async def get_warehouse_report(
        self,
        tenant_id: int,
        report_type: str = "inventory-summary",
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        warehouse_id: Optional[int] = None,
        material_id: Optional[int] = None,
        keyword: Optional[str] = None,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> Dict[str, Any]:
        """仓库报表汇总"""
        from apps.master_data.models.material_batch import MaterialBatch

        lim = max(1, min(int(limit or 100), 500))
        sk = max(0, int(skip or 0))

        if report_type in ["inventory-summary", "inventory_summary"]:
            return await self._get_inventory_summary_v2(tenant_id, warehouse_id)
        elif report_type in ["inventory-ledger", "ledger", "inventory_ledger"]:
            from apps.kuaizhizao.services.report_enhancements import build_inventory_ledger
            return self._wrap_report_payload(await build_inventory_ledger(
                tenant_id,
                date_start=date_start,
                date_end=date_end,
                warehouse_id=warehouse_id,
                material_id=material_id,
                keyword=keyword,
                skip=sk,
                limit=lim,
            ))
        elif report_type in ["inventory-turnover-analysis", "turnover"]:
            raise ValidationError(f"报表已下线: {report_type}")
        elif report_type in ["stocktaking-history", "stocktaking"]:
            # 盘点历史记录
            from apps.kuaizhizao.models.stocktaking import Stocktaking
            items = await Stocktaking.filter(tenant_id=tenant_id).limit(100).values("code", "warehouse_name", "status", "created_at")
            return {"data": items, "success": True}
        elif report_type in ["warehouse-transfer-tracking", "transfer"]:
            # 仓库调拨跟踪
            from apps.kuaizhizao.models.inventory_transfer import InventoryTransfer
            query = InventoryTransfer.filter(tenant_id=tenant_id, deleted_at__isnull=True)
            total = await query.count()
            items = await query.order_by("-created_at").offset(sk).limit(lim).values(
                "code",
                "from_warehouse_name",
                "to_warehouse_name",
                "status",
                "total_quantity",
                "transfer_date",
            )
            for it in items:
                it["order_code"] = it.get("code")
                it["from_warehouse"] = it.get("from_warehouse_name")
                it["to_warehouse"] = it.get("to_warehouse_name")
                it["quantity"] = float(it.get("total_quantity") or 0)
                it.setdefault("material_name", "-")
            return self._wrap_report_payload({"data": items, "success": True, "total": total})
        elif report_type in ["material-batch-tracking", "batch_tracking"]:
            # 物料批次追溯
            items = await MaterialBatch.filter(tenant_id=tenant_id).limit(100).values("batch_no", "material_name", "quantity", "status")
            return {"data": items, "success": True}
        elif report_type in ["slow-moving-analysis", "slow_moving"]:
            payload = await self._get_slow_moving_analysis(
                tenant_id, date_start, date_end, warehouse_id, skip=sk, limit=lim,
            )
            return self._wrap_report_payload(payload)
        return {"data": [], "success": True}

    async def _get_inventory_summary(self, tenant_id: int, warehouse_id: Optional[int] = None) -> Dict[str, Any]:
        """获取库存汇总"""
        from apps.master_data.models.material_batch import MaterialBatch
        # 由于当前没有独立的 InvStock，使用 MaterialBatch 按物料汇总
        batches = await MaterialBatch.filter(tenant_id=tenant_id).prefetch_related("material").all()
        main_wh_cache: Dict[int, Optional[Tuple[int, str]]] = {}
        summary = {}
        for b in batches:
            resolved_wh = await self._resolve_material_default_warehouse_for_report(
                tenant_id=tenant_id,
                material=getattr(b, "material", None),
                cache=main_wh_cache,
            )
            resolved_wh_id = int(resolved_wh[0]) if resolved_wh else None
            if warehouse_id and resolved_wh_id != int(warehouse_id):
                continue
            resolved_wh_name = self._normalize_warehouse_display_name(
                resolved_wh[1] if resolved_wh else None
            )
            m_name = b.material.name if b.material else "未知"
            m_code = b.material.main_code if b.material else "N/A"
            key = (m_code, m_name, resolved_wh_name)
            if key not in summary:
                summary[key] = {
                    "material_code": m_code,
                    "material_name": m_name,
                    "warehouse_name": resolved_wh_name,
                    "opening_qty": 0.0,
                    "inbound_qty": 0.0,
                    "outbound_qty": 0.0,
                    "closing_qty": 0.0,
                    "batch_count": 0
                }
            qty = float(b.quantity or 0)
            summary[key]["closing_qty"] += qty
            summary[key]["batch_count"] += 1
        
        return {"data": list(summary.values()), "success": True}

    @staticmethod
    def _build_inventory_items_summary(items: List[Dict[str, Any]]) -> Dict[str, Any]:
        total_quantity = sum(float(it.get("quantity") or 0) for it in items)
        in_stock_count = sum(1 for it in items if float(it.get("quantity") or 0) > 0)
        zero_stock_count = sum(1 for it in items if float(it.get("quantity") or 0) <= 0)
        expired_count = sum(1 for it in items if it.get("status") == "已过期")
        near_expiry_count = 0
        today = date.today()
        for it in items:
            expiry = it.get("expiry_date")
            if not expiry:
                continue
            try:
                expiry_d = datetime.fromisoformat(str(expiry)).date()
                if today <= expiry_d <= (today + timedelta(days=30)):
                    near_expiry_count += 1
            except Exception:
                continue
        return {
            "total_records": len(items),
            "total_quantity": round(total_quantity, 4),
            "in_stock_count": in_stock_count,
            "zero_stock_count": zero_stock_count,
            "expired_count": expired_count,
            "near_expiry_count": near_expiry_count,
        }

    @staticmethod
    def _group_inventory_items(items: List[Dict[str, Any]], group_by: Optional[str]) -> Optional[List[Dict[str, Any]]]:
        if not group_by:
            return None
        group_by = str(group_by).strip()
        if group_by not in {"warehouse", "material", "status", "aging_bucket"}:
            return None
        grouped: Dict[str, Dict[str, Any]] = {}
        today = date.today()
        for it in items:
            if group_by == "warehouse":
                k = str(it.get("warehouse_name") or "未设置")
            elif group_by == "material":
                k = str(it.get("material_code") or it.get("material_name") or "未设置")
            elif group_by == "status":
                k = str(it.get("status") or "未知")
            else:
                expiry = it.get("expiry_date")
                if not expiry:
                    k = "无有效期"
                else:
                    try:
                        expiry_d = datetime.fromisoformat(str(expiry)).date()
                        diff = (expiry_d - today).days
                        if diff < 0:
                            k = "已过期"
                        elif diff <= 30:
                            k = "0-30天"
                        elif diff <= 90:
                            k = "31-90天"
                        else:
                            k = "90天以上"
                    except Exception:
                        k = "无有效期"
            if k not in grouped:
                grouped[k] = {"group_key": k, "record_count": 0, "total_quantity": 0.0}
            grouped[k]["record_count"] += 1
            grouped[k]["total_quantity"] += float(it.get("quantity") or 0)
        out = list(grouped.values())
        out.sort(key=lambda x: str(x["group_key"]))
        return out

    async def get_performance_report(self, tenant_id: int, report_type: str = "employee-efficiency-ranking", date_start: Optional[datetime] = None, date_end: Optional[datetime] = None) -> Dict[str, Any]:
        """绩效报表汇总"""
        from apps.kuaizhizao.models.reporting_record import ReportingRecord
        from apps.master_data.models.employee_performance import PerformanceSummary
        from decimal import Decimal as D

        normalized = (report_type or "").strip().lower().replace("_", "-")
        alias_map = {
            "efficiency-ranking": "employee-efficiency-ranking",
            "employee-efficiency-ranking": "employee-efficiency-ranking",
            "piece-rate": "piece-rate-salary-summary",
            "piece-rate-salary-summary": "piece-rate-salary-summary",
        }
        normalized = alias_map.get(normalized, normalized)

        if normalized == "employee-efficiency-ranking":
            from apps.master_data.services.performance_calc_service import PerformanceCalcService

            query = ReportingRecord.filter(
                tenant_id=tenant_id,
                status="approved",
                deleted_at__isnull=True,
            )
            if date_start:
                query = query.filter(reported_at__gte=date_start)
            if date_end:
                query = query.filter(reported_at__lte=date_end)
            records = await query.all()
            agg: Dict[int, Dict[str, Any]] = {}
            op_cache: Dict[tuple, Any] = {}
            for r in records:
                wid = r.worker_id
                if wid not in agg:
                    agg[wid] = {
                        "worker_id": wid,
                        "worker_name": r.worker_name or str(wid),
                        "total_pieces": D("0"),
                        "total_hours": D("0"),
                    }
                agg[wid]["total_pieces"] += r.qualified_quantity or D("0")
                agg[wid]["total_hours"] += await PerformanceCalcService._effective_work_hours(
                    tenant_id, r, op_cache=op_cache
                )
            stats = []
            for row in agg.values():
                hours = row["total_hours"]
                pieces = row["total_pieces"]
                pph = float(pieces / hours) if hours > 0 else 0.0
                pieces_f = float(pieces)
                stats.append({
                    "worker_id": row["worker_id"],
                    "worker_name": row["worker_name"],
                    "total_pieces": pieces_f,
                    # 与生产域 worker-efficiency-ranking 的 total_qty 对齐，避免前端列绑错时空白
                    "total_qty": pieces_f,
                    "qualified_quantity": pieces_f,
                    "total_hours": float(hours),
                    "pieces_per_hour": round(pph, 4),
                })
            # 有工时按效率排；工时全为 0 时按合格产量排（避免全部并列 0）
            stats.sort(
                key=lambda x: (x["pieces_per_hour"], x["total_pieces"]),
                reverse=True,
            )
            return {"data": stats, "success": True}

        if normalized == "piece-rate-salary-summary":
            query = PerformanceSummary.filter(tenant_id=tenant_id, deleted_at__isnull=True)
            if date_start:
                period_start = date_start.strftime("%Y-%m")
                query = query.filter(period__gte=period_start)
            if date_end:
                period_end = date_end.strftime("%Y-%m")
                query = query.filter(period__lte=period_end)
            summaries = await query.order_by("-period", "employee_name").all()
            preferred: Dict[tuple, PerformanceSummary] = {}
            status_rank = {"confirmed": 2, "calculated": 1, "draft": 0}
            for s in summaries:
                key = (s.employee_id, s.period)
                existing = preferred.get(key)
                if not existing or status_rank.get(s.status or "", 0) > status_rank.get(existing.status or "", 0):
                    preferred[key] = s
            stats = [
                {
                    "employee_id": s.employee_id,
                    "employee_name": s.employee_name,
                    "period": s.period,
                    "total_hours": float(s.total_hours or 0),
                    "total_pieces": float(s.total_pieces or 0),
                    "time_amount": float(s.time_amount or 0),
                    "piece_amount": float(s.piece_amount or 0),
                    "kpi_coefficient": float(s.kpi_coefficient or 1),
                    "total_amount": float(s.total_amount or 0),
                    "status": s.status,
                }
                for s in preferred.values()
            ]
            stats.sort(key=lambda x: x["total_amount"], reverse=True)
            return {"data": stats, "success": True}

        return {"data": [], "success": True}

    async def export_domain_report(
        self,
        tenant_id: int,
        domain: str,
        report_type: str,
        *,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        warehouse_id: Optional[int] = None,
        customer_id: Optional[int] = None,
        customer_keyword: Optional[str] = None,
        material_id: Optional[int] = None,
        limit: int = 10000,
        current_user: Optional[Any] = None,
    ) -> str:
        """导出指定域报表为 CSV 文件，返回临时文件路径"""
        import csv
        import os
        import tempfile

        domain_key = (domain or "").strip().lower()
        if domain_key == "plan":
            domain_key = "plans"
        payload: Dict[str, Any]
        if domain_key == "sales":
            payload = await self.get_sales_report(
                tenant_id=tenant_id,
                report_type=report_type,
                date_start=date_start,
                date_end=date_end,
                customer_id=customer_id,
                customer_keyword=customer_keyword,
                skip=0,
                limit=limit,
                current_user=current_user,
            )
        elif domain_key == "inventory":
            payload = await self.get_inventory_report(
                tenant_id=tenant_id,
                report_type=report_type,
                date_start=date_start,
                date_end=date_end,
                warehouse_id=warehouse_id,
            )
        elif domain_key == "warehouse":
            payload = await self.get_warehouse_report(
                tenant_id=tenant_id,
                report_type=report_type,
                date_start=date_start,
                date_end=date_end,
                warehouse_id=warehouse_id,
                material_id=material_id,
            )
        elif domain_key == "quality":
            payload = await self.get_quality_report(
                tenant_id=tenant_id,
                report_type=report_type,
                date_start=date_start,
                date_end=date_end,
                material_id=material_id,
            )
        elif domain_key == "production":
            payload = await self.get_production_report(
                tenant_id=tenant_id,
                report_type=report_type,
                date_start=date_start,
                date_end=date_end,
            )
        elif domain_key == "purchases":
            payload = await self.get_purchase_report(
                tenant_id=tenant_id,
                report_type=report_type,
                date_start=date_start,
                date_end=date_end,
                current_user=current_user,
            )
        elif domain_key == "equipment":
            payload = await self.get_equipment_report(
                tenant_id=tenant_id,
                report_type=report_type,
                date_start=date_start,
                date_end=date_end,
            )
        elif domain_key == "performance":
            payload = await self.get_performance_report(
                tenant_id=tenant_id,
                report_type=report_type,
                date_start=date_start,
                date_end=date_end,
            )
        elif domain_key == "plans":
            payload = await self.get_plan_report(
                tenant_id=tenant_id,
                report_type=report_type,
                date_start=date_start,
                date_end=date_end,
                current_user=current_user,
            )
        else:
            raise ValidationError(f"不支持的报表域: {domain}")

        rows = payload.get("data") or []
        if not rows:
            raise ValidationError("没有可导出的数据")

        export_dir = os.path.join(tempfile.gettempdir(), "riveredge_exports")
        os.makedirs(export_dir, exist_ok=True)
        timestamp = resolve_business_datetime().strftime("%Y%m%d_%H%M%S")
        filename = f"{domain_key}_{report_type}_{timestamp}.csv"
        file_path = os.path.join(export_dir, filename)

        headers = list(rows[0].keys()) if isinstance(rows[0], dict) else []
        with open(file_path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=headers, extrasaction="ignore")
            writer.writeheader()
            for row in rows:
                if isinstance(row, dict):
                    writer.writerow(row)

        return file_path
