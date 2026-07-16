"""排产绩效单价覆盖检查。"""

from __future__ import annotations

from datetime import date
from typing import Any, Dict, List

from apps.master_data.models.employee_performance import EmployeePerformanceConfig
from apps.master_data.services.employee_performance_service import HourlyRateService, PieceRateService
from infra.models.user import User


async def check_scheduling_rate_coverage(
    tenant_id: int,
    items: List[Dict[str, Any]],
) -> Dict[str, Any]:
    as_of = date.today()
    results: List[Dict[str, Any]] = []
    for raw in items[:100]:
        worker_id = int(raw.get("worker_id") or 0)
        operation_id = int(raw.get("operation_id") or 0)
        material_id = raw.get("material_id")
        material_id_int = int(material_id) if material_id else None
        if worker_id <= 0 or operation_id <= 0:
            continue

        config = await EmployeePerformanceConfig.filter(
            tenant_id=tenant_id,
            employee_id=worker_id,
            is_active=True,
            deleted_at__isnull=True,
        ).first()
        calc_mode = (config.calc_mode if config else "time") or "time"
        missing: List[str] = []

        if calc_mode in ("time", "mixed"):
            hourly_ok = bool(config and config.hourly_rate is not None)
            if not hourly_ok:
                user = await User.filter(id=worker_id, tenant_id=tenant_id).first()
                rate = await HourlyRateService.get_rate_for_employee(
                    tenant_id,
                    worker_id,
                    department_id=user.department_id if user else None,
                    position_id=user.position_id if user else None,
                    as_of_date=as_of,
                )
                hourly_ok = rate is not None
            if not hourly_ok:
                missing.append("hourly_rate")

        if calc_mode in ("piece", "mixed"):
            piece_rate = await PieceRateService.get_rate_for_operation(
                tenant_id,
                operation_id,
                material_id=material_id_int,
                as_of_date=as_of,
            )
            if piece_rate is None and config and config.default_piece_rate is not None:
                piece_rate = config.default_piece_rate
            if piece_rate is None:
                missing.append("piece_rate")

        results.append(
            {
                "worker_id": worker_id,
                "operation_id": operation_id,
                "material_id": material_id_int,
                "missing": missing,
                "calc_mode": calc_mode,
            }
        )
    return {"items": results}
