"""
审批流程服务模块

提供审批流程的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaioa.models.approval import ApprovalProcess
from apps.kuaioa.schemas.approval_process_schemas import (
    ApprovalProcessCreate, ApprovalProcessUpdate, ApprovalProcessResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ApprovalProcessService:
    """审批流程服务"""
    
    @staticmethod
    async def create_approvalprocess(
        tenant_id: int,
        data: ApprovalProcessCreate
    ) -> ApprovalProcessResponse:
        """
        创建审批流程
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            ApprovalProcessResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await ApprovalProcess.filter(
            tenant_id=tenant_id,
            process_no=data.process_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"流程编号 {data.process_no} 已存在")
        
        # 创建对象
        obj = await ApprovalProcess.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return ApprovalProcessResponse.model_validate(obj)
    
    @staticmethod
    async def get_approvalprocess_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> ApprovalProcessResponse:
        """
        根据UUID获取审批流程
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            ApprovalProcessResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ApprovalProcess.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"审批流程 {obj_uuid} 不存在")
        
        return ApprovalProcessResponse.model_validate(obj)
    
    @staticmethod
    async def list_approvalprocesss(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[ApprovalProcessResponse]:
        """
        获取审批流程列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[ApprovalProcessResponse]: 对象列表
        """
        query = ApprovalProcess.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [ApprovalProcessResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_approvalprocess(
        tenant_id: int,
        obj_uuid: str,
        data: ApprovalProcessUpdate
    ) -> ApprovalProcessResponse:
        """
        更新审批流程
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            ApprovalProcessResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ApprovalProcess.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"审批流程 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return ApprovalProcessResponse.model_validate(obj)
    
    @staticmethod
    async def delete_approvalprocess(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除审批流程（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ApprovalProcess.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"审批流程 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
