"""交付节点汇报服务"""

from __future__ import annotations

from decimal import Decimal
from typing import Optional

from tortoise.transactions import in_transaction

from apps.common.audit_actor import apply_create_audit, apply_update_audit, operator_name_from_user
from apps.common.base_service import AppBaseService
from apps.kuaizhizao.constants.delivery_project import (
    DeliveryNodeReportStatus,
    DeliveryNodeStatus,
)
from apps.kuaizhizao.models.delivery_project import DeliveryNodeReport, DeliveryProjectNode
from apps.kuaizhizao.schemas.delivery_project import (
    DeliveryNodeReportCreate,
    DeliveryNodeReportListEnvelope,
    DeliveryNodeReportResponse,
    DeliveryNodeReportReviewRequest,
    DeliveryNodeReportUpdate,
)
from apps.kuaizhizao.services.delivery_project_service import DeliveryProjectService
from core.utils.timezone_utils import resolve_business_datetime, today_site_str, to_site_date
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User


DELIVERY_NODE_REPORT_SORTABLE_FIELDS = frozenset({
    "report_code",
    "report_date",
    "status",
    "created_at",
})


class DeliveryNodeReportService(AppBaseService[DeliveryNodeReport]):
    def __init__(self):
        super().__init__(DeliveryNodeReport)
        self._project_service = DeliveryProjectService()

    async def _generate_report_code(self, tenant_id: int) -> str:
        try:
            return await self.generate_code(
                tenant_id,
                "DELIVERY_NODE_REPORT_CODE",
                prefix=f"DNR{today_site_str()}",
            )
        except Exception:
            import uuid

            return f"DNR{today_site_str()}{uuid.uuid4().hex[:4].upper()}"

    async def _get_or_404(self, tenant_id: int, report_id: int) -> DeliveryNodeReport:
        row = await DeliveryNodeReport.get_or_none(
            tenant_id=tenant_id, id=report_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError(f"节点汇报不存在: {report_id}")
        return row

    async def _to_response(self, row: DeliveryNodeReport) -> DeliveryNodeReportResponse:
        return DeliveryNodeReportResponse.model_validate(row)

    async def create_report(
        self,
        tenant_id: int,
        body: DeliveryNodeReportCreate,
        current_user: User,
    ) -> DeliveryNodeReportResponse:
        project = await self._project_service._get_or_404(tenant_id, body.project_id)
        node = await DeliveryProjectNode.get_or_none(
            tenant_id=tenant_id, id=body.node_id, project_id=body.project_id
        )
        if not node:
            raise ValidationError(f"节点不存在: {body.node_id}")
        code = await self._generate_report_code(tenant_id)
        row = DeliveryNodeReport(
            tenant_id=tenant_id,
            report_code=code,
            project_id=project.id,
            project_code=project.project_code,
            node_id=node.id,
            node_key=node.node_key,
            node_name=node.node_name,
            reporter_id=current_user.id,
            reporter_name=operator_name_from_user(current_user),
            report_date=body.report_date,
            progress_percent=body.progress_percent,
            content=body.content,
            attachments=body.attachments,
            status=DeliveryNodeReportStatus.DRAFT.value,
        )
        apply_create_audit(row, current_user)
        await row.save()
        return await self._to_response(row)

    async def list_reports(
        self,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 50,
        project_id: Optional[int] = None,
        node_id: Optional[int] = None,
        node_key: Optional[str] = None,
        status: Optional[str] = None,
        order_by: Optional[str] = None,
    ) -> DeliveryNodeReportListEnvelope:
        qs = DeliveryNodeReport.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if project_id:
            qs = qs.filter(project_id=project_id)
        if node_id:
            qs = qs.filter(node_id=node_id)
        if node_key:
            qs = qs.filter(node_key=node_key)
        if status:
            qs = qs.filter(status=status)
        order_field = "-created_at"
        if order_by:
            field = order_by.lstrip("-")
            if field in DELIVERY_NODE_REPORT_SORTABLE_FIELDS:
                order_field = order_by
        total = await qs.count()
        rows = await qs.order_by(order_field).offset(skip).limit(limit)
        return DeliveryNodeReportListEnvelope(
            items=[await self._to_response(r) for r in rows],
            total=total,
        )

    async def get_report(self, tenant_id: int, report_id: int) -> DeliveryNodeReportResponse:
        return await self._to_response(await self._get_or_404(tenant_id, report_id))

    async def update_report(
        self,
        tenant_id: int,
        report_id: int,
        body: DeliveryNodeReportUpdate,
        current_user: User,
    ) -> DeliveryNodeReportResponse:
        row = await self._get_or_404(tenant_id, report_id)
        if row.status != DeliveryNodeReportStatus.DRAFT.value:
            raise ValidationError("仅草稿可编辑")
        if body.report_date is not None:
            row.report_date = body.report_date
        if body.progress_percent is not None:
            row.progress_percent = body.progress_percent
        if body.content is not None:
            row.content = body.content
        if body.attachments is not None:
            row.attachments = body.attachments
        apply_update_audit(row, current_user)
        await row.save()
        return await self._to_response(row)

    async def submit_report(self, tenant_id: int, report_id: int, current_user: User) -> DeliveryNodeReportResponse:
        row = await self._get_or_404(tenant_id, report_id)
        if row.status != DeliveryNodeReportStatus.DRAFT.value:
            raise ValidationError("仅草稿可提交")
        row.status = DeliveryNodeReportStatus.SUBMITTED.value
        apply_update_audit(row, current_user)
        await row.save()
        return await self._to_response(row)

    async def review_report(
        self,
        tenant_id: int,
        report_id: int,
        body: DeliveryNodeReportReviewRequest,
        current_user: User,
    ) -> DeliveryNodeReportResponse:
        row = await self._get_or_404(tenant_id, report_id)
        if row.status != DeliveryNodeReportStatus.SUBMITTED.value:
            raise ValidationError("仅已提交汇报可审核")
        async with in_transaction():
            if body.approved:
                row.status = DeliveryNodeReportStatus.APPROVED.value
                node = await DeliveryProjectNode.get_or_none(
                    tenant_id=tenant_id, id=row.node_id, project_id=row.project_id
                )
                if node:
                    node.progress_percent = row.progress_percent
                    if row.progress_percent >= Decimal("100"):
                        node.status = DeliveryNodeStatus.COMPLETED.value
                        node.actual_end_date = to_site_date(resolve_business_datetime())
                    elif node.status == DeliveryNodeStatus.NOT_STARTED.value:
                        node.status = DeliveryNodeStatus.IN_PROGRESS.value
                        node.actual_start_date = to_site_date(resolve_business_datetime())
                    await node.save()
                    project = await self._project_service._get_or_404(tenant_id, row.project_id)
                    nodes = await self._project_service._load_nodes(tenant_id, row.project_id)
                    await self._project_service._sync_project_progress(project, nodes)
            else:
                row.status = DeliveryNodeReportStatus.REJECTED.value
            row.reviewer_id = current_user.id
            row.reviewer_name = operator_name_from_user(current_user)
            row.reviewed_at = resolve_business_datetime()
            row.review_notes = body.review_notes
            apply_update_audit(row, current_user)
            await row.save()
        return await self._to_response(row)

    async def delete_report(self, tenant_id: int, report_id: int, current_user: User) -> None:
        row = await self._get_or_404(tenant_id, report_id)
        if row.status != DeliveryNodeReportStatus.DRAFT.value:
            raise ValidationError("仅草稿可删除")
        row.deleted_at = resolve_business_datetime()
        apply_update_audit(row, current_user)
        await row.save()
