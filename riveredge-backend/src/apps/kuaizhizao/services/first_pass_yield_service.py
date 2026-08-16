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


def _empty_qty_bucket() -> Dict[str, Decimal]:
    return {
        "count": Decimal("0"),
        "reported_quantity": Decimal("0"),
        "qualified_quantity": Decimal("0"),
        "unqualified_quantity": Decimal("0"),
        "first_pass_reported_quantity": Decimal("0"),
        "first_pass_qualified_quantity": Decimal("0"),
        "first_pass_unqualified_quantity": Decimal("0"),
    }


def _add_record_quantities(bucket: Dict[str, Decimal], record: ReportingRecord) -> None:
    reported = record.reported_quantity or Decimal("0")
    qualified = record.qualified_quantity or Decimal("0")
    unqualified = record.unqualified_quantity or Decimal("0")
    bucket["count"] += Decimal("1")
    bucket["reported_quantity"] += reported
    bucket["qualified_quantity"] += qualified
    bucket["unqualified_quantity"] += unqualified
    if record.rework_order_id is None:
        bucket["first_pass_reported_quantity"] += reported
        bucket["first_pass_qualified_quantity"] += qualified
        bucket["first_pass_unqualified_quantity"] += unqualified


def _qty_fields(bucket: Dict[str, Decimal]) -> Dict[str, Any]:
    reported = float(bucket["reported_quantity"])
    qualified = float(bucket["qualified_quantity"])
    unqualified = float(bucket["unqualified_quantity"])
    fp_reported = float(bucket["first_pass_reported_quantity"])
    fp_qualified = float(bucket["first_pass_qualified_quantity"])
    fp_unqualified = float(bucket["first_pass_unqualified_quantity"])
    return {
        "count": int(bucket["count"]),
        "reported_quantity": reported,
        "qualified_quantity": qualified,
        "unqualified_quantity": unqualified,
        "qualification_rate": compute_first_pass_yield_rate(qualified, reported),
        "first_pass_reported_quantity": fp_reported,
        "first_pass_qualified_quantity": fp_qualified,
        "first_pass_unqualified_quantity": fp_unqualified,
        "first_pass_yield_rate": compute_first_pass_yield_rate(fp_qualified, fp_reported),
    }


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
        stats: Dict[str, Dict[str, Decimal]] = defaultdict(_empty_qty_bucket)
        for record in records:
            key = record.operation_name or record.operation_code or "-"
            _add_record_quantities(stats[key], record)

        rows: List[Dict[str, Any]] = []
        for operation_name, bucket in stats.items():
            rows.append({"operation_name": operation_name, **_qty_fields(bucket)})
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
        """工单直通率：按报工汇总报工/合格/不合格，直通率=首次合格/首次报工。"""
        records = await self._load_records(
            tenant_id,
            date_start=date_start,
            date_end=date_end,
            approved_only=False,
        )
        stats: Dict[int, Dict[str, Decimal]] = defaultdict(_empty_qty_bucket)
        for record in records:
            if not record.work_order_id:
                continue
            _add_record_quantities(stats[int(record.work_order_id)], record)
        if not stats:
            return [], 0

        wo_ids = list(stats.keys())
        work_orders = await WorkOrder.filter(
            tenant_id=tenant_id,
            id__in=wo_ids,
            deleted_at__isnull=True,
        ).values("id", "code", "product_name")
        wo_map = {int(row["id"]): row for row in work_orders}
        rework_set = set(
            await ReworkOrder.filter(
                tenant_id=tenant_id,
                original_work_order_id__in=wo_ids,
                deleted_at__isnull=True,
            ).values_list("original_work_order_id", flat=True)
        )

        rows: List[Dict[str, Any]] = []
        for wo_id, bucket in stats.items():
            wo = wo_map.get(wo_id, {})
            qty = _qty_fields(bucket)
            rows.append(
                {
                    "id": wo_id,
                    "work_order_code": wo.get("code") or "",
                    "product_name": wo.get("product_name") or "",
                    "has_rework": wo_id in rework_set,
                    "work_order_first_pass_yield_rate": qty["first_pass_yield_rate"],
                    **qty,
                }
            )
        rows.sort(key=lambda item: item["work_order_first_pass_yield_rate"])
        total = len(rows)
        return rows[skip : skip + limit], total

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
            bucket = product_op_stats[product_code].setdefault(seq, _empty_qty_bucket())
            _add_record_quantities(bucket, record)

        rows: List[Dict[str, Any]] = []
        for product_code, op_map in product_op_stats.items():
            meta = product_meta.get(product_code, {})
            operation_rates: List[float] = []
            operation_count = 0
            product_bucket = _empty_qty_bucket()
            for seq in sorted(op_map.keys()):
                bucket = op_map[seq]
                for field, value in bucket.items():
                    product_bucket[field] += value
                qty = _qty_fields(bucket)
                if qty["first_pass_reported_quantity"] > 0:
                    operation_rates.append(qty["first_pass_yield_rate"] / 100)
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
                    **_qty_fields(product_bucket),
                }
            )

        rows.sort(key=lambda item: item["roll_through_yield_rate"])
        total = len(rows)
        return rows[skip : skip + limit], total
