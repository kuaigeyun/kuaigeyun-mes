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
from infra.exceptions.exceptions import NotFoundError, ValidationError
from loguru import logger


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
            status=data.status,
            approval_comment=data.approval_comment,
            applicant_id=applicant_id,
        )
        
        # 加载关联数据
        await change.fetch_related("process_route")
        
        response = ProcessRouteChangeResponse.model_validate(change)
        if change.process_route:
            response.process_route_code = change.process_route.code
            response.process_route_name = change.process_route.name
        return response
    
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
        
        response = ProcessRouteChangeResponse.model_validate(change)
        if change.process_route:
            response.process_route_code = change.process_route.code
            response.process_route_name = change.process_route.name
        return response
    
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
            response = ProcessRouteChangeResponse.model_validate(change)
            if change.process_route:
                response.process_route_code = change.process_route.code
                response.process_route_name = change.process_route.name
            items.append(response)
        
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
        
        response = ProcessRouteChangeResponse.model_validate(change)
        if change.process_route:
            response.process_route_code = change.process_route.code
            response.process_route_name = change.process_route.name
        return response
    
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
        
        if change.status != "pending":
            raise ValidationError(f"变更记录状态为 {change.status}，无法审批")
        
        # 更新审批信息
        change.status = "approved" if approved else "rejected"
        change.approver_id = approver_id
        if approval_comment:
            change.approval_comment = approval_comment
        
        await change.save()
        
        response = ProcessRouteChangeResponse.model_validate(change)
        if change.process_route:
            response.process_route_code = change.process_route.code
            response.process_route_name = change.process_route.name
        return response
    
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
        
        response = ProcessRouteChangeResponse.model_validate(change)
        if change.process_route:
            response.process_route_code = change.process_route.code
            response.process_route_name = change.process_route.name
        return response
    
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
