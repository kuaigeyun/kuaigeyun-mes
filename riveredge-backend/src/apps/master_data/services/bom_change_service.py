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
            status=data.status,
            approval_comment=data.approval_comment,
            bom_code=data.bom_code,
            from_version=data.from_version,
            to_version=data.to_version,
            applicant_id=applicant_id,
        )

        await change.fetch_related("material")
        response = BOMChangeResponse.model_validate(change)
        if change.material:
            response.material_code = change.material.main_code
            response.material_name = change.material.name
        return response

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

        response = BOMChangeResponse.model_validate(change)
        if change.material:
            response.material_code = change.material.main_code
            response.material_name = change.material.name
        return response

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
            response = BOMChangeResponse.model_validate(change)
            if change.material:
                response.material_code = change.material.main_code
                response.material_name = change.material.name
            items.append(response)

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

        response = BOMChangeResponse.model_validate(change)
        if change.material:
            response.material_code = change.material.main_code
            response.material_name = change.material.name
        return response

    @staticmethod
    async def approve_change(
        tenant_id: int,
        change_uuid: str,
        approver_id: int,
        approved: bool,
        approval_comment: Optional[str] = None,
    ) -> BOMChangeResponse:
        """审批变更记录"""
        change = await BOMChange.filter(
            tenant_id=tenant_id,
            uuid=change_uuid,
            deleted_at__isnull=True,
        ).prefetch_related("material").first()

        if not change:
            raise NotFoundError("BOM 工程变更记录", change_uuid)

        if change.status != "pending":
            raise ValidationError(f"变更记录状态为 {change.status}，无法审批")

        change.status = "approved" if approved else "rejected"
        change.approver_id = approver_id
        if approval_comment:
            change.approval_comment = approval_comment

        await change.save()

        response = BOMChangeResponse.model_validate(change)
        if change.material:
            response.material_code = change.material.main_code
            response.material_name = change.material.name
        return response

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

        response = BOMChangeResponse.model_validate(change)
        if change.material:
            response.material_code = change.material.main_code
            response.material_name = change.material.name
        return response

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
