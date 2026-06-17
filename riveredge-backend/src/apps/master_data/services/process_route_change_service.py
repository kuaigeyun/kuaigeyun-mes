"""
工艺路线变更记录服务模块

提供工艺路线变更记录的业务逻辑处理，包括变更申请、审批、执行等功能。

Author: Luigi Lu
Date: 2026-01-27
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from tortoise.expressions import Q

from apps.master_data.models.process_route_change import ProcessRouteChange
from apps.master_data.models.process import ProcessRoute
from apps.master_data.schemas.process_route_change_schemas import (
    ProcessRouteChangeCreate,
    ProcessRouteChangeUpdate,
    ProcessRouteChangeResponse,
    ProcessRouteChangeListResponse,
)
from apps.kuaiplm.services.engineering_change_audit import is_audit_required
from infra.exceptions.exceptions import NotFoundError, ValidationError
from loguru import logger


def _to_process_route_change_response(change: ProcessRouteChange) -> ProcessRouteChangeResponse:
    """ORM 仅存 process_route_id；响应需 process_route_uuid，须从关联路线解析。"""
    process_route = getattr(change, "process_route", None)
    if not process_route:
        raise ValidationError(f"工艺路线变更 {change.uuid} 缺少关联路线，无法返回")
    return ProcessRouteChangeResponse(
        id=change.id,
        uuid=change.uuid,
        tenant_id=change.tenant_id,
        process_route_id=change.process_route_id,
        process_route_uuid=process_route.uuid,
        process_route_code=process_route.code,
        process_route_name=process_route.name,
        change_type=change.change_type,
        change_content=change.change_content,
        change_reason=change.change_reason,
        change_impact=change.change_impact,
        status=change.status,
        approval_comment=change.approval_comment,
        applicant_id=change.applicant_id,
        approver_id=change.approver_id,
        applied_at=change.applied_at,
        created_at=change.created_at,
        updated_at=change.updated_at,
        deleted_at=change.deleted_at,
    )


class ProcessRouteChangeService:
    """
    工艺路线变更记录服务类
    
    提供工艺路线变更记录的 CRUD 操作和变更流程管理。
    """
    
    @staticmethod
    async def create_change(
        tenant_id: int,
        data: ProcessRouteChangeCreate,
        applicant_id: int
    ) -> ProcessRouteChangeResponse:
        """
        创建工艺路线变更记录
        
        Args:
            tenant_id: 租户ID
            data: 变更记录创建数据
            applicant_id: 申请人ID
            
        Returns:
            ProcessRouteChangeResponse: 创建的变更记录对象
            
        Raises:
            NotFoundError: 当工艺路线不存在时抛出
        """
        # 验证工艺路线是否存在
        process_route = await ProcessRoute.filter(
            tenant_id=tenant_id,
            uuid=data.process_route_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not process_route:
            raise NotFoundError("工艺路线", data.process_route_uuid)
        
        # 创建变更记录
        change = await ProcessRouteChange.create(
            tenant_id=tenant_id,
            process_route_id=process_route.id,
            change_type=data.change_type,
            change_content=data.change_content,
            change_reason=data.change_reason,
            change_impact=data.change_impact,
            status="draft",
            approval_comment=data.approval_comment,
            applicant_id=applicant_id,
        )
        
        await change.fetch_related("process_route")
        if data.status in ("pending", "draft"):
            return await ProcessRouteChangeService.submit_change(tenant_id, change.id, applicant_id)
        return _to_process_route_change_response(change)

    @staticmethod
    async def _get_change_or_raise(tenant_id: int, change_id: int) -> ProcessRouteChange:
        change = await ProcessRouteChange.filter(
            tenant_id=tenant_id,
            id=change_id,
            deleted_at__isnull=True,
        ).prefetch_related("process_route").first()
        if not change:
            raise NotFoundError("工艺路线变更记录", str(change_id))
        return change

    @staticmethod
    async def submit_change(
        tenant_id: int,
        change_id: int,
        operator_id: int,
    ) -> ProcessRouteChangeResponse:
        change = await ProcessRouteChangeService._get_change_or_raise(tenant_id, change_id)
        if change.status != "draft":
            raise ValidationError(f"变更记录状态为 {change.status}，无法提交")

        audit_required = await is_audit_required(tenant_id, "process_route")
        change.status = "pending" if audit_required else "approved"
        if not audit_required:
            change.approver_id = operator_id
        await change.save()
        return _to_process_route_change_response(change)

    @staticmethod
    async def withdraw_change(
        tenant_id: int,
        change_id: int,
        operator_id: int,
    ) -> ProcessRouteChangeResponse:
        change = await ProcessRouteChangeService._get_change_or_raise(tenant_id, change_id)
        if change.status != "pending":
            raise ValidationError(f"变更记录状态为 {change.status}，无法撤回")
        change.status = "draft"
        change.approver_id = None
        change.approval_comment = None
        await change.save()
        return _to_process_route_change_response(change)

    @staticmethod
    async def revoke_change(
        tenant_id: int,
        change_id: int,
        operator_id: int,
    ) -> ProcessRouteChangeResponse:
        change = await ProcessRouteChangeService._get_change_or_raise(tenant_id, change_id)
        if change.status != "approved":
            raise ValidationError(f"变更记录状态为 {change.status}，无法反审核")
        change.status = "draft"
        change.approver_id = None
        change.approval_comment = None
        await change.save()
        return _to_process_route_change_response(change)
    
    @staticmethod
    async def get_change_by_uuid(
        tenant_id: int,
        change_uuid: str
    ) -> ProcessRouteChangeResponse:
        """
        根据UUID获取变更记录
        
        Args:
            tenant_id: 租户ID
            change_uuid: 变更记录UUID
            
        Returns:
            ProcessRouteChangeResponse: 变更记录对象
            
        Raises:
            NotFoundError: 当变更记录不存在时抛出
        """
        change = await ProcessRouteChange.filter(
            tenant_id=tenant_id,
            uuid=change_uuid,
            deleted_at__isnull=True
        ).prefetch_related("process_route").first()
        
        if not change:
            raise NotFoundError("工艺路线变更记录", change_uuid)
        
        return _to_process_route_change_response(change)
    
    @staticmethod
    async def list_changes(
        tenant_id: int,
        process_route_uuid: Optional[str] = None,
        change_type: Optional[str] = None,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> ProcessRouteChangeListResponse:
        """
        获取变更记录列表
        
        Args:
            tenant_id: 租户ID
            process_route_uuid: 工艺路线UUID（可选，筛选条件）
            change_type: 变更类型（可选，筛选条件）
            status: 变更状态（可选，筛选条件）
            page: 页码（默认：1）
            page_size: 每页数量（默认：20）
            
        Returns:
            ProcessRouteChangeListResponse: 变更记录列表响应
        """
        query = ProcessRouteChange.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        # 工艺路线筛选
        if process_route_uuid:
            process_route = await ProcessRoute.filter(
                tenant_id=tenant_id,
                uuid=process_route_uuid,
                deleted_at__isnull=True
            ).first()
            if process_route:
                query = query.filter(process_route_id=process_route.id)
        
        # 变更类型筛选
        if change_type:
            query = query.filter(change_type=change_type)
        
        # 状态筛选
        if status:
            query = query.filter(status=status)
        
        # 总数
        total = await query.count()
        
        # 分页查询
        changes = await query.prefetch_related("process_route").offset(
            (page - 1) * page_size
        ).limit(page_size).order_by("-created_at")
        
        items = []
        for change in changes:
            items.append(_to_process_route_change_response(change))
        
        return ProcessRouteChangeListResponse(items=items, total=total)
    
    @staticmethod
    async def update_change(
        tenant_id: int,
        change_uuid: str,
        data: ProcessRouteChangeUpdate
    ) -> ProcessRouteChangeResponse:
        """
        更新变更记录
        
        Args:
            tenant_id: 租户ID
            change_uuid: 变更记录UUID
            data: 变更记录更新数据
            
        Returns:
            ProcessRouteChangeResponse: 更新后的变更记录对象
            
        Raises:
            NotFoundError: 当变更记录不存在时抛出
        """
        change = await ProcessRouteChange.filter(
            tenant_id=tenant_id,
            uuid=change_uuid,
            deleted_at__isnull=True
        ).prefetch_related("process_route").first()
        
        if not change:
            raise NotFoundError("工艺路线变更记录", change_uuid)
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(change, key, value)
        
        await change.save()
        
        return _to_process_route_change_response(change)
    
    @staticmethod
    async def approve_change(
        tenant_id: int,
        change_uuid: str,
        approver_id: int,
        approved: bool,
        approval_comment: Optional[str] = None
    ) -> ProcessRouteChangeResponse:
        """
        审批变更记录
        
        Args:
            tenant_id: 租户ID
            change_uuid: 变更记录UUID
            approver_id: 审批人ID
            approved: 是否同意（True:同意, False:拒绝）
            approval_comment: 审批意见（可选）
            
        Returns:
            ProcessRouteChangeResponse: 更新后的变更记录对象
            
        Raises:
            NotFoundError: 当变更记录不存在时抛出
            ValidationError: 当变更记录状态不允许审批时抛出
        """
        change = await ProcessRouteChange.filter(
            tenant_id=tenant_id,
            uuid=change_uuid,
            deleted_at__isnull=True
        ).prefetch_related("process_route").first()
        
        if not change:
            raise NotFoundError("工艺路线变更记录", change_uuid)
        
        if change.status not in ("pending",):
            raise ValidationError(f"变更记录状态为 {change.status}，无法审批")
        
        # 更新审批信息
        change.status = "approved" if approved else "rejected"
        change.approver_id = approver_id
        if approval_comment:
            change.approval_comment = approval_comment
        
        await change.save()
        
        return _to_process_route_change_response(change)
    
    @staticmethod
    async def execute_change(
        tenant_id: int,
        change_uuid: str,
        executor_id: int
    ) -> ProcessRouteChangeResponse:
        """
        执行变更记录
        
        将已审批的变更记录应用到工艺路线，创建新版本。
        
        Args:
            tenant_id: 租户ID
            change_uuid: 变更记录UUID
            executor_id: 执行人ID
            
        Returns:
            ProcessRouteChangeResponse: 更新后的变更记录对象
            
        Raises:
            NotFoundError: 当变更记录不存在时抛出
            ValidationError: 当变更记录状态不允许执行时抛出
        """
        change = await ProcessRouteChange.filter(
            tenant_id=tenant_id,
            uuid=change_uuid,
            deleted_at__isnull=True
        ).prefetch_related("process_route").first()
        
        if not change:
            raise NotFoundError("工艺路线变更记录", change_uuid)
        
        if change.status != "approved":
            raise ValidationError(f"变更记录状态为 {change.status}，无法执行（需要先审批通过）")
        
        # TODO: 实现变更执行逻辑
        # 1. 创建新版本工艺路线
        # 2. 应用变更内容
        # 3. 更新变更记录状态为已执行
        
        # 更新执行信息
        change.status = "executed"
        change.applied_at = datetime.utcnow()
        await change.save()
        try:
            from apps.kuaizhizao.services.demand_change_event_service import DemandChangeEventService
            await DemandChangeEventService().create_event(
                tenant_id=tenant_id,
                event_type="route",
                source_type="process_route_change",
                source_id=change.id,
                source_code=(change.process_route.code if change.process_route else None),
                source_name=(change.process_route.name if change.process_route else None),
                changed_fields=["process_route_change_executed"],
                payload={
                    "process_route_change_id": change.id,
                    "process_route_id": change.process_route_id,
                    "change_type": change.change_type,
                },
                effective_at=change.applied_at,
                trigger_reason="process_route_change_executed",
                requested_by=executor_id,
                correlation_id=f"process_route_change:{change.id}",
                auto_create_task=True,
            )
        except Exception as e:
            logger.warning("create demand change event for process route failed: %s", e)
        
        return _to_process_route_change_response(change)
    
    @staticmethod
    async def delete_change(
        tenant_id: int,
        change_uuid: str
    ) -> None:
        """
        删除变更记录（软删除）
        
        Args:
            tenant_id: 租户ID
            change_uuid: 变更记录UUID
            
        Raises:
            NotFoundError: 当变更记录不存在时抛出
        """
        change = await ProcessRouteChange.filter(
            tenant_id=tenant_id,
            uuid=change_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not change:
            raise NotFoundError("工艺路线变更记录", change_uuid)
        
        # 软删除
        change.deleted_at = datetime.utcnow()
        await change.save()
