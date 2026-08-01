"""
工序直通率（First Pass Yield）计算服务。

口径：首次报工（rework_order_id 为空）的合格数量 / 首次报工数量；
返工报工整段排除，与合格率（含返工后再合格）分离。
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional, Sequence, Tuple

from apps.kuaizhizao.models.reporting_record import ReportingRecord
from apps.kuaizhizao.models.rework_order import ReworkOrder
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
from core.utils.timezone_utils import resolve_business_datetime, to_site_date


def _to_float(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    return float(value)


def compute_first_pass_yield_rate(qualified: float, reported: float) -> float:
    """计算直通率（%），保留 2 位小数。"""
    if reported <= 0:
        return 0.0
    return round(qualified / reported * 100, 2)


def _aggregate_quantities(
    records: Sequence[ReportingRecord],
    *,
    first_pass_only: bool,
) -> Tuple[float, float]:
    qualified = Decimal("0")
    reported = Decimal("0")
    for record in records:
        if first_pass_only and record.rework_order_id is not None:
            continue
        qualified += record.qualified_quantity or Decimal("0")
        reported += record.reported_quantity or Decimal("0")
    return float(qualified), float(reported)


class FirstPassYieldService:
    """工序直通率统一计算入口。"""

    async def _load_records(
        self,
        tenant_id: int,
        *,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        worker_id: Optional[int] = None,
        approved_only: bool = False,
    ) -> List[ReportingRecord]:
        query = ReportingRecord.filter(tenant_id=tenant_id)
        if date_start:
            query = query.filter(reported_at__gte=date_start)
        if date_end:
            query = query.filter(reported_at__lte=date_end)
        if worker_id is not None:
            query = query.filter(worker_id=worker_id)
        if approved_only:
            query = query.filter(status="approved")
        return await query.all()

    async def get_summary(
        self,
        tenant_id: int,
        *,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        worker_id: Optional[int] = None,
        approved_only: bool = False,
    ) -> Dict[str, float]:
        records = await self._load_records(
            tenant_id,
            date_start=date_start,
            date_end=date_end,
            worker_id=worker_id,
            approved_only=approved_only,
        )
        fp_qualified, fp_reported = _aggregate_quantities(records, first_pass_only=True)
        all_qualified, all_reported = _aggregate_quantities(records, first_pass_only=False)
        return {
            "first_pass_qualified_quantity": fp_qualified,
            "first_pass_reported_quantity": fp_reported,
            "first_pass_yield_rate": compute_first_pass_yield_rate(fp_qualified, fp_reported),
            "qualification_rate": compute_first_pass_yield_rate(all_qualified, all_reported),
        }

    async def get_operation_breakdown(
        self,
        tenant_id: int,
        *,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        approved_only: bool = False,
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        records = await self._load_records(
            tenant_id,
            date_start=date_start,
            date_end=date_end,
            approved_only=approved_only,
        )
        stats: Dict[str, Dict[str, Decimal]] = defaultdict(
            lambda: {
                "count": Decimal("0"),
                "reported_quantity": Decimal("0"),
                "qualified_quantity": Decimal("0"),
                "first_pass_reported_quantity": Decimal("0"),
                "first_pass_qualified_quantity": Decimal("0"),
            }
        )
        for record in records:
            key = record.operation_name or record.operation_code or "-"
            bucket = stats[key]
            bucket["count"] += Decimal("1")
            bucket["reported_quantity"] += record.reported_quantity or Decimal("0")
            bucket["qualified_quantity"] += record.qualified_quantity or Decimal("0")
            if record.rework_order_id is None:
                bucket["first_pass_reported_quantity"] += record.reported_quantity or Decimal("0")
                bucket["first_pass_qualified_quantity"] += record.qualified_quantity or Decimal("0")

        rows: List[Dict[str, Any]] = []
        for operation_name, bucket in stats.items():
            reported = float(bucket["reported_quantity"])
            qualified = float(bucket["qualified_quantity"])
            fp_reported = float(bucket["first_pass_reported_quantity"])
            fp_qualified = float(bucket["first_pass_qualified_quantity"])
            rows.append(
                {
                    "operation_name": operation_name,
                    "count": int(bucket["count"]),
                    "reported_quantity": reported,
                    "qualified_quantity": qualified,
                    "qualification_rate": compute_first_pass_yield_rate(qualified, reported),
                    "first_pass_reported_quantity": fp_reported,
                    "first_pass_qualified_quantity": fp_qualified,
                    "first_pass_yield_rate": compute_first_pass_yield_rate(fp_qualified, fp_reported),
                }
            )
        rows.sort(key=lambda item: item["count"], reverse=True)
        return rows[: max(1, limit)]

    async def get_worker_breakdown(
        self,
        tenant_id: int,
        *,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        approved_only: bool = False,
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        records = await self._load_records(
            tenant_id,
            date_start=date_start,
            date_end=date_end,
            approved_only=approved_only,
        )
        stats: Dict[str, Dict[str, Decimal]] = defaultdict(
            lambda: {
                "count": Decimal("0"),
                "reported_quantity": Decimal("0"),
                "qualified_quantity": Decimal("0"),
                "first_pass_reported_quantity": Decimal("0"),
                "first_pass_qualified_quantity": Decimal("0"),
            }
        )
        for record in records:
            key = record.worker_name or "-"
            bucket = stats[key]
            bucket["count"] += Decimal("1")
            bucket["reported_quantity"] += record.reported_quantity or Decimal("0")
            bucket["qualified_quantity"] += record.qualified_quantity or Decimal("0")
            if record.rework_order_id is None:
                bucket["first_pass_reported_quantity"] += record.reported_quantity or Decimal("0")
                bucket["first_pass_qualified_quantity"] += record.qualified_quantity or Decimal("0")

        rows: List[Dict[str, Any]] = []
        for worker_name, bucket in stats.items():
            reported = float(bucket["reported_quantity"])
            qualified = float(bucket["qualified_quantity"])
            fp_reported = float(bucket["first_pass_reported_quantity"])
            fp_qualified = float(bucket["first_pass_qualified_quantity"])
            rows.append(
                {
                    "worker_name": worker_name,
                    "count": int(bucket["count"]),
                    "reported_quantity": reported,
                    "qualified_quantity": qualified,
                    "qualification_rate": compute_first_pass_yield_rate(qualified, reported),
                    "first_pass_reported_quantity": fp_reported,
                    "first_pass_qualified_quantity": fp_qualified,
                    "first_pass_yield_rate": compute_first_pass_yield_rate(fp_qualified, fp_reported),
                }
            )
        rows.sort(key=lambda item: item["count"], reverse=True)
        return rows[: max(1, limit)]

    async def get_daily_trend(
        self,
        tenant_id: int,
        *,
        days: int = 7,
        end_at: Optional[datetime] = None,
        approved_only: bool = False,
    ) -> List[Dict[str, Any]]:
        end = end_at or resolve_business_datetime()
        end_day = to_site_date(end)
        start_day = end_day - timedelta(days=max(1, days) - 1)
        start_dt = datetime.combine(start_day, datetime.min.time())
        end_dt = datetime.combine(end_day, datetime.max.time())

        records = await self._load_records(
            tenant_id,
            date_start=start_dt,
            date_end=end_dt,
            approved_only=approved_only,
        )
        by_date: Dict[str, Dict[str, Decimal]] = defaultdict(
            lambda: {
                "reported_quantity": Decimal("0"),
                "qualified_quantity": Decimal("0"),
                "first_pass_reported_quantity": Decimal("0"),
                "first_pass_qualified_quantity": Decimal("0"),
            }
        )
        for record in records:
            if not record.reported_at:
                continue
            date_key = to_site_date(record.reported_at).strftime("%Y-%m-%d")
            bucket = by_date[date_key]
            bucket["reported_quantity"] += record.reported_quantity or Decimal("0")
            bucket["qualified_quantity"] += record.qualified_quantity or Decimal("0")
            if record.rework_order_id is None:
                bucket["first_pass_reported_quantity"] += record.reported_quantity or Decimal("0")
                bucket["first_pass_qualified_quantity"] += record.qualified_quantity or Decimal("0")

        trend: List[Dict[str, Any]] = []
        cursor = start_day
        while cursor <= end_day:
            date_key = cursor.strftime("%Y-%m-%d")
            bucket = by_date.get(date_key, {})
            reported = float(bucket.get("reported_quantity", 0) or 0)
            qualified = float(bucket.get("qualified_quantity", 0) or 0)
            fp_reported = float(bucket.get("first_pass_reported_quantity", 0) or 0)
            fp_qualified = float(bucket.get("first_pass_qualified_quantity", 0) or 0)
            trend.append(
                {
                    "date": date_key,
                    "qualification_rate": compute_first_pass_yield_rate(qualified, reported),
                    "first_pass_yield_rate": compute_first_pass_yield_rate(fp_qualified, fp_reported),
                }
            )
            cursor += timedelta(days=1)
        return trend

    async def get_work_order_first_pass_yield(
        self,
        tenant_id: int,
        *,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[Dict[str, Any]], int]:
        """工单直通率：完工工单中未产生返工单的占比（按数量加权）。"""
        wo_query = WorkOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="completed")
        if date_start:
            wo_query = wo_query.filter(actual_end_date__gte=date_start)
        if date_end:
            wo_query = wo_query.filter(actual_end_date__lte=date_end)
        total = await wo_query.count()
        work_orders = await wo_query.order_by("-actual_end_date").offset(skip).limit(limit).values(
            "id",
            "code",
            "product_name",
            "quantity",
            "completed_quantity",
            "actual_end_date",
        )
        if not work_orders:
            return [], total

        wo_ids = [row["id"] for row in work_orders]
        rework_rows = await ReworkOrder.filter(
            tenant_id=tenant_id,
            work_order_id__in=wo_ids,
            deleted_at__isnull=True,
        ).values_list("work_order_id", flat=True)
        rework_set = set(rework_rows)

        rows: List[Dict[str, Any]] = []
        for row in work_orders:
            qty = float(row.get("completed_quantity") or row.get("quantity") or 0)
            has_rework = row["id"] in rework_set
            rows.append(
                {
                    "work_order_code": row.get("code"),
                    "product_name": row.get("product_name"),
                    "completed_quantity": qty,
                    "has_rework": has_rework,
                    "work_order_first_pass_yield_rate": 100.0 if not has_rework and qty > 0 else 0.0,
                    "actual_end_date": row.get("actual_end_date"),
                }
            )
        return rows, total

    async def get_product_rty(
        self,
        tenant_id: int,
        *,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[Dict[str, Any]], int]:
        """产线综合直通率 RTY：按产品汇总各工序直通率连乘。"""
        records = await self._load_records(
            tenant_id,
            date_start=date_start,
            date_end=date_end,
            approved_only=False,
        )
        if not records:
            return [], 0

        wo_ids = {record.work_order_id for record in records if record.work_order_id}
        work_orders = await WorkOrder.filter(
            tenant_id=tenant_id,
            id__in=list(wo_ids),
            deleted_at__isnull=True,
        ).values("id", "product_code", "product_name")
        product_by_wo = {
            row["id"]: {
                "product_code": row.get("product_code") or "-",
                "product_name": row.get("product_name") or "-",
            }
            for row in work_orders
        }

        op_rows = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id__in=list(wo_ids),
        ).values("work_order_id", "operation_id", "operation_name", "sequence")
        sequence_by_wo_op: Dict[Tuple[int, int], int] = {}
        for row in op_rows:
            sequence_by_wo_op[(row["work_order_id"], row["operation_id"])] = int(row.get("sequence") or 0)

        product_op_stats: Dict[str, Dict[int, Dict[str, Any]]] = defaultdict(dict)
        product_meta: Dict[str, Dict[str, str]] = {}

        for record in records:
            if record.rework_order_id is not None:
                continue
            product = product_by_wo.get(record.work_order_id, {})
            product_code = product.get("product_code") or "-"
            product_meta[product_code] = {
                "product_code": product_code,
                "product_name": product.get("product_name") or "-",
            }
            seq = sequence_by_wo_op.get((record.work_order_id, record.operation_id), record.operation_id)
            bucket = product_op_stats[product_code].setdefault(
                seq,
                {
                    "operation_name": record.operation_name or record.operation_code or "-",
                    "first_pass_reported_quantity": Decimal("0"),
                    "first_pass_qualified_quantity": Decimal("0"),
                },
            )
            bucket["first_pass_reported_quantity"] += record.reported_quantity or Decimal("0")
            bucket["first_pass_qualified_quantity"] += record.qualified_quantity or Decimal("0")

        rows: List[Dict[str, Any]] = []
        for product_code, op_map in product_op_stats.items():
            meta = product_meta.get(product_code, {})
            operation_rates: List[float] = []
            operation_count = 0
            for seq in sorted(op_map.keys()):
                bucket = op_map[seq]
                reported = float(bucket["first_pass_reported_quantity"])
                qualified = float(bucket["first_pass_qualified_quantity"])
                rate = compute_first_pass_yield_rate(qualified, reported)
                if reported > 0:
                    operation_rates.append(rate / 100)
                    operation_count += 1
            rty = 100.0
            for rate in operation_rates:
                rty = round(rty * rate, 4)
            if not operation_rates:
                rty = 0.0
            rows.append(
                {
                    "product_code": meta.get("product_code") or product_code,
                    "product_name": meta.get("product_name") or "-",
                    "operation_count": operation_count,
                    "roll_through_yield_rate": round(rty, 2),
                }
            )

        rows.sort(key=lambda item: item["roll_through_yield_rate"])
        total = len(rows)
        return rows[skip : skip + limit], total
