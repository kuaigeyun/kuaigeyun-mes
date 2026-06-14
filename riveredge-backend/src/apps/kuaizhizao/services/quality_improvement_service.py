"""
质量改进服务：8D / OQC / SPC
"""

from __future__ import annotations

import re
from datetime import datetime
from statistics import mean, pstdev
from typing import Any, Dict, List, Optional

from tortoise.queryset import Q

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.models.oqc_inspection import OQCInspection
from apps.kuaizhizao.models.quality_8d_report import Quality8DReport
from apps.kuaizhizao.models.spc_sample import SPCSample
from apps.kuaizhizao.schemas.quality_improvement import (
    Quality8DHistoryEntry,
    OQCInspectionConduct,
    OQCInspectionCreate,
    OQCInspectionResponse,
    Quality8DCreate,
    Quality8DLifecycleStage,
    Quality8DListResponse,
    Quality8DResponse,
    Quality8DTransition,
    Quality8DUpdate,
    SPCChartResponse,
    SPCPoint,
    SPCSampleCreate,
    SPCSampleResponse,
)
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError
from tortoise.transactions import in_transaction
from datetime import timezone

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
_8D_STAGE_LABELS: Dict[str, str] = {
    "d1_team": "D1 组建团队",
    "d2_problem": "D2 问题描述",
    "d3_containment": "D3 临时遏制",
    "d4_root_cause": "D4 根因分析",
    "d5_corrective_action": "D5 纠正措施",
    "d6_implement_result": "D6 实施验证",
    "d7_prevent_recurrence": "D7 防再发",
    "d8_team_congratulation": "D8 总结",
    "closed": "已关闭",
}
_8D_STAGE_REQUIRED_FIELD: Dict[str, str] = {
    "d1_team": "d1_team",
    "d2_problem": "d2_problem",
    "d3_containment": "d3_containment",
    "d4_root_cause": "d4_root_cause",
    "d5_corrective_action": "d5_corrective_action",
    "d6_implement_result": "d6_implement_result",
    "d7_prevent_recurrence": "d7_prevent_recurrence",
    "d8_team_congratulation": "d8_team_congratulation",
}
_HISTORY_LINE_PATTERN = re.compile(r"^\[(?P<ts>[^\]]+)\]\s*(?P<status>[a-z0-9_]+)\s*:\s*(?P<remarks>.+)$")

def _build_quick_code(prefix: str) -> str:
    now = datetime.now()
    return f"{prefix}{now.strftime('%Y%m%d%H%M%S%f')[-12:]}"


class Quality8DService(AppBaseService[Quality8DReport]):
    def __init__(self) -> None:
        super().__init__(Quality8DReport)

    @staticmethod
    def _normalize_text(value: Optional[str]) -> str:
        return (value or "").strip()

    def _current_stage_index(self, status: str) -> int:
        try:
            return VALID_8D_STATUS_FLOW.index(status)
        except ValueError as exc:
            raise BusinessLogicError(f"非法 8D 阶段: {status}") from exc

    def _next_status(self, status: str) -> Optional[str]:
        idx = self._current_stage_index(status)
        return VALID_8D_STATUS_FLOW[idx + 1] if idx < len(VALID_8D_STATUS_FLOW) - 1 else None

    def _build_lifecycle_stages(self, status: str) -> List[Quality8DLifecycleStage]:
        current_idx = self._current_stage_index(status)
        stages: List[Quality8DLifecycleStage] = []
        for idx, key in enumerate(VALID_8D_STATUS_FLOW):
            if idx < current_idx:
                stage_status = "done"
            elif idx == current_idx:
                stage_status = "active"
            else:
                stage_status = "pending"
            stages.append(
                Quality8DLifecycleStage(
                    key=key,
                    label=_8D_STAGE_LABELS.get(key, key),
                    status=stage_status,
                )
            )
        return stages

    def _build_response(self, row: Quality8DReport) -> Quality8DResponse:
        base = Quality8DResponse.model_validate(row)
        next_status = self._next_status(row.status)
        suggestions: List[str] = []
        if next_status:
            suggestions.append(f"推进到 {_8D_STAGE_LABELS.get(next_status, next_status)}")
        if row.status != "closed":
            suggestions.append("更新当前阶段内容并保存")
        if row.status == "d8_team_congratulation":
            suggestions.append("填写验证结果后关闭")
        return base.model_copy(
            update={
                "lifecycle_stages": self._build_lifecycle_stages(row.status),
                "next_status": next_status,
                "next_step_suggestions": suggestions,
            }
        )

    def _validate_stage_completion_before_transition(
        self,
        row: Quality8DReport,
        to_status: str,
        verification_result: Optional[str],
    ) -> None:
        if row.status == "closed":
            raise BusinessLogicError("已关闭的 8D 报告不可再流转")
        expected_next = self._next_status(row.status)
        if expected_next != to_status:
            raise BusinessLogicError(
                f"仅允许按顺序推进到下一阶段：当前 {_8D_STAGE_LABELS.get(row.status, row.status)}，"
                f"下一步应为 {_8D_STAGE_LABELS.get(expected_next or '', expected_next or '-')}"
            )
        required_field = _8D_STAGE_REQUIRED_FIELD.get(row.status)
        if required_field and not self._normalize_text(getattr(row, required_field, None)):
            raise BusinessLogicError(
                f"推进前需先完善当前阶段内容：{_8D_STAGE_LABELS.get(row.status, row.status)}"
            )
        if to_status == "closed":
            resolved_verification = self._normalize_text(verification_result) or self._normalize_text(
                row.verification_result
            )
            if not resolved_verification:
                raise BusinessLogicError("关闭前必须填写验证结果")

    def _append_transition_history_line(self, row: Quality8DReport, payload: Quality8DTransition) -> None:
        if not payload.remarks:
            return
        history = f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {payload.to_status}: {payload.remarks}"
        row.remarks = f"{row.remarks}\n{history}".strip() if row.remarks else history

    def _parse_history_from_remarks(self, row: Quality8DReport) -> List[Quality8DHistoryEntry]:
        base_tz = row.created_at.tzinfo or timezone.utc

        def _normalize_ts(ts: datetime) -> datetime:
            if ts.tzinfo is None:
                return ts.replace(tzinfo=base_tz)
            return ts.astimezone(base_tz)

        def _sort_key(entry: Quality8DHistoryEntry) -> float:
            ts = entry.timestamp
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=base_tz)
            return ts.astimezone(timezone.utc).timestamp()

        history: List[Quality8DHistoryEntry] = [
            Quality8DHistoryEntry(
                timestamp=_normalize_ts(row.created_at),
                action="created",
                to_status="d1_team",
                remarks="8D 报告创建",
            )
        ]
        remarks_text = row.remarks or ""
        prev_status = "d1_team"
        for line in remarks_text.splitlines():
            raw = line.strip()
            if not raw:
                continue
            matched = _HISTORY_LINE_PATTERN.match(raw)
            if not matched:
                continue
            ts_str = matched.group("ts")
            status = matched.group("status")
            detail = matched.group("remarks")
            try:
                ts = datetime.strptime(ts_str, "%Y-%m-%d %H:%M:%S")
            except ValueError:
                ts = row.updated_at
            ts = _normalize_ts(ts)
            history.append(
                Quality8DHistoryEntry(
                    timestamp=ts,
                    action="transition",
                    from_status=prev_status,
                    to_status=status,
                    remarks=detail,
                )
            )
            prev_status = status
        if row.closed_at:
            history.append(
                Quality8DHistoryEntry(
                    timestamp=_normalize_ts(row.closed_at),
                    action="closed",
                    from_status="d8_team_congratulation",
                    to_status="closed",
                    verification_result=row.verification_result,
                )
            )
        history.sort(key=_sort_key)
        return history

    async def create_report(self, tenant_id: int, user_id: int, payload: Quality8DCreate) -> Quality8DResponse:
        report_code = payload.report_code
        if not report_code:
            report_code = _build_quick_code("8D")

        report = await Quality8DReport.create(
            tenant_id=tenant_id,
            report_code=report_code,
            **payload.model_dump(exclude={"report_code"}),
        )
        return self._build_response(report)

    async def list_reports(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        owner_id: Optional[int] = None,
        overdue_only: bool = False,
    ) -> Quality8DListResponse:
        query = Quality8DReport.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            query = query.filter(status=status)
        if owner_id:
            query = query.filter(owner_id=owner_id)
        if overdue_only:
            query = query.filter(due_date__lt=datetime.now()).exclude(status="closed")
        total = await query.count()
        rows = await query.order_by("-created_at").offset(skip).limit(limit)
        return Quality8DListResponse(items=[self._build_response(row) for row in rows], total=total)

    async def get_report(self, tenant_id: int, report_id: int) -> Quality8DResponse:
        row = await Quality8DReport.get_or_none(id=report_id, tenant_id=tenant_id, deleted_at__isnull=True)
        if not row:
            raise NotFoundError("8D 报告不存在")
        return self._build_response(row)

    async def update_report(self, tenant_id: int, report_id: int, user_id: int, payload: Quality8DUpdate) -> Quality8DResponse:
        row = await Quality8DReport.get_or_none(id=report_id, tenant_id=tenant_id, deleted_at__isnull=True)
        if not row:
            raise NotFoundError("8D 报告不存在")
        data = payload.model_dump(exclude_unset=True)
        if "status" in data and data.get("status") not in (None, row.status):
            raise BusinessLogicError("请通过“推进阶段”接口更新 8D 阶段")
        if data:
            await row.update_from_dict(data).save()
        return self._build_response(row)

    async def transition(self, tenant_id: int, report_id: int, user_id: int, payload: Quality8DTransition) -> Quality8DResponse:
        row = await Quality8DReport.get_or_none(id=report_id, tenant_id=tenant_id, deleted_at__isnull=True)
        if not row:
            raise NotFoundError("8D 报告不存在")
        if payload.to_status not in VALID_8D_STATUS_FLOW:
            raise BusinessLogicError(f"非法 8D 阶段: {payload.to_status}")
        self._validate_stage_completion_before_transition(row, payload.to_status, payload.verification_result)
        old_status = row.status
        row.status = payload.to_status
        if payload.to_status == "closed":
            row.closed_at = datetime.now()
            row.verification_result = self._normalize_text(payload.verification_result) or row.verification_result
        self._append_transition_history_line(row, payload)
        await row.save()
        resp = self._build_response(row)
        return resp.model_copy(
            update={
                "next_step_suggestions": [
                    f"阶段已从 {_8D_STAGE_LABELS.get(old_status, old_status)} 推进到 "
                    f"{_8D_STAGE_LABELS.get(row.status, row.status)}"
                ]
                + resp.next_step_suggestions
            }
        )

    async def delete_report(self, tenant_id: int, report_id: int, user_id: int) -> None:
        row = await Quality8DReport.get_or_none(id=report_id, tenant_id=tenant_id, deleted_at__isnull=True)
        if not row:
            raise NotFoundError("8D 报告不存在")
        if row.status == "closed":
            raise BusinessLogicError("已关闭的 8D 报告不可删除")
        row.deleted_at = datetime.now()
        await row.save(update_fields=["deleted_at"])

    async def get_history(self, tenant_id: int, report_id: int) -> List[Quality8DHistoryEntry]:
        row = await Quality8DReport.get_or_none(id=report_id, tenant_id=tenant_id, deleted_at__isnull=True)
        if not row:
            raise NotFoundError("8D 报告不存在")
        return self._parse_history_from_remarks(row)


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

    async def list(self, tenant_id: int, skip: int = 0, limit: int = 100, status: Optional[str] = None, shipment_notice_id: Optional[int] = None, sales_delivery_id: Optional[int] = None) -> Dict[str, Any]:
        query = OQCInspection.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            query = query.filter(status=status)
        if shipment_notice_id:
            query = query.filter(shipment_notice_id=shipment_notice_id)
        if sales_delivery_id:
            query = query.filter(source_type="sales_delivery", source_id=sales_delivery_id)
        total = await query.count()
        rows = await query.order_by("-created_at").offset(skip).limit(limit)
        return {
            "items": [OQCInspectionResponse.model_validate(row) for row in rows],
            "total": total,
        }

    async def conduct(self, tenant_id: int, inspection_id: int, user_id: int, payload: OQCInspectionConduct) -> OQCInspectionResponse:
        from apps.kuaizhizao.services.quality_service import (
            _apply_template_conduct_to_payload,
            _maybe_create_quality_exception_from_inspection,
        )

        row = await OQCInspection.get_or_none(id=inspection_id, tenant_id=tenant_id, deleted_at__isnull=True)
        if not row:
            raise NotFoundError("OQC 检验单不存在")
        user_info = await self.get_user_info(user_id)
        conduct_data = payload.model_dump(exclude_unset=True)
        conduct_extra = _apply_template_conduct_to_payload(row, "other_checks", conduct_data)
        row.inspection_result = payload.inspection_result
        row.quality_status = payload.quality_status
        row.qualified_quantity = payload.qualified_quantity
        row.unqualified_quantity = payload.unqualified_quantity
        row.release_decision = payload.release_decision
        row.release_note = payload.release_note
        row.notes = payload.notes
        if conduct_extra.get("other_checks") is not None:
            row.other_checks = conduct_extra["other_checks"]
        if conduct_extra.get("measurement_data") is not None:
            pass  # OQC 暂无 measurement_data 列，已并入 other_checks
        row.status = "已检验"
        row.inspector_id = user_id
        row.inspector_name = user_info["name"]
        row.inspection_time = datetime.now()
        await row.save()

        if row.quality_status == "不合格" or payload.inspection_result == "不合格":
            await _maybe_create_quality_exception_from_inspection(
                tenant_id=tenant_id,
                source_type="oqc_inspection",
                source_id=inspection_id,
                inspected_by=user_id,
                problem_description=payload.notes or f"出货检验不合格：{row.inspection_code}",
            )
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

    async def delete_inspection(self, tenant_id: int, inspection_id: int, user_id: int) -> None:
        from datetime import datetime
        from infra.exceptions.exceptions import BusinessLogicError

        row = await OQCInspection.get_or_none(
            id=inspection_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("OQC 检验单不存在")
        if (row.status or "") not in ("待检验",):
            raise BusinessLogicError("仅待检验状态的出货检验单可删除")
        row.deleted_at = datetime.now()
        await row.save(update_fields=["deleted_at"])

    async def revoke_approval(
        self, tenant_id: int, inspection_id: int, user_id: int
    ) -> OQCInspectionResponse:
        from infra.exceptions.exceptions import BusinessLogicError

        row = await OQCInspection.get_or_none(
            id=inspection_id, tenant_id=tenant_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("OQC 检验单不存在")
        if (row.status or "") != "已审核":
            raise BusinessLogicError("仅已审核通过的出货检验单可撤销审核")
        row.status = "已检验"
        row.review_status = "待审核"
        row.reviewer_id = None
        row.reviewer_name = None
        row.review_time = None
        await row.save()
        return OQCInspectionResponse.model_validate(row)

    async def create_from_shipment_notice(
        self,
        tenant_id: int,
        notice_id: int,
        user_id: int,
        line_ids: Optional[List[int]] = None,
    ) -> List[OQCInspectionResponse]:
        """从发货通知单创建 OQC 出货检验单（按明细行，跳过无需 OQC 的物料）。"""
        from apps.kuaizhizao.models.shipment_notice import ShipmentNotice
        from apps.kuaizhizao.models.shipment_notice_item import ShipmentNoticeItem
        from apps.kuaizhizao.services.inspection_policy_service import resolve_inspection_policy
        from apps.kuaizhizao.services.quality_service import _resolve_inspection_template_fields
        from apps.master_data.models.material import Material

        notice = await ShipmentNotice.get_or_none(
            tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True
        )
        if not notice:
            raise NotFoundError(f"发货通知单不存在: {notice_id}")

        item_query = ShipmentNoticeItem.filter(tenant_id=tenant_id, notice_id=notice_id)
        if line_ids:
            item_query = item_query.filter(id__in=line_ids)
        items = await item_query.all()
        if not items:
            raise BusinessLogicError("发货通知单没有可创建 OQC 的明细")

        mids = [it.material_id for it in items if it.material_id]
        mat_rows = await Material.filter(
            tenant_id=tenant_id, id__in=mids, deleted_at__isnull=True
        ).all()
        mat_by_id = {m.id: m for m in mat_rows}

        created: List[OQCInspectionResponse] = []
        async with in_transaction():
            for item in items:
                if not item.material_id:
                    continue
                existing = await OQCInspection.filter(
                    tenant_id=tenant_id,
                    shipment_notice_id=notice.id,
                    material_id=item.material_id,
                    deleted_at__isnull=True,
                ).first()
                if existing:
                    created.append(OQCInspectionResponse.model_validate(existing))
                    continue

                mat = mat_by_id.get(item.material_id)
                eff, _, _ = await resolve_inspection_policy(
                    tenant_id,
                    "oqc",
                    material_id=item.material_id,
                )
                if eff == "none":
                    continue

                inspection_code = _build_quick_code("OQC")
                template = await _resolve_inspection_template_fields(
                    tenant_id,
                    item.material_id,
                    "oqc",
                )
                row = await OQCInspection.create(
                    tenant_id=tenant_id,
                    inspection_code=inspection_code,
                    source_type="shipment_notice",
                    source_id=notice.id,
                    source_code=notice.notice_code,
                    shipment_notice_id=notice.id,
                    shipment_notice_code=notice.notice_code,
                    sales_order_id=notice.sales_order_id,
                    sales_order_code=notice.sales_order_code,
                    customer_id=notice.customer_id,
                    customer_name=notice.customer_name,
                    material_id=item.material_id,
                    material_code=item.material_code,
                    material_name=item.material_name,
                    inspection_quantity=item.notice_quantity,
                    status="待检验",
                    review_status="待审核",
                    inspection_standard=template.get("inspection_standard"),
                    other_checks=template.get("other_checks"),
                )
                created.append(OQCInspectionResponse.model_validate(row))
        if not created:
            raise BusinessLogicError("没有需要 OQC 的物料行，或均已存在检验单")
        return created

    async def create_from_sales_delivery(
        self,
        tenant_id: int,
        delivery_id: int,
        user_id: int,
        line_ids: Optional[List[int]] = None,
    ) -> List[OQCInspectionResponse]:
        """从销售出库单创建 OQC 出货检验单（按明细行，跳过无需 OQC 的物料）。"""
        from apps.kuaizhizao.models.sales_delivery import SalesDelivery
        from apps.kuaizhizao.models.sales_delivery_item import SalesDeliveryItem
        from apps.kuaizhizao.services.inspection_policy_service import resolve_inspection_policy
        from apps.kuaizhizao.services.quality_service import _resolve_inspection_template_fields
        from apps.master_data.models.material import Material

        delivery = await SalesDelivery.get_or_none(
            tenant_id=tenant_id, id=delivery_id, deleted_at__isnull=True
        )
        if not delivery:
            raise NotFoundError(f"销售出库单不存在: {delivery_id}")

        item_query = SalesDeliveryItem.filter(tenant_id=tenant_id, delivery_id=delivery_id)
        if line_ids:
            item_query = item_query.filter(id__in=line_ids)
        items = await item_query.all()
        if not items:
            raise BusinessLogicError("销售出库单没有可创建 OQC 的明细")

        mids = [it.material_id for it in items if it.material_id]
        mat_rows = await Material.filter(
            tenant_id=tenant_id, id__in=mids, deleted_at__isnull=True
        ).all()
        mat_by_id = {m.id: m for m in mat_rows}

        created: List[OQCInspectionResponse] = []
        async with in_transaction():
            for item in items:
                if not item.material_id:
                    continue
                existing = await OQCInspection.filter(
                    tenant_id=tenant_id,
                    source_type="sales_delivery",
                    source_id=delivery.id,
                    material_id=item.material_id,
                    deleted_at__isnull=True,
                ).first()
                if existing:
                    created.append(OQCInspectionResponse.model_validate(existing))
                    continue

                mat = mat_by_id.get(item.material_id)
                eff, _, _ = await resolve_inspection_policy(
                    tenant_id,
                    "oqc",
                    material_id=item.material_id,
                )
                if eff == "none":
                    continue

                inspection_code = _build_quick_code("OQC")
                template = await _resolve_inspection_template_fields(
                    tenant_id,
                    item.material_id,
                    "oqc",
                )
                row = await OQCInspection.create(
                    tenant_id=tenant_id,
                    inspection_code=inspection_code,
                    source_type="sales_delivery",
                    source_id=delivery.id,
                    source_code=delivery.delivery_code,
                    sales_order_id=delivery.sales_order_id,
                    sales_order_code=delivery.sales_order_code,
                    customer_id=delivery.customer_id,
                    customer_name=delivery.customer_name,
                    material_id=item.material_id,
                    material_code=item.material_code,
                    material_name=item.material_name,
                    batch_number=item.batch_number,
                    inspection_quantity=item.delivery_quantity,
                    status="待检验",
                    review_status="待审核",
                    inspection_standard=template.get("inspection_standard"),
                    other_checks=template.get("other_checks"),
                )
                created.append(OQCInspectionResponse.model_validate(row))
        if not created:
            raise BusinessLogicError("没有需要 OQC 的物料行，或均已存在检验单")
        return created


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
