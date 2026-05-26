"""
质量改进服务：8D / OQC / SPC
"""

from __future__ import annotations

from datetime import datetime
from statistics import mean, pstdev
from typing import Any, Dict, List, Optional

from tortoise.queryset import Q

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.models.oqc_inspection import OQCInspection
from apps.kuaizhizao.models.quality_8d_report import Quality8DReport
from apps.kuaizhizao.models.spc_sample import SPCSample
from apps.kuaizhizao.schemas.quality_improvement import (
    OQCInspectionConduct,
    OQCInspectionCreate,
    OQCInspectionResponse,
    Quality8DCreate,
    Quality8DResponse,
    Quality8DTransition,
    Quality8DUpdate,
    SPCChartResponse,
    SPCPoint,
    SPCSampleCreate,
    SPCSampleResponse,
)
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError

VALID_8D_STATUS_FLOW = [
    "d1_team",
    "d2_problem",
    "d3_containment",
    "d4_root_cause",
    "d5_corrective_action",
    "d6_implement_result",
    "d7_prevent_recurrence",
    "d8_team_congratulation",
    "closed",
]

def _build_quick_code(prefix: str) -> str:
    now = datetime.now()
    return f"{prefix}{now.strftime('%Y%m%d%H%M%S%f')[-12:]}"


class Quality8DService(AppBaseService[Quality8DReport]):
    def __init__(self) -> None:
        super().__init__(Quality8DReport)

    async def create_report(self, tenant_id: int, user_id: int, payload: Quality8DCreate) -> Quality8DResponse:
        report_code = payload.report_code
        if not report_code:
            report_code = _build_quick_code("8D")

        report = await Quality8DReport.create(
            tenant_id=tenant_id,
            report_code=report_code,
            **payload.model_dump(exclude={"report_code"}),
        )
        return Quality8DResponse.model_validate(report)

    async def list_reports(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        owner_id: Optional[int] = None,
        overdue_only: bool = False,
    ) -> List[Quality8DResponse]:
        query = Quality8DReport.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            query = query.filter(status=status)
        if owner_id:
            query = query.filter(owner_id=owner_id)
        if overdue_only:
            query = query.filter(due_date__lt=datetime.now()).exclude(status="closed")
        rows = await query.order_by("-created_at").offset(skip).limit(limit)
        return [Quality8DResponse.model_validate(row) for row in rows]

    async def get_report(self, tenant_id: int, report_id: int) -> Quality8DResponse:
        row = await Quality8DReport.get_or_none(id=report_id, tenant_id=tenant_id, deleted_at__isnull=True)
        if not row:
            raise NotFoundError("8D 报告不存在")
        return Quality8DResponse.model_validate(row)

    async def update_report(self, tenant_id: int, report_id: int, user_id: int, payload: Quality8DUpdate) -> Quality8DResponse:
        row = await Quality8DReport.get_or_none(id=report_id, tenant_id=tenant_id, deleted_at__isnull=True)
        if not row:
            raise NotFoundError("8D 报告不存在")
        data = payload.model_dump(exclude_unset=True)
        if data:
            await row.update_from_dict(data).save()
        return Quality8DResponse.model_validate(row)

    async def transition(self, tenant_id: int, report_id: int, user_id: int, payload: Quality8DTransition) -> Quality8DResponse:
        row = await Quality8DReport.get_or_none(id=report_id, tenant_id=tenant_id, deleted_at__isnull=True)
        if not row:
            raise NotFoundError("8D 报告不存在")
        if payload.to_status not in VALID_8D_STATUS_FLOW:
            raise BusinessLogicError(f"非法 8D 阶段: {payload.to_status}")
        row.status = payload.to_status
        if payload.to_status == "closed":
            row.closed_at = datetime.now()
            if payload.verification_result:
                row.verification_result = payload.verification_result
        if payload.remarks:
            history = f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {payload.to_status}: {payload.remarks}"
            row.remarks = f"{row.remarks}\n{history}".strip() if row.remarks else history
        await row.save()
        return Quality8DResponse.model_validate(row)


class OQCInspectionService(AppBaseService[OQCInspection]):
    def __init__(self) -> None:
        super().__init__(OQCInspection)

    async def create(self, tenant_id: int, user_id: int, payload: OQCInspectionCreate) -> OQCInspectionResponse:
        inspection_code = payload.inspection_code
        if not inspection_code:
            inspection_code = _build_quick_code("OQC")
        row = await OQCInspection.create(
            tenant_id=tenant_id,
            inspection_code=inspection_code,
            status="待检验",
            review_status="待审核",
            **payload.model_dump(exclude={"inspection_code"}),
        )
        return OQCInspectionResponse.model_validate(row)

    async def list(self, tenant_id: int, skip: int = 0, limit: int = 100, status: Optional[str] = None) -> Dict[str, Any]:
        query = OQCInspection.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            query = query.filter(status=status)
        total = await query.count()
        rows = await query.order_by("-created_at").offset(skip).limit(limit)
        return {
            "items": [OQCInspectionResponse.model_validate(row) for row in rows],
            "total": total,
        }

    async def conduct(self, tenant_id: int, inspection_id: int, user_id: int, payload: OQCInspectionConduct) -> OQCInspectionResponse:
        row = await OQCInspection.get_or_none(id=inspection_id, tenant_id=tenant_id, deleted_at__isnull=True)
        if not row:
            raise NotFoundError("OQC 检验单不存在")
        user_info = await self.get_user_info(user_id)
        row.inspection_result = payload.inspection_result
        row.quality_status = payload.quality_status
        row.qualified_quantity = payload.qualified_quantity
        row.unqualified_quantity = payload.unqualified_quantity
        row.release_decision = payload.release_decision
        row.release_note = payload.release_note
        row.notes = payload.notes
        row.status = "已检验"
        row.inspector_id = user_id
        row.inspector_name = user_info["name"]
        row.inspection_time = datetime.now()
        await row.save()
        return OQCInspectionResponse.model_validate(row)

    async def approve(self, tenant_id: int, inspection_id: int, user_id: int, approve: bool) -> OQCInspectionResponse:
        row = await OQCInspection.get_or_none(id=inspection_id, tenant_id=tenant_id, deleted_at__isnull=True)
        if not row:
            raise NotFoundError("OQC 检验单不存在")
        user_info = await self.get_user_info(user_id)
        row.review_status = "已审核" if approve else "已驳回"
        row.status = "已审核" if approve else "已驳回"
        row.reviewer_id = user_id
        row.reviewer_name = user_info["name"]
        row.review_time = datetime.now()
        await row.save()
        return OQCInspectionResponse.model_validate(row)


class SPCService(AppBaseService[SPCSample]):
    def __init__(self) -> None:
        super().__init__(SPCSample)

    async def create_sample(self, tenant_id: int, user_id: int, payload: SPCSampleCreate) -> SPCSampleResponse:
        row = await SPCSample.create(
            tenant_id=tenant_id,
            **payload.model_dump(),
        )
        return SPCSampleResponse.model_validate(row)

    async def list_samples(
        self,
        tenant_id: int,
        characteristic_name: Optional[str] = None,
        skip: int = 0,
        limit: int = 200,
    ) -> List[SPCSampleResponse]:
        query = Q(tenant_id=tenant_id, deleted_at__isnull=True)
        if characteristic_name:
            query &= Q(characteristic_name=characteristic_name)
        rows = await SPCSample.filter(query).order_by("-sample_time").offset(skip).limit(limit)
        return [SPCSampleResponse.model_validate(row) for row in rows]

    async def build_imr_chart(
        self,
        tenant_id: int,
        characteristic_name: str,
        limit: int = 50,
    ) -> SPCChartResponse:
        rows = await SPCSample.filter(
            tenant_id=tenant_id,
            characteristic_name=characteristic_name,
            deleted_at__isnull=True,
        ).order_by("-sample_time").limit(limit)
        points_raw = list(reversed(rows))
        values = [float(row.sample_value) for row in points_raw]
        if not values:
            return SPCChartResponse(
                characteristic_name=characteristic_name,
                chart_type="imr",
                mean=0,
                sigma=0,
                ucl=0,
                lcl=0,
                points=[],
                triggered_summary=[],
            )
        center = mean(values)
        sigma = pstdev(values) if len(values) > 1 else 0
        ucl = center + 3 * sigma
        lcl = center - 3 * sigma

        points: List[SPCPoint] = []
        triggered_summary: List[str] = []
        increasing_count = 1
        decreasing_count = 1
        for idx, row in enumerate(points_raw):
            current = float(row.sample_value)
            rules: List[str] = []
            out_of_control = current > ucl or current < lcl
            if out_of_control:
                rules.append("3sigma_out_of_control")
            if idx > 0:
                prev = float(points_raw[idx - 1].sample_value)
                if current > prev:
                    increasing_count += 1
                    decreasing_count = 1
                elif current < prev:
                    decreasing_count += 1
                    increasing_count = 1
                else:
                    increasing_count = 1
                    decreasing_count = 1
                if increasing_count >= 6:
                    rules.append("six_points_increasing")
                if decreasing_count >= 6:
                    rules.append("six_points_decreasing")
            if rules:
                triggered_summary.extend(rules)
            points.append(
                SPCPoint(
                    sample_time=row.sample_time,
                    sample_value=current,
                    out_of_control=out_of_control,
                    triggered_rules=rules,
                )
            )

        return SPCChartResponse(
            characteristic_name=characteristic_name,
            chart_type="imr",
            mean=center,
            sigma=sigma,
            ucl=ucl,
            lcl=lcl,
            points=points,
            triggered_summary=sorted(set(triggered_summary)),
        )
