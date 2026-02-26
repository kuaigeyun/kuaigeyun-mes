"""
绩效计算服务模块

从报工记录汇总并按规则计算计时/计件金额，支持 KPI 计算。
"""

from datetime import datetime, date
from decimal import Decimal
from typing import List, Optional, Dict, Any

from apps.kuaizhizao.models.reporting_record import ReportingRecord
from apps.master_data.models.employee_performance import (
    EmployeePerformanceConfig,
    PerformanceSummary,
    EmployeeKPIScore,
    KPIDefinition,
)
from apps.master_data.schemas.employee_performance_schemas import (
    PerformanceSummaryResponse,
    PerformanceDetailItem,
    PerformanceDetailResponse,
)
from apps.master_data.services.employee_performance_service import (
    EmployeePerformanceConfigService,
    PieceRateService,
    HourlyRateService,
)
class PerformanceCalcService:
    """绩效计算服务"""

    @staticmethod
    def _period_from_date(d: date) -> str:
        """日期转周期 YYYY-MM"""
        return d.strftime("%Y-%m")

    @staticmethod
    async def aggregate_reporting_by_employee(
        tenant_id: int,
        period: str,
        status_filter: Optional[str] = "approved",
    ) -> Dict[int, Dict[str, Any]]:
        """
        按员工汇总报工记录（仅 approved 或全部）
        Returns: { worker_id: { total_hours, total_pieces, total_unqualified, records, worker_name } }
        """
        year, month = map(int, period.split("-"))
        start_dt = datetime(year, month, 1)
        if month == 12:
            end_dt = datetime(year + 1, 1, 1)
        else:
            end_dt = datetime(year, month + 1, 1)

        query = ReportingRecord.filter(
            tenant_id=tenant_id,
            reported_at__gte=start_dt,
            reported_at__lt=end_dt,
            deleted_at__isnull=True,
        )
        if status_filter:
            query = query.filter(status=status_filter)

        records = await query.all()
        result: Dict[int, Dict[str, Any]] = {}
        for r in records:
            wid = r.worker_id
            if wid not in result:
                result[wid] = {
                    "worker_id": wid,
                    "worker_name": r.worker_name,
                    "total_hours": Decimal("0"),
                    "total_pieces": Decimal("0"),
                    "total_unqualified": Decimal("0"),
                    "records": [],
                }
            result[wid]["total_hours"] += r.work_hours or Decimal("0")
            result[wid]["total_pieces"] += r.qualified_quantity or Decimal("0")
            result[wid]["total_unqualified"] += r.unqualified_quantity or Decimal("0")
            result[wid]["records"].append(r)
        return result

    @staticmethod
    async def calculate_employee_performance(
        tenant_id: int,
        employee_id: int,
        employee_name: str,
        period: str,
        total_hours: Decimal,
        total_pieces: Decimal,
        total_unqualified: Decimal,
        records: List[ReportingRecord],
    ) -> PerformanceSummary:
        """
        计算单个员工的绩效金额（计时+计件），考虑月保障工资。
        """
        config = await EmployeePerformanceConfigService.get_by_employee(tenant_id, employee_id)
        calc_mode = config.calc_mode if config else "time"
        hourly_rate = config.hourly_rate if config else None
        default_piece_rate = config.default_piece_rate if config else None
        base_salary = config.base_salary if config else None

        if hourly_rate is None:
            from infra.models.user import User
            user = await User.filter(id=employee_id, tenant_id=tenant_id).first()
            dept_id = user.department_id if user else None
            pos_id = user.position_id if user else None
            hourly_rate = await HourlyRateService.get_rate_for_employee(
                tenant_id, employee_id, department_id=dept_id, position_id=pos_id
            )
        if hourly_rate is None:
            hourly_rate = Decimal("50")  # 默认工时单价

        time_amount = total_hours * hourly_rate
        piece_amount = Decimal("0")

        if calc_mode in ("piece", "mixed") and records:
            for r in records:
                op_id = r.operation_id
                rate = await PieceRateService.get_rate_for_operation(tenant_id, op_id, material_id=None)
                if rate is None:
                    rate = default_piece_rate or Decimal("0")
                piece_amount += (r.qualified_quantity or Decimal("0")) * rate

        total_amount = time_amount + piece_amount
        if base_salary is not None and calc_mode in ("piece", "mixed"):
            total_amount = max(total_amount, base_salary)
        elif base_salary is not None and calc_mode == "time":
            total_amount = max(total_amount, base_salary)

        summary, _ = await PerformanceSummary.update_or_create(
            tenant_id=tenant_id,
            employee_id=employee_id,
            period=period,
            defaults={
                "employee_name": employee_name,
                "total_hours": total_hours,
                "total_pieces": total_pieces,
                "total_unqualified": total_unqualified,
                "time_amount": time_amount,
                "piece_amount": piece_amount,
                "total_amount": total_amount,
                "status": "calculated",
            },
        )
        return summary

    @staticmethod
    async def calculate_period(tenant_id: int, period: str) -> List[PerformanceSummaryResponse]:
        """
        计算指定周期的所有员工绩效。
        """
        agg = await PerformanceCalcService.aggregate_reporting_by_employee(
            tenant_id, period, status_filter="approved"
        )
        results = []
        for worker_id, data in agg.items():
            summary = await PerformanceCalcService.calculate_employee_performance(
                tenant_id=tenant_id,
                employee_id=worker_id,
                employee_name=data["worker_name"] or "",
                period=period,
                total_hours=data["total_hours"],
                total_pieces=data["total_pieces"],
                total_unqualified=data["total_unqualified"],
                records=data["records"],
            )
            results.append(PerformanceSummaryResponse.model_validate(summary))
        return results

    @staticmethod
    async def get_summaries(
        tenant_id: int,
        period: Optional[str] = None,
        employee_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[PerformanceSummaryResponse]:
        """查询绩效汇总列表"""
        query = PerformanceSummary.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if period:
            query = query.filter(period=period)
        if employee_id is not None:
            query = query.filter(employee_id=employee_id)
        summaries = await query.offset(skip).limit(limit).order_by("-period", "employee_id").all()
        return [PerformanceSummaryResponse.model_validate(s) for s in summaries]

    @staticmethod
    async def get_detail(
        tenant_id: int,
        employee_id: int,
        period: str,
    ) -> PerformanceDetailResponse:
        """获取绩效明细（含报工记录列表）"""
        year, month = map(int, period.split("-"))
        start_dt = datetime(year, month, 1)
        if month == 12:
            end_dt = datetime(year + 1, 1, 1)
        else:
            end_dt = datetime(year, month + 1, 1)

        records = await ReportingRecord.filter(
            tenant_id=tenant_id,
            worker_id=employee_id,
            reported_at__gte=start_dt,
            reported_at__lt=end_dt,
            status="approved",
            deleted_at__isnull=True,
        ).order_by("reported_at").all()

        summary = await PerformanceSummary.filter(
            tenant_id=tenant_id,
            employee_id=employee_id,
            period=period,
            deleted_at__isnull=True,
        ).first()

        config = await EmployeePerformanceConfigService.get_by_employee(tenant_id, employee_id)
        hourly_rate = config.hourly_rate if config and config.hourly_rate is not None else None
        if hourly_rate is None:
            from infra.models.user import User
            user = await User.filter(id=employee_id, tenant_id=tenant_id).first()
            hourly_rate = await HourlyRateService.get_rate_for_employee(
                tenant_id, employee_id,
                department_id=user.department_id if user else None,
                position_id=user.position_id if user else None,
            )
        if hourly_rate is None:
            hourly_rate = Decimal("50")

        items = []
        for r in records:
            piece_rate = await PieceRateService.get_rate_for_operation(tenant_id, r.operation_id)
            piece_amt = (r.qualified_quantity or Decimal("0")) * (piece_rate or Decimal("0")) if piece_rate else None
            time_amt = (r.work_hours or Decimal("0")) * hourly_rate
            items.append(PerformanceDetailItem(
                reporting_record_id=r.id,
                work_order_code=r.work_order_code or "",
                operation_name=r.operation_name or "",
                reported_at=r.reported_at,
                reported_quantity=r.reported_quantity or Decimal("0"),
                qualified_quantity=r.qualified_quantity or Decimal("0"),
                unqualified_quantity=r.unqualified_quantity or Decimal("0"),
                work_hours=r.work_hours or Decimal("0"),
                piece_rate=piece_rate,
                piece_amount=piece_amt,
                time_amount=time_amt,
            ))

        employee_name = summary.employee_name if summary else None
        if not employee_name and records:
            employee_name = records[0].worker_name
        if not employee_name:
            from infra.models.user import User
            user = await User.filter(id=employee_id, tenant_id=tenant_id).first()
            employee_name = user.full_name if user else str(employee_id)

        return PerformanceDetailResponse(
            employee_id=employee_id,
            employee_name=employee_name,
            period=period,
            summary=PerformanceSummaryResponse.model_validate(summary) if summary else None,
            items=items,
        )
