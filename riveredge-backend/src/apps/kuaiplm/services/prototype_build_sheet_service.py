"""样机制作书服务（研发项目 §2.15）"""

from __future__ import annotations

from typing import Any, List, Optional

from apps.common.audit_actor import apply_create_audit, apply_update_audit
from apps.common.base_service import AppBaseService
from apps.kuaiplm.models.prototype_build_sheet import (
    PROTOTYPE_BUILD_ROUNDS,
    PrototypeBuildSheet,
)
from apps.kuaiplm.models.rd_project import RdProject
from apps.kuaiplm.schemas.prototype_build_sheet import (
    PrototypeBuildAttachment,
    PrototypeBuildSectionUpdate,
    PrototypeBuildSheetCreate,
    PrototypeBuildSheetListResponse,
    PrototypeBuildSheetResponse,
    PrototypeBuildSheetUpdate,
    PrototypeBuildSignoffUpdate,
)
from core.services.approval.approval_instance_service import ApprovalInstanceService
from core.services.approval.audit_binding_service import AuditBindingService
from core.utils.timezone_utils import resolve_business_datetime
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User

AUDIT_NODE = "prototype_build_sheet"
ALLOWED_STATUS = {"draft", "pending", "approved", "issued", "closed", "rejected"}
SECTION_KEYS = frozenset({"electronics", "structure"})


class PrototypeBuildSheetService(AppBaseService[PrototypeBuildSheet]):
    code_field = "sheet_code"
    rule_code = "KUAI_PLM_PROTOTYPE_BUILD_SHEET_CODE"
    code_prefix = "YJZZ"

    def __init__(self) -> None:
        super().__init__(PrototypeBuildSheet)
        self.model = PrototypeBuildSheet

    async def _ensure_code(self, tenant_id: int, code: Optional[str]) -> str:
        raw = (code or "").strip()
        if raw:
            return raw
        return await self.generate_code(tenant_id, self.rule_code, prefix=self.code_prefix)

    async def _require_project(self, tenant_id: int, project_id: int) -> RdProject:
        project = await RdProject.filter(
            tenant_id=tenant_id, id=project_id, deleted_at__isnull=True
        ).first()
        if not project:
            raise ValidationError("研发项目不存在")
        return project

    async def _get_row(self, tenant_id: int, sheet_id: int) -> PrototypeBuildSheet:
        row = await PrototypeBuildSheet.filter(
            tenant_id=tenant_id, id=sheet_id, deleted_at__isnull=True
        ).first()
        if not row:
            raise NotFoundError("样机制作书不存在")
        return row

    def _normalize_round(self, round_key: str) -> str:
        raw = (round_key or "t1").strip().lower()
        if raw not in PROTOTYPE_BUILD_ROUNDS:
            raise ValidationError(f"非法样机轮次: {round_key}")
        return raw

    def _normalize_attachments(
        self, raw: List[PrototypeBuildAttachment] | None
    ) -> List[dict[str, Any]]:
        if not raw:
            return []
        out: List[dict[str, Any]] = []
        for item in raw:
            if isinstance(item, PrototypeBuildAttachment):
                data = item.model_dump()
            elif isinstance(item, dict):
                data = item
            else:
                raise ValidationError("附件格式非法")
            fuuid = str(data.get("file_uuid") or "").strip()
            if not fuuid:
                raise ValidationError("附件须包含 file_uuid")
            kind = str(data.get("media_kind") or "file").strip() or "file"
            if kind not in {"text", "image", "file"}:
                raise ValidationError(f"非法附件类型: {kind}")
            out.append(
                {
                    "file_uuid": fuuid,
                    "file_name": (str(data.get("file_name") or "").strip() or None),
                    "media_kind": kind,
                }
            )
        return out

    def _section_ready(self, requirements: Optional[str], attachments: List[dict]) -> bool:
        if requirements and str(requirements).strip():
            return True
        return len(attachments) > 0

    async def create(
        self, tenant_id: int, payload: PrototypeBuildSheetCreate, user: User
    ) -> PrototypeBuildSheetResponse:
        project = await self._require_project(tenant_id, payload.project_id)
        code = await self._ensure_code(tenant_id, payload.sheet_code)
        exists = await PrototypeBuildSheet.filter(
            tenant_id=tenant_id, sheet_code=code, deleted_at__isnull=True
        ).exists()
        if exists:
            raise BusinessLogicError("样机制作书单号已存在")

        row = PrototypeBuildSheet(
            tenant_id=tenant_id,
            sheet_code=code,
            project_id=project.id,
            project_code=project.project_code,
            project_name=project.project_name,
            round_key=self._normalize_round(payload.round_key),
            title=payload.title.strip(),
            status="draft",
            project_requirements=payload.project_requirements,
            project_attachments=self._normalize_attachments(payload.project_attachments),
            remarks=payload.remarks,
        )
        apply_create_audit(row, user)
        await row.save()
        return PrototypeBuildSheetResponse.model_validate(row)

    async def list(
        self,
        tenant_id: int,
        *,
        keyword: Optional[str] = None,
        status: Optional[str] = None,
        project_id: Optional[int] = None,
        round_key: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> PrototypeBuildSheetListResponse:
        query = PrototypeBuildSheet.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if project_id:
            query = query.filter(project_id=project_id)
        if status:
            if status not in ALLOWED_STATUS:
                raise ValidationError(f"非法状态: {status}")
            query = query.filter(status=status)
        if round_key:
            query = query.filter(round_key=self._normalize_round(round_key))
        if keyword:
            query = query.filter(title__icontains=keyword)
        total = await query.count()
        rows = await query.order_by("-updated_at", "-id").offset(skip).limit(limit)
        from apps.kuaiplm.schemas.prototype_build_sheet import PrototypeBuildSheetListItem

        return PrototypeBuildSheetListResponse(
            items=[PrototypeBuildSheetListItem.model_validate(r) for r in rows],
            total=total,
        )

    async def get(self, tenant_id: int, sheet_id: int) -> PrototypeBuildSheetResponse:
        row = await self._get_row(tenant_id, sheet_id)
        return PrototypeBuildSheetResponse.model_validate(row)

    async def update(
        self,
        tenant_id: int,
        sheet_id: int,
        payload: PrototypeBuildSheetUpdate,
        user: User,
    ) -> PrototypeBuildSheetResponse:
        row = await self._get_row(tenant_id, sheet_id)
        if row.status not in {"draft", "rejected"}:
            raise BusinessLogicError("仅草稿或已驳回状态可编辑项目区")
        if payload.title is not None:
            row.title = payload.title.strip()
        if payload.project_requirements is not None:
            row.project_requirements = payload.project_requirements
        if payload.project_attachments is not None:
            row.project_attachments = self._normalize_attachments(payload.project_attachments)
        if payload.remarks is not None:
            row.remarks = payload.remarks
        apply_update_audit(row, user)
        await row.save()
        return PrototypeBuildSheetResponse.model_validate(row)

    async def update_section(
        self,
        tenant_id: int,
        sheet_id: int,
        section: str,
        payload: PrototypeBuildSectionUpdate,
        user: User,
    ) -> PrototypeBuildSheetResponse:
        key = (section or "").strip().lower()
        if key not in SECTION_KEYS:
            raise ValidationError(f"非法分区: {section}")
        row = await self._get_row(tenant_id, sheet_id)
        if row.status not in {"draft", "pending", "rejected"}:
            raise BusinessLogicError("当前状态不可编辑分区要求")
        attachments = self._normalize_attachments(payload.attachments)
        ready = self._section_ready(payload.requirements, attachments)
        if key == "electronics":
            row.electronics_requirements = payload.requirements
            row.electronics_attachments = attachments
            row.electronics_status = "ready" if ready else "draft"
        else:
            row.structure_requirements = payload.requirements
            row.structure_attachments = attachments
            row.structure_status = "ready" if ready else "draft"
        apply_update_audit(row, user)
        await row.save()
        return PrototypeBuildSheetResponse.model_validate(row)

    async def update_signoff(
        self,
        tenant_id: int,
        sheet_id: int,
        payload: PrototypeBuildSignoffUpdate,
        user: User,
    ) -> PrototypeBuildSheetResponse:
        row = await self._get_row(tenant_id, sheet_id)
        if row.status not in {"approved", "issued", "closed"}:
            raise BusinessLogicError("审核下发后才可填写制造/质量会签意见")
        if payload.manufacturing_opinion is not None:
            row.manufacturing_opinion = payload.manufacturing_opinion
        if payload.quality_opinion is not None:
            row.quality_opinion = payload.quality_opinion
        apply_update_audit(row, user)
        await row.save()
        return PrototypeBuildSheetResponse.model_validate(row)

    async def submit(self, tenant_id: int, sheet_id: int, user: User) -> PrototypeBuildSheetResponse:
        row = await self._get_row(tenant_id, sheet_id)
        if row.status not in {"draft", "rejected"}:
            raise BusinessLogicError("仅草稿或已驳回可提交")
        if not self._section_ready(row.project_requirements, list(row.project_attachments or [])):
            raise ValidationError("请先填写项目侧相关要求")
        if row.electronics_status != "ready" or row.structure_status != "ready":
            raise ValidationError("电子与结构分区均须填写完成后再提交")
        row.status = "pending"
        row.submitted_at = resolve_business_datetime()
        apply_update_audit(row, user)
        await row.save()

        approval_instance = None
        if await AuditBindingService.is_audit_enabled(tenant_id, AUDIT_NODE):
            approval_instance = await ApprovalInstanceService.start_approval_for_node(
                tenant_id=tenant_id,
                user_id=user.id,
                node_key=AUDIT_NODE,
                entity_type=AUDIT_NODE,
                entity_id=row.id,
                entity_uuid=str(row.uuid),
                title=f"样机制作书 {row.sheet_code}",
                content=row.project_requirements or row.title,
                business_type=row.round_key,
                send_notification=True,
            )
            if approval_instance is None:
                raise ValidationError(
                    f"审核已开启但未找到可用审批流程，请检查 {AUDIT_NODE} 绑定"
                )
        from apps.kuaiplm.services.plm_audit_flow_sync import submit_instance_auto_passed

        if submit_instance_auto_passed(approval_instance):
            return await self.approve(tenant_id, sheet_id, user)
        return PrototypeBuildSheetResponse.model_validate(row)

    async def approve(self, tenant_id: int, sheet_id: int, user: User) -> PrototypeBuildSheetResponse:
        row = await self._get_row(tenant_id, sheet_id)
        if row.status != "pending":
            raise BusinessLogicError("仅待审状态可批准")
        from apps.kuaiplm.services.plm_audit_flow_sync import assert_plm_manual_approval_action

        await assert_plm_manual_approval_action(
            tenant_id,
            audit_node=AUDIT_NODE,
            entity_type=AUDIT_NODE,
            entity_id=sheet_id,
            doc_label="样机制作书",
            verb="审核",
        )
        row.status = "approved"
        row.approved_at = resolve_business_datetime()
        apply_update_audit(row, user)
        await row.save()
        return PrototypeBuildSheetResponse.model_validate(row)

    async def reject(self, tenant_id: int, sheet_id: int, user: User) -> PrototypeBuildSheetResponse:
        row = await self._get_row(tenant_id, sheet_id)
        if row.status != "pending":
            raise BusinessLogicError("仅待审状态可驳回")
        from apps.kuaiplm.services.plm_audit_flow_sync import assert_plm_manual_approval_action

        await assert_plm_manual_approval_action(
            tenant_id,
            audit_node=AUDIT_NODE,
            entity_type=AUDIT_NODE,
            entity_id=sheet_id,
            doc_label="样机制作书",
            verb="驳回",
        )
        row.status = "rejected"
        apply_update_audit(row, user)
        await row.save()
        return PrototypeBuildSheetResponse.model_validate(row)

    async def issue(self, tenant_id: int, sheet_id: int, user: User) -> PrototypeBuildSheetResponse:
        row = await self._get_row(tenant_id, sheet_id)
        if row.status != "approved":
            raise BusinessLogicError("仅已批准状态可下发制造样机组")
        row.status = "issued"
        row.issued_at = resolve_business_datetime()
        apply_update_audit(row, user)
        await row.save()
        return PrototypeBuildSheetResponse.model_validate(row)

    async def close(self, tenant_id: int, sheet_id: int, user: User) -> PrototypeBuildSheetResponse:
        row = await self._get_row(tenant_id, sheet_id)
        if row.status not in {"issued", "approved"}:
            raise BusinessLogicError("仅已下发状态可关闭")
        if not (row.manufacturing_opinion and str(row.manufacturing_opinion).strip()):
            raise ValidationError("制造会签意见必填")
        if not (row.quality_opinion and str(row.quality_opinion).strip()):
            raise ValidationError("质量会签意见必填")
        row.status = "closed"
        row.closed_at = resolve_business_datetime()
        apply_update_audit(row, user)
        await row.save()
        return PrototypeBuildSheetResponse.model_validate(row)

    async def delete(self, tenant_id: int, sheet_id: int, user: User) -> None:
        row = await self._get_row(tenant_id, sheet_id)
        if row.status not in {"draft", "rejected"}:
            raise BusinessLogicError("仅草稿或已驳回可删除")
        row.deleted_at = resolve_business_datetime()
        apply_update_audit(row, user)
        await row.save()
