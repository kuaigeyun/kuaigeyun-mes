"""
BOM 工程变更记录服务模块

提供 BOM 工程变更（ECN）的业务逻辑处理，包括变更申请、审批、执行等功能。

Author: AI Assistant
Date: 2026-03-16
"""

from typing import List, Optional
from datetime import datetime

from apps.master_data.models.bom_change import BOMChange
from apps.master_data.models.material import Material
from apps.master_data.schemas.bom_change_schemas import (
    BOMChangeCreate,
    BOMChangeUpdate,
    BOMChangeResponse,
    BOMChangeListResponse,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError
from loguru import logger


def _to_bom_change_response(change: BOMChange) -> BOMChangeResponse:
    """ORM 仅存 material_id；响应需 material_uuid，须从关联物料解析。"""
    material = getattr(change, "material", None)
    if not material:
        raise ValidationError(f"BOM 工程变更 {change.uuid} 缺少关联物料，无法返回")
    return BOMChangeResponse(
        id=change.id,
        uuid=change.uuid,
        tenant_id=change.tenant_id,
        material_id=change.material_id,
        material_uuid=material.uuid,
        material_code=material.main_code,
        material_name=material.name,
        change_type=change.change_type,
        change_content=change.change_content,
        change_reason=change.change_reason,
        change_impact=change.change_impact,
        status=change.status,
        approval_comment=change.approval_comment,
        bom_code=change.bom_code,
        from_version=change.from_version,
        to_version=change.to_version,
        applicant_id=change.applicant_id,
        approver_id=change.approver_id,
        applied_at=change.applied_at,
        created_at=change.created_at,
        updated_at=change.updated_at,
        deleted_at=change.deleted_at,
    )


class BOMChangeService:
    """BOM 工程变更记录服务类"""

    @staticmethod
    async def create_change(
        tenant_id: int,
        data: BOMChangeCreate,
        applicant_id: int,
    ) -> BOMChangeResponse:
        """创建 BOM 工程变更记录"""
        material = await Material.filter(
            tenant_id=tenant_id,
            uuid=data.material_uuid,
            deleted_at__isnull=True,
        ).first()

        if not material:
            raise NotFoundError("物料", data.material_uuid)

        change = await BOMChange.create(
            tenant_id=tenant_id,
            material_id=material.id,
            change_type=data.change_type,
            change_content=data.change_content,
            change_reason=data.change_reason,
            change_impact=data.change_impact,
            status="draft",
            approval_comment=data.approval_comment,
            bom_code=data.bom_code,
            from_version=data.from_version,
            to_version=data.to_version,
            applicant_id=applicant_id,
        )

        await change.fetch_related("material")
        if data.status in ("pending", "draft"):
            return await BOMChangeService.submit_change(tenant_id, change.id, applicant_id)
        return _to_bom_change_response(change)

    @staticmethod
    async def _get_change_or_raise(tenant_id: int, change_id: int) -> BOMChange:
        change = await BOMChange.filter(
            tenant_id=tenant_id,
            id=change_id,
            deleted_at__isnull=True,
        ).prefetch_related("material").first()
        if not change:
            raise NotFoundError("BOM 工程变更记录", str(change_id))
        return change

    @staticmethod
    async def submit_change(
        tenant_id: int,
        change_id: int,
        operator_id: int,
    ) -> BOMChangeResponse:
        """提交变更（草稿 → 待审批 / 已审批），待审批时自动启动审批流。"""
        change = await BOMChangeService._get_change_or_raise(tenant_id, change_id)
        if change.status != "draft":
            raise ValidationError(f"变更记录状态为 {change.status}，无法提交")

        from apps.kuaiplm.services.engineering_change_audit import (
            is_audit_required,
            start_change_approval_flow,
        )

        audit_required = await is_audit_required(tenant_id, "bom")
        if audit_required:
            change.status = "pending"
            await change.save()
            submitter_id = change.applicant_id or operator_id
            await start_change_approval_flow(
                tenant_id,
                "bom",
                change,
                submitter_id=submitter_id,
            )
        else:
            change.status = "approved"
            change.approver_id = operator_id
            await change.save()
        return _to_bom_change_response(change)

    @staticmethod
    async def withdraw_change(
        tenant_id: int,
        change_id: int,
        operator_id: int,
    ) -> BOMChangeResponse:
        """撤回待审批变更。"""
        from core.services.approval.uni_audit_service import UniAuditService

        change = await BOMChangeService._get_change_or_raise(tenant_id, change_id)
        if change.status != "pending":
            raise ValidationError(f"变更记录状态为 {change.status}，无法撤回")

        async def _do_withdraw() -> BOMChangeResponse:
            change.status = "draft"
            change.approver_id = None
            change.approval_comment = None
            await change.save()
            return _to_bom_change_response(change)

        result = await UniAuditService.withdraw_with_flow_fallback(
            tenant_id=tenant_id,
            entity_type="bom_change",
            entity_id=change.id,
            operator_id=operator_id,
            flow_withdraw=_do_withdraw,
        )
        return result if result is not None else _to_bom_change_response(change)

    @staticmethod
    async def revoke_change(
        tenant_id: int,
        change_id: int,
        operator_id: int,
    ) -> BOMChangeResponse:
        """反审核已审批且未执行的变更。"""
        from core.services.approval.uni_audit_service import UniAuditService

        change = await BOMChangeService._get_change_or_raise(tenant_id, change_id)
        if change.status != "approved":
            raise ValidationError(f"变更记录状态为 {change.status}，无法反审核")

        async def _do_revoke() -> BOMChangeResponse:
            change.status = "draft"
            change.approver_id = None
            change.approval_comment = None
            await change.save()
            return _to_bom_change_response(change)

        result = await UniAuditService.revoke_with_flow_fallback(
            tenant_id=tenant_id,
            entity_type="bom_change",
            entity_id=change.id,
            operator_id=operator_id,
            flow_revoke=_do_revoke,
        )
        return result if result is not None else _to_bom_change_response(change)

    @staticmethod
    async def get_change_by_uuid(
        tenant_id: int,
        change_uuid: str,
    ) -> BOMChangeResponse:
        """根据 UUID 获取变更记录"""
        change = await BOMChange.filter(
            tenant_id=tenant_id,
            uuid=change_uuid,
            deleted_at__isnull=True,
        ).prefetch_related("material").first()

        if not change:
            raise NotFoundError("BOM 工程变更记录", change_uuid)

        return _to_bom_change_response(change)

    @staticmethod
    async def list_changes(
        tenant_id: int,
        material_uuid: Optional[str] = None,
        change_type: Optional[str] = None,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> BOMChangeListResponse:
        """获取变更记录列表"""
        query = BOMChange.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )

        if material_uuid:
            material = await Material.filter(
                tenant_id=tenant_id,
                uuid=material_uuid,
                deleted_at__isnull=True,
            ).first()
            if material:
                query = query.filter(material_id=material.id)

        if change_type:
            query = query.filter(change_type=change_type)
        if status:
            query = query.filter(status=status)

        total = await query.count()
        changes = await query.prefetch_related("material").offset(
            (page - 1) * page_size
        ).limit(page_size).order_by("-created_at")

        items = []
        for change in changes:
            if change.status == "pending":
                from apps.kuaiplm.services.engineering_change_audit import (
                    ensure_pending_change_approval_instance,
                )

                await ensure_pending_change_approval_instance(tenant_id, "bom", change)
            items.append(_to_bom_change_response(change))

        return BOMChangeListResponse(items=items, total=total)

    @staticmethod
    async def update_change(
        tenant_id: int,
        change_uuid: str,
        data: BOMChangeUpdate,
    ) -> BOMChangeResponse:
        """更新变更记录"""
        change = await BOMChange.filter(
            tenant_id=tenant_id,
            uuid=change_uuid,
            deleted_at__isnull=True,
        ).prefetch_related("material").first()

        if not change:
            raise NotFoundError("BOM 工程变更记录", change_uuid)

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(change, key, value)

        await change.save()

        return _to_bom_change_response(change)

    @staticmethod
    async def _apply_approval_decision(
        tenant_id: int,
        change_uuid: str,
        approver_id: int,
        approved: bool,
        approval_comment: Optional[str] = None,
    ) -> BOMChangeResponse:
        change = await BOMChange.filter(
            tenant_id=tenant_id,
            uuid=change_uuid,
            deleted_at__isnull=True,
        ).prefetch_related("material").first()

        if not change:
            raise NotFoundError("BOM 工程变更记录", change_uuid)

        if change.status not in ("pending",):
            raise ValidationError(f"变更记录状态为 {change.status}，无法审批")

        change.status = "approved" if approved else "rejected"
        change.approver_id = approver_id
        if approval_comment:
            change.approval_comment = approval_comment

        await change.save()
        return _to_bom_change_response(change)

    @staticmethod
    async def approve_change(
        tenant_id: int,
        change_uuid: str,
        approver_id: int,
        approved: bool,
        approval_comment: Optional[str] = None,
    ) -> BOMChangeResponse:
        """审批变更记录（优先走平台审批流）。"""
        from core.services.approval.uni_audit_service import UniAuditService

        change = await BOMChange.filter(
            tenant_id=tenant_id,
            uuid=change_uuid,
            deleted_at__isnull=True,
        ).prefetch_related("material").first()

        if not change:
            raise NotFoundError("BOM 工程变更记录", change_uuid)

        if change.status not in ("pending",):
            raise ValidationError(f"变更记录状态为 {change.status}，无法审批")

        async def _do_approve() -> BOMChangeResponse:
            return await BOMChangeService._apply_approval_decision(
                tenant_id, change_uuid, approver_id, True, approval_comment
            )

        async def _do_reject(reason: Optional[str]) -> BOMChangeResponse:
            return await BOMChangeService._apply_approval_decision(
                tenant_id,
                change_uuid,
                approver_id,
                False,
                reason or approval_comment or "审批驳回",
            )

        if approved:
            result = await UniAuditService.approve_with_flow_fallback(
                tenant_id=tenant_id,
                entity_type="bom_change",
                entity_id=change.id,
                approver_id=approver_id,
                flow_approve=_do_approve,
            )
        else:
            result = await UniAuditService.reject_with_flow_fallback(
                tenant_id=tenant_id,
                entity_type="bom_change",
                entity_id=change.id,
                approver_id=approver_id,
                reason=approval_comment or "审批驳回",
                flow_reject=_do_reject,
            )
        if result is not None:
            return result
        refreshed = await BOMChange.filter(
            tenant_id=tenant_id,
            uuid=change_uuid,
            deleted_at__isnull=True,
        ).prefetch_related("material").first()
        if not refreshed:
            raise NotFoundError("BOM 工程变更记录", change_uuid)
        return _to_bom_change_response(refreshed)

    @staticmethod
    async def execute_change(
        tenant_id: int,
        change_uuid: str,
        executor_id: int,
    ) -> BOMChangeResponse:
        """执行变更记录（将已审批的变更标记为已执行）"""
        change = await BOMChange.filter(
            tenant_id=tenant_id,
            uuid=change_uuid,
            deleted_at__isnull=True,
        ).prefetch_related("material").first()

        if not change:
            raise NotFoundError("BOM 工程变更记录", change_uuid)

        if change.status != "approved":
            raise ValidationError(f"变更记录状态为 {change.status}，无法执行（需要先审批通过）")

        # 变更执行：实际 BOM 修改已在 BOM 升版/编辑时完成，此处仅更新状态
        change.status = "executed"
        change.applied_at = datetime.utcnow()
        await change.save()
        try:
            from apps.kuaizhizao.services.demand_change_event_service import DemandChangeEventService
            await DemandChangeEventService().create_event(
                tenant_id=tenant_id,
                event_type="design",
                source_type="bom_change",
                source_id=change.id,
                source_code=change.bom_code,
                source_name=(change.material.name if change.material else change.bom_code),
                changed_fields=["bom_change_executed"],
                payload={
                    "bom_change_id": change.id,
                    "material_id": change.material_id,
                    "from_version": change.from_version,
                    "to_version": change.to_version,
                },
                effective_at=change.applied_at,
                trigger_reason="bom_change_executed",
                requested_by=executor_id,
                correlation_id=f"bom_change:{change.id}",
                auto_create_task=True,
            )
        except Exception as e:
            logger.warning("create demand change event for bom change failed: %s", e)

        return _to_bom_change_response(change)

    @staticmethod
    async def delete_change(
        tenant_id: int,
        change_uuid: str,
    ) -> None:
        """删除变更记录（软删除）"""
        change = await BOMChange.filter(
            tenant_id=tenant_id,
            uuid=change_uuid,
            deleted_at__isnull=True,
        ).first()

        if not change:
            raise NotFoundError("BOM 工程变更记录", change_uuid)

        change.deleted_at = datetime.utcnow()
        await change.save()
