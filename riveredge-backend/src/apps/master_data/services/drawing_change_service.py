"""图纸工程变更：创建 / 签审 / 执行（升版、换文件、作废）。"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from tortoise.expressions import Q

from apps.common.audit_actor import apply_create_audit, apply_update_audit, audit_response_fields
from apps.kuaiplm.services.engineering_change_audit import (
    is_audit_required,
    start_change_approval_flow,
)
from apps.master_data.models.drawing import EngineeringDrawing
from apps.master_data.models.drawing_change import DrawingChange
from apps.master_data.schemas.drawing_change_schemas import (
    DrawingChangeCreate,
    DrawingChangeListResponse,
    DrawingChangeResponse,
)
from apps.master_data.schemas.drawing_schemas import EngineeringDrawingObsoleteRequest, EngineeringDrawingRevisionCreate
from apps.master_data.services.drawing_service import DrawingService
from core.utils.timezone_utils import resolve_business_datetime
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User
from infra.services.user_service import UserService


def _to_response(row: DrawingChange) -> DrawingChangeResponse:
    audit = audit_response_fields(row)
    return DrawingChangeResponse(
        id=row.id,
        uuid=row.uuid,
        tenant_id=row.tenant_id,
        drawing_id=row.drawing_id,
        drawing_uuid=row.drawing_uuid,
        drawing_code=row.drawing_code,
        drawing_name=row.drawing_name,
        drawing_revision=row.drawing_revision,
        change_type=row.change_type,
        change_content=row.change_content,
        change_reason=row.change_reason,
        status=row.status,
        applicant_id=row.applicant_id,
        approval_comment=row.approval_comment,
        applied_at=row.applied_at,
        result_drawing_uuid=row.result_drawing_uuid,
        created_by_name=audit.get("created_by_name"),
        updated_by_name=audit.get("updated_by_name"),
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


class DrawingChangeService:
    @staticmethod
    async def _get_or_404(tenant_id: int, change_uuid: str) -> DrawingChange:
        row = await DrawingChange.get_or_none(
            tenant_id=tenant_id, uuid=change_uuid, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("图纸变更不存在")
        return row

    @staticmethod
    async def _get_change_or_raise(tenant_id: int, change_id: int) -> DrawingChange:
        row = await DrawingChange.get_or_none(
            tenant_id=tenant_id, id=change_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("图纸变更不存在", str(change_id))
        return row

    @staticmethod
    async def create_change(
        tenant_id: int,
        data: DrawingChangeCreate,
        applicant_id: int,
    ) -> DrawingChangeResponse:
        drawing = await EngineeringDrawing.get_or_none(
            tenant_id=tenant_id, uuid=data.drawing_uuid, deleted_at__isnull=True
        )
        if not drawing:
            raise NotFoundError("图纸不存在")
        if (drawing.status or "") != "Released":
            raise ValidationError("仅已发布图纸可发起工程变更")
        applicant = await UserService().get_user_by_id(applicant_id)
        payload: Dict[str, Any] = {
            "tenant_id": tenant_id,
            "drawing_id": drawing.id,
            "drawing_uuid": drawing.uuid,
            "drawing_code": drawing.code,
            "drawing_name": drawing.name,
            "drawing_revision": drawing.revision,
            "change_type": data.change_type,
            "change_content": data.change_content,
            "change_reason": (data.change_reason or "").strip() or None,
            "status": "draft",
            "applicant_id": applicant_id,
        }
        apply_create_audit(payload, applicant)
        row = await DrawingChange.create(**payload)
        return await DrawingChangeService.submit_change(tenant_id, row.uuid, applicant_id)

    @staticmethod
    async def submit_change(
        tenant_id: int, change_uuid: str, operator_id: int
    ) -> DrawingChangeResponse:
        row = await DrawingChangeService._get_or_404(tenant_id, change_uuid)
        if row.status != "draft":
            raise ValidationError(f"变更记录状态为 {row.status}，无法提交")
        audit_required = await is_audit_required(tenant_id, "drawing")
        if audit_required:
            row.status = "pending"
            await row.save()
            await start_change_approval_flow(
                tenant_id,
                "drawing",
                row,
                submitter_id=row.applicant_id or operator_id,
            )
        else:
            row.status = "approved"
            row.approver_id = operator_id
            await row.save()
        return _to_response(row)

    @staticmethod
    async def get_change_by_uuid(tenant_id: int, change_uuid: str) -> DrawingChangeResponse:
        return _to_response(await DrawingChangeService._get_or_404(tenant_id, change_uuid))

    @staticmethod
    async def list_changes(
        tenant_id: int,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
        change_code: Optional[str] = None,
        target_name: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> DrawingChangeListResponse:
        from apps.master_data.services.master_data_list_core import (
            apply_master_crud_created_date_range,
            apply_master_crud_updated_date_range,
        )

        query = DrawingChange.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            query = query.filter(status=status)
        kw = (keyword or "").strip()
        if kw:
            query = query.filter(
                Q(change_reason__icontains=kw)
                | Q(drawing_code__icontains=kw)
                | Q(drawing_name__icontains=kw)
            )
        else:
            if (change_code or "").strip():
                query = query.filter(drawing_code__icontains=change_code.strip())
            if (target_name or "").strip():
                query = query.filter(drawing_name__icontains=target_name.strip())
        query = apply_master_crud_created_date_range(
            query, start_date=created_start_date, end_date=created_end_date
        )
        query = apply_master_crud_updated_date_range(
            query, start_date=updated_start_date, end_date=updated_end_date
        )
        total = await query.count()
        rows = await query.offset((page - 1) * page_size).limit(page_size).order_by("-created_at")
        items: List[DrawingChangeResponse] = []
        for row in rows:
            items.append(_to_response(row))
        return DrawingChangeListResponse(items=items, total=total)

    @staticmethod
    async def approve_change(
        tenant_id: int,
        change_uuid: str,
        approver_id: int,
        approved: bool,
        approval_comment: Optional[str] = None,
    ) -> DrawingChangeResponse:
        from core.services.approval.uni_audit_service import UniAuditService

        row = await DrawingChangeService._get_or_404(tenant_id, change_uuid)
        if row.status != "pending":
            raise ValidationError(f"变更记录状态为 {row.status}，无法审批")

        async def _do_approve() -> DrawingChangeResponse:
            row.status = "approved"
            row.approver_id = approver_id
            if approval_comment:
                row.approval_comment = approval_comment
            await row.save()
            return _to_response(row)

        async def _do_reject(reason: Optional[str]) -> DrawingChangeResponse:
            row.status = "rejected"
            row.approver_id = approver_id
            row.approval_comment = reason or approval_comment or "审批驳回"
            await row.save()
            return _to_response(row)

        if approved:
            result = await UniAuditService.approve_with_flow_fallback(
                tenant_id=tenant_id,
                entity_type="drawing_change",
                entity_id=row.id,
                approver_id=approver_id,
                flow_approve=_do_approve,
            )
        else:
            result = await UniAuditService.reject_with_flow_fallback(
                tenant_id=tenant_id,
                entity_type="drawing_change",
                entity_id=row.id,
                approver_id=approver_id,
                reason=approval_comment or "审批驳回",
                flow_reject=_do_reject,
            )
        if result is not None:
            return result
        return _to_response(await DrawingChangeService._get_or_404(tenant_id, change_uuid))

    @staticmethod
    async def withdraw_change(
        tenant_id: int, change_id: int, operator_id: int
    ) -> DrawingChangeResponse:
        from core.services.approval.uni_audit_service import UniAuditService

        row = await DrawingChangeService._get_change_or_raise(tenant_id, change_id)
        if row.status != "pending":
            raise ValidationError(f"变更记录状态为 {row.status}，无法撤回")

        async def _do_withdraw() -> DrawingChangeResponse:
            row.status = "draft"
            row.approver_id = None
            row.approval_comment = None
            await row.save()
            return _to_response(row)

        result = await UniAuditService.withdraw_with_flow_fallback(
            tenant_id=tenant_id,
            entity_type="drawing_change",
            entity_id=row.id,
            operator_id=operator_id,
            flow_withdraw=_do_withdraw,
        )
        if result is not None:
            return result
        return _to_response(await DrawingChangeService._get_change_or_raise(tenant_id, change_id))

    @staticmethod
    async def revoke_change(
        tenant_id: int, change_id: int, operator_id: int
    ) -> DrawingChangeResponse:
        from core.services.approval.audit_transition import resolve_revoke_landing_phase
        from core.services.approval.uni_audit_service import UniAuditService

        row = await DrawingChangeService._get_change_or_raise(tenant_id, change_id)
        if row.status != "approved":
            raise ValidationError(f"变更记录状态为 {row.status}，无法撤销审核")
        audit_required = await is_audit_required(tenant_id, "drawing")
        landing = resolve_revoke_landing_phase(manual_audit_enabled=audit_required)

        async def _do_revoke() -> DrawingChangeResponse:
            row.status = "pending" if landing == "pending" else "draft"
            row.approver_id = None
            row.approval_comment = None
            await row.save()
            return _to_response(row)

        result = await UniAuditService.revoke_with_flow_fallback(
            tenant_id=tenant_id,
            entity_type="drawing_change",
            entity_id=row.id,
            operator_id=operator_id,
            flow_revoke=_do_revoke,
        )
        if result is not None:
            return result
        return _to_response(await DrawingChangeService._get_change_or_raise(tenant_id, change_id))

    @staticmethod
    async def execute_change(
        tenant_id: int, change_uuid: str, executor: User
    ) -> DrawingChangeResponse:
        row = await DrawingChangeService._get_or_404(tenant_id, change_uuid)
        if row.status != "approved":
            raise ValidationError(f"变更记录状态为 {row.status}，无法执行")
        content = row.change_content if isinstance(row.change_content, dict) else {}
        if row.change_type == "obsolete":
            await DrawingService.obsolete_drawing(
                tenant_id,
                row.drawing_uuid,
                EngineeringDrawingObsoleteRequest(reason=row.change_reason),
            )
        else:
            created = await DrawingService.create_revision(
                tenant_id,
                row.drawing_uuid,
                EngineeringDrawingRevisionCreate(
                    file_uuid=content.get("fileUuid") or content.get("file_uuid"),
                    supplementary_file_uuids=content.get("supplementaryFileUuids")
                    or content.get("supplementary_file_uuids"),
                    description=content.get("description") or row.change_reason,
                ),
                current_user=executor,
            )
            row.result_drawing_uuid = created.uuid
        row.status = "executed"
        row.applied_at = resolve_business_datetime()
        apply_update_audit(row, executor)
        await row.save()
        return _to_response(row)

    @staticmethod
    async def delete_change(tenant_id: int, change_uuid: str) -> None:
        row = await DrawingChangeService._get_or_404(tenant_id, change_uuid)
        if row.status == "executed":
            raise ValidationError("已执行的变更不能删除")
        row.deleted_at = resolve_business_datetime()
        await row.save()
