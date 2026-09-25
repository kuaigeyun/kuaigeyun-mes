"""
实现产能（产量）口径：统一看板/报工统计/行业达成看板的合格分子。

- all_operations: 全部工序已审核报工合格（历史默认）
- last_operation_qualified: 仅末道工序报工合格
- last_operation_effective_qualified: 仅末道有效合格（过程检放行后；无方案检等同报工合格）
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional, Set, Tuple

from apps.kuaizhizao.models.reporting_record import ReportingRecord
from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
from apps.kuaizhizao.services.operation_transfer_service import (
    resolve_operation_transfer_qualified,
)
from infra.services.business_config_service import BusinessConfigService

OUTPUT_BASIS_ALL = "all_operations"
OUTPUT_BASIS_LAST_QUALIFIED = "last_operation_qualified"
OUTPUT_BASIS_LAST_EFFECTIVE = "last_operation_effective_qualified"
OUTPUT_BASIS_VALUES = frozenset(
    {
        OUTPUT_BASIS_ALL,
        OUTPUT_BASIS_LAST_QUALIFIED,
        OUTPUT_BASIS_LAST_EFFECTIVE,
    }
)


class OutputBasisService:
    @staticmethod
    async def get_output_basis(tenant_id: int) -> str:
        config = await BusinessConfigService().get_business_config(tenant_id)
        raw = (
            (config.get("parameters") or {})
            .get("production", {})
            .get("output_basis", OUTPUT_BASIS_ALL)
        )
        v = str(raw or OUTPUT_BASIS_ALL).strip()
        return v if v in OUTPUT_BASIS_VALUES else OUTPUT_BASIS_ALL

    @classmethod
    async def sum_output_quantities(
        cls,
        tenant_id: int,
        *,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        worker_id: Optional[int] = None,
        basis: Optional[str] = None,
        production_line_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """按产量口径汇总报工数量。返回 reported/qualified/unqualified 与 basis。"""
        resolved = basis or await cls.get_output_basis(tenant_id)
        if resolved not in OUTPUT_BASIS_VALUES:
            resolved = OUTPUT_BASIS_ALL

        query = ReportingRecord.filter(
            tenant_id=tenant_id,
            status="approved",
            deleted_at__isnull=True,
        )
        if date_start:
            query = query.filter(reported_at__gte=date_start)
        if date_end:
            query = query.filter(reported_at__lte=date_end)
        if worker_id is not None:
            query = query.filter(worker_id=worker_id)

        rows: List[Dict[str, Any]] = await query.values(
            "id",
            "work_order_id",
            "operation_id",
            "reported_quantity",
            "qualified_quantity",
            "unqualified_quantity",
            "rework_order_id",
        )

        if not rows:
            return {
                "output_basis": resolved,
                "reported_quantity": Decimal("0"),
                "qualified_quantity": Decimal("0"),
                "unqualified_quantity": Decimal("0"),
            }

        if resolved == OUTPUT_BASIS_ALL and production_line_id is None:
            reported = sum((Decimal(str(r["reported_quantity"] or 0)) for r in rows), Decimal("0"))
            qualified = sum((Decimal(str(r["qualified_quantity"] or 0)) for r in rows), Decimal("0"))
            unqualified = sum(
                (Decimal(str(r["unqualified_quantity"] or 0)) for r in rows), Decimal("0")
            )
            return {
                "output_basis": resolved,
                "reported_quantity": reported,
                "qualified_quantity": qualified,
                "unqualified_quantity": unqualified,
            }

        wo_ids: Set[int] = {int(r["work_order_id"]) for r in rows if r.get("work_order_id")}
        last_ops = await cls._load_last_operations(tenant_id, wo_ids)
        if production_line_id is not None:
            last_ops = await cls._filter_last_ops_by_line(
                tenant_id, last_ops, int(production_line_id)
            )
            allowed_wo = set(last_ops.keys())
            rows = [r for r in rows if int(r["work_order_id"] or 0) in allowed_wo]

        last_master_by_wo = {
            wo_id: int(op.operation_id or 0)
            for wo_id, op in last_ops.items()
            if op.operation_id
        }
        last_rows = [
            r
            for r in rows
            if int(r.get("operation_id") or 0)
            == last_master_by_wo.get(int(r.get("work_order_id") or 0), -1)
        ]

        if resolved == OUTPUT_BASIS_ALL:
            reported = sum(
                (Decimal(str(r["reported_quantity"] or 0)) for r in last_rows), Decimal("0")
            )
            qualified = sum(
                (Decimal(str(r["qualified_quantity"] or 0)) for r in last_rows), Decimal("0")
            )
            unqualified = sum(
                (Decimal(str(r["unqualified_quantity"] or 0)) for r in last_rows), Decimal("0")
            )
            return {
                "output_basis": resolved,
                "reported_quantity": reported,
                "qualified_quantity": qualified,
                "unqualified_quantity": unqualified,
            }

        reported = sum(
            (Decimal(str(r["reported_quantity"] or 0)) for r in last_rows), Decimal("0")
        )
        unqualified = sum(
            (Decimal(str(r["unqualified_quantity"] or 0)) for r in last_rows), Decimal("0")
        )
        window_qualified_by_wo: Dict[int, Decimal] = defaultdict(lambda: Decimal("0"))
        for r in last_rows:
            wo_id = int(r["work_order_id"] or 0)
            window_qualified_by_wo[wo_id] += Decimal(str(r["qualified_quantity"] or 0))

        if resolved == OUTPUT_BASIS_LAST_QUALIFIED:
            qualified = sum(window_qualified_by_wo.values(), Decimal("0"))
            return {
                "output_basis": resolved,
                "reported_quantity": reported,
                "qualified_quantity": qualified,
                "unqualified_quantity": unqualified,
            }

        # last_operation_effective_qualified
        qualified = Decimal("0")
        for wo_id, window_q in window_qualified_by_wo.items():
            op = last_ops.get(wo_id)
            if not op:
                continue
            lifetime_q = Decimal(str(op.qualified_quantity or 0))
            transfer = await resolve_operation_transfer_qualified(tenant_id, wo_id, op)
            if lifetime_q <= 0:
                continue
            ratio = transfer / lifetime_q
            if ratio > 1:
                ratio = Decimal("1")
            if ratio < 0:
                ratio = Decimal("0")
            qualified += window_q * ratio

        return {
            "output_basis": resolved,
            "reported_quantity": reported,
            "qualified_quantity": qualified,
            "unqualified_quantity": unqualified,
        }

    @staticmethod
    async def _load_last_operations(
        tenant_id: int, work_order_ids: Set[int]
    ) -> Dict[int, WorkOrderOperation]:
        if not work_order_ids:
            return {}
        ops = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id__in=list(work_order_ids),
            deleted_at__isnull=True,
        ).all()
        best: Dict[int, WorkOrderOperation] = {}
        for op in ops:
            wo_id = int(op.work_order_id or 0)
            prev = best.get(wo_id)
            if prev is None or int(op.sequence or 0) > int(prev.sequence or 0):
                best[wo_id] = op
        return best

    @staticmethod
    async def _filter_last_ops_by_line(
        tenant_id: int,
        last_ops: Dict[int, WorkOrderOperation],
        production_line_id: int,
    ) -> Dict[int, WorkOrderOperation]:
        """按末道工序指派工位所属产线过滤。"""
        from apps.master_data.models.factory import Workstation

        station_ids = {
            int(op.assigned_station_id)
            for op in last_ops.values()
            if op.assigned_station_id
        }
        if not station_ids:
            return {}
        stations = await Workstation.filter(
            tenant_id=tenant_id,
            id__in=list(station_ids),
            deleted_at__isnull=True,
        ).values("id", "production_line_id")
        line_by_station = {
            int(r["id"]): int(r["production_line_id"] or 0) for r in stations
        }
        return {
            wo_id: op
            for wo_id, op in last_ops.items()
            if line_by_station.get(int(op.assigned_station_id or 0), 0) == production_line_id
        }
