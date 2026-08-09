"""
绩效计算服务模块

从报工记录汇总并按规则计算计时/计件金额，支持 KPI 计算。
"""

from __future__ import annotations

import csv
import io
from datetime import datetime, date
from decimal import Decimal
from typing import List, Optional, Dict, Any, Tuple

from apps.kuaizhizao.models.reporting_record import ReportingRecord
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.master_data.models.employee_performance import (
    PerformanceSummary,
    EmployeeKPIScore,
)
from apps.master_data.schemas.employee_performance_schemas import (
    PerformanceSummaryResponse,
    PerformanceDetailItem,
    PerformanceDetailResponse,
)
from apps.common.audit_actor import apply_create_audit, apply_update_audit
from infra.models.user import User
from apps.master_data.services.employee_performance_service import (
    EmployeePerformanceConfigService,
    PieceRateService,
    HourlyRateService,
)
from apps.master_data.services.kpi_evaluator_service import KPIEvaluatorService
from infra.exceptions.exceptions import NotFoundError, ValidationError


class PerformanceCalcService:
    """绩效计算服务"""

    @staticmethod
    def _period_from_date(d: date) -> str:
        return d.strftime("%Y-%m")

    @staticmethod
    def _period_as_of_date(period: str) -> date:
        year, month = map(int, period.split("-"))
        return date(year, month, 1)

    @staticmethod
    async def _resolve_hourly_rate(
        tenant_id: int,
        employee_id: int,
        period: str,
        *,
        config_hourly: Optional[Decimal] = None,
    ) -> Decimal:
        if config_hourly is not None:
            return config_hourly
        from infra.models.user import User

        user = await User.filter(id=employee_id, tenant_id=tenant_id).first()
        as_of = PerformanceCalcService._period_as_of_date(period)
        rate = await HourlyRateService.get_rate_for_employee(
            tenant_id,
            employee_id,
            department_id=user.department_id if user else None,
            position_id=user.position_id if user else None,
            as_of_date=as_of,
        )
        if rate is None:
            name = user.full_name if user and user.full_name else str(employee_id)
            raise ValidationError(f"员工 {name} 未配置工时单价，请在员工绩效配置或工时单价中维护")
        return rate

    @staticmethod
    async def _material_id_for_record(tenant_id: int, record: ReportingRecord) -> Optional[int]:
        if not record.work_order_id:
            return None
        wo = await WorkOrder.filter(
            tenant_id=tenant_id,
            id=record.work_order_id,
            deleted_at__isnull=True,
        ).first()
        return int(wo.product_id) if wo and wo.product_id else None

    @staticmethod
    async def aggregate_reporting_by_employee(
        tenant_id: int,
        period: str,
        status_filter: Optional[str] = "approved",
    ) -> Dict[int, Dict[str, Any]]:
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
        operator: Optional[User] = None,
    ) -> PerformanceSummary:
        existing = await PerformanceSummary.filter(
            tenant_id=tenant_id,
            employee_id=employee_id,
            period=period,
            deleted_at__isnull=True,
        ).first()
        if existing and existing.status == "confirmed":
            return existing

        config = await EmployeePerformanceConfigService.get_by_employee(tenant_id, employee_id)
        calc_mode = ((config.calc_mode if config else None) or "time").strip().lower()
        piece_rate_mode = ((config.piece_rate_mode if config else None) or "operation").strip().lower()
        default_piece_rate = config.default_piece_rate if config else None
        base_salary = config.base_salary if config else None
        as_of = PerformanceCalcService._period_as_of_date(period)

        # 已维护默认计件单价且本期有合格产量，但模式仍为「计时」：按混合计薪。
        # 否则常见误配会导致总件数>0 而计件金额恒为 0。
        if (
            calc_mode == "time"
            and default_piece_rate is not None
            and (total_pieces or Decimal("0")) > 0
        ):
            calc_mode = "mixed"

        time_amount = Decimal("0")
        if calc_mode in ("time", "mixed"):
            hourly_rate = await PerformanceCalcService._resolve_hourly_rate(
                tenant_id,
                employee_id,
                period,
                config_hourly=config.hourly_rate if config else None,
            )
            time_amount = total_hours * hourly_rate

        piece_amount = Decimal("0")
        if calc_mode in ("piece", "mixed"):
            if piece_rate_mode == "default":
                if default_piece_rate is None:
                    raise ValidationError(
                        f"员工 {employee_name} 计件单价来源为默认单价，但未配置默认计件单价"
                    )
                piece_amount = (total_pieces or Decimal("0")) * default_piece_rate
            else:
                if not records:
                    if default_piece_rate is None:
                        raise ValidationError(
                            f"员工 {employee_name} 无报工明细且未配置默认计件单价，无法计算计件金额"
                        )
                    piece_amount = (total_pieces or Decimal("0")) * default_piece_rate
                else:
                    for r in records:
                        material_id = await PerformanceCalcService._material_id_for_record(
                            tenant_id, r
                        )
                        rate = await PieceRateService.get_rate_for_operation(
                            tenant_id,
                            r.operation_id,
                            material_id=material_id,
                            as_of_date=as_of,
                        )
                        if rate is None:
                            rate = default_piece_rate
                        if rate is None:
                            raise ValidationError(
                                f"员工 {employee_name} 工序 {r.operation_name or r.operation_id} 未配置计件单价"
                            )
                        piece_amount += (r.qualified_quantity or Decimal("0")) * rate

        total_amount = time_amount + piece_amount
        if base_salary is not None:
            total_amount = max(total_amount, base_salary)

        ctx = await KPIEvaluatorService.build_context(
            tenant_id,
            period,
            records,
            total_hours,
            total_pieces,
            total_unqualified,
            employee_id=employee_id,
        )
        kpi_score, kpi_coefficient = await KPIEvaluatorService.evaluate_and_persist(
            tenant_id, employee_id, employee_name, period, ctx,
        )
        total_amount = (total_amount * kpi_coefficient).quantize(Decimal("0.01"))

        defaults = {
                "employee_name": employee_name,
                "total_hours": total_hours,
                "total_pieces": total_pieces,
                "total_unqualified": total_unqualified,
                "time_amount": time_amount,
                "piece_amount": piece_amount,
                "kpi_score": kpi_score,
                "kpi_coefficient": kpi_coefficient,
                "total_amount": total_amount,
                "status": "calculated",
            }
        apply_update_audit(defaults, operator)
        if existing is None:
            apply_create_audit(defaults, operator)
        summary, _ = await PerformanceSummary.update_or_create(
            tenant_id=tenant_id,
            employee_id=employee_id,
            period=period,
            defaults=defaults,
        )
        return summary

    @staticmethod
    async def calculate_period(tenant_id: int, period: str, operator: Optional[User] = None) -> List[PerformanceSummaryResponse]:
        agg = await PerformanceCalcService.aggregate_reporting_by_employee(
            tenant_id, period, status_filter="approved",
        )
        results: List[PerformanceSummaryResponse] = []
        errors: List[str] = []
        for worker_id, data in agg.items():
            existing = await PerformanceSummary.filter(
                tenant_id=tenant_id,
                employee_id=worker_id,
                period=period,
                deleted_at__isnull=True,
            ).first()
            if existing and existing.status == "confirmed":
                results.append(PerformanceSummaryResponse.model_validate(existing))
                continue
            try:
                summary = await PerformanceCalcService.calculate_employee_performance(
                    tenant_id=tenant_id,
                    employee_id=worker_id,
                    employee_name=data["worker_name"] or "",
                    period=period,
                    total_hours=data["total_hours"],
                    total_pieces=data["total_pieces"],
                    total_unqualified=data["total_unqualified"],
                    records=data["records"],
                    operator=operator,
                )
                results.append(PerformanceSummaryResponse.model_validate(summary))
            except ValidationError as exc:
                errors.append(str(exc))
        # 任一员工计薪失败须暴露，禁止静默跳过导致列表残留件数为正、金额为 0
        if errors:
            raise ValidationError("; ".join(errors))
        return results

    @staticmethod
    async def confirm_summary(tenant_id: int, summary_id: int, operator: Optional[User] = None) -> PerformanceSummaryResponse:
        summary = await PerformanceSummary.filter(
            id=summary_id, tenant_id=tenant_id, deleted_at__isnull=True,
        ).first()
        if not summary:
            raise NotFoundError(f"绩效汇总 {summary_id} 不存在")
        if summary.status == "confirmed":
            return PerformanceSummaryResponse.model_validate(summary)
        if summary.status not in ("calculated", "draft"):
            raise ValidationError(f"当前状态 {summary.status} 不可确认")
        if (summary.total_amount or Decimal("0")) <= 0:
            raise ValidationError("应发总额须大于 0 才能确认")
        summary.status = "confirmed"
        apply_update_audit(summary, operator)
        await summary.save()
        return PerformanceSummaryResponse.model_validate(summary)

    @staticmethod
    async def reopen_summary(tenant_id: int, summary_id: int, operator: Optional[User] = None) -> PerformanceSummaryResponse:
        summary = await PerformanceSummary.filter(
            id=summary_id, tenant_id=tenant_id, deleted_at__isnull=True,
        ).first()
        if not summary:
            raise NotFoundError(f"绩效汇总 {summary_id} 不存在")
        if summary.status != "confirmed":
            raise ValidationError("仅已确认汇总可退回重算")
        summary.status = "calculated"
        apply_update_audit(summary, operator)
        await summary.save()
        return PerformanceSummaryResponse.model_validate(summary)

    @staticmethod
    async def batch_confirm_period(tenant_id: int, period: str, operator: Optional[User] = None) -> Dict[str, Any]:
        rows = await PerformanceSummary.filter(
            tenant_id=tenant_id,
            period=period,
            status="calculated",
            deleted_at__isnull=True,
        ).all()
        confirmed = 0
        skipped = 0
        for row in rows:
            if (row.total_amount or Decimal("0")) <= 0:
                skipped += 1
                continue
            row.status = "confirmed"
            apply_update_audit(row, operator)
            await row.save(update_fields=["status", "updated_at", "updated_by", "updated_by_name"])
            confirmed += 1
        return {"period": period, "confirmed_count": confirmed, "skipped_count": skipped}

    @staticmethod
    async def export_summaries_csv(
        tenant_id: int,
        *,
        period: str,
        status: str = "confirmed",
    ) -> Tuple[str, Decimal]:
        rows = await PerformanceSummary.filter(
            tenant_id=tenant_id,
            period=period,
            status=status,
            deleted_at__isnull=True,
        ).order_by("employee_name").all()

        from infra.models.user import User

        user_ids = [r.employee_id for r in rows]
        users = await User.filter(tenant_id=tenant_id, id__in=user_ids).all() if user_ids else []
        dept_map = {u.id: u.department_id for u in users}

        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([
            "员工", "部门ID", "周期", "总工时", "总件数",
            "计时金额", "计件金额", "KPI系数", "应发总额",
        ])
        total_sum = Decimal("0")
        for r in rows:
            amt = r.total_amount or Decimal("0")
            total_sum += amt
            writer.writerow([
                r.employee_name or r.employee_id,
                dept_map.get(r.employee_id, ""),
                r.period,
                float(r.total_hours or 0),
                float(r.total_pieces or 0),
                float(r.time_amount or 0),
                float(r.piece_amount or 0),
                float(r.kpi_coefficient or 1),
                float(amt),
            ])
        writer.writerow([])
        writer.writerow(["合计", "", period, "", "", "", "", "", float(total_sum)])
        return buf.getvalue(), total_sum

    @staticmethod
    async def get_summaries(
        tenant_id: int,
        period: Optional[str] = None,
        employee_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 100,
        keyword: Optional[str] = None,
        order_by: Optional[str] = None,
        status: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
    ) -> dict:
        from apps.master_data.services.performance_list_core import apply_performance_summary_list_filters

        query = PerformanceSummary.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        query, order_clause = apply_performance_summary_list_filters(
            query,
            keyword=keyword,
            order_by=order_by,
            period=period,
            employee_id=employee_id,
            status=status,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            updated_start_date=updated_start_date,
            updated_end_date=updated_end_date,
        )
        total = await query.count()
        summaries = await query.order_by(order_clause).offset(skip).limit(limit).all()
        items = [PerformanceSummaryResponse.model_validate(s) for s in summaries]
        return {"items": items, "total": total}

    @staticmethod
    async def get_detail(
        tenant_id: int,
        employee_id: int,
        period: str,
    ) -> PerformanceDetailResponse:
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
        try:
            hourly_rate = await PerformanceCalcService._resolve_hourly_rate(
                tenant_id,
                employee_id,
                period,
                config_hourly=config.hourly_rate if config and config.hourly_rate is not None else None,
            )
        except ValidationError:
            hourly_rate = Decimal("0")
        as_of = PerformanceCalcService._period_as_of_date(period)

        items = []
        for r in records:
            material_id = await PerformanceCalcService._material_id_for_record(tenant_id, r)
            piece_rate = await PieceRateService.get_rate_for_operation(
                tenant_id, r.operation_id, material_id=material_id, as_of_date=as_of,
            )
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

        kpi_scores = await KPIEvaluatorService.list_scores(
            tenant_id, employee_id=employee_id, period=period,
        )

        return PerformanceDetailResponse(
            employee_id=employee_id,
            employee_name=employee_name,
            period=period,
            summary=PerformanceSummaryResponse.model_validate(summary) if summary else None,
            items=items,
            kpi_scores=[
                {
                    "kpi_code": s.kpi_code,
                    "score": float(s.score or 0),
                    "source_data_json": s.source_data_json,
                }
                for s in kpi_scores
            ],
        )

    @staticmethod
    async def distribute_by_work_group(
        tenant_id: int,
        work_group_uuid: str,
        period: str,
        total_amount: Decimal,
        custom_distribution: Optional[Dict[int, Decimal]] = None,
    ) -> List[PerformanceSummaryResponse]:
        from apps.master_data.models.factory import WorkGroup, WorkGroupMember

        work_group = await WorkGroup.filter(
            tenant_id=tenant_id,
            uuid=work_group_uuid,
            deleted_at__isnull=True,
        ).prefetch_related("members").first()

        if not work_group:
            raise NotFoundError(f"工作小组 {work_group_uuid} 不存在")

        members = [m for m in work_group.members if m.deleted_at is None]
        if not members:
            raise ValidationError("工作小组无有效成员")

        async def _add_distribution(member, amt: Decimal):
            existing = await PerformanceSummary.filter(
                tenant_id=tenant_id,
                employee_id=member.employee_id,
                period=period,
                deleted_at__isnull=True,
            ).first()
            if existing and existing.status == "confirmed":
                raise ValidationError(f"成员 {member.employee_name} 该周期已确认，无法分配")
            if existing:
                existing.total_amount = (existing.total_amount or Decimal("0")) + amt
                await existing.save()
                return existing
            return await PerformanceSummary.create(
                tenant_id=tenant_id,
                employee_id=member.employee_id,
                employee_name=member.employee_name,
                period=period,
                total_hours=Decimal("0"),
                total_pieces=Decimal("0"),
                total_unqualified=Decimal("0"),
                time_amount=Decimal("0"),
                piece_amount=Decimal("0"),
                total_amount=amt,
                status="calculated",
            )

        results = []
        if custom_distribution is not None and len(custom_distribution) > 0:
            for member in members:
                amt = custom_distribution.get(member.employee_id) or Decimal("0")
                summary = await _add_distribution(member, amt)
                results.append(PerformanceSummaryResponse.model_validate(summary))
        else:
            weight_sum = sum(m.performance_weight or Decimal("1") for m in members)
            if weight_sum <= 0:
                weight_sum = Decimal("1")
            for member in members:
                w = member.performance_weight or Decimal("1")
                amt = (total_amount * w / weight_sum).quantize(Decimal("0.01"))
                summary = await _add_distribution(member, amt)
                results.append(PerformanceSummaryResponse.model_validate(summary))
        return results
